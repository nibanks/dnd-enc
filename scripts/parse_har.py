import json
import sys

# Load both HAR files
har_files = [
    (r'C:\Users\gamer\Downloads\dragonclaw-private.har', 'PRIVATE (not logged in)'),
    (r'C:\Users\gamer\Downloads\dragonclaw-loggedin.har', 'LOGGED IN')
]

for har_path, label in har_files:
    print(f'\n{"="*80}')
    print(f'{label}: {har_path}')
    print('='*80)
    
    try:
        har = json.load(open(har_path, encoding='utf-8'))
        entries = har['log']['entries']
        
        # Find the monster page request
        monster_req = None
        for entry in entries:
            url = entry['request']['url']
            if '17470-dragonclaw' in url or 'monsters/17470' in url:
                monster_req = entry
                break
        
        if not monster_req:
            print(f'ERROR: Could not find dragonclaw request')
            print(f'Total entries: {len(entries)}')
            continue
        
        # Show request details
        print(f'\nURL: {monster_req["request"]["url"]}')
        print(f'Method: {monster_req["request"]["method"]}')
        
        # Show cookies
        cookies = monster_req['request']['cookies']
        print(f'\nCOOKIES SENT: {len(cookies)}')
        if len(cookies) > 0:
            print('Key cookies:')
            for cookie in cookies:
                name = cookie['name']
                value = cookie['value']
                # Show important auth cookies in full, others truncated
                if name in ['CobaltSession', 'LoginState', 'User.ID', 'User.Username']:
                    if len(value) > 100:
                        value = value[:100] + '...'
                    print(f'  {name}: {value}')
                elif 'token' in name.lower() or 'session' in name.lower() or 'auth' in name.lower():
                    print(f'  {name}: {value[:50]}...')
        else:
            print('  NO COOKIES')
        
        # Show response
        response = monster_req['response']
        print(f'\nRESPONSE:')
        print(f'  Status: {response["status"]}')
        print(f'  URL: {response.get("redirectURL", "No redirect")}')
        
        # Check final URL
        if 'redirectURL' in response and response['redirectURL']:
            print(f'  ⚠️ REDIRECTED TO: {response["redirectURL"]}')
        elif 'marketplace' in monster_req["request"]["url"].lower():
            print(f'  ⚠️ Already at marketplace URL')
        else:
            print(f'  ✓ No redirect - monster page loaded')
        
        # Show important headers
        print(f'\nKEY REQUEST HEADERS:')
        for header in monster_req['request']['headers']:
            name = header['name'].lower()
            if name in ['user-agent', 'referer', 'cookie', 'authorization']:
                value = header['value']
                if len(value) > 100:
                    value = value[:100] + '...'
                print(f'  {header["name"]}: {value}')
        
    except Exception as e:
        print(f'ERROR parsing {har_path}: {e}')
        import traceback
        traceback.print_exc()

print(f'\n{"="*80}')
print('COMPARISON COMPLETE')
print('='*80)


