"""
Fetch 50 random monsters from D&D Beyond
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import get_monster_details, CACHE_DIR, MONSTER_DETAILS_DIR
import json
import random
import time
from pathlib import Path

def get_monster_list():
    """Load monster URLs from monsters.json"""
    print("Loading monster URLs from monsters.json...")
    
    monsters_file = CACHE_DIR / "monsters.json"
    
    if not monsters_file.exists():
        print("ERROR: monsters.json not found!")
        return []
    
    with open(monsters_file, 'r', encoding='utf-8') as f:
        monsters_data = json.load(f)
    
    # Extract URLs from the dictionary
    monster_urls = []
    for name, data in monsters_data.items():
        if 'url' in data:
            monster_urls.append({
                'name': name,
                'url': data['url'],
                'cr': data.get('cr', 'Unknown')
            })
    
    print(f"Loaded {len(monster_urls)} monster URLs from monsters.json")
    return monster_urls

def fetch_monsters(monster_list, count=50):
    """Fetch monster details for the given URLs"""
    print(f"\n{'='*80}")
    print(f"FETCHING {count} MONSTERS")
    print(f"{'='*80}\n")
    
    passed = 0
    failed = 0
    errors = []
    skipped_no_data = 0
    
    for monster_info in monster_list[:count * 2]:  # Try 2x to account for access issues
        if passed >= count:
            break
            
        name = monster_info['name']
        url = monster_info['url']
        cr = monster_info.get('cr', '?')
        
        # Extract slug from URL
        slug = url.split('/monsters/')[-1].split('?')[0]
        
        print(f"[{passed+1}/{count}] {name:<40}", end=' ', flush=True)
        
        try:
            # Call get_monster_details (will cache to file)
            try:
                get_monster_details(url)
            except RuntimeError as e:
                if "application context" not in str(e):
                    raise
                # Expected error due to jsonify() outside Flask context
                pass
            
            # Find cache file
            cache_files = list(MONSTER_DETAILS_DIR.glob(f"{slug}.json"))
            if not cache_files:
                # Try with just the ID part
                monster_id = slug.split('-')[0]
                cache_files = list(MONSTER_DETAILS_DIR.glob(f"{monster_id}-*.json"))
            
            if not cache_files:
                # Not cached - skip silently
                print(f"\r{' ' * 80}\r", end='', flush=True)  # Clear line
                skipped_no_data += 1
                time.sleep(0.2)
                continue
            
            cache_file = cache_files[0]
            
            # Read from cache
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            data = cache_data.get('data', {})
            actions_count = len(data.get('actions', []))
            special_count = len(data.get('specialActions', []))
            
            # Check if monster has valid data
            if not data.get('hp') and not data.get('abilities'):
                # No data (requires purchase) - skip silently
                print(f"\r{' ' * 80}\r", end='', flush=True)  # Clear line
                skipped_no_data += 1
                continue
            
            # Validate format
            if data.get('formatVersion') != 2:
                raise ValueError(f"formatVersion is {data.get('formatVersion')}, expected 2")
            
            # Check abilities are flat
            abilities = data.get('abilities', {})
            if abilities and isinstance(list(abilities.values())[0], dict):
                raise ValueError("abilities are nested, should be flat")
            
            # Check no description in actions
            for action in data.get('actions', []):
                if 'description' in action:
                    raise ValueError(f"Action '{action['name']}' has description field")
            
            print(f"CR {cr:<4} OK ({actions_count}a/{special_count}s)")
            passed += 1
                
        except Exception as e:
            error_msg = str(e)
            if "No stat block" not in error_msg and "HTTP 404" not in error_msg:
                print(f"FAILED - {error_msg}")
                failed += 1
                errors.append({
                    'name': name,
                    'url': url,
                    'error': error_msg
                })
            else:
                # Skip errors silently
                print(f"\r{' ' * 80}\r", end='', flush=True)  # Clear line
                skipped_no_data += 1
        
        # Small delay between requests
        time.sleep(0.3)
    
    print(f"\n{'='*80}")
    print(f"RESULTS: {passed} passed, {failed} failed")
    print(f"Skipped: {skipped_no_data} (no data/requires purchase)")
    print(f"{'='*80}")
    
    if errors:
        print("\nERRORS:")
        for err in errors:
            print(f"  {err['name']}: {err['error']}")
    
    return passed, failed

if __name__ == '__main__':
    # Get monster URLs from monsters.json
    all_monsters = get_monster_list()
    
    if not all_monsters:
        print("No monster URLs loaded!")
        sys.exit(1)
    
    # Randomly shuffle the monsters
    random.shuffle(all_monsters)
    
    print(f"\nAttempting to fetch 50 monsters from {len(all_monsters)} available...")
    
    # Fetch them
    fetch_monsters(all_monsters, count=50)
