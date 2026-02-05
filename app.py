from flask import Flask, render_template, request, jsonify
import json
import os
from pathlib import Path
import requests
from functools import lru_cache
import time
from bs4 import BeautifulSoup
import re

app = Flask(__name__)
DATA_DIR = Path("adventures")
DATA_DIR.mkdir(exist_ok=True)

CACHE_DIR = Path(".cache")
CACHE_DIR.mkdir(exist_ok=True)
MONSTERS_CACHE = CACHE_DIR / "monsters.json"
COOKIES_CACHE = CACHE_DIR / "cookies.json"
MONSTER_DETAILS_DIR = CACHE_DIR / "monsters"
MONSTER_DETAILS_DIR.mkdir(exist_ok=True)

# Store D&D Beyond cookies
DNDBEYOND_COOKIES = {}

# Load cookies from cache if available
if COOKIES_CACHE.exists():
    try:
        with open(COOKIES_CACHE, 'r', encoding='utf-8') as f:
            DNDBEYOND_COOKIES = json.load(f)
        print(f"Loaded {len(DNDBEYOND_COOKIES)} cookies from cache")
    except Exception as e:
        print(f"Error loading cookies: {e}")

@app.route('/api/dndbeyond/set-cookies', methods=['POST'])
def set_dndbeyond_cookies():
    """Store D&D Beyond authentication cookies"""
    global DNDBEYOND_COOKIES
    data = request.json
    DNDBEYOND_COOKIES = data.get('cookies', {})
    
    # Save to file
    with open(COOKIES_CACHE, 'w', encoding='utf-8') as f:
        json.dump(DNDBEYOND_COOKIES, f, indent=2)
    
    print(f"Stored {len(DNDBEYOND_COOKIES)} cookies and saved to cache")
    return jsonify({"success": True})

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
    """Scrape monsters from D&D Beyond and cache them"""
    try:
        # Check if we have cached data and it's recent (less than 30 days old)
        if MONSTERS_CACHE.exists():
            cache_age = time.time() - MONSTERS_CACHE.stat().st_mtime
            if cache_age < 2592000:  # 30 days (60*60*24*30)
                print(f"Loading monsters from cache (age: {cache_age/86400:.1f} days)")
                with open(MONSTERS_CACHE, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                return jsonify({'success': True, 'monsters': cached_data, 'count': len(cached_data), 'cached': True})
        
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
                    score = int(score_elem.get_text(strip=True))
                    modifier_text = modifier_elem.get_text(strip=True).strip('()+')
                    modifier = int(modifier_text) if modifier_text else 0
                    
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

@app.route('/api/dndbeyond/monster/<path:monster_url>', methods=['GET'])
def get_monster_details(monster_url):
    """Fetch detailed monster stats from D&D Beyond (JIT)"""
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
                    print(f"Returning cached details for {monster_id} (age: {cache_age/86400:.1f} days)")
                    return jsonify({'success': True, 'details': cached_data.get('data', {}), 'cached': True})
                else:
                    print(f"Cache expired for {monster_id} (age: {cache_age/86400:.1f} days)")
        
        # Need to scrape
        if not DNDBEYOND_COOKIES:
            print("No cookies available for fetching monster details")
            return jsonify({'success': False, 'error': 'No authentication cookies available'})
        
        print(f"Scraping monster page with {len(DNDBEYOND_COOKIES)} cookies...")
        
        # Use a session to properly handle cookies and redirects
        session = requests.Session()
        
        # Add all cookies to the session
        for cookie_name, cookie_value in DNDBEYOND_COOKIES.items():
            session.cookies.set(cookie_name, cookie_value, domain='.dndbeyond.com')
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Try to prevent redirect by setting allow_redirects=False first
        response = session.get(monster_url, headers=headers, timeout=15, allow_redirects=False)
        
        # If we get a redirect, try following it with our cookies
        if response.status_code in [301, 302, 303, 307, 308]:
            redirect_location = response.headers.get('Location', 'Unknown')
            print(f"  Got redirect to: {redirect_location}")
            print(f"  Attempting to follow redirect with authentication...")
            
            # If it's redirecting to marketplace, that's a hard fail
            if 'marketplace' in redirect_location.lower():
                error_msg = 'Monster requires purchase of Tyranny of Dragons adventure'
                print(f"  ERROR: {error_msg}")
                cache_data = {
                    'url': monster_url,
                    'data': {},
                    'error': error_msg,
                    'timestamp': time.time()
                }
                with open(cache_file, 'w') as f:
                    json.dump(cache_data, f)
                return jsonify({'success': False, 'error': error_msg})
            
            # Try following the redirect with cookies
            response = session.get(redirect_location, headers=headers, timeout=15, allow_redirects=True)
        
        if response.status_code != 200:
            error_msg = f'HTTP {response.status_code}'
            print(f"Failed to fetch monster page: {error_msg}")
            return jsonify({'success': False, 'error': error_msg})
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check if we got redirected to marketplace or got an invalid page
        page_title = soup.find('title')
        if page_title:
            title_text = page_title.get_text().lower()
            # Check for various error/redirect indicators
            if 'shop' in title_text or 'marketplace' in title_text or 'category' in title_text:
                error_msg = 'Monster page redirected to marketplace - may not be accessible'
                print(f"  ERROR: {error_msg} (title: {title_text})")
                # Save debug HTML
                debug_file = CACHE_DIR / f"monster_debug_{monster_id}.html"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"  Saved debug HTML to {debug_file}")
                # Save error to cache to avoid repeated attempts
                cache_data = {
                    'url': monster_url,
                    'data': {},
                    'error': error_msg,
                    'timestamp': time.time()
                }
                with open(cache_file, 'w') as f:
                    json.dump(cache_data, f)
                return jsonify({'success': False, 'error': error_msg})
        
        details = {}
        
        # Check for legacy badge on the monster details page
        is_legacy = False
        legacy_badge = soup.select_one('.badge .badge-label#legacy-badge, [aria-label="legacy"]')
        if legacy_badge:
            is_legacy = True
            print(f"  Detected LEGACY monster")
        
        details['isLegacy'] = is_legacy
        
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
        
        # Extract AC with type
        ac_label, ac_format = find_stat_label(soup, r'Armor\s+Class|^AC$')
        if ac_label:
            # Choose class prefix based on format
            prefix = 'mon-stat-block-2024' if ac_format == 'new' else 'mon-stat-block'
            # For 2024 format, the value is directly next to the label, not in a sibling
            if ac_format == 'new':
                ac_elem = ac_label.find_next_sibling('span', class_=f'{prefix}__attribute-value')
            else:
                ac_elem = ac_label.find_next_sibling('span', class_=f'{prefix}__attribute-data')
            if ac_elem:
                ac_value = ac_elem.find('span', class_=f'{prefix}__attribute-data-value')
                if ac_value:
                    ac_match = re.search(r'(\d+)', ac_value.get_text(strip=True))
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
                speed_match = re.search(r'(\d+)\s*ft', speed_text)
                if speed_match:
                    details['walkSpeed'] = int(speed_match.group(1))
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
                            score = int(cells[1].get_text(strip=True))
                            modifier = int(cells[2].get_text(strip=True))
                            # cells[3] is the saving throw modifier
                            if ability_name in ability_names:
                                details['abilities'][ability_name] = {
                                    'score': score,
                                    'modifier': modifier
                                }
                details['initiativeModifier'] = details['abilities']['dex']['modifier']
                print(f"  Found Abilities (2024): STR {details['abilities']['str']['score']}, DEX {details['abilities']['dex']['score']}, CON {details['abilities']['con']['score']}, INT {details['abilities']['int']['score']}, WIS {details['abilities']['wis']['score']}, CHA {details['abilities']['cha']['score']}")
                print(f"  Initiative Modifier: {details['initiativeModifier']:+d}")
        else:
            # Try legacy 2014 format
            stat_scores = soup.find_all('span', class_='ability-block__score')
            stat_modifiers = soup.find_all('span', class_='ability-block__modifier')
            
            if len(stat_scores) >= 6:
                details['abilities'] = {}
                for i, ability in enumerate(ability_names):
                    score = int(stat_scores[i].get_text(strip=True))
                    modifier_text = stat_modifiers[i].get_text(strip=True).strip('()')
                    modifier = int(modifier_text)
                    details['abilities'][ability] = {
                        'score': score,
                        'modifier': modifier
                    }
                details['initiativeModifier'] = details['abilities']['dex']['modifier']
                print(f"  Found Abilities (2014): STR {details['abilities']['str']['score']}, DEX {details['abilities']['dex']['score']}, CON {details['abilities']['con']['score']}, INT {details['abilities']['int']['score']}, WIS {details['abilities']['wis']['score']}, CHA {details['abilities']['cha']['score']}")
                print(f"  Initiative Modifier: {details['initiativeModifier']:+d}")
        
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
                details['skills'] = skills_data.get_text(strip=True)
                print(f"  Found Skills: {details['skills']}")
        
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
                details['damageResistances'] = resist_data.get_text(strip=True)
                print(f"  Found Resistances: {details['damageResistances']}")
        
        # Extract Damage Immunities
        immune_label, immune_format = find_tidbit_label(soup, r'Damage Immunities')
        if immune_label:
            prefix = 'mon-stat-block-2024' if immune_format == 'new' else 'mon-stat-block'
            immune_data = immune_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if immune_data:
                details['damageImmunities'] = immune_data.get_text(strip=True)
                print(f"  Found Immunities: {details['damageImmunities']}")
        
        # Extract Condition Immunities
        cond_label, cond_format = find_tidbit_label(soup, r'Condition Immunities')
        if cond_label:
            prefix = 'mon-stat-block-2024' if cond_format == 'new' else 'mon-stat-block'
            cond_data = cond_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if cond_data:
                details['conditionImmunities'] = cond_data.get_text(strip=True)
                print(f"  Found Condition Immunities: {details['conditionImmunities']}")
        
        # Extract Senses
        senses_label, senses_format = find_tidbit_label(soup, r'Senses')
        if senses_label:
            prefix = 'mon-stat-block-2024' if senses_format == 'new' else 'mon-stat-block'
            senses_data = senses_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if senses_data:
                details['senses'] = senses_data.get_text(strip=True)
                print(f"  Found Senses: {details['senses']}")
        
        # Extract Languages
        lang_label, lang_format = find_tidbit_label(soup, r'Languages')
        if lang_label:
            prefix = 'mon-stat-block-2024' if lang_format == 'new' else 'mon-stat-block'
            lang_data = lang_label.find_next_sibling('span', class_=f'{prefix}__tidbit-data')
            if lang_data:
                details['languages'] = lang_data.get_text(strip=True)
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
                xp_match = re.search(r'\(([,\d]+)\s*XP\)', cr_text)
                if xp_match:
                    details['xp'] = xp_match.group(1).replace(',', '')
                if 'cr' in details:
                    print(f"  Found CR: {details.get('cr', 'N/A')}")
        
        # Extract Traits (Special Abilities)
        traits = []
        
        # Try 2024 format first - check if we're in 2024 mode by looking for the stat block
        stat_block_2024 = soup.find('div', class_='mon-stat-block-2024')
        
        if stat_block_2024:
            # In 2024, tidbits that aren't standard fields are traits (like Proficiency Bonus)
            trait_tidbits = stat_block_2024.find_all('div', class_='mon-stat-block-2024__tidbit')
            for block in trait_tidbits:
                name_elem = block.find('span', class_='mon-stat-block-2024__tidbit-label')
                data_elem = block.find('span', class_='mon-stat-block-2024__tidbit-data')
                
                if name_elem and data_elem:
                    name = name_elem.get_text(strip=True)
                    # Skip standard fields
                    if name.lower() not in ['saving throws', 'skills', 'damage vulnerabilities', 
                                           'damage resistances', 'damage immunities', 
                                           'condition immunities', 'senses', 'languages', 'challenge', 'cr', 'gear']:
                        description = data_elem.get_text(strip=True)
                        traits.append({'name': name, 'description': description})
        else:
            # Legacy 2014 format
            trait_blocks = soup.find_all('div', class_='mon-stat-block__tidbit')
            for block in trait_blocks:
                name_elem = block.find('span', class_='mon-stat-block__tidbit-label')
                data_elem = block.find('span', class_='mon-stat-block__tidbit-data')
                
                if name_elem and data_elem:
                    name = name_elem.get_text(strip=True)
                    # Skip standard fields
                    if name.lower() not in ['saving throws', 'skills', 'damage vulnerabilities', 
                                           'damage resistances', 'damage immunities', 
                                           'condition immunities', 'senses', 'languages', 'challenge']:
                        description = data_elem.get_text(strip=True)
                        traits.append({'name': name, 'description': description})
        
        if traits:
            details['traits'] = traits
            print(f"  Found {len(traits)} Traits")
        
        # Extract Actions
        actions = []
        
        # Try 2024 format first
        if stat_block_2024:
            desc_blocks = stat_block_2024.find_all('div', class_='mon-stat-block-2024__description-block')
            for block in desc_blocks:
                heading = block.find('div', class_='mon-stat-block-2024__description-block-heading')
                if heading and re.search(r'^Actions\s*$', heading.get_text(strip=True), re.I):
                    content_div = block.find('div', class_='mon-stat-block-2024__description-block-content')
                    if content_div:
                        action_paragraphs = content_div.find_all('p')
                        for p in action_paragraphs:
                            strong = p.find('strong')
                            if strong:
                                name = strong.get_text(strip=True).rstrip('.')
                                description = p.get_text(strip=True)
                                if description.startswith(name):
                                    description = description[len(name):].lstrip('. ')
                                actions.append({'name': name, 'description': description})
        else:
            # Legacy 2014 format
            actions_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'^Actions\s*$', re.I))
            if actions_heading:
                content_div = actions_heading.find_next_sibling('div', class_='mon-stat-block__description-block-content')
                if content_div:
                    action_paragraphs = content_div.find_all('p')
                    for p in action_paragraphs:
                        strong = p.find('strong')
                        if strong:
                            name = strong.get_text(strip=True).rstrip('.')
                            description = p.get_text(strip=True)
                            if description.startswith(name):
                                description = description[len(name):].lstrip('. ')
                            actions.append({'name': name, 'description': description})
        
        if actions:
            details['actions'] = actions
            print(f"  Found {len(actions)} Actions")
        
        # Extract Legendary Actions
        legendary_actions = []
        legendary_heading = soup.find('div', class_='mon-stat-block__description-block-heading', string=re.compile(r'Legendary Actions', re.I))
        if legendary_heading:
            # Get the description paragraph (might be before the first action)
            content_div = legendary_heading.find_next_sibling('div', class_='mon-stat-block__description-block-content')
            if content_div:
                # First paragraph might be description
                first_p = content_div.find('p')
                if first_p and not first_p.find('strong'):
                    details['legendaryActionsDescription'] = first_p.get_text(strip=True)
                
                # Find all action paragraphs
                action_paragraphs = content_div.find_all('p')
                for p in action_paragraphs:
                    strong = p.find('strong')
                    if strong:
                        name = strong.get_text(strip=True).rstrip('.')
                        description = p.get_text(strip=True)
                        if description.startswith(name):
                            description = description[len(name):].lstrip('. ')
                        legendary_actions.append({'name': name, 'description': description})
        
        if legendary_actions:
            details['legendaryActions'] = legendary_actions
            print(f"  Found {len(legendary_actions)} Legendary Actions")
        
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
        
        if not details:
            print("  WARNING: No stats found on page - selectors may need updating")
            # Save a debug file
            debug_file = CACHE_DIR / f"monster_debug_{monster_url.split('/')[-1]}.html"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(response.text)
            print(f"  Saved debug HTML to {debug_file}")
        
        print(f"Extracted details: {details}")
        
        # Cache the details with timestamp in individual file
        cache_data = {
            'url': monster_url,
            'data': details,
            'timestamp': time.time()
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        
        print(f"Cached to {cache_file}")
        
        return jsonify({'success': True, 'details': details, 'cached': False})
    
    except Exception as e:
        print(f"Error fetching monster details: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/adventures', methods=['GET'])
def list_adventures():
    """List all adventure files"""
    adventures = [f.stem for f in DATA_DIR.glob("*.json")]
    return jsonify(adventures)

@app.route('/api/adventure/<name>', methods=['GET'])
def get_adventure(name):
    """Load an adventure file"""
    filepath = DATA_DIR / f"{name}.json"
    if not filepath.exists():
        return jsonify({"error": "Adventure not found"}), 404
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Restore full URLs after loading
    data = restore_adventure_from_storage(data)
    
    return jsonify(data)

def clean_adventure_for_storage(data):
    """Remove CR fields and shorten URLs before saving"""
    import copy
    data = copy.deepcopy(data)
    
    # Strip common URL prefix
    url_prefix = "https://www.dndbeyond.com/monsters/"
    
    # Clean encounters
    if 'encounters' in data:
        for encounter in data['encounters']:
            if 'combatants' in encounter:
                for combatant in encounter['combatants']:
                    # Remove CR field (always look up from monster database)
                    if 'cr' in combatant:
                        del combatant['cr']
                    
                    # Shorten dndBeyondUrl
                    if 'dndBeyondUrl' in combatant and combatant['dndBeyondUrl'].startswith(url_prefix):
                        combatant['dndBeyondUrl'] = combatant['dndBeyondUrl'][len(url_prefix):]
    
    # Clean players
    if 'players' in data:
        for player in data['players']:
            # Shorten player dndBeyondUrl (different prefix for characters)
            if 'dndBeyondUrl' in player:
                # Strip common character URL prefixes
                char_prefixes = [
                    "https://www.dndbeyond.com/profile/",
                    "https://www.dndbeyond.com/characters/"
                ]
                for prefix in char_prefixes:
                    if player['dndBeyondUrl'].startswith(prefix):
                        player['dndBeyondUrl'] = player['dndBeyondUrl'][len(prefix):]
                        break
    
    return data

def restore_adventure_from_storage(data):
    """Restore full URLs after loading"""
    import copy
    data = copy.deepcopy(data)
    
    monster_prefix = "https://www.dndbeyond.com/monsters/"
    
    # Restore encounter URLs
    if 'encounters' in data:
        for encounter in data['encounters']:
            if 'combatants' in encounter:
                for combatant in encounter['combatants']:
                    # Restore monster URL if it's shortened
                    if 'dndBeyondUrl' in combatant and combatant['dndBeyondUrl']:
                        url = combatant['dndBeyondUrl']
                        # Only add prefix if it doesn't already have it
                        if not url.startswith('http'):
                            combatant['dndBeyondUrl'] = monster_prefix + url
    
    # Restore player URLs
    if 'players' in data:
        for player in data['players']:
            if 'dndBeyondUrl' in player and player['dndBeyondUrl']:
                url = player['dndBeyondUrl']
                # Only add prefix if it doesn't already have it
                if not url.startswith('http'):
                    # Determine if it's a profile or character URL based on format
                    if '/' in url and not url.startswith('characters/'):
                        # Looks like profile/username/characters/id
                        player['dndBeyondUrl'] = "https://www.dndbeyond.com/profile/" + url
                    else:
                        # Direct character ID
                        player['dndBeyondUrl'] = "https://www.dndbeyond.com/characters/" + url
    
    return data

@app.route('/api/adventure/<name>', methods=['POST'])
def save_adventure(name):
    """Save an adventure file (auto-save)"""
    filepath = DATA_DIR / f"{name}.json"
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
    app.run(debug=True, port=5000)
