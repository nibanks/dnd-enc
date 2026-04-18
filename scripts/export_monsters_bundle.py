#!/usr/bin/env python3
"""Copy the locally-scraped monster index into the repo's bundled data file.

Usage:
    python scripts/export_monsters_bundle.py

Run this after a fresh ``/api/dndbeyond/monsters`` scrape so the updated
index gets committed to the repo. New clones will then bootstrap from
``data/monsters.json`` without having to scrape D&D Beyond themselves.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT_ROOT / ".cache" / "monsters.json"
DEST = PROJECT_ROOT / "data" / "monsters.json"


def main() -> int:
    if not SOURCE.exists():
        print(f"Error: {SOURCE} does not exist.", file=sys.stderr)
        print("Run the app and trigger a monster library scrape first:", file=sys.stderr)
        print("    curl http://localhost:5000/api/dndbeyond/monsters", file=sys.stderr)
        return 1

    try:
        with SOURCE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: {SOURCE} is not valid JSON: {e}", file=sys.stderr)
        return 1

    if not isinstance(data, dict) or not data:
        print(f"Error: {SOURCE} contained no monsters ({type(data).__name__}).", file=sys.stderr)
        return 1

    DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, DEST)
    print(f"Exported {len(data)} monsters -> {DEST.relative_to(PROJECT_ROOT)}")
    print("Next step:")
    print(f"    git add {DEST.relative_to(PROJECT_ROOT)} && git commit -m 'Refresh bundled monster index'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
