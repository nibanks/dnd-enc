# Bundled Data

Files in this directory ship with the repo and are used to bootstrap
a freshly cloned install.

## `monsters.json`

An index of D&D Beyond monsters (name, CR, type, size, alignment, URL,
legacy flag). This is just the metadata visible on the public monster
listing pages — no paid stat-block content — so it's safe to commit.

On startup, if `.cache/monsters.json` doesn't exist, `app.py` copies this
bundle into the cache so new users get a working monster library
instantly instead of waiting for a 3–4 minute first-run scrape against
D&D Beyond.

### Regenerating the bundle

If the monster list changes upstream, refresh it like this:

```bash
# 1. Make sure you have D&D Beyond cookies configured in Settings.
# 2. Trigger a fresh scrape:
rm -f .cache/monsters.json
curl http://localhost:5000/api/dndbeyond/monsters   # wait a few minutes

# 3. Export the newly-scraped index to the bundle:
python scripts/export_monsters_bundle.py

# 4. Commit the updated data/monsters.json.
```
