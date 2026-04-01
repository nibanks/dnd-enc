#!/usr/bin/env python3
"""
D&D Beyond Cookie Setup Helper
This script helps you set up D&D Beyond cookies for the test suite
"""
import json
import os
from pathlib import Path


def print_header(text, color='\033[96m'):
    """Print a colored header."""
    reset = '\033[0m'
    print(f"\n{color}{'='*50}{reset}")
    print(f"{color}{text:^50}{reset}")
    print(f"{color}{'='*50}{reset}\n")


def print_step(step_num, title, color='\033[92m'):
    """Print a step header."""
    reset = '\033[0m'
    print(f"\n{color}Step {step_num}: {title}{reset}")
    print(f"{color}{'-'*40}{reset}")


def main():
    """Main setup function."""
    # Change to project root directory (parent of scripts/)
    script_dir = Path(__file__).parent
    os.chdir(script_dir.parent)
    
    print_header("D&D Beyond Cookie Setup Helper")
    
    print("\033[93mTo use D&D Beyond features and run integration tests, you need to provide")
    print("authentication cookies from your browser.\033[0m\n")
    
    print_step(1, "Get Your Cookies from Browser")
    print("1. Open your browser and go to: \033[96mhttps://www.dndbeyond.com\033[0m")
    print("2. Make sure you're logged in")
    print("3. Press F12 to open Developer Tools")
    print("4. Go to the 'Application' tab (Chrome) or 'Storage' tab (Firefox)")
    print("5. In the left sidebar, expand 'Cookies' and click on 'https://www.dndbeyond.com'")
    print("6. Find and copy the values for these three cookies:")
    print("   - \033[93mCobaltId\033[0m")
    print("   - \033[93mCobaltAff\033[0m")
    print("   - \033[93mCobaltAT\033[0m")
    print()
    
    # Ask if user wants to continue
    continue_input = input("Do you have your cookies ready? (y/n): ").strip().lower()
    if continue_input != 'y':
        print("\n\033[93mNo problem! Run this script again when you're ready.\033[0m")
        return
    
    print_step(2, "Enter Your Cookies")
    
    # Get cookies from user
    cobalt_id = input("\n\033[93mEnter CobaltId value: \033[0m").strip()
    cobalt_aff = input("\033[93mEnter CobaltAff value: \033[0m").strip()
    cobalt_at = input("\033[93mEnter CobaltAT value: \033[0m").strip()
    
    # Validate input
    if not cobalt_id or not cobalt_aff or not cobalt_at:
        print("\n\033[91mError: All three cookie values are required!\033[0m")
        return 1
    
    # Create cookies object
    cookies = {
        "CobaltId": cobalt_id,
        "CobaltAff": cobalt_aff,
        "CobaltAT": cobalt_at
    }
    
    # Ensure .cache directory exists
    cache_dir = Path(".cache")
    if not cache_dir.exists():
        cache_dir.mkdir(parents=True)
        print("\n\033[90mCreated .cache directory\033[0m")
    
    # Save to cookies.json
    cookies_file = cache_dir / "cookies.json"
    with open(cookies_file, 'w', encoding='utf-8') as f:
        json.dump(cookies, f, indent=2)
    
    print_header("Success! Cookies Saved", '\033[92m')
    print(f"Cookies have been saved to: \033[96m{cookies_file}\033[0m\n")
    print("\033[93mYou can now:\033[0m")
    print("  \033[0m1. Run the production app with D&D Beyond integration")
    print("  2. Run integration tests with: \033[96mpytest\033[0m")
    print("  3. D&D Beyond API tests will no longer be skipped\n")
    print("\033[93mTip:\033[0m \033[90mIf your cookies expire, just run this script again!\033[0m\n")
    
    return 0


if __name__ == "__main__":
    exit(main() or 0)
