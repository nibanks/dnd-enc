#!/usr/bin/env python3
"""
Test runner for D&D Encounter Tracker
Runs both backend (pytest) and frontend (Jest) tests
"""
import subprocess
import sys
import os
from pathlib import Path


def run_command(command, description):
    """Run a command and return the exit code."""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print('='*60 + '\n')
    
    result = subprocess.run(command, shell=True)
    return result.returncode


def main():
    """Run all test suites."""
    print("\n" + "="*60)
    print("  D&D Encounter Tracker - Test Suite")
    print("="*60 + "\n")
    
    # Change to script directory
    os.chdir(Path(__file__).parent)
    
    all_passed = True
    
    # Run backend tests
    backend_result = run_command(
        "pytest -v",
        "Running Backend Tests (pytest)"
    )
    
    if backend_result == 0:
        print("\n✓ Backend Tests PASSED")
    else:
        print("\n✗ Backend Tests FAILED")
        all_passed = False
    
    # Check if npm is available
    npm_available = subprocess.run(
        "npm --version",
        shell=True,
        capture_output=True
    ).returncode == 0
    
    if not npm_available:
        print("\nWarning: npm not found. Skipping frontend tests.")
        print("Install Node.js to run JavaScript tests.")
    else:
        # Check if node_modules exists
        if not Path("node_modules").exists():
            print("\nInstalling frontend dependencies...")
            subprocess.run("npm install", shell=True)
        
        # Run frontend tests
        frontend_result = run_command(
            "npm test",
            "Running Frontend Tests (Jest)"
        )
        
        if frontend_result == 0:
            print("\n✓ Frontend Tests PASSED")
        else:
            print("\n✗ Frontend Tests FAILED")
            all_passed = False
    
    # Summary
    print("\n" + "="*60)
    print("           Test Summary")
    print("="*60 + "\n")
    
    if all_passed:
        print("All tests passed! ✓")
        sys.exit(0)
    else:
        print("Some tests failed. Please review the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
