"""
Check which monster URLs return valid responses (200 OK vs 404)
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import COOKIES_CACHE
import requests
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

def load_cookies():
    """Load D&D Beyond cookies from cache"""
    cookies = {}
    if COOKIES_CACHE.exists():
        try:
            with open(COOKIES_CACHE, 'r', encoding='utf-8') as f:
                cookies = json.load(f)
            print(f"Loaded {len(cookies)} cookies")
        except Exception as e:
            print(f"Error loading cookies: {e}")
    return cookies

def check_url(monster_id, session, headers):
    """Check if a monster URL returns 200 OK"""
    # Try just the ID - D&D Beyond might redirect to the full slug URL
    url = f"https://www.dndbeyond.com/monsters/{monster_id}"
    
    try:
        # Use GET request (not HEAD) with short timeout to follow redirects
        response = session.get(url, headers=headers, timeout=5, allow_redirects=True)
        
        # Check if we got a valid monster page (not a 404 or marketplace redirect)
        is_valid = (
            response.status_code == 200 and 
            '/monsters/' in response.url and
            '/marketplace/' not in response.url  # Redirects to marketplace = no access
        )
        
        # Extract slug from final URL if valid
        slug = None
        if is_valid and response.url != url:
            # Extract slug from redirected URL (e.g., "416909-abyssal-chicken")
            slug = response.url.split('/monsters/')[-1].split('?')[0]
        elif is_valid:
            # No redirect means URL was already correct (just use ID)
            slug = monster_id
        
        return {
            'id': monster_id,
            'url': url,
            'final_url': response.url,
            'status': response.status_code,
            'slug': slug,
            'valid': is_valid
        }
    except requests.Timeout:
        return {
            'id': monster_id,
            'url': url,
            'status': 'TIMEOUT',
            'valid': False
        }
    except Exception as e:
        return {
            'id': monster_id,
            'url': url,
            'status': 'ERROR',
            'error': str(e),
            'valid': False
        }

def check_urls_parallel(monster_ids, cookies, max_workers=50):
    """Check multiple URLs in parallel"""
    results = []
    
    print(f"\nChecking {len(monster_ids)} URLs with {max_workers} parallel workers...")
    print(f"{'='*80}\n")
    
    # Create a session with cookies
    session = requests.Session()
    for key, value in cookies.items():
        session.cookies.set(key, value)
    
    # Set up browser-like headers
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.dndbeyond.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
    }
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks - share the same session and headers
        future_to_id = {
            executor.submit(check_url, monster_id, session, headers): monster_id 
            for monster_id in monster_ids
        }
        
        completed = 0
        valid_count = 0
        last_print_count = 0
        
        for future in as_completed(future_to_id):
            result = future.result()
            results.append(result)
            completed += 1
            
            if result['valid']:
                valid_count += 1
                # Print every valid find
                slug = result.get('slug', result['id'])
                print(f"[{completed}/{len(monster_ids)}] ✓ {slug:<50} ({valid_count} valid)")
            
            # Print progress every 100 checks for invalid ones
            elif completed - last_print_count >= 100:
                print(f"[{completed}/{len(monster_ids)}] Checked... ({valid_count} valid so far)")
                last_print_count = completed
    
    return results

def generate_monster_ids():
    """Generate candidate monster IDs to check"""
    # Known valid IDs from test suite and their ranges
    known_ranges = [
        (16700, 18000),      # 2014 SRD monsters
        (21800, 22100),      # Hoard of the Dragon Queen supplements
        (292000, 292200),    # Various supplements
        (300000, 300200),    
        (416800, 417800),    # Descent into Avernus
        (4904500, 4904800),  # Various
        (5174900, 5175100),  # 2024 Monsters
        (5194800, 5195400),  # 2024 Monster Manual
    ]
    
    monster_ids = []
    
    # Sample from each known range
    for start, end in known_ranges:
        # Add all IDs in range
        monster_ids.extend([str(id) for id in range(start, end)])
    
    print(f"Generated {len(monster_ids)} monster ID candidates from {len(known_ranges)} ranges")
    return monster_ids

if __name__ == '__main__':
    cookies = load_cookies()
    
    if not cookies:
        print("WARNING: No cookies loaded. Some monsters may not be accessible.")
    
    # Generate candidate IDs
    monster_ids = generate_monster_ids()
    print(f"Generated {len(monster_ids)} candidate monster IDs")
    
    # Check URLs
    results = check_urls_parallel(monster_ids, cookies, max_workers=20)
    
    # Analyze results
    valid_results = [r for r in results if r['valid']]
    not_found = [r for r in results if r.get('status') == 404]
    errors = [r for r in results if r.get('status') not in [200, 404]]
    redirects = [r for r in results if r['valid'] and r['final_url'] != r['url']]
    
    print(f"\n{'='*80}")
    print(f"RESULTS:")
    print(f"  Valid (200 OK): {len(valid_results)}")
    print(f"  Not Found (404): {len(not_found)}")
    print(f"  Redirects: {len(redirects)}")
    print(f"  Errors: {len(errors)}")
    print(f"{'='*80}\n")
    
    # Save results to JSON
    output_file = Path('.cache/monster_url_check.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': time.time(),
            'total_checked': len(results),
            'valid_count': len(valid_results),
            'results': results
        }, f, indent=2)
    
    print(f"Full results saved to: {output_file}")
    
    # Save just valid IDs and slugs to a file for easy fetching
    valid_ids_file = Path('.cache/valid_monster_ids.txt')
    with open(valid_ids_file, 'w', encoding='utf-8') as f:
        for result in sorted(valid_results, key=lambda x: int(x['id'])):
            slug = result.get('slug', result['id'])
            f.write(f"{slug}\n")
    
    print(f"Valid monster IDs/slugs saved to: {valid_ids_file}")
    
    # Print some examples of valid monsters
    print(f"\nSample of valid monster IDs/slugs:")
    for result in valid_results[:20]:
        slug = result.get('slug', result['id'])
        print(f"  {slug}")
    
    if len(valid_results) > 20:
        print(f"  ... and {len(valid_results) - 20} more")
