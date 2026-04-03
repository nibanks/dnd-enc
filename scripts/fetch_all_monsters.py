#!/usr/bin/env python3
"""
Fetch and parse all monsters from monsters.json in parallel.
Marks monsters with access issues as "noAccess": true.
"""

import json
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import get_monster_details, app

# Constants
CACHE_DIR = Path(__file__).parent.parent / '.cache'
MONSTERS_JSON = CACHE_DIR / 'monsters.json'
MAX_WORKERS = 15  # Parallel workers
TEST_LIMIT = None  # Set to a number to limit monsters for testing, None for all

# Thread-safe counters
stats = {
    'total': 0,
    'success': 0,
    'no_access': 0,
    'failed': 0,
    'skipped': 0
}
stats_lock = Lock()

def load_monsters():
    """Load all monsters from monsters.json"""
    print(f"Loading monsters from {MONSTERS_JSON}...")
    with open(MONSTERS_JSON, 'r', encoding='utf-8') as f:
        monsters = json.load(f)
    
    print(f"Found {len(monsters)} monsters in library")
    return monsters

def save_monsters(monsters):
    """Save updated monsters.json with noAccess flags"""
    print(f"\nSaving updated monsters.json...")
    with open(MONSTERS_JSON, 'w', encoding='utf-8') as f:
        json.dump(monsters, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved {len(monsters)} monsters")

def delete_invalid_cache(monster_id):
    """Delete cached file if it's invalid"""
    cache_file = CACHE_DIR / 'monsters' / f'{monster_id}.json'
    if cache_file.exists():
        try:
            cache_file.unlink()
            return True
        except Exception:
            return False
    return False

def fetch_monster(name, monster_data, monsters_dict, dict_lock):
    """Fetch a single monster and update stats"""
    url = monster_data.get('url')
    if not url:
        with stats_lock:
            stats['skipped'] += 1
        return (name, 'skipped', 'No URL')
    
    # Extract monster ID from URL
    monster_id = url.split('/')[-1]
    
    try:
        # Use Flask app context for fetching
        with app.app_context():
            result = get_monster_details(url)
            
            # Check if fetch was successful
            if hasattr(result, 'json'):
                result_data = result.json
            else:
                result_data = result
            
            if result_data.get('success'):
                details = result_data.get('details', {})
                
                # Validate critical fields
                validation_errors = []
                if 'formatVersion' not in details or details['formatVersion'] != 2:
                    validation_errors.append('missing/wrong formatVersion')
                if 'abilities' not in details or not isinstance(details['abilities'], dict):
                    validation_errors.append('missing/invalid abilities')
                if 'actions' not in details:
                    validation_errors.append('missing actions')
                
                # Check if we got an essentially empty response (likely no access)
                # If we only got formatVersion and isLegacy, this is probably a no-access situation
                if len(details) <= 3 and 'formatVersion' in details and 'abilities' not in details:
                    with dict_lock:
                        monsters_dict[name]['noAccess'] = True
                    
                    # Delete the invalid cache file
                    delete_invalid_cache(monster_id)
                    
                    with stats_lock:
                        stats['no_access'] += 1
                    return (name, 'no_access', 'Empty response - likely no access')
                
                if validation_errors:
                    with stats_lock:
                        stats['failed'] += 1
                    return (name, 'validation_failed', ', '.join(validation_errors))
                
                # Success - remove noAccess flag if it exists
                with dict_lock:
                    if 'noAccess' in monsters_dict[name]:
                        del monsters_dict[name]['noAccess']
                
                with stats_lock:
                    stats['success'] += 1
                return (name, 'success', monster_id)
            else:
                error = result_data.get('error', 'Unknown error')
                
                # Check if it's an access issue
                if 'access' in error.lower() or '403' in error or '404' in error:
                    # Mark as no access
                    with dict_lock:
                        monsters_dict[name]['noAccess'] = True
                    
                    with stats_lock:
                        stats['no_access'] += 1
                    return (name, 'no_access', error)
                else:
                    with stats_lock:
                        stats['failed'] += 1
                    return (name, 'failed', error)
                    
    except Exception as e:
        error_msg = str(e)
        
        # Check if it's likely an access issue
        if 'access' in error_msg.lower() or '403' in error_msg or '404' in error_msg:
            with dict_lock:
                monsters_dict[name]['noAccess'] = True
            
            with stats_lock:
                stats['no_access'] += 1
            return (name, 'no_access', error_msg)
        else:
            with stats_lock:
                stats['failed'] += 1
            return (name, 'failed', error_msg)

def validate_cached_monsters():
    """Validate all cached monster files"""
    print("\n" + "="*80)
    print("VALIDATING CACHED MONSTERS")
    print("="*80)
    
    cache_dir = CACHE_DIR / 'monsters'
    if not cache_dir.exists():
        print("No monsters cache directory found")
        return
    
    monster_files = list(cache_dir.glob('*.json'))
    print(f"Found {len(monster_files)} cached monster files")
    
    validation_results = {
        'valid': 0,
        'invalid': 0,
        'errors': []
    }
    
    for monster_file in monster_files:
        try:
            with open(monster_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check structure
            if 'data' not in data:
                validation_results['errors'].append(f"{monster_file.name}: Missing 'data' field")
                validation_results['invalid'] += 1
                continue
            
            details = data['data']
            
            # Check critical fields
            issues = []
            if details.get('formatVersion') != 2:
                issues.append('formatVersion != 2')
            if not isinstance(details.get('abilities'), dict):
                issues.append('invalid abilities')
            if 'actions' not in details:
                issues.append('missing actions')
            if 'initBonus' not in details:
                issues.append('missing initBonus')
            
            # Check for old fields that should be removed
            if 'xp' in details:
                issues.append('has xp field (should be removed)')
            if 'walkSpeed' in details:
                issues.append('has walkSpeed field (should be removed)')
            if 'init' in details and 'initBonus' not in details:
                issues.append('has old init field instead of initBonus')
            if 'proficiencyBonus' in details:
                issues.append('has old proficiencyBonus instead of profBonus')
            
            if issues:
                validation_results['errors'].append(f"{monster_file.name}: {', '.join(issues)}")
                validation_results['invalid'] += 1
            else:
                validation_results['valid'] += 1
                
        except Exception as e:
            validation_results['errors'].append(f"{monster_file.name}: {str(e)}")
            validation_results['invalid'] += 1
    
    print(f"\nValidation Results:")
    print(f"  ✓ Valid: {validation_results['valid']}")
    print(f"  ✗ Invalid: {validation_results['invalid']}")
    
    if validation_results['errors']:
        print(f"\nValidation Errors (showing first 20):")
        for error in validation_results['errors'][:20]:
            print(f"  • {error}")
        if len(validation_results['errors']) > 20:
            print(f"  ... and {len(validation_results['errors']) - 20} more")
    
    return validation_results

def main():
    """Main execution"""
    start_time = time.time()
    
    print("="*80)
    print("PARALLEL MONSTER FETCHER")
    print("="*80)
    
    # Load monsters
    monsters = load_monsters()
    
    # Prepare monster list
    monster_items = list(monsters.items())
    if TEST_LIMIT:
        monster_items = monster_items[:TEST_LIMIT]
        print(f"\n⚠️  TEST MODE: Only processing {TEST_LIMIT} monsters")
    
    stats['total'] = len(monster_items)
    
    print(f"\nProcessing {stats['total']} monsters with {MAX_WORKERS} parallel workers...")
    print("="*80 + "\n")
    
    # Thread-safe lock for modifying monsters dict
    dict_lock = Lock()
    
    # Process monsters in parallel
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        futures = {
            executor.submit(fetch_monster, name, data, monsters, dict_lock): name 
            for name, data in monster_items
        }
        
        # Process results as they complete
        completed = 0
        for future in as_completed(futures):
            completed += 1
            name = futures[future]
            
            try:
                result_name, status, message = future.result()
                
                # Show progress every 50 monsters
                if completed % 50 == 0 or completed == stats['total']:
                    print(f"[{completed}/{stats['total']}] Progress: "
                          f"✓ {stats['success']} success, "
                          f"⊘ {stats['no_access']} no access, "
                          f"✗ {stats['failed']} failed, "
                          f"⊗ {stats['skipped']} skipped")
                
                # Show individual failures/no-access in real-time
                if status == 'no_access':
                    print(f"  ⊘ No Access: {result_name}")
                elif status == 'failed':
                    print(f"  ✗ Failed: {result_name} - {message}")
                elif status == 'validation_failed':
                    print(f"  ⚠ Validation Failed: {result_name} - {message}")
                    
            except Exception as e:
                print(f"  ✗ Exception processing {name}: {str(e)}")
                with stats_lock:
                    stats['failed'] += 1
    
    # Save updated monsters.json with noAccess flags
    save_monsters(monsters)
    
    # Final summary
    elapsed = time.time() - start_time
    print("\n" + "="*80)
    print("FETCH SUMMARY")
    print("="*80)
    print(f"Total Monsters: {stats['total']}")
    print(f"  ✓ Successfully Parsed: {stats['success']} ({stats['success']/stats['total']*100:.1f}%)")
    print(f"  ⊘ No Access: {stats['no_access']} ({stats['no_access']/stats['total']*100:.1f}%)")
    print(f"  ✗ Failed: {stats['failed']} ({stats['failed']/stats['total']*100:.1f}%)")
    print(f"  ⊗ Skipped: {stats['skipped']} ({stats['skipped']/stats['total']*100:.1f}%)")
    print(f"\nTime Elapsed: {elapsed:.1f}s ({stats['total']/elapsed:.1f} monsters/sec)")
    
    # Validate cached monsters
    validation_results = validate_cached_monsters()
    
    print("\n" + "="*80)
    print("✓ ALL DONE!")
    print("="*80)

if __name__ == '__main__':
    main()
