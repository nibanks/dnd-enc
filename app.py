from flask import Flask, render_template, request, jsonify, session
import json
import os
from pathlib import Path
import requests
from functools import lru_cache
import time
from bs4 import BeautifulSoup
import re
import logging
import secrets

app = Flask(__name__)
# Generate a secret key for sessions (regenerates on restart)
app.secret_key = secrets.token_hex(32)

# Suppress Flask auto-refresh logging for spectator view
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

DATA_DIR = Path("adventures")
DATA_DIR.mkdir(exist_ok=True)

CACHE_DIR = Path(".cache")
CACHE_DIR.mkdir(exist_ok=True)
MONSTERS_CACHE = CACHE_DIR / "monsters.json"
COOKIES_CACHE = CACHE_DIR / "cookies.json"
MONSTER_DETAILS_DIR = CACHE_DIR / "monsters"
MONSTER_DETAILS_DIR.mkdir(exist_ok=True)
IMAGES_CACHE_DIR = CACHE_DIR / "images"
IMAGES_CACHE_DIR.mkdir(exist_ok=True)

# Bundled monster index (committed to the repo). If the user doesn't have a
# local scraped cache yet, copy this in so they get a working library on
# first run instead of waiting minutes for a fresh scrape.
BUNDLED_MONSTERS = Path("data") / "monsters.json"
if not MONSTERS_CACHE.exists() and BUNDLED_MONSTERS.exists():
    try:
        import shutil
        shutil.copyfile(BUNDLED_MONSTERS, MONSTERS_CACHE)
        with open(MONSTERS_CACHE, 'r', encoding='utf-8') as _f:
            _bundle_count = len(json.load(_f))
        print(f"Bootstrapped {MONSTERS_CACHE} from bundled {BUNDLED_MONSTERS} ({_bundle_count} monsters)")
    except Exception as _e:
        print(f"Could not bootstrap monster cache from bundle: {_e}")

# Store D&D Beyond cookies
DNDBEYOND_COOKIES = {}


def parse_signed_int(text, default=None):
    """Parse an integer from text, tolerating Unicode minus/plus variants.

    D&D Beyond sometimes renders ability modifiers with the Unicode minus sign
    U+2212 ("−") or full-width plus/minus instead of ASCII "-"/"+", which
    trips up ``int()``. This helper normalizes those and ignores surrounding
    whitespace/parentheses. Returns ``default`` (or raises ``ValueError`` when
    ``default is None``) if no integer can be extracted.
    """
    if text is None:
        if default is not None:
            return default
        raise ValueError('Cannot parse int from None')
    # Normalize common Unicode sign variants to ASCII
    normalized = (
        str(text)
        .replace('\u2212', '-')   # minus sign
        .replace('\u2013', '-')   # en dash
        .replace('\u2014', '-')   # em dash
        .replace('\uff0b', '+')   # full-width plus
        .replace('\uff0d', '-')   # full-width hyphen-minus
        .strip()
        .strip('()')
        .strip()
    )
    match = re.match(r'^([+-]?\d+)', normalized)
    if not match:
        if default is not None:
            return default
        raise ValueError(f'Cannot parse int from {text!r}')
    return int(match.group(1))


def _is_valid_cookie_value(value):
    """A cookie value must be a string with no CR/LF/NUL (HTTP header safety)."""
    if not isinstance(value, str) or not value:
        return False
    return not any(ch in value for ch in ('\r', '\n', '\0'))


def parse_cookies_input(cookies_input):
    """Normalize any supported cookie input into a flat {name: value} dict.

    Accepts:
      - dict of {name: value}
      - list of {"name": ..., "value": ...} (Cookie-Editor / EditThisCookie JSON export)
      - str: either a Cookie-Editor JSON array, a JSON {name: value} object, or a
        browser ``document.cookie`` style ``name=value; name2=value2`` string.
      - dict with a single ``cookies`` key whose value is one of the above
        (covers malformed saves where the outer wrapper leaked through).

    Returns (cookies_dict, format_label). Raises ValueError on unparseable input.
    """
    # Unwrap a single {"cookies": ...} level if present (recover from bad saves)
    if isinstance(cookies_input, dict) and set(cookies_input.keys()) == {'cookies'}:
        cookies_input = cookies_input['cookies']

    if isinstance(cookies_input, str):
        stripped = cookies_input.strip()
        if not stripped:
            raise ValueError('Empty cookie input')
        # Try JSON first (Cookie-Editor array export or {name: value} object)
        if stripped[0] in '[{':
            try:
                cookies_input = json.loads(stripped)
            except json.JSONDecodeError as e:
                raise ValueError(f'Invalid JSON cookie input: {e}') from e
        else:
            # document.cookie style: "name1=value1; name2=value2"
            parsed = {}
            for part in stripped.split(';'):
                if '=' not in part:
                    continue
                name, _, value = part.partition('=')
                name = name.strip()
                value = value.strip()
                if name and _is_valid_cookie_value(value):
                    parsed[name] = value
            if not parsed:
                raise ValueError('Could not parse cookie string')
            return parsed, 'document.cookie string'

    if isinstance(cookies_input, list):
        parsed = {}
        for cookie in cookies_input:
            if not isinstance(cookie, dict):
                continue
            name = cookie.get('name')
            value = cookie.get('value')
            if isinstance(name, str) and _is_valid_cookie_value(value):
                parsed[name] = value
        if not parsed:
            raise ValueError('Cookie list contained no usable entries')
        return parsed, 'Cookie-Editor JSON array'

    if isinstance(cookies_input, dict):
        parsed = {k: v for k, v in cookies_input.items()
                  if isinstance(k, str) and _is_valid_cookie_value(v)}
        if not parsed:
            raise ValueError('Cookie dict contained no usable entries')
        return parsed, 'key-value dict'

    raise ValueError(f'Unsupported cookie input type: {type(cookies_input).__name__}')


# Load cookies from cache if available
if COOKIES_CACHE.exists():
    try:
        with open(COOKIES_CACHE, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        DNDBEYOND_COOKIES, fmt = parse_cookies_input(raw)
        print(f"Loaded {len(DNDBEYOND_COOKIES)} cookies from cache ({fmt})")
        # If the file was malformed, rewrite it in the clean shape
        if raw != DNDBEYOND_COOKIES:
            print("Migrating cookies.json to clean key-value format")
            with open(COOKIES_CACHE, 'w', encoding='utf-8') as f:
                json.dump(DNDBEYOND_COOKIES, f, indent=2)
    except Exception as e:
        print(f"Error loading cookies from {COOKIES_CACHE}: {e}")
        print("Ignoring cached cookies; re-import via Settings to fix.")
        DNDBEYOND_COOKIES = {}

def cache_avatar_image(avatar_url):
    """Download and cache an avatar image, return local path"""
    if not avatar_url:
        return None
    
    try:
        # Extract filename from URL (use hash for unique identification)
        import hashlib
        url_hash = hashlib.md5(avatar_url.encode()).hexdigest()
        
        # Get file extension from URL
        ext = '.jpeg'
        if '.png' in avatar_url.lower():
            ext = '.png'
        elif '.jpg' in avatar_url.lower():
            ext = '.jpg'
        elif '.webp' in avatar_url.lower():
            ext = '.webp'
        
        filename = f"{url_hash}{ext}"
        cache_path = IMAGES_CACHE_DIR / filename
        
        # Return local path if already cached (instant)
        if cache_path.exists():
            return f"/cached/images/{filename}"
        
        # Download the image
        print(f"  Downloading avatar: {avatar_url}")
        response = requests.get(avatar_url, timeout=10)
        
        if response.status_code == 200:
            with open(cache_path, 'wb') as f:
                f.write(response.content)
            print(f"  Cached avatar as: {filename}")
            return f"/cached/images/{filename}"
        else:
            print(f"  Failed to download avatar: HTTP {response.status_code}")
            return avatar_url  # Return original URL as fallback
            
    except Exception as e:
        print(f"  Error caching avatar: {e}")
        return avatar_url  # Return original URL as fallback

@app.route('/cached/images/<path:filename>')
def serve_cached_image(filename):
    """Serve cached avatar images"""
    from flask import send_from_directory
    return send_from_directory(IMAGES_CACHE_DIR, filename)

@app.route('/api/dndbeyond/set-cookies', methods=['POST'])
def set_dndbeyond_cookies():
    """Store D&D Beyond authentication cookies - accepts multiple formats"""
    global DNDBEYOND_COOKIES
    data = request.get_json(silent=True) or {}
    cookies_input = data.get('cookies', data)

    try:
        parsed, fmt = parse_cookies_input(cookies_input)
    except ValueError as e:
        print(f"Rejected cookie input: {e}")
        return jsonify({"success": False, "error": str(e)}), 400

    DNDBEYOND_COOKIES = parsed
    print(f"Detected {fmt} ({len(DNDBEYOND_COOKIES)} cookies)")

    with open(COOKIES_CACHE, 'w', encoding='utf-8') as f:
        json.dump(DNDBEYOND_COOKIES, f, indent=2)

    print(f"Stored {len(DNDBEYOND_COOKIES)} cookies and saved to cache")
    return jsonify({"success": True, "count": len(DNDBEYOND_COOKIES)})

@app.route('/api/dndbeyond/clear-cookies', methods=['POST'])
def clear_dndbeyond_cookies():
    """Clear stored cookies"""
    global DNDBEYOND_COOKIES
    DNDBEYOND_COOKIES = {}
    
    # Remove from file
    if COOKIES_CACHE.exists():
        COOKIES_CACHE.unlink()
    
    print("Cleared D&D Beyond cookies and cache file")
    return jsonify({"success": True})

@app.route('/api/dndbeyond/cookie-status', methods=['GET'])
def check_cookie_status():
    """Check if cookies are configured"""
    has_cookies = len(DNDBEYOND_COOKIES) > 0
    return jsonify({
        "success": True,
        "hasCookies": has_cookies,
        "cookieCount": len(DNDBEYOND_COOKIES)
    })

@app.route('/api/dndbeyond/monsters', methods=['GET'])
def get_dndbeyond_monsters():
    """Scrape monsters from D&D Beyond and cache them.

    Query params:
      cache_only=true  Return cached monsters immediately, or an empty list if
                       no cache exists. Never triggers a scrape. Useful for
                       pages that only need the library opportunistically (e.g.
                       the statistics page) and don't want to block on a 3+
                       minute first-time scrape.
    """
    cache_only = request.args.get('cache_only', '').lower() in ('1', 'true', 'yes')

    try:
        # Check if we have cached data and it's recent (less than 30 days old)
        if MONSTERS_CACHE.exists():
            cache_age = time.time() - MONSTERS_CACHE.stat().st_mtime
            if cache_age < 2592000:  # 30 days (60*60*24*30)
                print(f"Loading monsters from cache (age: {cache_age/86400:.1f} days)")
                with open(MONSTERS_CACHE, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                return jsonify({'success': True, 'monsters': cached_data, 'count': len(cached_data), 'cached': True})

        # No usable cache. If the caller explicitly opted out of a fresh
        # scrape, return an empty-but-successful payload immediately instead
        # of blocking for minutes.
        if cache_only:
            print("cache_only=true and no cached monsters - returning empty list")
            return jsonify({'success': True, 'monsters': {}, 'count': 0, 'cached': False, 'scraped': False})

        # Need to scrape - check if we have cookies
        if not DNDBEYOND_COOKIES:
            print("No cookies available for scraping")
            return jsonify({'success': False, 'error': 'No authentication cookies available'})
        
        print(f"Scraping monsters from D&D Beyond using {len(DNDBEYOND_COOKIES)} cookies...")
        
        all_monsters = {}
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        
        # D&D Beyond has about 173 pages of monsters (20 per page = ~3460 monsters)
        # We'll scrape all pages
        page = 1
        max_pages = 200  # Safety limit (actual is around 173)
        consecutive_empty = 0  # Track consecutive empty pages
        
        while page <= max_pages:
            url = 'https://www.dndbeyond.com/monsters'
            params = {
                'filter-partnered-content': 'f',  # Only official content
                'page': page
            }
            
            print(f"Scraping page {page}...")
            response = requests.get(url, params=params, headers=headers, cookies=DNDBEYOND_COOKIES, timeout=15)
            
            if response.status_code != 200:
                print(f"Page {page} returned status {response.status_code}")
                break
            
            # Save first page for debugging
            if page == 1:
                debug_file = CACHE_DIR / "monsters_page_debug.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"Saved debug HTML to {debug_file}")
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all monster list items using the data-slug attribute
            monster_items = soup.select('[data-slug][data-type="monsters"]')
            
            print(f"Found {len(monster_items)} items on page {page}")
            
            if not monster_items:
                consecutive_empty += 1
                if consecutive_empty >= 3:  # Stop after 3 empty pages
                    print(f"3 consecutive empty pages, stopping")
                    break
                page += 1
                continue
            else:
                consecutive_empty = 0
            
            for item in monster_items:
                try:
                    # Extract monster name from .monster-name .name a
                    name_elem = item.select_one('.monster-name .name a, .monster-name a')
                    if not name_elem:
                        continue
                    
                    name = name_elem.get_text(strip=True)
                    # Remove quotes if present
                    name = name.strip('"')
                    if not name:
                        continue
                    
                    # Check for legacy badge
                    is_legacy = False
                    badge_elem = item.select_one('.badge .badge-label#legacy-badge')
                    if badge_elem or name_elem.get('aria-describedby') == 'legacy-badge':
                        is_legacy = True
                    
                    # Extract URL from the same link
                    monster_url = name_elem.get('href')
                    if monster_url and monster_url.startswith('/'):
                        monster_url = f"https://www.dndbeyond.com{monster_url}"
                    else:
                        # Fallback: use data-slug
                        slug = item.get('data-slug', '')
                        monster_url = f"https://www.dndbeyond.com/monsters/{slug}"
                    
                    # Extract CR from .monster-challenge
                    cr_text = '0'
                    cr_elem = item.select_one('.monster-challenge span')
                    if cr_elem:
                        cr_text = cr_elem.get_text(strip=True)
                    
                    # Extract Type from .monster-type
                    monster_type = ''
                    type_elem = item.select_one('.monster-type .type')
                    if type_elem:
                        monster_type = type_elem.get_text(strip=True)
                    
                    # Extract Size from .monster-size
                    size = ''
                    size_elem = item.select_one('.monster-size span')
                    if size_elem:
                        size = size_elem.get_text(strip=True)
                    
                    # Extract Alignment from .monster-alignment
                    alignment = ''
                    align_elem = item.select_one('.monster-alignment span')
                    if align_elem:
                        alignment = align_elem.get_text(strip=True)
                    
                    # If this is a legacy monster and we already have a non-legacy version, skip it
                    if is_legacy and name in all_monsters and not all_monsters[name].get('isLegacy', False):
                        print(f"  Skipping legacy version of {name} (already have newer version)")
                        continue
                    
                    # If this is NOT legacy and we already have a legacy version, replace it
                    if not is_legacy and name in all_monsters and all_monsters[name].get('isLegacy', False):
                        print(f"  Replacing legacy version of {name} with newer version")
                    
                    all_monsters[name] = {
                        'cr': cr_text,
                        'type': monster_type,
                        'size': size,
                        'alignment': alignment,
                        'url': monster_url,
                        'isLegacy': is_legacy
                    }
                    
                except Exception as e:
                    print(f"Error parsing monster item: {e}")
                    continue
            
            # Move to next page
            page += 1
            
            # Add a small delay to be respectful to the server
            if page <= max_pages:
                time.sleep(0.3)  # 300ms between pages
        
        print(f"Scraped {len(all_monsters)} monsters total")
        
        if all_monsters:
            # Save to cache
            with open(MONSTERS_CACHE, 'w', encoding='utf-8') as f:
                json.dump(all_monsters, f, indent=2)
            print(f"Cached monsters to {MONSTERS_CACHE}")
            
            return jsonify({'success': True, 'monsters': all_monsters, 'count': len(all_monsters), 'cached': False})
        else:
            return jsonify({'success': False, 'error': 'No monsters found on page'})
    
    except Exception as e:
        print(f"Error scraping monsters: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/dndbeyond/character/<path:character_url>', methods=['GET'])
def get_character_details(character_url):
    """Fetch character stats from D&D Beyond API"""
    try:
        from urllib.parse import unquote
        character_url = unquote(character_url)
        
        # Extract character ID from URL
        # Formats: /profile/username/characters/ID or /characters/ID
        character_id = character_url.rstrip('/').split('/')[-1]
        
        print(f"Fetching character details for ID: {character_id}")
        
        # Check cache first
        cache_file = CACHE_DIR / "characters" / f"{character_id}.json"
        cache_file.parent.mkdir(exist_ok=True)
        
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # Check if cache is less than 1 hour old
            if 'timestamp' in cached_data:
                cache_age = time.time() - cached_data['timestamp']
                if cache_age < 3600:  # 1 hour
                    print(f"Using cached character data (age: {cache_age:.0f}s)")
                    
                    # Cache avatar image if present and not already a local path
                    if 'avatarUrl' in cached_data and cached_data['avatarUrl']:
                        if not cached_data['avatarUrl'].startswith('/cached/images/'):
                            cached_avatar = cache_avatar_image(cached_data['avatarUrl'])
                            if cached_avatar:
                                cached_data['avatarUrl'] = cached_avatar
                    
                    return jsonify(cached_data)
        
        # Call D&D Beyond character API
        api_url = f"https://character-service.dndbeyond.com/character/v5/character/{character_id}"
        params = {'includeCustomItems': 'true'}
        
        # Add headers to match browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.dndbeyond.com',
            'Referer': 'https://www.dndbeyond.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
        }
        
        print(f"Calling D&D Beyond API: {api_url}")
        response = requests.get(api_url, params=params, headers=headers, cookies=DNDBEYOND_COOKIES, timeout=10)
        response.raise_for_status()
        
        api_data = response.json()
        
        if not api_data.get('success'):
            return jsonify({'success': False, 'error': 'API returned unsuccessful response'})
        
        char_data = api_data.get('data', {})
        
        # Extract ability scores (stats array has IDs 1-6 for STR/DEX/CON/INT/WIS/CHA)
        stats = {stat['id']: stat['value'] for stat in char_data.get('stats', [])}
        abilities = {
            'str': stats.get(1, 10),
            'dex': stats.get(2, 10),
            'con': stats.get(3, 10),
            'int': stats.get(4, 10),
            'wis': stats.get(5, 10),
            'cha': stats.get(6, 10)
        }
        
        # Calculate ability modifiers
        def calc_modifier(score):
            return (score - 10) // 2
        
        ability_mods = {k: calc_modifier(v) for k, v in abilities.items()}
        
        # Get character classes
        classes = []
        for cls in char_data.get('classes', []):
            class_def = cls.get('definition', {})
            classes.append({
                'name': class_def.get('name', 'Unknown'),
                'level': cls.get('level', 1)
            })
        
        # Calculate total level
        total_level = sum(c['level'] for c in classes)
        
        # Get race
        race_def = char_data.get('race', {}).get('baseRaceName', '')
        if not race_def:
            race_def = char_data.get('race', {}).get('fullName', 'Unknown')
        
        # Calculate AC (from bonusStats and modifiers)
        ac = 10 + ability_mods['dex']  # Base AC
        # TODO: Add armor/shield bonuses from inventory
        
        # Get HP
        base_hp = char_data.get('baseHitPoints', 0)
        bonus_hp = char_data.get('bonusHitPoints', 0) or 0
        override_hp = char_data.get('overrideHitPoints')
        max_hp = override_hp if override_hp else (base_hp + bonus_hp)
        current_hp = max_hp - char_data.get('removedHitPoints', 0)
        
        # Get speed
        speed = char_data.get('race', {}).get('weightSpeeds', {}).get('normal', {}).get('walk', 30)
        
        # Calculate initiative (DEX modifier)
        initiative = ability_mods['dex']
        
        # Calculate passive perception (10 + WIS mod + proficiency if proficient)
        proficiency_bonus = 2 + (total_level - 1) // 4
        passive_perception = 10 + ability_mods['wis']
        # TODO: Add proficiency if skilled in Perception
        
        # Extract avatar URL
        avatar_url = None
        decorations = char_data.get('decorations', {})
        if decorations:
            # Try avatarUrl field
            avatar_url = decorations.get('avatarUrl')
            # If not found, try themeColor with avatar construction
            if not avatar_url and decorations.get('avatarId'):
                avatar_id = decorations.get('avatarId')
                # D&D Beyond avatar URL pattern
                avatar_url = f"https://www.dndbeyond.com/avatars/{avatar_id}/avatar.jpg"
        
        # Fallback to checking if there's a direct avatarUrl in character data
        if not avatar_url:
            avatar_url = char_data.get('avatarUrl')
        
        if avatar_url:
            print(f"  Found character avatar: {avatar_url}")
            # Cache the avatar image locally
            cached_avatar = cache_avatar_image(avatar_url)
            avatar_url = cached_avatar if cached_avatar else avatar_url
        
        # Build character details
        character_details = {
            'success': True,
            'name': char_data.get('name', 'Unknown'),
            'race': race_def,
            'classes': classes,
            'level': total_level,
            'abilities': abilities,
            'ability_modifiers': ability_mods,
            'ac': ac,
            'hp': {'current': current_hp, 'max': max_hp, 'temp': char_data.get('temporaryHitPoints', 0)},
            'speed': speed,
            'initiative': initiative,
            'passive_perception': passive_perception,
            'proficiency_bonus': proficiency_bonus,
            'avatarUrl': avatar_url,
            'timestamp': time.time()
        }
        
        # Cache the result
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(character_details, f, indent=2)
        
        print(f"Successfully fetched character: {character_details['name']}")
        return jsonify(character_details)
    
    except Exception as e:
        print(f"Error in character endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/dndbeyond/character-old/<path:character_url>', methods=['GET'])
def get_character_details_old(character_url):
    """Fetch detailed character stats from D&D Beyond character sheet"""
    try:
        # Decode the URL-encoded path
        from urllib.parse import unquote
        character_url = unquote(character_url)
        
        # Ensure URL is properly formatted
        if not character_url.startswith('http'):
            # If it looks like profile/username/characters/id or characters/id
            if '/' in character_url:
                if character_url.startswith('profile/') or character_url.startswith('characters/'):
                    character_url = f"https://www.dndbeyond.com/{character_url}"
                else:
                    # Assume it's username/characters/id format
                    character_url = f"https://www.dndbeyond.com/profile/{character_url}"
            else:
                # Just a character ID
                character_url = f"https://www.dndbeyond.com/characters/{character_url}"
        
        print(f"Fetching character details from: {character_url}")
        
        # Generate cache filename from character ID
        character_id = character_url.split('/')[-1]  # Get last part of URL
        cache_file = CACHE_DIR / "characters" / f"{character_id}.json"
        cache_file.parent.mkdir(exist_ok=True)
        
        # Check cache first
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # Check if cache is less than 1 day old (characters change more often than monsters)
            if 'timestamp' in cached_data:
                cache_age = time.time() - cached_data['timestamp']
                if cache_age < 86400:  # 24 hours in seconds
                    print(f"Returning cached details for {character_id} (age: {cache_age/3600:.1f} hours)")
                    return jsonify({'success': True, 'details': cached_data.get('data', {}), 'cached': True})
        
        # Need to scrape
        if not DNDBEYOND_COOKIES:
            print("No cookies available for fetching character details")
            return jsonify({'success': False, 'error': 'No authentication cookies available'})
        
        print(f"Scraping character page with {len(DNDBEYOND_COOKIES)} cookies...")
        
        # Use a session to properly handle cookies
        session = requests.Session()
        
        # Add all cookies to the session
        for cookie_name, cookie_value in DNDBEYOND_COOKIES.items():
            session.cookies.set(cookie_name, cookie_value, domain='.dndbeyond.com')
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        
        response = session.get(character_url, headers=headers, timeout=15, allow_redirects=True)
        
        if response.status_code != 200:
            error_msg = f'HTTP {response.status_code}'
            print(f"Failed to fetch character page: {error_msg}")
            return jsonify({'success': False, 'error': error_msg})
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Save debug HTML for first character fetch
        debug_file = CACHE_DIR / f"character_debug_{character_id}.html"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(response.text)
        print(f"Saved debug HTML to {debug_file}")
        
        details = {}
        
        # Extract character name
        name_elem = soup.select_one('.ddbc-character-name')
        if name_elem:
            details['name'] = name_elem.get_text(strip=True)
            print(f"  Found character name: {details['name']}")
        
        # Extract race/class/level from character summary
        summary_elem = soup.select_one('.ddbc-character-summary__classes')
        if summary_elem:
            summary_text = summary_elem.get_text(strip=True)
            details['summary'] = summary_text  # e.g., "Level 1 Tiefling Rogue"
            print(f"  Found summary: {summary_text}")
        
        # Extract ability scores from the stat block
        ability_names = ['str', 'dex', 'con', 'int', 'wis', 'cha']
        details['abilities'] = {}
        
        for ability in ability_names:
            ability_elem = soup.select_one(f'.ddbc-ability-summary--{ability}')
            if ability_elem:
                score_elem = ability_elem.select_one('.ddbc-ability-summary__primary')
                modifier_elem = ability_elem.select_one('.ddbc-ability-summary__secondary')
                
                if score_elem and modifier_elem:
                    score = parse_signed_int(score_elem.get_text(strip=True), default=0)
                    modifier = parse_signed_int(modifier_elem.get_text(strip=True), default=0)
                    
                    details['abilities'][ability] = {
                        'score': score,
                        'modifier': modifier
                    }
        
        if details['abilities']:
            print(f"  Found {len(details['abilities'])} ability scores")
        
        # Extract AC from character summary
        ac_elem = soup.select_one('.ddbc-armor-class-box__value')
        if ac_elem:
            ac_text = ac_elem.get_text(strip=True)
            ac_match = re.search(r'(\d+)', ac_text)
            if ac_match:
                details['ac'] = int(ac_match.group(1))
                print(f"  Found AC: {details['ac']}")
        
        # Extract HP from character summary  
        hp_elem = soup.select_one('.ddbc-health-summary__hp-number')
        if hp_elem:
            hp_text = hp_elem.get_text(strip=True)
            hp_match = re.search(r'(\d+)', hp_text)
            if hp_match:
                details['hp'] = int(hp_match.group(1))
                details['maxHp'] = details['hp']  # Current max HP
                print(f"  Found HP: {details['hp']}")
        
        # Extract Speed
        speed_elem = soup.select_one('.ddbc-speed-box__value')
        if speed_elem:
            speed_text = speed_elem.get_text(strip=True)
            speed_match = re.search(r'(\d+)', speed_text)
            if speed_match:
                details['speed'] = int(speed_match.group(1))
                print(f"  Found Speed: {details['speed']}")
        
        # Extract Initiative Bonus
        init_elem = soup.select_one('.ddbc-initiative-box__value')
        if init_elem:
            init_text = init_elem.get_text(strip=True)
            init_match = re.search(r'([+-]?\d+)', init_text)
            if init_match:
                details['initiativeBonus'] = int(init_match.group(1))
                print(f"  Found Initiative: {details['initiativeBonus']}")
        
        # Extract Passive Perception
        pp_elem = soup.select_one('.ddbc-passive-perception-box__value')
        if pp_elem:
            pp_text = pp_elem.get_text(strip=True)
            pp_match = re.search(r'(\d+)', pp_text)
            if pp_match:
                details['passivePerception'] = int(pp_match.group(1))
                print(f"  Found Passive Perception: {details['passivePerception']}")
            if pp_match:
                details['passivePerception'] = int(pp_match.group(1))
        
        # Extract Skills
        skills = []
        skill_items = soup.select('.ddbc-skills-list__item')
        for item in skill_items:
            skill_name_elem = item.select_one('.ddbc-skills-list__label')
            skill_bonus_elem = item.select_one('.ddbc-skills-list__value')
            
            if skill_name_elem and skill_bonus_elem:
                skill_name = skill_name_elem.get_text(strip=True)
                skill_bonus = skill_bonus_elem.get_text(strip=True)
                skills.append(f"{skill_name} {skill_bonus}")
        
        if skills:
            details['skills'] = ', '.join(skills)
        
        # Extract Saving Throws
        saves = []
        save_items = soup.select('.ddbc-saving-throws-summary__ability')
        for item in save_items:
            save_name_elem = item.select_one('.ddbc-saving-throws-summary__ability-name')
            save_bonus_elem = item.select_one('.ddbc-saving-throws-summary__ability-modifier')
            
            if save_name_elem and save_bonus_elem:
                save_name = save_name_elem.get_text(strip=True).upper()[:3]
                save_bonus = save_bonus_elem.get_text(strip=True)
                saves.append(f"{save_name} {save_bonus}")
        
        if saves:
            details['savingThrows'] = ', '.join(saves)
        
        # Extract Proficiencies
        prof_elems = soup.select('.ddbc-proficiency-groups__item')
        proficiencies = {}
        for elem in prof_elems:
            prof_label = elem.select_one('.ddbc-proficiency-groups__label')
            prof_list = elem.select_one('.ddbc-proficiency-groups__list')
            
            if prof_label and prof_list:
                label = prof_label.get_text(strip=True).rstrip(':')
                items = prof_list.get_text(strip=True)
                proficiencies[label] = items
        
        if proficiencies:
            details['proficiencies'] = proficiencies
            print(f"  Found {len(proficiencies)} proficiency categories")
        
        # Extract Features & Traits
        features = []
        feature_items = soup.select('.ddbc-feature-list__item, .ct-feature-snippet')
        for item in feature_items[:10]:  # Limit to first 10 features to avoid too much data
            name_elem = item.select_one('.ddbc-feature-list__item-name, .ct-feature-snippet__heading')
            desc_elem = item.select_one('.ddbc-feature-list__item-description, .ct-feature-snippet__content')
            
            if name_elem:
                name = name_elem.get_text(strip=True)
                description = desc_elem.get_text(strip=True) if desc_elem else ''
                # Truncate long descriptions
                if len(description) > 200:
                    description = description[:200] + '...'
                features.append({'name': name, 'description': description})
        
        if features:
            details['features'] = features
            print(f"  Found {len(features)} features")
        
        print(f"Extracted character details with {len(details)} fields: {list(details.keys())}")
        
        # Cache the details
        cache_data = {
            'url': character_url,
            'data': details,
            'timestamp': time.time()
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"Cached to {cache_file}")
        
        return jsonify({'success': True, 'details': details, 'cached': False})
    
    except Exception as e:
        print(f"Error fetching character details: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/dndbeyond/monster/search/<monster_name>', methods=['GET'])
def search_monster_by_name(monster_name):
    """Search for a monster by name in the cached monsters dictionary"""
    try:
        from urllib.parse import unquote
        monster_name = unquote(monster_name).strip()
        
        print(f"Searching for monster: {monster_name}")
        
        # Check if monsters are cached
        if not MONSTERS_CACHE.exists():
            return jsonify({'success': False, 'error': 'Monster list not loaded. Please load monsters first.'})
        
        # Load monsters from cache (stored as dict with name as key)
        with open(MONSTERS_CACHE, 'r', encoding='utf-8') as f:
            all_monsters = json.load(f)
        
        # Search for exact match (case-insensitive)
        for name, monster_data in all_monsters.items():
            if name.lower() == monster_name.lower():
                print(f"Found monster: {name} -> {monster_data['url']}")
                
                # Also fetch full details if possible
                monster_url = monster_data['url']
                monster_id = monster_url.split('/')[-1]
                details_cache = MONSTER_DETAILS_DIR / f"{monster_id}.json"
                
                details = None
                if details_cache.exists():
                    with open(details_cache, 'r', encoding='utf-8') as f:
                        details = json.load(f)
                    print(f"Found cached details for {name}")
                
                return jsonify({
                    'success': True,
                    'url': monster_data['url'],
                    'name': name,
                    'cr': monster_data.get('cr'),
                    'type': monster_data.get('type'),
                    'size': monster_data.get('size'),
                    'alignment': monster_data.get('alignment'),
                    'id': monster_id,
                    'details': details
                })
        
        # No exact match found
        print(f"Monster '{monster_name}' not found. Available monsters sample: {list(all_monsters.keys())[:5]}")
        return jsonify({'success': False, 'error': f'Monster "{monster_name}" not found in cached list'})
        
    except Exception as e:
        print(f"Error searching for monster: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/dndbeyond/monster/<path:monster_url>', methods=['GET'])
def get_monster_details(monster_url):
    """Fetch detailed monster stats from D&D Beyond (JIT)"""
    import time
    start_time = time.time()
    try:
        # Decode the URL-encoded path
        from urllib.parse import unquote
        monster_url = unquote(monster_url)
        
        # Ensure URL is properly formatted
        if not monster_url.startswith('http'):
            # If it's a short form, add the full monsters prefix
            if not monster_url.startswith('monsters/'):
                monster_url = f"https://www.dndbeyond.com/monsters/{monster_url}"
            else:
                monster_url = f"https://www.dndbeyond.com/{monster_url}"
        
        print(f"Fetching monster details from: {monster_url}")
        
        # Generate cache filename from monster ID
        monster_id = monster_url.split('/')[-1]  # e.g., "16835-cultist"
        cache_file = MONSTER_DETAILS_DIR / f"{monster_id}.json"
        
        # Check cache first
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # Check if cache is less than 30 days old
            if 'timestamp' in cached_data:
                cache_age = time.time() - cached_data['timestamp']
                if cache_age < 2592000:  # 30 days in seconds
                    cache_read_time = time.time()
                    print(f"Returning cached details for {monster_id} (age: {cache_age/86400:.1f} days) [cache read: {(cache_read_time - start_time)*1000:.0f}ms]")
                    details = cached_data.get('data', {})
                    
                    # Cache avatar image if present and not already a local path (disabled for bulk processing)
                    # if 'avatarUrl' in details and details['avatarUrl']:
                    #     if not details['avatarUrl'].startswith('/cached/images/'):
                    #         avatar_cache_start = time.time()
                    #         cached_avatar = cache_avatar_image(details['avatarUrl'])
                    #         avatar_cache_time = time.time()
                    #         print(f"  Avatar caching took: {(avatar_cache_time - avatar_cache_start)*1000:.0f}ms")
                    #         if cached_avatar:
                    #             details['avatarUrl'] = cached_avatar
                    
                    total_time = time.time() - start_time
                    print(f"  TOTAL response time: {total_time*1000:.0f}ms")
                    return jsonify({'success': True, 'details': details, 'cached': True})
                else:
                    print(f"Cache expired for {monster_id} (age: {cache_age/86400:.1f} days)")
        
        # Need to scrape
        # Use a session to properly handle cookies and redirects
        session = requests.Session()
        
        # Try to establish session like a browser: visit homepage first
        print(f"Establishing session - visiting D&D Beyond homepage first...")
        
        # Add cookies if we have them
        if DNDBEYOND_COOKIES:
            for cookie_name, cookie_value in DNDBEYOND_COOKIES.items():
                session.cookies.set(cookie_name, cookie_value, domain='.dndbeyond.com')
            print(f"  Loaded {len(DNDBEYOND_COOKIES)} cookies from cache")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Priority': 'u=0, i',
            'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Visit homepage first to establish session (like a browser would)
        try:
            homepage_response = session.get('https://www.dndbeyond.com/', headers=headers, timeout=10)
            print(f"  Homepage: Status {homepage_response.status_code}")
            print(f"  Session now has {len(session.cookies)} cookies")
        except Exception as e:
            print(f"  Warning: Homepage visit failed: {e}")
        
        # Update headers to include Referer (showing we came from D&D Beyond)
        headers['Referer'] = 'https://www.dndbeyond.com/'
        headers['Sec-Fetch-Site'] = 'same-origin'
        
        # Now try to fetch the monster page with the established session
        print(f"\n{'='*80}")
        print(f"FETCHING: {monster_url}")
        print(f"Session cookies: {len(session.cookies)}")
        print(f"{'='*80}")
        
        response = session.get(monster_url, headers=headers, timeout=15, allow_redirects=True)
        
        # Diagnostic output
        print(f"  Status Code: {response.status_code}")
        print(f"  Final URL: {response.url}")
        print(f"  Content-Encoding: {response.headers.get('Content-Encoding', 'none')}")
        print(f"  Content-Type: {response.headers.get('Content-Type', 'none')}")
        print(f"  Content-Length: {len(response.content)} bytes")
        
        # Ensure content is decoded properly
        response.encoding = response.apparent_encoding or 'utf-8'
        
        if response.status_code != 200:
            error_msg = f'HTTP {response.status_code}'
            print(f"  ❌ ERROR: {error_msg}")
            return jsonify({'success': False, 'error': error_msg})
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check if we got redirected to marketplace or got an invalid page
        page_title = soup.find('title')
        if page_title:
            title_text = page_title.get_text().lower()
            print(f"  Page Title: '{title_text}'")
            # Check for various error/redirect indicators
            if 'shop' in title_text or 'marketplace' in title_text:
                error_msg = 'Monster page redirected to marketplace - may not be accessible'
                print(f"  ❌ REDIRECT ERROR: {error_msg}")
                print(f"  💡 This usually means cookies are expired or invalid")
                # Save error to cache to avoid repeated attempts
                cache_data = {
                    'url': monster_url,
                    'data': {},
                    'error': error_msg,
                    'timestamp': time.time()
                }
                with open(cache_file, 'w') as f:
                    json.dump(cache_data, f)
                return jsonify({'success': False, 'error': error_msg, 'auth_failed': True})
        
        # Check for main stat blocks to verify we got a valid monster page
        stat_block_2014 = soup.find('div', class_='mon-stat-block')
        stat_block_2024 = soup.find('div', class_='mon-stat-block-2024')
        
        if stat_block_2014:
            print(f"  ✓ Found 2014 format stat block")
        if stat_block_2024:
            print(f"  ✓ Found 2024 format stat block")
        
        if not stat_block_2014 and not stat_block_2024:
            print(f"  ⚠️  WARNING: No stat block found in page")
        
        details = {}
        
        # Mark new format version
        details['formatVersion'] = 2
        
        # Check for legacy badge on the monster details page
        is_legacy = False
        legacy_badge = soup.select_one('.badge .badge-label#legacy-badge, [aria-label="legacy"]')
        if legacy_badge:
            is_legacy = True
            print(f"  Detected LEGACY monster")
        
        details['isLegacy'] = is_legacy
        
        # Helper function to normalize Unicode characters to ASCII equivalents
        def normalize_text(text):
            """Replace Unicode characters with ASCII equivalents and fix missing spaces"""
            if not text:
                return text
            # Replace curly quotes
            text = text.replace('\u2018', "'")  # Left single quote
            text = text.replace('\u2019', "'")  # Right single quote
            text = text.replace('\u201c', '"')  # Left double quote
            text = text.replace('\u201d', '"')  # Right double quote
            # Replace dashes
            text = text.replace('\u2013', '-')  # En dash
            text = text.replace('\u2014', '-')  # Em dash
            # Replace other common characters
            text = text.replace('\u2026', '...')  # Ellipsis
            
            # Fix common missing spaces between words
            # Handle lowercase followed by uppercase (camelCase)
            text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
            
            # Fix missing spaces around numbers (while preserving dice notation and D20 system references)
            # First, protect dice notation and D20 references
            text = re.sub(r'(\d+)d(\d+)', r'\1‡DICE‡\2', text, flags=re.I)  # Protect XdY dice notation
            text = re.sub(r'([^a-z]|^)(D)(\d+)', r'\1\2‡NUM‡\3', text, flags=re.I)  # Protect D20, D10, etc. (uppercase D + number)
            # Protect ordinal numbers (1st, 2nd, 3rd, 4th, etc.)
            text = re.sub(r'(\d+)(st|nd|rd|th)', r'\1‡ORD‡\2', text, flags=re.I)  # Protect 1st, 2nd, 3rd, etc.
            # Now add spaces between letters and digits (but not between D and ‡NUM‡)
            text = re.sub(r'([a-z])(\d)', r'\1 \2', text, flags=re.I)  # letter followed by digit
            text = re.sub(r'(\d)([a-z])', r'\1 \2', text, flags=re.I)  # digit followed by letter
            # Restore protected patterns (may have spaces around markers now)
            text = re.sub(r'(\d+)\s*‡DICE‡\s*(\d+)', r'\1d\2', text)
            text = re.sub(r'(D)\s*‡NUM‡\s*(\d+)', r'\1\2', text, flags=re.I)
            text = re.sub(r'(\d+)\s*‡ORD‡\s*(st|nd|rd|th)', r'\1\2', text, flags=re.I)
            
            # Fix missing space after colons (but not in time formats like "5:30" or URLs)
            # Handle :The, :DC, :any, etc.
            text = re.sub(r':([A-Z][a-z])', r': \1', text)  # :The → : The
            text = re.sub(r':([A-Z]{2,})', r': \1', text)  # :DC → : DC
            text = re.sub(r':(\d+\()', r': \1', text)  # :7(1d6) → : 7(1d6)
            text = re.sub(r':\+(\d+)', r': +\1', text)  # :+6 → : +6
            
            # Fix missing space after commas in certain contexts
            text = re.sub(r',\+(\d+)', r', +\1', text)  # DC 14,+6 → DC 14, +6
            
            # Fix specific D&D Beyond text concatenation issues
            # These need to be done carefully to avoid breaking valid compound words
            text = re.sub(r'Pointsgained', 'Points gained', text)
            text = re.sub(r'Pointsrequired', 'Points required', text)
            text = re.sub(r'Concentrationor', 'Concentration or', text)
            text = re.sub(r'Concentrationand', 'Concentration and', text)
            text = re.sub(r'Concentrationuntil', 'Concentration until', text)
            text = re.sub(r'Hitsgained', 'Hits gained', text)
            text = re.sub(r'hasDisadvantageon', 'has Disadvantage on', text)
            text = re.sub(r'Disadvantageon', 'Disadvantage on', text)
            text = re.sub(r'hasAdvantageon', 'has Advantage on', text)
            text = re.sub(r'Advantageon', 'Advantage on', text)
            text = re.sub(r'WhileBloodied', 'While Bloodied', text)
            text = re.sub(r'creatureGrappledby', 'creature Grappled by', text)
            
            # Fix missing space before parentheses in certain contexts
            text = re.sub(r'(\w)\(Recharge', r'\1 (Recharge', text)  # Lightning Breath(Recharge → Lightning Breath (Recharge
            text = re.sub(r'(\w)\(Costs', r'\1 (Costs', text)  # Action(Costs → Action (Costs
            
            # Fix "being" + condition concatenations
            text = re.sub(r'beingcharmed', 'being charmed', text, flags=re.I)
            text = re.sub(r'beingfrightened', 'being frightened', text, flags=re.I)
            text = re.sub(r'beingpoisoned', 'being poisoned', text, flags=re.I)
            text = re.sub(r'beingparalyzed', 'being paralyzed', text, flags=re.I)
            text = re.sub(r'beingstunned', 'being stunned', text, flags=re.I)
            text = re.sub(r'beingrestrained', 'being restrained', text, flags=re.I)
            text = re.sub(r'beinggrappled', 'being grappled', text, flags=re.I)
            text = re.sub(r'beingblinded', 'being blinded', text, flags=re.I)
            text = re.sub(r'beingdeafened', 'being deafened', text, flags=re.I)
            text = re.sub(r'beingincapacitated', 'being incapacitated', text, flags=re.I)
            text = re.sub(r'beingpetrified', 'being petrified', text, flags=re.I)
            text = re.sub(r'beinginvisible', 'being invisible', text, flags=re.I)
            text = re.sub(r'beingprone', 'being prone', text, flags=re.I)
            
            # Fix "the" + condition concatenations
            text = re.sub(r'thePoisoned', 'the Poisoned', text)
            text = re.sub(r'theCharmed', 'the Charmed', text)
            text = re.sub(r'theFrightened', 'the Frightened', text)
            text = re.sub(r'theParalyzed', 'the Paralyzed', text)
            text = re.sub(r'theStunned', 'the Stunned', text)
            text = re.sub(r'theRestrained', 'the Restrained', text)
            text = re.sub(r'theGrappled', 'the Grappled', text)
            text = re.sub(r'theBlinded', 'the Blinded', text)
            text = re.sub(r'theDeafened', 'the Deafened', text)
            text = re.sub(r'theIncapacitated', 'the Incapacitated', text)
            text = re.sub(r'thePetrified', 'the Petrified', text)
            text = re.sub(r'theInvisible', 'the Invisible', text)
            text = re.sub(r'theProne', 'the Prone', text)
            
            # Fix condition names with "condition" suffix
            text = re.sub(r'Incapacitatedcondition', 'Incapacitated condition', text)
            text = re.sub(r'Deafenedcondition', 'Deafened condition', text) 
            text = re.sub(r'Blindedcondition', 'Blinded condition', text)
            text = re.sub(r'Pronecon dition', 'Prone condition', text)
            text = re.sub(r'Stunnedcondition', 'Stunned condition', text)
            text = re.sub(r'Paralyzedcondition', 'Paralyzed condition', text)
            text = re.sub(r'Frightenedcondition', 'Frightened condition', text)
            text = re.sub(r'Restrainedcondition', 'Restrained condition', text)
            text = re.sub(r'Grappledcondition', 'Grappled condition', text)
            text = re.sub(r'Poisonedcondition', 'Poisoned condition', text)
            text = re.sub(r'Charmedcondition', 'Charmed condition', text)
            text = re.sub(r'Invisiblecondition', 'Invisible condition', text)
            text = re.sub(r'Exhaustioncondition', 'Exhaustion condition', text)
            text = re.sub(r'Petrifiedcondition', 'Petrified condition', text)
            
            # Generic fix for "word+gained/required/until" patterns (but avoid "on" as it breaks words like Dragon, action, Poison)
            text = re.sub(r'([a-z])gained\b', r'\1 gained', text, flags=re.I)
            text = re.sub(r'([a-z])required\b', r'\1 required', text, flags=re.I)
            text = re.sub(r'([a-z])until\b', r'\1 until', text, flags=re.I)
            
            # Fix space before opening parenthesis when missing
            text = re.sub(r'([a-zA-Z])\(', r'\1 (', text)
            
            return text
        
        # Helper function to parse action descriptions into structured data
        def parse_action(name, description):
            """Parse action description into structured fields.
            
            Returns dict with structured fields if parseable, or None for special actions.
            Description is NOT stored - all info should be regeneratable from structured fields.
            """
            action = {'name': name}
            
            # Check for dual-mode (Melee or Ranged) - handle "orRanged" without space
            if re.search(r'Melee\s*or\s*Ranged\s+Weapon\s+Attack', description, re.I):
                # Will be split into two separate actions by caller
                action['isDualMode'] = True
                action['_originalDescription'] = description  # Temporarily store for splitting
                return action
            
            # Check for Melee Weapon Attack
            if re.search(r'Melee\s+Weapon\s+Attack', description, re.I):
                action['type'] = 'Melee Weapon Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*to\s+hit', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract reach
                reach_match = re.search(r'reach\s+(\d+)\s*ft', description, re.I)
                if reach_match:
                    action['reach'] = f"{reach_match.group(1)} ft."
                
                # Extract targets
                target_match = re.search(r'(one|two|three|\d+)\s+target', description, re.I)
                if target_match:
                    action['targets'] = target_match.group(1)
                
                # Extract damage - handle multiple damage types
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)', description)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    
                    # Check for additional damage ("plus X (YdZ) type damage")
                    plus_damage = re.search(r'plus\s+(\d+)\s*\(([^)]+)\)\s*(\w+)\s+damage', description, re.I)
                    if plus_damage:
                        action['damage2'] = f"{plus_damage.group(1)} ({plus_damage.group(2)}) {plus_damage.group(3)}"
                        
                        # Extract extra text after the second damage (if present)
                        extra_start_pos = plus_damage.end()
                        extra_text = description[extra_start_pos:].strip('. \t\n')
                        if extra_text and len(extra_text) > 0:
                            action['extra'] = extra_text
                    else:
                        # Check for alternative damage (e.g., two-handed)
                        alt_damage = re.search(r'or\s+(\d+)\s*\(([^)]+)\)\s*(\w+)\s+damage\s+if\s+used\s+with\s+two\s+hands', description, re.I)
                        if alt_damage:
                            action['damage2'] = f"{alt_damage.group(1)} ({alt_damage.group(2)}) {alt_damage.group(3)} if used with two hands"
                        else:
                            # No second damage, extract extra text after first damage
                            first_damage_match = re.search(r'Hit:\s*\d+\s*\([^)]+\)\s*\w+\s+damage', description, re.I)
                            if first_damage_match:
                                extra_start_pos = first_damage_match.end()
                                extra_text = description[extra_start_pos:].strip('. \t\n')
                                if extra_text and len(extra_text) > 0:
                                    action['extra'] = extra_text
                
                return action
            
            # Check for Melee Spell Attack (similar to Melee Weapon Attack)
            if re.search(r'Melee\s+Spell\s+Attack', description, re.I):
                action['type'] = 'Melee Spell Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*to\s+hit', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract reach
                reach_match = re.search(r'reach\s+(\d+)\s*ft', description, re.I)
                if reach_match:
                    action['reach'] = f"{reach_match.group(1)} ft."
                
                # Extract targets
                target_match = re.search(r'(one|two|three|\d+)\s+(target|creature)', description, re.I)
                if target_match:
                    action['targets'] = target_match.group(1)
                
                # Extract damage
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)', description)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    
                    # Extract extra text after damage
                    first_damage_match = re.search(r'Hit:\s*\d+\s*\([^)]+\)\s*\w+\s+damage', description, re.I)
                    if first_damage_match:
                        extra_start_pos = first_damage_match.end()
                        extra_text = description[extra_start_pos:].strip('. \t\n')
                        if extra_text and len(extra_text) > 0:
                            action['extra'] = extra_text
                
                return action
            
            # Check for Ranged Weapon Attack
            if re.search(r'Ranged\s+Weapon\s+Attack', description, re.I):
                action['type'] = 'Ranged Weapon Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*to\s+hit', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract range - handle both "range X/Y ft" and "ranged X ft./Y ft."
                range_match = re.search(r'ranged?\s+(\d+)\s*(?:ft\.?)?\s*/\s*(\d+)\s*ft', description, re.I)
                if range_match:
                    action['range'] = f"{range_match.group(1)}/{range_match.group(2)} ft."
                
                # Extract targets
                target_match = re.search(r'(one|two|three|\d+)\s+target', description, re.I)
                if target_match:
                    action['targets'] = target_match.group(1)
                
                # Extract damage and any additional effect text
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)(.*)$', description, re.DOTALL)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    # Capture any additional text after damage type (e.g., "of a type chosen by...")
                    extra_text = damage_match.group(4).strip()
                    if extra_text and not extra_text.startswith('.'):
                        action['extra'] = extra_text.lstrip(',. ')
                
                return action
            
            # Check for Ranged Spell Attack (similar to Ranged Weapon Attack)
            if re.search(r'Ranged\s+Spell\s+Attack', description, re.I):
                action['type'] = 'Ranged Spell Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*to\s+hit', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract range
                range_match = re.search(r'ranged?\s+(\d+)\s*(?:ft\.?)?\s*/\s*(\d+)\s*ft', description, re.I)
                if range_match:
                    action['range'] = f"{range_match.group(1)}/{range_match.group(2)} ft."
                
                # Extract targets
                target_match = re.search(r'(one|two|three|\d+)\s+(target|creature)', description, re.I)
                if target_match:
                    action['targets'] = target_match.group(1)
                
                # Extract damage
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)(.*)$', description, re.DOTALL)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    # Capture any additional text after damage type
                    extra_text = damage_match.group(4).strip()
                    if extra_text and not extra_text.startswith('.'):
                        action['extra'] = extra_text.lstrip(',. ')
                
                return action
            
            # Check for Melee Attack (2024 format)
            if re.search(r'Melee\s+Attack\s+Roll', description, re.I):
                action['type'] = 'Melee Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*,\s*reach', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract reach
                reach_match = re.search(r'reach\s+(\d+)\s*ft', description, re.I)
                if reach_match:
                    action['reach'] = f"{reach_match.group(1)} ft."
                
                # Extract damage and any additional effect text
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)(.*)$', description, re.DOTALL)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    # Capture any additional text after damage type
                    extra_text = damage_match.group(4).strip()
                    if extra_text and not extra_text.startswith('.'):
                        extra_text = extra_text.lstrip(',. ')
                        # Remove leading "damage" word if present
                        if extra_text.lower().startswith('damage'):
                            extra_text = extra_text[6:].lstrip(',. ')
                        if extra_text:
                            action['extra'] = extra_text
                
                return action
            
            # Check for Ranged Attack (2024 format)
            if re.search(r'Ranged\s+Attack\s+Roll', description, re.I):
                action['type'] = 'Ranged Attack'
                
                # Extract hit bonus
                hit_match = re.search(r'\+(\d+)\s*,\s*range', description)
                if hit_match:
                    action['hit'] = int(hit_match.group(1))
                
                # Extract range
                range_match = re.search(r'range\s+(\d+)/(\d+)\s*ft', description, re.I)
                if range_match:
                    action['range'] = f"{range_match.group(1)}/{range_match.group(2)} ft."
                
                # Extract damage and any additional effect text
                damage_match = re.search(r'Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)(.*)$', description, re.DOTALL)
                if damage_match:
                    action['damage'] = f"{damage_match.group(1)} ({damage_match.group(2)}) {damage_match.group(3)}"
                    # Capture any additional text after damage type
                    extra_text = damage_match.group(4).strip()
                    if extra_text and not extra_text.startswith('.'):
                        extra_text = extra_text.lstrip(',. ')
                        # Remove leading "damage" word if present
                        if extra_text.lower().startswith('damage'):
                            extra_text = extra_text[6:].lstrip(',. ')
                        if extra_text:
                            action['extra'] = extra_text
                
                return action
            
            # Check for Saving Throw attacks
            save_match = re.search(r'(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving\s+Throw.*?DC\s+(\d+)', description, re.I)
            if save_match:
                action['type'] = 'Saving Throw'
                action['save'] = {
                    'ability': save_match.group(1),
                    'dc': int(save_match.group(2))
                }
                
                # Extract area of effect (e.g., "each creature in a 60-foot Cone" or "60-foot-long, 5-foot-wide Line")
                area_match = re.search(r'each\s+creature\s+in\s+(?:an?\s+)?([^.]+?\.)', description, re.I)
                if area_match:
                    action['area'] = area_match.group(1).strip('.')
                
                # Extract damage
                damage_match = re.search(r'(Failure|Success)?:?\s*(\d+)\s*\(([^)]+)\)\s*(\w+)', description)
                if damage_match:
                    action['damage'] = f"{damage_match.group(2)} ({damage_match.group(3)}) {damage_match.group(4)}"
                
                # Extract full effect description for failures
                failure_match = re.search(r'Failure:\s*(.+?)(?=Success:|Failure\s+or\s+Success:|$)', description, re.I | re.DOTALL)
                if failure_match:
                    effect_text = failure_match.group(1).strip()
                    
                    # Remove damage text from the beginning if present
                    effect_text = re.sub(r'^\d+\s*\([^)]+\)\s*\w+\s*damage\.?\s*', '', effect_text, flags=re.I)
                    
                    # Remove leading connectors like ", and" or ", " left over from damage removal
                    effect_text = re.sub(r'^,\s*and\s+', '', effect_text, flags=re.I)
                    effect_text = re.sub(r'^,\s+', '', effect_text)
                    
                    # Only store if there's actual effect text remaining
                    if effect_text:
                        action['failureEffect'] = effect_text
                
                # Check for "Failure or Success" combined effect first
                both_match = re.search(r'Failure\s+or\s+Success:\s*(.+?)$', description, re.I | re.DOTALL)
                if both_match:
                    both_text = both_match.group(1).strip()
                    # Store in both fields since it applies to both cases
                    if 'failureEffect' in action:
                        action['failureEffect'] += ' ' + both_text
                    else:
                        action['failureEffect'] = both_text
                    if 'successEffect' in action:
                        action['successEffect'] += ' ' + both_text
                    else:
                        action['successEffect'] = both_text
                else:
                    # Only look for standalone "Success:" if there's no "Failure or Success:"
                    success_match = re.search(r'Success:\s*(.+?)$', description, re.I | re.DOTALL)
                    if success_match:
                        success_text = success_match.group(1).strip()
                        action['successEffect'] = success_text
                
                # Check for half damage on success
                if re.search(r'Success:\s*Half\s+damage', description, re.I):
                    action['halfDamageOnSave'] = True
                
                return action
            
            # If we can't parse it, mark as special action
            return None
        
        # Helper function to find stat labels (supports both 2014 and 2024 formats)
        def find_stat_label(soup_obj, label_pattern):
            """Find a stat label using both old (2014) and new (2024) class names"""
            # Try 2014 format first
            label = soup_obj.find('span', class_='mon-stat-block__attribute-label', string=re.compile(label_pattern, re.I))
            if label:
                return label, 'old'
            # Try 2024 format
            label = soup_obj.find('span', class_='mon-stat-block-2024__attribute-label', string=re.compile(label_pattern, re.I))
            if label:
                return label, 'new'
            return None, None
        
        # Helper function to find tidbit labels (for skills, saves, etc.)
        def find_tidbit_label(soup_obj, label_pattern):
            """Find a tidbit label (works for both 2014 and 2024)"""
            # Try 2024 format first
            label_2024 = soup_obj.find('span', class_='mon-stat-block-2024__tidbit-label', string=re.compile(label_pattern, re.I))
            if label_2024:
                return label_2024, 'new'
            # Try 2014 format
            label_2014 = soup_obj.find('span', class_='mon-stat-block__tidbit-label', string=re.compile(label_pattern, re.I))
            if label_2014:
                return label_2014, 'old'
            return None, None
        
        # Extract monster name
        name_elem = (
            soup.find('div', class_='mon-stat-block-2024__name') or
            soup.find('div', class_='mon-stat-block__name') or
            soup.find('h1', class_='mon-stat-block-2024__name') or
            soup.find('span', class_='mon-stat-block__name') or
            soup.find('h1', class_='mon-stat-block__name')
        )
        if name_elem:
            details['name'] = normalize_text(name_elem.get_text(strip=True))
            print(f"  Found Name: {details['name']}")
        
        # Extract Type/Size/Alignment (e.g., "Huge Dragon (Metallic), Chaotic Good")
        # This appears in different places depending on format
        # Try multiple selectors as D&D Beyond structure varies
        type_size_elem = (
            soup.find('div', class_='mon-stat-block-2024__meta') or
            soup.find('div', class_='mon-stat-block__meta') or
            soup.find('span', class_='mon-stat-block-2024__type') or 
            soup.find('span', class_='mon-stat-block__type') or
            soup.find('div', class_='mon-stat-block-2024__type') or
            soup.find('div', class_='mon-stat-block__type') or
            soup.find('p', class_='mon-stat-block-2024__type') or
            soup.find('p', class_='mon-stat-block__type')
        )
        if type_size_elem:
            type_text = normalize_text(type_size_elem.get_text(strip=True))
            if type_text:
                details['typeAndAlignment'] = type_text
                print(f"  Found Type: {type_text}")
        
        # Extract AC with type
        ac_label, ac_format = find_stat_label(soup, r'Armor\s+Class|^AC$')
        if ac_label:
            # Choose class prefix based on format
            prefix = 'mon-stat-block-2024' if ac_format == 'new' else 'mon-stat-block'
            # For 2024 format, use __attribute-value (contains clean AC number)
            # For legacy format, use __attribute-value (same structure)
            ac_elem = ac_label.find_next_sibling('span', class_=f'{prefix}__attribute-value')
            if ac_elem:
                # For 2024, the value is directly in the ac_elem text
                # For legacy, it's in a nested __attribute-data-value span
                ac_value_elem = ac_elem.find('span', class_=f'{prefix}__attribute-data-value')
                if ac_value_elem:
                    # Legacy format: extract from nested span
                    ac_text = ac_value_elem.get_text(strip=True)
                else:
                    # 2024 format: value is directly in ac_elem
                    ac_text = ac_elem.get_text(strip=True)
                
                ac_match = re.search(r'(\d+)', ac_text)
                if ac_match:
                    details['ac'] = int(ac_match.group(1))
                
                ac_extra = ac_elem.find('span', class_=f'{prefix}__attribute-data-extra')
                if ac_extra:
                    details['acType'] = ac_extra.get_text(strip=True).strip('()')
                if 'ac' in details:
                    print(f"  Found AC: {details['ac']}{' (' + details.get('acType', '') + ')' if 'acType' in details else ''}")
        
        # Extract HP with hit dice
        hp_label, hp_format = find_stat_label(soup, r'Hit\s+Points|^HP$')
        if hp_label:
            prefix = 'mon-stat-block-2024' if hp_format == 'new' else 'mon-stat-block'
            if hp_format == 'new':
                hp_elem = hp_label.find_next_sibling('span', class_=f'{prefix}__attribute-data')
            else:
                hp_elem = hp_label.find_next_sibling('span', class_=f'{prefix}__attribute-data')
            if hp_elem:
                hp_value = hp_elem.find('span', class_=f'{prefix}__attribute-data-value')
                if hp_value:
                    hp_match = re.search(r'(\d+)', hp_value.get_text(strip=True))
                    if hp_match:
                        details['hp'] = int(hp_match.group(1))
                hp_extra = hp_elem.find('span', class_=f'{prefix}__attribute-data-extra')
                if hp_extra:
                    details['hitDice'] = hp_extra.get_text(strip=True).strip('()')
                if 'hp' in details:
                    print(f"  Found HP: {details['hp']}{' (' + details.get('hitDice', '') + ')' if 'hitDice' in details else ''}")
        
        # Extract Speed
        speed_label, speed_format = find_stat_label(soup, r'Speed')
        if speed_label:
            prefix = 'mon-stat-block-2024' if speed_format == 'new' else 'mon-stat-block'
            speed_elem = speed_label.find_next_sibling('span', class_=f'{prefix}__attribute-data')
            if speed_elem:
                speed_text = speed_elem.get_text(strip=True)
                details['speed'] = speed_text
                print(f"  Found Speed: {speed_text}")
        
        # Extract Ability Scores
        ability_names = ['str', 'dex', 'con', 'int', 'wis', 'cha']
        
        # Try 2024 format first (stat tables)
        stats_section = soup.find('div', class_='mon-stat-block-2024__stats')
        if stats_section:
            stat_tables = stats_section.find_all('table', class_='stat-table')
            if stat_tables:
                details['abilities'] = {}
                for table in stat_tables:
                    rows = table.find('tbody').find_all('tr')
                    for row in rows:
                        cells = row.find_all(['th', 'td'])
                        if len(cells) >= 4:
                            ability_name = cells[0].get_text(strip=True).lower()
                            score = parse_signed_int(cells[1].get_text(strip=True), default=10)
                            # cells[2] is the ability modifier; D&D Beyond may
                            # render negatives with the Unicode minus sign.
                            modifier = parse_signed_int(cells[2].get_text(strip=True), default=0)
                            # cells[3] is the saving throw modifier
                            if ability_name in ability_names:
                                details['abilities'][ability_name] = score
                details['initBonus'] = details['abilities']['dex']
                if details['initBonus'] >= 10:
                    details['initBonus'] = (details['initBonus'] - 10) // 2
                else:
                    details['initBonus'] = -((10 - details['initBonus'] + 1) // 2)
                print(f"  Found Abilities (2024): STR {details['abilities']['str']}, DEX {details['abilities']['dex']}, CON {details['abilities']['con']}, INT {details['abilities']['int']}, WIS {details['abilities']['wis']}, CHA {details['abilities']['cha']}")
                print(f"  Initiative Modifier: {details['initBonus']:+d}")
        else:
            # Try legacy 2014 format
            stat_scores = soup.find_all('span', class_='ability-block__score')
            stat_modifiers = soup.find_all('span', class_='ability-block__modifier')
            
            if len(stat_scores) >= 6:
                details['abilities'] = {}
                for i, ability in enumerate(ability_names):
                    score = parse_signed_int(stat_scores[i].get_text(strip=True), default=10)
                    details['abilities'][ability] = score
                # Calculate initiative from dex
                dex = details['abilities']['dex']
                details['initBonus'] = (dex - 10) // 2
                print(f"  Found Abilities (2014): STR {details['abilities']['str']}, DEX {details['abilities']['dex']}, CON {details['abilities']['con']}, INT {details['abilities']['int']}, WIS {details['abilities']['wis']}, CHA {details['abilities']['cha']}")
                print(f"  Initiative Modifier: {details['initBonus']:+d}")
        
        # Extract Saving Throws
        saves_label, saves_format = find_tidbit_label(soup, r'Saving Throws')
        if saves_label:
            prefix = 'mon-stat-block-2024' if saves_format == 'new' else 'mon-stat-block'
            saves_data = saves_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if saves_data:
                details['savingThrows'] = saves_data.get_text(strip=True)
                print(f"  Found Saving Throws: {details['savingThrows']}")
        
        # Extract Skills
        skills_label, skills_format = find_tidbit_label(soup, r'Skills')
        if skills_label:
            prefix = 'mon-stat-block-2024' if skills_format == 'new' else 'mon-stat-block'
            skills_data = skills_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if skills_data:
                skills_text = skills_data.get_text(strip=True)
                # Parse skills into array: "Athletics+5,Perception+2" or "Athletics +5, Perception +2"
                skills_array = []
                # Split by comma
                skill_parts = skills_text.split(',')
                for part in skill_parts:
                    part = part.strip()
                    # Match skill name and modifier: "Athletics +5" or "Athletics+5"
                    match = re.search(r'([A-Za-z\s]+?)\s*([+\-])\s*(\d+)', part)
                    if match:
                        skill_name = match.group(1).strip()
                        sign = match.group(2)
                        mod_value = int(match.group(3))
                        if sign == '-':
                            mod_value = -mod_value
                        skills_array.append({'skill': skill_name, 'mod': mod_value})
                details['skills'] = skills_array
                print(f"  Found Skills: {len(skills_array)} skills parsed")
        
        # Extract Damage Vulnerabilities
        vuln_label, vuln_format = find_tidbit_label(soup, r'Damage Vulnerabilities')
        if vuln_label:
            prefix = 'mon-stat-block-2024' if vuln_format == 'new' else 'mon-stat-block'
            vuln_data = vuln_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if vuln_data:
                details['damageVulnerabilities'] = vuln_data.get_text(strip=True)
                print(f"  Found Vulnerabilities: {details['damageVulnerabilities']}")
        
        # Extract Damage Resistances
        resist_label, resist_format = find_tidbit_label(soup, r'Damage Resistances')
        if resist_label:
            prefix = 'mon-stat-block-2024' if resist_format == 'new' else 'mon-stat-block'
            resist_data = resist_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if resist_data:
                details['damageResistances'] = normalize_text(resist_data.get_text(strip=True))
                print(f"  Found Resistances: {details['damageResistances']}")
        
        # Extract Damage Immunities
        immune_label, immune_format = find_tidbit_label(soup, r'Damage Immunities')
        if immune_label:
            prefix = 'mon-stat-block-2024' if immune_format == 'new' else 'mon-stat-block'
            immune_data = immune_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if immune_data:
                details['damageImmunities'] = normalize_text(immune_data.get_text(strip=True))
                print(f"  Found Immunities: {details['damageImmunities']}")
        
        # Extract Condition Immunities
        cond_label, cond_format = find_tidbit_label(soup, r'Condition Immunities')
        if cond_label:
            prefix = 'mon-stat-block-2024' if cond_format == 'new' else 'mon-stat-block'
            cond_data = cond_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if cond_data:
                details['conditionImmunities'] = normalize_text(cond_data.get_text(strip=True))
                print(f"  Found Condition Immunities: {details['conditionImmunities']}")
        
        # Extract Senses
        senses_label, senses_format = find_tidbit_label(soup, r'Senses')
        if senses_label:
            prefix = 'mon-stat-block-2024' if senses_format == 'new' else 'mon-stat-block'
            senses_data = senses_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if senses_data:
                senses_text = normalize_text(senses_data.get_text(strip=True))
                # Parse senses into array by splitting on comma
                senses_array = []
                for sense in senses_text.split(','):
                    sense = sense.strip()
                    # Fix spacing for common senses (e.g., "Darkvision60 ft." -> "Darkvision 60 ft.")
                    sense = re.sub(r'(Darkvision|Blindsight|Tremorsense|Truesight)(\d)', r'\1 \2', sense)
                    senses_array.append(sense)
                details['senses'] = senses_array
                print(f"  Found Senses: {len(senses_array)} senses")
        
        # Extract Languages
        lang_label, lang_format = find_tidbit_label(soup, r'Languages')
        if lang_label:
            prefix = 'mon-stat-block-2024' if lang_format == 'new' else 'mon-stat-block'
            lang_data = lang_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if lang_data:
                details['languages'] = normalize_text(lang_data.get_text(strip=True))
                print(f"  Found Languages: {details['languages']}")
        
        # Extract Challenge Rating
        cr_label, cr_format = find_tidbit_label(soup, r'Challenge|^CR$')
        if cr_label:
            prefix = 'mon-stat-block-2024' if cr_format == 'new' else 'mon-stat-block'
            cr_data = cr_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if cr_data:
                cr_text = cr_data.get_text(strip=True)
                cr_match = re.search(r'([\d/]+)', cr_text)
                if cr_match:
                    details['cr'] = cr_match.group(1)
                if 'cr' in details:
                    print(f"  Found CR: {details.get('cr', 'N/A')}")
        
        # Extract Proficiency Bonus specially (if present)
        prof_label = soup.find('span', class_='mon-stat-block-2024__tidbit-label', string=re.compile(r'^Proficiency\s+Bonus$', re.I))
        if not prof_label:
            prof_label = soup.find('span', class_='mon-stat-block__tidbit-label', string=re.compile(r'^Proficiency\s+Bonus$', re.I))
        if prof_label:
            prof_data = prof_label.find_next_sibling('span')
            if prof_data:
                prof_text = prof_data.get_text(strip=True)
                # Extract just the number from something like "+5"
                prof_match = re.search(r'\+?(\d+)', prof_text)
                if prof_match:
                    details['profBonus'] = int(prof_match.group(1))
                    print(f"  Found Proficiency Bonus: +{details['profBonus']}")
        
        # Extract Traits (Special Abilities) from description blocks
        traits = []
        spellcasting_from_traits = None
        
        # Try 2024 format first
        stat_block_2024 = soup.find('div', class_='mon-stat-block-2024')
        
        if stat_block_2024:
            # Look for description blocks that are NOT Actions/Bonus Actions/Reactions/Legendary Actions
            desc_blocks = stat_block_2024.find_all('div', class_='mon-stat-block-2024__description-block')
            for block in desc_blocks:
                heading = block.find('div', class_='mon-stat-block-2024__description-block-heading')
                if heading:
                    heading_text = heading.get_text(strip=True)
                    # Skip action-type blocks
                    if not re.search(r'^(Actions?|Bonus\s+Actions?|Reactions?|Legendary\s+Actions?)$', heading_text, re.I):
                        # This is a trait block - extract all paragraphs
                        content_div = block.find('div', class_='mon-stat-block-2024__description-block-content')
                        if content_div:
                            trait_paragraphs = content_div.find_all('p')
                            for p in trait_paragraphs:
                                strong = p.find('strong')
                                if strong:
                                    name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                                    description = normalize_text(p.get_text(strip=True))
                                    if description.startswith(name):
                                        description = description[len(name):].lstrip('. ')
                                    
                                    # Check if this is Spellcasting
                                    if re.search(r'^Spellcasting', name, re.I):
                                        # Extract spellcasting separately with following lists/paragraphs
                                        # Get any following list items OR paragraphs
                                        next_elem = p.find_next_sibling()
                                        while next_elem:
                                            if next_elem.name in ['ul', 'ol']:
                                                # List items - these are the spell lists
                                                for li in next_elem.find_all('li'):
                                                    description += ' ' + normalize_text(li.get_text(strip=True))
                                                next_elem = next_elem.find_next_sibling()
                                            elif next_elem.name == 'p':
                                                # Check if it has a strong tag (would be next trait)
                                                p_strong = next_elem.find('strong')
                                                if p_strong:
                                                    # This is a new trait, stop
                                                    break
                                                # No strong - this paragraph continues spellcasting
                                                description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                                next_elem = next_elem.find_next_sibling()
                                            else:
                                                break
                                        spellcasting_from_traits = {'name': name, 'description': description}
                                    else:
                                        traits.append({'name': name, 'description': description})
        else:
            # Legacy 2014 format - look for paragraphs before Actions heading
            # Find all description blocks that come before Actions
            desc_blocks = soup.find_all('div', class_='mon-stat-block__description-block')
            for block in desc_blocks:
                heading = block.find('div', class_='mon-stat-block__description-block-heading')
                if heading:
                    heading_text = heading.get_text(strip=True)
                    # Skip action-type blocks
                    if not re.search(r'^(Actions?|Bonus\s+Actions?|Reactions?|Legendary\s+Actions?)$', heading_text, re.I):
                        content_div = block.find('div', class_='mon-stat-block__description-block-content')
                        if content_div:
                            trait_paragraphs = content_div.find_all('p')
                            for p in trait_paragraphs:
                                strong = p.find('strong')
                                if strong:
                                    name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                                    description = normalize_text(p.get_text(strip=True))
                                    if description.startswith(name):
                                        description = description[len(name):].lstrip('. ')
                                    
                                    # Check if this is Spellcasting
                                    if re.search(r'^Spellcasting', name, re.I):
                                        # Extract spellcasting separately with following lists/paragraphs
                                        # Get any following list items OR paragraphs
                                        next_elem = p.find_next_sibling()
                                        while next_elem:
                                            if next_elem.name in ['ul', 'ol']:
                                                # List items - these are the spell lists
                                                for li in next_elem.find_all('li'):
                                                    description += ' ' + normalize_text(li.get_text(strip=True))
                                                next_elem = next_elem.find_next_sibling()
                                            elif next_elem.name == 'p':
                                                # Check if it has a strong tag (would be next trait)
                                                p_strong = next_elem.find('strong')
                                                if p_strong:
                                                    # This is a new trait, stop
                                                    break
                                                # No strong - this paragraph continues spellcasting
                                                description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                                next_elem = next_elem.find_next_sibling()
                                            else:
                                                break
                                        spellcasting_from_traits = {'name': name, 'description': description}
                                    else:
                                        traits.append({'name': name, 'description': description})
        
        if traits:
            details['traits'] = traits
            print(f"  Found {len(traits)} Traits")
        
        # Extract Actions
        raw_actions = []
        
        # Try 2024 format first
        if stat_block_2024:
            desc_blocks = stat_block_2024.find_all('div', class_='mon-stat-block-2024__description-block')
            for block in desc_blocks:
                heading = block.find('div', class_='mon-stat-block-2024__description-block-heading')
                if heading and re.search(r'^Actions\s*$', heading.get_text(strip=True), re.I):
                    content_div = block.find('div', class_='mon-stat-block-2024__description-block-content')
                    if content_div:
                        action_paragraphs = content_div.find_all('p')
                        processed_paragraphs = set()  # Track which paragraphs have been processed
                        
                        for p in action_paragraphs:
                            # Skip if already processed as part of spellcasting
                            if p in processed_paragraphs:
                                continue
                                
                            strong = p.find('strong')
                            if strong:
                                name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                                
                                # Skip standalone spell list indicators - they should have been merged with Spellcasting
                                if re.match(r'^(At[\s-]?Will|At[\s-]?will|\d+/[Dd]ay(\s+[Ee]ach)?):?$', name, re.I):
                                    continue
                                
                                # Fix spacing before parentheses
                                name = re.sub(r'(\S)\(', r'\1 (', name)  # Add space before (
                                description = normalize_text(p.get_text(strip=True))
                                if description.startswith(name):
                                    description = description[len(name):].lstrip('. ')
                                
                                # For Spellcasting, also get any following list items OR paragraphs without strong
                                if re.search(r'^Spellcasting', name, re.I):
                                    next_elem = p.find_next_sibling()
                                    while next_elem:
                                        if next_elem.name in ['ul', 'ol']:
                                            # List items
                                            for li in next_elem.find_all('li'):
                                                description += ' ' + normalize_text(li.get_text(strip=True))
                                        elif next_elem.name == 'p':
                                            # Check if it has a strong element
                                            p_strong = next_elem.find('strong')
                                            if p_strong:
                                                # Check if the strong tag is a spell list indicator (At Will, X/Day, etc.)
                                                strong_text = p_strong.get_text(strip=True)
                                                if re.match(r'^(At[\s-]?Will|At[\s-]?will|\d+/[Dd]ay(\s+[Ee]ach)?):?$', strong_text, re.I):
                                                    # This is a spell list continuation, include it and mark as processed
                                                    description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                                    processed_paragraphs.add(next_elem)
                                                else:
                                                    # This is a different action, stop
                                                    break
                                            else:
                                                # Paragraph without strong - part of spellcasting description
                                                description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                        else:
                                            # Some other element, stop
                                            break
                                        next_elem = next_elem.find_next_sibling()
                                
                                raw_actions.append({'name': name, 'description': description})
        else:
            # Legacy 2014 format
            actions_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'^Actions\s*$', re.I))
            if actions_heading:
                content_div = actions_heading.find_next_sibling('div', class_='mon-stat-block__description-block-content')
                if content_div:
                    action_paragraphs = content_div.find_all('p')
                    processed_paragraphs = set()  # Track which paragraphs have been processed
                    
                    for p in action_paragraphs:
                        # Skip if already processed as part of spellcasting
                        if p in processed_paragraphs:
                            continue
                            
                        strong = p.find('strong')
                        if strong:
                            name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                            
                            # Skip standalone spell list indicators - they should have been merged with Spellcasting
                            if re.match(r'^(At[\s-]?Will|At[\s-]?will|\d+/[Dd]ay(\s+[Ee]ach)?):?$', name, re.I):
                                continue
                            
                            # Fix spacing before parentheses
                            name = re.sub(r'(\S)\(', r'\1 (', name)  # Add space before (
                            description = normalize_text(p.get_text(strip=True))
                            if description.startswith(name):
                                description = description[len(name):].lstrip('. ')
                            
                            # For Spellcasting, also get any following list items OR paragraphs without strong
                            if re.search(r'^Spellcasting', name, re.I):
                                next_elem = p.find_next_sibling()
                                while next_elem:
                                    if next_elem.name in ['ul', 'ol']:
                                        # List items
                                        for li in next_elem.find_all('li'):
                                            description += ' ' + normalize_text(li.get_text(strip=True))
                                    elif next_elem.name == 'p':
                                        # Check if it has a strong element
                                        p_strong = next_elem.find('strong')
                                        if p_strong:
                                            # Check if the strong tag is a spell list indicator (At Will, X/Day, etc.)
                                            strong_text = p_strong.get_text(strip=True)
                                            if re.match(r'^(At[\s-]?Will|At[\s-]?will|\d+/[Dd]ay(\s+[Ee]ach)?):?$', strong_text, re.I):
                                                # This is a spell list continuation, include it and mark as processed
                                                description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                                processed_paragraphs.add(next_elem)
                                            else:
                                                # This is a different action, stop
                                                break
                                        else:
                                            # Paragraph without strong - part of spellcasting description
                                            description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                    else:
                                        # Some other element, stop
                                        break
                                    next_elem = next_elem.find_next_sibling()
                            
                            raw_actions.append({'name': name, 'description': description})
        
        # Parse actions into structured format
        actions = []
        special_actions = []
        spellcasting = None
        
        for raw_action in raw_actions:
            # Check if this is spellcasting
            if re.search(r'^Spellcasting', raw_action['name'], re.I):
                # Use the description from raw_action which should have spell lists appended
                spell_content_text = raw_action['description']
                
                # Extract just the intro text for description (before spell lists)
                intro_match = re.search(r'^(.+?)(?=At[\s-]?[Ww]ill:|\d+/[Dd]ay|$)', spell_content_text, re.I | re.DOTALL)
                if intro_match:
                    spell_intro = intro_match.group(1).strip().rstrip(':')
                else:
                    spell_intro = spell_content_text
                
                # Extract spellcasting info
                spell_info = {'description': spell_intro}
                
                # Try to extract spell save DC
                dc_match = re.search(r'spell\s+save\s+DC\s+(\d+)', spell_content_text, re.I)
                if dc_match:
                    spell_info['spellSaveDC'] = int(dc_match.group(1))
                
                # Try to extract spell attack bonus
                attack_match = re.search(r'\+(\d+)\s+to\s+hit\s+with\s+spell\s+attacks', spell_content_text, re.I)
                if attack_match:
                    spell_info['spellAttackBonus'] = int(attack_match.group(1))
                
                # Try to extract spellcasting ability
                ability_match = re.search(r'using\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+as\s+the\s+spellcasting\s+ability', spell_content_text, re.I)
                if ability_match:
                    spell_info['spellcastingAbility'] = ability_match.group(1)
                
                # Extract spell lists
                spell_lists = {}
                
                # At will spells (handles both "At will:" and "At-will:" and multiline)
                at_will_match = re.search(r'At[\s-]?will:\s*([^\n]+?)(?=\n|$|\d+/day)', spell_content_text, re.I | re.DOTALL)
                if at_will_match:
                    spells_text = at_will_match.group(1).strip()
                    # Split by comma, handling spell names with parentheses
                    spells = [s.strip() for s in re.split(r',\s*(?![^()]*\))', spells_text) if s.strip()]
                    # Normalize spell names: add space before parentheses
                    spells = [re.sub(r'(\S)\(', r'\1 (', spell) for spell in spells]
                    if spells:
                        spell_lists['atWill'] = spells
                
                # X/day each spells  
                for match in re.finditer(r'(\d+)/day\s+each:\s*([^\n]+?)(?=\n|$|\d+/day)', spell_content_text, re.I | re.DOTALL):
                    uses = match.group(1)
                    spells_text = match.group(2).strip()
                    spells = [s.strip() for s in re.split(r',\s*(?![^()]*\))', spells_text) if s.strip()]
                    # Normalize spell names: add space before parentheses
                    spells = [re.sub(r'(\S)\(', r'\1 (', spell) for spell in spells]
                    if spells:
                        spell_lists[f'{uses}PerDay'] = spells
                
                if spell_lists:
                    spell_info['spells'] = spell_lists
                
                spellcasting = spell_info
                continue
            
            parsed = parse_action(raw_action['name'], raw_action['description'])
            
            if parsed is None:
                # Special action (Multiattack, etc.) - no structured fields
                special_actions.append({'name': raw_action['name'], 'description': raw_action['description']})
            elif parsed.get('isDualMode'):
                # Split dual-mode weapon into melee and ranged
                desc = parsed['_originalDescription']
                
                # Create melee version
                melee_name = f"{parsed['name']} (Melee)"
                melee_desc = re.sub(r'Melee\s*or\s*Ranged\s+Weapon\s+Attack', 'Melee Weapon Attack', desc, flags=re.I)
                # Remove the "or ranged X ft./Y ft." part for melee (handles both "range" and "ranged")
                melee_desc = re.sub(r'\s+or\s+ranged?\s+\d+\s*(?:ft\\.?)?\s*/\\s*\d+\s*ft\\.?', '', melee_desc, flags=re.I)
                melee_parsed = parse_action(melee_name, melee_desc)
                if melee_parsed and not melee_parsed.get('isDualMode'):
                    actions.append(melee_parsed)
                
                # Create ranged version
                ranged_name = f"{parsed['name']} (Ranged)"
                ranged_desc = re.sub(r'Melee\s*or\s*Ranged\s+Weapon\s+Attack', 'Ranged Weapon Attack', desc, flags=re.I)
                # Remove the "reach X ft. or" part for ranged (keep the actual range)
                ranged_desc = re.sub(r'reach\s+\d+\s*ft\\.\s+or\\s+', '', ranged_desc, flags=re.I)
                ranged_parsed = parse_action(ranged_name, ranged_desc)
                if ranged_parsed and not ranged_parsed.get('isDualMode'):
                    actions.append(ranged_parsed)
            else:
                # Regular parsed action
                actions.append(parsed)
        
        if actions:
            details['actions'] = actions
            print(f"  Found {len(actions)} Actions (parsed)")
        
        # Handle spellcasting from actions or traits
        if spellcasting:
            details['spellcasting'] = spellcasting
            spell_count = sum(len(spells) for spells in spellcasting.get('spells', {}).values())
            print(f"  Found Spellcasting ({spell_count} spells)")
        elif spellcasting_from_traits:
            # Parse spellcasting from traits section
            spell_content_text = spellcasting_from_traits['description']
            
            # DEBUG: Print spell text to see format
            print(f"  DEBUG Spell text (first 300 chars): {spell_content_text[:300]}")
            
            # Extract just the intro text for description (before spell lists)
            # Stop at "Cantrips (", "At will:", "1st level", etc.
            intro_match = re.search(r'^(.+?)(?=Cantrips?\s*\(|At[\s-]?[Ww]ill:|\d+(?:st|nd|rd|th)\s+level|\d+/[Dd]ay|$)', spell_content_text, re.I | re.DOTALL)
            if intro_match:
                spell_intro = intro_match.group(1).strip().rstrip(':')
            else:
                spell_intro = spell_content_text
            
            # Extract spellcasting info
            spell_info = {'description': spell_intro}
            
            # Try to extract spell save DC
            dc_match = re.search(r'spell\s+save\s+DC\s+(\d+)', spell_content_text, re.I)
            if dc_match:
                spell_info['spellSaveDC'] = int(dc_match.group(1))
            
            # Try to extract spell attack bonus
            attack_match = re.search(r'\+(\d+)\s+to\s+hit\s+with\s+spell\s+attacks', spell_content_text, re.I)
            if attack_match:
                spell_info['spellAttackBonus'] = int(attack_match.group(1))
            
            # Try to extract spellcasting ability
            ability_match = re.search(r'using\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+as\s+(?:her|his|its|their)\s+spellcasting\s+ability', spell_content_text, re.I)
            if ability_match:
                spell_info['spellcastingAbility'] = ability_match.group(1)
            
            # Extract spell lists
            spell_lists = {}
            
            # Cantrips (at will)
            cantrip_match = re.search(r'Cantrips?\s*\([^)]*\):\s*([^\n]+?)(?=\d+(?:st|nd|rd|th)\s+level|$)', spell_content_text, re.I | re.DOTALL)
            if cantrip_match:
                spells_text = cantrip_match.group(1).strip()
                spells = [s.strip() for s in re.split(r',\s*(?![^()]*\))', spells_text) if s.strip()]
                if spells:
                    spell_lists['cantrips'] = spells
            
            # Leveled spells (1st level (4 slots): ...)
            for level in range(1, 10):
                # Match "1st level (3 slots): spell1, spell2"
                level_suffix = 'st' if level == 1 else 'nd' if level == 2 else 'rd' if level == 3 else 'th'
                level_pattern = rf'{level}{level_suffix}\s+level\s*\([^)]*\):\s*([^\n]+?)(?=\d+(?:st|nd|rd|th)\s+level|$)'
                level_match = re.search(level_pattern, spell_content_text, re.I | re.DOTALL)
                if level_match:
                    spells_text = level_match.group(1).strip()
                    spells = [s.strip() for s in re.split(r',\s*(?![^()]*\))', spells_text) if s.strip()]
                    if spells:
                        spell_lists[f'level{level}'] = spells
            
            # At will spells (alternative format)
            at_will_match = re.search(r'At[\s-]?will:\s*([^\n]+?)(?=\d+/day|$)', spell_content_text, re.I)
            if at_will_match and 'cantrips' not in spell_lists:
                spells_text = at_will_match.group(1).strip()
                spells = [s.strip() for s in re.split(r',\s*(?![^()]*\))', spells_text) if s.strip()]
                if spells:
                    spell_lists['atWill'] = spells
            
            # X/day each spells
            for match in re.finditer(r'(\d+)/day(?:\s+each)?:\s*([^\n]+)', spell_content_text, re.I):
                uses = match.group(1)
                spells = [s.strip() for s in match.group(2).split(',')]
                spell_lists[f'{uses}PerDay'] = spells
            
            if spell_lists:
                spell_info['spells'] = spell_lists
            
            details['spellcasting'] = spell_info
            spell_count = sum(len(spells) for spells in spell_info.get('spells', {}).values())
            print(f"  Found Spellcasting from Traits ({spell_count} spells)")
        
        if special_actions:
            details['specialActions'] = special_actions
            print(f"  Found {len(special_actions)} Special Actions")
        
        # Extract Bonus Actions
        bonus_actions = []
        
        # Try 2024 format first
        if stat_block_2024:
            desc_blocks = stat_block_2024.find_all('div', class_='mon-stat-block-2024__description-block')
            for block in desc_blocks:
                heading = block.find('div', class_='mon-stat-block-2024__description-block-heading')
                if heading and re.search(r'^Bonus\s+Actions?\s*$', heading.get_text(strip=True), re.I):
                    content_div = block.find('div', class_='mon-stat-block-2024__description-block-content')
                    if content_div:
                        action_paragraphs = content_div.find_all('p')
                        for p in action_paragraphs:
                            strong = p.find('strong')
                            if strong:
                                name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                                # Fix spacing before parentheses
                                name = re.sub(r'(\S)\(', r'\1 (', name)
                                description = normalize_text(p.get_text(strip=True))
                                if description.startswith(name):
                                    description = description[len(name):].lstrip('. ')
                                
                                # Check for additional paragraphs (without strong) that belong to this action
                                next_elem = p.find_next_sibling()
                                while next_elem:
                                    if next_elem.name == 'p':
                                        # Check if it has a strong element (would be next action)
                                        if next_elem.find('strong'):
                                            break
                                        # Otherwise, it's part of this action's description
                                        description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                    else:
                                        # Some other element, stop
                                        break
                                    next_elem = next_elem.find_next_sibling()
                                
                                bonus_actions.append({'name': name, 'description': description})
        else:
            # Legacy 2014 format
            bonus_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'^Bonus\s+Actions?\s*$', re.I))
            if bonus_heading:
                content_div = bonus_heading.find_next_sibling('div', class_='mon-stat-block__description-block-content')
                if content_div:
                    action_paragraphs = content_div.find_all('p')
                    for p in action_paragraphs:
                        strong = p.find('strong')
                        if strong:
                            name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                            # Fix spacing before parentheses
                            name = re.sub(r'(\S)\(', r'\1 (', name)
                            description = normalize_text(p.get_text(strip=True))
                            if description.startswith(name):
                                description = description[len(name):].lstrip('. ')
                            
                            # Check for additional paragraphs (without strong) that belong to this action
                            next_elem = p.find_next_sibling()
                            while next_elem:
                                if next_elem.name == 'p':
                                    # Check if it has a strong element (would be next action)
                                    if next_elem.find('strong'):
                                        break
                                    # Otherwise, it's part of this action's description
                                    description += ' ' + normalize_text(next_elem.get_text(strip=True))
                                else:
                                    # Some other element, stop
                                    break
                                next_elem = next_elem.find_next_sibling()
                            
                            bonus_actions.append({'name': name, 'description': description})
        
        if bonus_actions:
            details['bonusActions'] = bonus_actions
            print(f"  Found {len(bonus_actions)} Bonus Actions")
        
        # Extract Legendary Actions
        legendary_actions = []
        legendary_uses = None
        
        # Try both 2024 and 2014 formats
        legendary_heading = soup.find('div', class_='mon-stat-block-2024__description-block-heading', string=re.compile(r'Legendary\s+Actions?', re.I))
        if not legendary_heading:
            legendary_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'Legendary\s+Actions?', re.I))
        
        if legendary_heading:
            # Determine format based on which heading was found
            is_2024 = 'mon-stat-block-2024' in str(legendary_heading.get('class'))
            content_class = 'mon-stat-block-2024__description-block-content' if is_2024 else 'mon-stat-block__description-block-content'
            
            # Get the description paragraph (might be before the first action)
            content_div = legendary_heading.find_next_sibling('div', class_=content_class)
            if content_div:
                # First paragraph might contain uses information
                first_p = content_div.find('p')
                if first_p and not first_p.find('strong'):
                    desc_text = normalize_text(first_p.get_text(strip=True))
                    # Try to extract uses from description like "Legendary Action Uses: 3 (4 in Lair)"
                    uses_match = re.search(r'Legendary\s+Action\s+Uses:\s*([^.]+)', desc_text, re.I)
                    if uses_match:
                        legendary_uses = uses_match.group(1).strip()
                
                # Find all action paragraphs
                action_paragraphs = content_div.find_all('p')
                for p in action_paragraphs:
                    strong = p.find('strong')
                    if strong:
                        name = normalize_text(strong.get_text(strip=True).rstrip('.'))
                        description = normalize_text(p.get_text(strip=True))
                        if description.startswith(name):
                            description = description[len(name):].lstrip('. ')
                        
                        # Try to parse as structured action
                        parsed = parse_action(name, description)
                        if parsed and not parsed.get('isDualMode'):
                            # Successfully parsed into structured format
                            legendary_actions.append(parsed)
                        else:
                            # Keep as description-only
                            legendary_actions.append({'name': name, 'description': description})
        
        if legendary_actions:
            legendary_data = {'actions': legendary_actions}
            if legendary_uses:
                legendary_data['uses'] = legendary_uses
            details['legendaryActions'] = legendary_data
            print(f"  Found {len(legendary_actions)} Legendary Actions{' (uses: ' + legendary_uses + ')' if legendary_uses else ''}")
        
        # Extract Reactions
        reactions = []
        reactions_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'^Reactions\s*$', re.I))
        if reactions_heading:
            content_div = reactions_heading.find_next_sibling('div', class_='mon-stat-block__description-block-content')
            if content_div:
                action_paragraphs = content_div.find_all('p')
                for p in action_paragraphs:
                    strong = p.find('strong')
                    if strong:
                        name = strong.get_text(strip=True).rstrip('.')
                        description = p.get_text(strip=True)
                        if description.startswith(name):
                            description = description[len(name):].lstrip('. ')
                        reactions.append({'name': name, 'description': description})
        
        if reactions:
            details['reactions'] = reactions
            print(f"  Found {len(reactions)} Reactions")
        
        # Extract avatar/image URL
        avatar_url = None
        # Try multiple selectors for monster images
        avatar_selectors = [
            'div.detail-content img',
            'div.more-info-content img',
            'div.monster-image img',
            'img.monster-avatar',
            'div.primary-content img',
            'article img'
        ]
        
        for selector in avatar_selectors:
            img_elem = soup.select_one(selector)
            if img_elem and img_elem.get('src'):
                src = img_elem.get('src')
                # Make sure it's a real image URL (not icons or UI elements)
                if any(keyword in src.lower() for keyword in ['/avatars/', '/monsters/', 'monster', 'creature', '.jpg', '.jpeg', '.png', '.webp']):
                    # Ensure it's an absolute URL
                    if src.startswith('//'):
                        avatar_url = 'https:' + src
                    elif src.startswith('/'):
                        avatar_url = 'https://www.dndbeyond.com' + src
                    elif src.startswith('http'):
                        avatar_url = src
                    
                    if avatar_url:
                        # Prefer larger resolution if available
                        if '?' in avatar_url:
                            # Remove query parameters that limit size
                            avatar_url = avatar_url.split('?')[0]
                        print(f"  Found avatar: {avatar_url}")
                        break
        
        if avatar_url:
            # Cache the avatar image locally (disabled for bulk processing)
            # cached_avatar_url = cache_avatar_image(avatar_url)
            # details['avatarUrl'] = cached_avatar_url if cached_avatar_url else avatar_url
            details['avatarUrl'] = avatar_url
        
        if not details:
            print("  WARNING: No stats found on page - selectors may need updating")
            # Save a debug file
            debug_file = CACHE_DIR / f"monster_debug_{monster_url.split('/')[-1]}.html"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            print(f"  Saved debug HTML to {debug_file}")
        
        # Log what was extracted
        print(f"\n  EXTRACTED DATA:")
        print(f"    Format Version: {details.get('formatVersion', 'NOT SET')}")
        print(f"    AC: {details.get('ac', 'NOT FOUND')}")
        print(f"    HP: {details.get('hp', 'NOT FOUND')}")
        print(f"    Initiative: {details.get('init', 'NOT FOUND')}")
        print(f"    Abilities: {'YES' if details.get('abilities') else 'NO'}")
        print(f"    Skills: {len(details.get('skills', []))} found")
        print(f"    Senses: {len(details.get('senses', []))} found")
        print(f"    Actions: {len(details.get('actions', []))} found")
        print(f"    Special Actions: {len(details.get('specialActions', []))} found")
        print(f"    Is Legacy: {details.get('isLegacy', False)}")
        
        if not details.get('ac') and not details.get('hp'):
            print(f"  ⚠️  WARNING: No core stats extracted - data may be incomplete")
        else:
            print(f"  ✓ Successfully extracted monster stats")
        
        # Cache the details with timestamp in individual file
        cache_data = {
            'url': monster_url,
            'data': details,
            'timestamp': time.time()
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"  💾 Cached to {cache_file}")
        print(f"{'='*80}\n")
        
        return jsonify({'success': True, 'details': details, 'cached': False})
    
    except Exception as e:
        print(f"Error fetching monster details: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/statistics')
def statistics():
    """Statistics view for viewing aggregated campaign data"""
    return render_template('statistics.html')

@app.route('/spectator')
def spectator():
    """Spectator view for players to watch combat"""
    return render_template('spectator.html')

@app.route('/favicon.ico')
def favicon():
    """Return 204 No Content for favicon to suppress browser errors"""
    return '', 204

@app.route('/api/current-encounter')
def get_current_encounter():
    """Get the current active encounter state for spectator view - NO PIN REQUIRED"""
    try:
        return _get_current_encounter_impl()
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"\n{'='*80}")
        print(f"ERROR in /api/current-encounter:")
        print(f"{'='*80}")
        print(error_details)
        print(f"{'='*80}\n")
        # Return error as JSON so spectator can see it
        return jsonify({
            'active': False,
            'message': f'Server error: {str(e)}',
            'error_type': type(e).__name__
        }), 200  # Return 200 so the JS can parse the JSON

def _get_current_encounter_impl():
    """Implementation of get_current_encounter with error handling wrapper"""
    
    # Helper function to get avatar URL from cache
    def get_avatar_from_cache(url, cache_type='monster'):
        """Get avatar URL from cache file"""
        if not url:
            return None
        
        if cache_type == 'monster':
            if '/monsters/' in url:
                monster_id = url.split('/monsters/')[-1]
            else:
                monster_id = url
            cache_file = MONSTER_DETAILS_DIR / f"{monster_id}.json"
        else:  # character
            if '/characters/' in url:
                char_id = url.split('/characters/')[-1]
            else:
                char_id = url
            cache_file = CACHE_DIR / "characters" / f"{char_id}.json"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                    if cache_type == 'monster':
                        return cached.get('data', {}).get('avatarUrl')
                    else:
                        return cached.get('avatarUrl')
            except Exception:
                pass
        return None
    
    # Find the most recently modified adventure file
    adventure_files = list(DATA_DIR.glob("*.json"))
    if not adventure_files:
        return jsonify({'active': False, 'message': 'No adventures found'})
    
    # Get the most recently modified adventure
    latest_adventure = max(adventure_files, key=lambda f: f.stat().st_mtime)
    
    with open(latest_adventure, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Find active or most recent encounter
    active_encounter = None
    active_index = -1
    
    for idx, encounter in enumerate(data.get('encounters', [])):
        if encounter.get('state') == 'started':
            active_encounter = encounter
            active_index = idx
            break
    
    if not active_encounter:
        return jsonify({'active': False, 'message': 'No active encounter'})
    
    # Restore full URLs
    data = restore_adventure_from_storage(data)
    active_encounter = data['encounters'][active_index]
    
    # Enrich combatants with player character names
    # Extract just the character ID from the full URL for dictionary keys
    players_dict = {}
    for p in data.get('players', []):
        url = p.get('dndBeyondUrl', '')
        # Extract ID from URL like 'https://www.dndbeyond.com/characters/159889233'
        if '/characters/' in url:
            char_id = url.split('/characters/')[-1]
            players_dict[char_id] = p
        elif url.isdigit():
            # Already just an ID
            players_dict[url] = p
    
    enriched_combatants = []
    
    for combatant in active_encounter.get('combatants', []):
        combatant_copy = combatant.copy()
        # If combatant is a player (has numeric ID), add character name and initiative bonus
        if combatant.get('id'):
            combatant_id = str(combatant['id'])
            if combatant_id.isdigit():
                player = players_dict.get(combatant_id)
                if player:
                    combatant_copy['playerCharacterName'] = player.get('name', f"Player {combatant_id}")
                    combatant_copy['initiativeBonus'] = player.get('initiativeBonus', 0)
                    # Look up avatar from character cache
                    char_url = player.get('dndBeyondUrl', '')
                    avatar = get_avatar_from_cache(char_url, cache_type='character')
                    if avatar:
                        combatant_copy['avatarUrl'] = avatar
        
        # For monsters, get initiative modifier and avatar from cached data
        if combatant_copy.get('dndBeyondUrl'):
            url = combatant_copy['dndBeyondUrl']
            if '/monsters/' in url:
                monster_id = url.split('/monsters/')[-1]
                cache_file = MONSTER_DETAILS_DIR / f"{monster_id}.json"
                if cache_file.exists():
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached = json.load(f)
                        monster_data = cached.get('data', {})
                        # Try initiativeModifier first, then dex modifier
                        init_mod = monster_data.get('initiativeModifier')
                        if init_mod is None:
                            abilities = monster_data.get('abilities', {})
                            dex = abilities.get('dex')
                            if dex is not None:
                                # Handle both dict format {'modifier': X} and simple int format
                                if isinstance(dex, dict):
                                    init_mod = dex.get('modifier', 0)
                                elif isinstance(dex, int):
                                    # Calculate modifier from ability score: (score - 10) // 2
                                    init_mod = (dex - 10) // 2
                        if init_mod is not None:
                            combatant_copy['initiativeBonus'] = init_mod
                
                # Look up avatar from monster cache
                avatar = get_avatar_from_cache(url, cache_type='monster')
                if avatar:
                    combatant_copy['avatarUrl'] = avatar
        
        enriched_combatants.append(combatant_copy)
    
    # Return encounter data
    return jsonify({
        'active': True,
        'name': active_encounter.get('name', 'Combat'),
        'round': active_encounter.get('currentRound', 1),
        'state': active_encounter.get('state'),
        'activeCombatant': active_encounter.get('activeCombatant', ''),
        'combatants': enriched_combatants,
        'adventureName': data.get('name', 'Adventure')
    })


@app.route('/api/server-info')
def get_server_info():
    """Get server IP address for spectator URL"""
    import socket
    try:
        # Get local IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "localhost"
    
    return jsonify({
        'ip': ip,
        'port': request.environ.get('SERVER_PORT', '5000')
    })

@app.route('/api/adventures', methods=['GET'])
def list_adventures():
    """List all adventure files"""
    adventures = [f.stem for f in DATA_DIR.glob("*.json")]
    return jsonify(adventures)

@app.route('/api/adventure/<name>/verify-pin', methods=['POST'])
def verify_adventure_pin(name):
    """Verify PIN for a protected adventure"""
    filepath = DATA_DIR / f"{name}.json"
    if not filepath.exists():
        return jsonify({"error": "Adventure not found"}), 404
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    adventure_pin = data.get('pin')
    if not adventure_pin:
        # No PIN required
        return jsonify({"success": True, "message": "No PIN required"})
    
    # Check provided PIN
    provided_pin = request.json.get('pin', '')
    if str(provided_pin) == str(adventure_pin):
        # Store verified adventure with PIN version in session
        if 'verified_adventures' not in session:
            session['verified_adventures'] = {}
        
        pin_version = data.get('pinVersion', 0)
        session['verified_adventures'][name] = pin_version
        session.modified = True
        return jsonify({"success": True, "message": "PIN verified"})
    else:
        return jsonify({"success": False, "error": "Incorrect PIN"}), 401

@app.route('/api/adventure/<name>/check-pin', methods=['GET'])
def check_adventure_pin_status(name):
    """Check if an adventure requires PIN and if it's been verified"""
    filepath = DATA_DIR / f"{name}.json"
    if not filepath.exists():
        return jsonify({"error": "Adventure not found"}), 404
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    has_pin = 'pin' in data and data['pin']
    verified_adventures = session.get('verified_adventures', {})
    current_pin_version = data.get('pinVersion', 0)
    is_verified = name in verified_adventures and verified_adventures.get(name) == current_pin_version
    
    return jsonify({
        "requiresPin": has_pin,
        "isVerified": is_verified
    })

@app.route('/api/adventure/<name>/invalidate-sessions', methods=['POST'])
def invalidate_adventure_sessions(name):
    """Clear current session for this adventure (called when PIN changes)"""
    # Remove from current session's verified list
    if 'verified_adventures' in session:
        if name in session['verified_adventures']:
            del session['verified_adventures'][name]
        session.modified = True
    
    return jsonify({"success": True, "message": "Session cleared"})

@app.route('/api/adventure/<name>', methods=['GET'])
def get_adventure(name):
    """Load an adventure file"""
    filepath = DATA_DIR / f"{name}.json"
    if not filepath.exists():
        return jsonify({"error": "Adventure not found"}), 404
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Check if this is a read-only request (e.g., for statistics page)
    readonly = request.args.get('readonly', 'false').lower() == 'true'
    
    # Check if adventure has PIN protection (skip for read-only requests)
    adventure_pin = data.get('pin')
    if adventure_pin and not readonly:
        # Check if this adventure has been verified in this session with current PIN version
        verified_adventures = session.get('verified_adventures', {})
        current_pin_version = data.get('pinVersion', 0)
        
        # Check if adventure is verified AND has matching PIN version
        if name not in verified_adventures or verified_adventures.get(name) != current_pin_version:
            return jsonify({
                "error": "PIN required",
                "requiresPin": True,
                "adventureName": name
            }), 403
    
    # Restore full URLs after loading
    data = restore_adventure_from_storage(data)
    
    # For read-only requests, remove sensitive data like PIN
    if readonly:
        data.pop('pin', None)
        data.pop('pinVersion', None)
    
    # Keep both pin and pinVersion for the DM interface (non-readonly)
    # (They need to see/edit the PIN in settings)
    # Security is handled by the session-based verification on initial load
    
    return jsonify(data)

def calculate_default_encounter_cr(encounter):
    """Calculate the default CR for an encounter based on its monsters"""
    # CR to XP mapping
    CR_TO_XP = {
        '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
        '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
        '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
        '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
        '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
        '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
        '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
    }
    
    XP_TO_CR = [
        (10, '0'), (25, '1/8'), (50, '1/4'), (100, '1/2'),
        (200, '1'), (450, '2'), (700, '3'), (1100, '4'), (1800, '5'),
        (2300, '6'), (2900, '7'), (3900, '8'), (5000, '9'), (5900, '10'),
        (7200, '11'), (8400, '12'), (10000, '13'), (11500, '14'), (13000, '15'),
        (15000, '16'), (18000, '17'), (20000, '18'), (22000, '19'), (25000, '20'),
        (33000, '21'), (41000, '22'), (50000, '23'), (62000, '24'), (75000, '25'),
        (90000, '26'), (105000, '27'), (120000, '28'), (135000, '29'), (155000, '30')
    ]
    
    combatants = encounter.get('combatants', [])
    if not combatants:
        return '0'
    
    # Filter to only monsters (not players)
    # Players have numeric IDs, monsters have id with dashes or no id
    monsters = []
    for combatant in combatants:
        combatant_id = combatant.get('id', '')
        # If id is pure digits, it's a player, skip it
        if combatant_id and combatant_id.isdigit():
            continue
        # Otherwise it's a monster
        monsters.append(combatant)
    
    if not monsters:
        return '0'
    
    # Calculate total base XP
    total_xp = 0
    for combatant in monsters:
        cr = ''
        
        # Try to get CR from monster cache if we have an ID
        combatant_id = combatant.get('id', '')
        if combatant_id and '-' in combatant_id:
            cache_file = MONSTER_DETAILS_DIR / f"{combatant_id}.json"
            if cache_file.exists():
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached = json.load(f)
                        cr = cached.get('data', {}).get('cr', '')
                except Exception:
                    pass
        
        # Get XP for this CR
        xp = CR_TO_XP.get(cr, 0)
        total_xp += xp
    
    # Apply multiplier based on number of monsters
    monster_count = len(monsters)
    if monster_count == 0:
        multiplier = 1
    elif monster_count == 1:
        multiplier = 1
    elif monster_count == 2:
        multiplier = 1.5
    elif 3 <= monster_count <= 6:
        multiplier = 2
    elif 7 <= monster_count <= 10:
        multiplier = 2.5
    elif 11 <= monster_count <= 14:
        multiplier = 3
    else:
        multiplier = 4
    
    adjusted_xp = round(total_xp * multiplier)
    
    # Convert adjusted XP back to CR
    for xp_threshold, cr_value in reversed(XP_TO_CR):
        if adjusted_xp >= xp_threshold:
            return cr_value
    
    return '0'

def clean_adventure_for_storage(data):
    """Remove CR fields, shorten URLs, strip empty values, and remove default HP/AC before saving"""
    import copy
    import re
    data = copy.deepcopy(data)
    
    # Helper to get monster defaults from cache
    def get_monster_defaults(monster_id):
        """Get default HP and AC for a monster from cache"""
        if not monster_id or '/' in monster_id:
            return None, None
        
        cache_file = MONSTER_DETAILS_DIR / f"{monster_id}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                    monster_data = cached.get('data', {})
                    default_hp = monster_data.get('hp')
                    default_ac = monster_data.get('ac')
                    return default_hp, default_ac
            except Exception:
                pass
        return None, None
    
    # Helper to recursively remove empty strings, empty lists, empty dicts, None values, and zeros
    # BUT preserve important fields like 'pin' and 'pinVersion'
    def strip_empty(obj, parent_key=None):
        # Fields to preserve even if they have "empty" values
        preserve_fields = {'pin', 'pinVersion'}
        
        if isinstance(obj, dict):
            result = {}
            for k, v in obj.items():
                # Always preserve pin and pinVersion
                if k in preserve_fields:
                    result[k] = v
                # Strip empty values for other fields
                elif v not in (None, "", [], {}, 0, 0.0):
                    result[k] = strip_empty(v, k)
            return result
        elif isinstance(obj, list):
            return [strip_empty(item) for item in obj]
        else:
            return obj
    
    # Helper to extract character ID from URL
    def extract_character_id(url):
        """Extract just the character ID number from a D&D Beyond character URL"""
        if not url:
            return url
        # Match pattern like username/characters/NUMBER or just NUMBER
        match = re.search(r'(\d+)$', url)  # Any number of digits at the end
        if match:
            return match.group(1)
        return url
    
    # Strip common URL prefix
    monster_prefix = "https://www.dndbeyond.com/monsters/"
    
    # Clean encounters
    if 'encounters' in data:
        for encounter in data['encounters']:
            # Check if totalCR matches default - if so, remove it
            if 'totalCR' in encounter:
                default_cr = calculate_default_encounter_cr(encounter)
                if str(encounter['totalCR']) == str(default_cr):
                    del encounter['totalCR']
            
            if 'combatants' in encounter:
                for combatant in encounter['combatants']:
                    # Remove CR field (always look up from monster database)
                    if 'cr' in combatant:
                        del combatant['cr']
                    
                    # Remove avatarUrl (always look up from cache)
                    if 'avatarUrl' in combatant:
                        del combatant['avatarUrl']
                    
                    # Shorten field names for storage
                    if 'initiative' in combatant:
                        combatant['init'] = combatant['initiative']
                        del combatant['initiative']
                    
                    if 'dndBeyondUrl' in combatant:
                        combatant['id'] = combatant['dndBeyondUrl']
                        del combatant['dndBeyondUrl']
                    
                    # Check if this is a player (has id that looks like a character ID)
                    if 'id' in combatant and combatant['id']:
                        url = combatant['id']
                        
                        # If it's a character URL (contains only digits or profile path), it's a player
                        is_character = bool(re.search(r'/characters/|^\d+$', url))
                        
                        if is_character:
                            # Extract just the character ID
                            combatant['id'] = extract_character_id(url)
                            # Remove name for players (will look up from players list)
                            if 'name' in combatant:
                                del combatant['name']
                        else:
                            # It's a monster - shorten URL and check for default values
                            if url.startswith(monster_prefix):
                                monster_id = url[len(monster_prefix):]
                                combatant['id'] = monster_id
                                
                                # Get monster defaults and remove if matching
                                default_hp, default_ac = get_monster_defaults(monster_id)
                                
                                if default_hp is not None and combatant.get('maxHp') == default_hp:
                                    del combatant['maxHp']
                                
                                if default_ac is not None and combatant.get('ac') == default_ac:
                                    del combatant['ac']
                            else:
                                # Already shortened, check for defaults
                                default_hp, default_ac = get_monster_defaults(url)
                                
                                if default_hp is not None and combatant.get('maxHp') == default_hp:
                                    del combatant['maxHp']
                                
                                if default_ac is not None and combatant.get('ac') == default_ac:
                                    del combatant['ac']
                    else:
                        # No URL means it's a monster without URL - keep maxHp/ac as is
                        pass
    
    # Clean players - extract only character IDs
    if 'players' in data:
        for player in data['players']:
            if 'dndBeyondUrl' in player:
                player['dndBeyondUrl'] = extract_character_id(player['dndBeyondUrl'])
    
    # Strip all empty values
    return strip_empty(data)

def restore_adventure_from_storage(data):
    """Restore full URLs, provide defaults, and fill in monster HP/AC from cache"""
    import copy
    data = copy.deepcopy(data)
    
    monster_prefix = "https://www.dndbeyond.com/monsters/"
    character_prefix = "https://www.dndbeyond.com/characters/"
    
    # Helper to get monster defaults from cache
    def get_monster_defaults(monster_id):
        """Get default HP and AC for a monster from cache"""
        if not monster_id or '/' in monster_id:
            return None, None
        
        cache_file = MONSTER_DETAILS_DIR / f"{monster_id}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                    monster_data = cached.get('data', {})
                    default_hp = monster_data.get('hp')
                    default_ac = monster_data.get('ac')
                    return default_hp, default_ac
            except Exception:
                pass
        return None, None
    
    # Helper to ensure default values for missing fields
    def ensure_defaults(obj, defaults):
        """Merge defaults into object for any missing keys"""
        for key, default_value in defaults.items():
            if key not in obj or obj[key] is None:
                obj[key] = default_value
        return obj
    
    # Build a lookup map of character ID -> player info
    player_lookup = {}
    if 'players' in data:
        for player in data['players']:
            # Provide player-level defaults
            ensure_defaults(player, {
                'name': '',
                'playerName': '',
                'race': '',
                'class': '',
                'level': 1,
                'maxHp': 0,
                'ac': 10,
                'speed': 30,
                'initiativeBonus': 0,
                'passivePerception': 10,
                'passiveInvestigation': 10,
                'passiveInsight': 10,
                'notes': '',
                'dndBeyondUrl': ''
            })
            
            # Restore full character URL
            if player['dndBeyondUrl']:
                char_id = player['dndBeyondUrl']
                # Only add prefix if it doesn't already have it
                if not char_id.startswith('http'):
                    player['dndBeyondUrl'] = character_prefix + char_id
                    # Store in lookup by just the ID
                    player_lookup[char_id] = player
                else:
                    # Extract ID from full URL for lookup
                    char_id = char_id.split('/')[-1]
                    player_lookup[char_id] = player
    
    # Restore encounter URLs and defaults
    if 'encounters' in data:
        for encounter in data['encounters']:
            # Provide encounter-level defaults
            ensure_defaults(encounter, {
                'name': '',
                'chapter': '',
                'state': 'unstarted',
                'combatants': [],
                'currentRound': 1,
                'currentTurn': 0,
                'activeCombatant': None,
                'minimized': False,
                'treasure': '',
                'notes': ''
            })
            
            if 'combatants' in encounter:
                for combatant in encounter['combatants']:
                    # Restore full field names
                    if 'init' in combatant:
                        combatant['initiative'] = combatant['init']
                        del combatant['init']
                    
                    # Keep 'id' field for player lookup, also set dndBeyondUrl for display
                    if 'id' in combatant:
                        combatant['dndBeyondUrl'] = combatant['id']
                        # Keep 'id' for player combatant lookup
                    
                    # Provide combatant-level defaults
                    # Note: maxHp is handled separately for monsters (filled from cache)
                    ensure_defaults(combatant, {
                        'initiative': 0,
                        'hp': 0,
                        'dmg': 0,
                        'heal': 0,
                        'notes': '',
                        'dndBeyondUrl': ''
                    })
                    
                    if combatant['dndBeyondUrl']:
                        url = combatant['dndBeyondUrl']
                        
                        # Check if this looks like a character ID (digits only)
                        if url.isdigit():
                            # It's a player - restore URL and look up name from players list
                            combatant['dndBeyondUrl'] = character_prefix + url
                            
                            # Look up player name (don't set 'name' - its absence indicates player)
                            # The frontend will look up the name from the players list
                            if 'name' in combatant:
                                del combatant['name']
                        else:
                            # It's a monster - restore monster URL and ensure name exists
                            monster_id = url
                            if not url.startswith('http'):
                                combatant['dndBeyondUrl'] = monster_prefix + url
                            else:
                                # Extract ID from full URL
                                monster_id = url.split('/')[-1]
                            
                            # Fill in default HP and AC from monster cache if missing
                            default_hp, default_ac = get_monster_defaults(monster_id)
                            
                            if 'maxHp' not in combatant and default_hp is not None:
                                combatant['maxHp'] = default_hp
                            
                            if 'ac' not in combatant and default_ac is not None:
                                combatant['ac'] = default_ac
                            
                            # Ensure name exists for monsters (presence of 'name' indicates monster)
                            if 'name' not in combatant:
                                combatant['name'] = ''
                    elif 'name' not in combatant:
                        # No URL and no name - set empty name to indicate monster
                        combatant['name'] = ''
                    
                    # Final fallback for maxHp if still missing (e.g., for players or if cache lookup failed)
                    if 'maxHp' not in combatant:
                        combatant['maxHp'] = 0
    
    # Provide top-level defaults
    ensure_defaults(data, {
        'name': '',
        'players': [],
        'encounters': [],
        'chapters': [],
        'chapterNotes': {}
    })
    
    return data

@app.route('/api/adventure/<name>', methods=['POST'])
def save_adventure(name):
    """Save an adventure file (auto-save)"""
    filepath = DATA_DIR / f"{name}.json"
    
    # Check if the adventure requires PIN and if this session is validated
    if filepath.exists():
        with open(filepath, 'r') as f:
            existing_data = json.load(f)
            adventure_pin = existing_data.get('pin')
            
            if adventure_pin:
                # Verify this session has been validated with current PIN version
                verified_adventures = session.get('verified_adventures', {})
                current_pin_version = existing_data.get('pinVersion', 0)
                
                if name not in verified_adventures or verified_adventures.get(name) != current_pin_version:
                    return jsonify({
                        "error": "Unauthorized: PIN verification required",
                        "requiresPin": True
                    }), 403
    
    data = request.json
    
    # Clean data before saving
    cleaned_data = clean_adventure_for_storage(data)
    
    with open(filepath, 'w') as f:
        json.dump(cleaned_data, f, indent=2)
    
    return jsonify({"success": True})

@app.route('/api/adventure/<name>', methods=['DELETE'])
def delete_adventure(name):
    """Delete an adventure file"""
    filepath = DATA_DIR / f"{name}.json"
    if filepath.exists():
        filepath.unlink()
        return jsonify({"success": True})
    return jsonify({"error": "Adventure not found"}), 404

@app.route('/api/adventure', methods=['POST'])
def create_adventure():
    """Create a new adventure"""
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name required"}), 400
    
    filepath = DATA_DIR / f"{name}.json"
    if filepath.exists():
        return jsonify({"error": "Adventure already exists"}), 400
    
    initial_data = {
        "name": name,
        "players": [],
        "encounters": []
    }
    
    with open(filepath, 'w') as f:
        json.dump(initial_data, f, indent=2)
    
    return jsonify({"success": True})

if __name__ == '__main__':
    # Allow custom port via environment variable
    import os
    import sys
    import argparse
    import threading
    from werkzeug.serving import make_server
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='D&D Encounter Tracker Server')
    parser.add_argument('--enable-upnp', '--enable-external', 
                        action='store_true',
                        dest='enable_upnp',
                        help='Enable UPnP port forwarding and dynamic DNS updates (off by default)')
    args = parser.parse_args()
    
    print("="*50)
    print("D&D Encounter Tracker Server")
    print("="*50)
    
    # Get local IP for display
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "127.0.0.1"
    
    # Check for SSL certificate
    ssl_context = None
    ssl_config_file = Path('.cache/ssl_config.json')
    https_enabled = False
    
    if ssl_config_file.exists():
        try:
            with open(ssl_config_file, 'r') as f:
                ssl_config = json.load(f)
            
            cert_path = Path(ssl_config['cert_path'])
            key_path = Path(ssl_config['key_path'])
            
            if cert_path.exists() and key_path.exists():
                ssl_context = (str(cert_path), str(key_path))
                https_enabled = True
                print("🔐 SSL certificate found - enabling HTTPS")
                print(f"   Certificate: {cert_path}")
        except Exception as e:
            print(f"⚠️  Could not load SSL config: {e}")
    
    if not https_enabled:
        print("ℹ️  No SSL certificate - HTTP only mode")
    
    print()
    
    # Setup external access (DDNS + UPnP) - only if enabled via command line flag
    if args.enable_upnp:
        try:
            from ddns_upnp import setup_external_access
            if https_enabled:
                # HTTPS: Try external port 443 -> internal port 8443 first
                upnp_success, dns_success = setup_external_access(internal_port=8443, external_port=443)
                
                # If UPnP failed on port 443, try 8443 -> 8443 as fallback
                if not upnp_success:
                    print("⚠️  Port 443 UPnP failed, trying 8443 -> 8443 as fallback...")
                    setup_external_access(internal_port=8443, external_port=8443)
            else:
                # HTTP: external port 5000 -> internal port 5000
                setup_external_access(internal_port=5000, external_port=5000)
        except Exception:
            pass  # Silently continue if external access setup fails
    else:
        print("ℹ️  UPnP and dynamic DNS disabled (use --enable-upnp to enable)")
        print()
    
    # Display access URLs
    print("Access URLs:")
    if https_enabled:
        print(f"  🌍 External HTTPS: https://nbanks.dev")
        print(f"  🔒 Local HTTPS:    https://{local_ip}:8443 (certificate warning expected)")
        print(f"  🏠 Local HTTP:     http://{local_ip}:5000 (no SSL)")
    else:
        print(f"  🏠 Local HTTP:     http://{local_ip}:5000")
    print()
    print("Starting servers...")
    print()
    
    servers = []
    
    # Start HTTP server on port 5000 (always available)
    try:
        http_server = make_server('0.0.0.0', 5000, app, threaded=True)
        http_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
        http_thread.start()
        servers.append(('HTTP', 5000, http_server))
        print(f"✓ HTTP server running on port 5000")
    except Exception as e:
        print(f"✗ Failed to start HTTP server: {e}")
    
    # Start HTTPS server on port 8443 if certificate available
    if https_enabled:
        try:
            https_server = make_server('0.0.0.0', 8443, app, threaded=True, ssl_context=ssl_context)
            https_thread = threading.Thread(target=https_server.serve_forever, daemon=True)
            https_thread.start()
            servers.append(('HTTPS', 8443, https_server))
            print(f"✓ HTTPS server running on port 8443")
        except Exception as e:
            print(f"✗ Failed to start HTTPS server: {e}")
    
    if not servers:
        print("❌ No servers could be started!")
        sys.exit(1)
    
    print()
    print("Press Ctrl+C to stop all servers")
    print("="*50)
    print()
    
    # Keep main thread alive
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        for name, port, server in servers:
            print(f"  Stopping {name} server on port {port}...")
            server.shutdown()
        print("Done!")

