import json

# Read EditThisCookie format
with open('cookies_editthiscookie.json', 'r', encoding='utf-8') as f:
    cookies_array = json.load(f)

# Convert to simple key-value format
cookies_dict = {}
for cookie in cookies_array:
    cookies_dict[cookie['name']] = cookie['value']

# Save in the format the app expects
with open('.cache/cookies.json', 'w', encoding='utf-8') as f:
    json.dump(cookies_dict, f, indent=2)

print(f"✓ Converted {len(cookies_dict)} cookies")
print(f"✓ Saved to .cache/cookies.json")
print("\nKey cookies found:")
for key in ['CobaltSession', 'LoginState', 'User.ID', 'User.Username']:
    if key in cookies_dict:
        val = cookies_dict[key][:50] if len(cookies_dict[key]) > 50 else cookies_dict[key]
        print(f"  {key}: {val}...")
