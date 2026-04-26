# D&D Encounter Tracker

A web-based Dungeons & Dragons encounter tracker with D&D Beyond integration, featuring automatic stat population, initiative rolling, and an intuitive interface for managing players and combat encounters across multiple chapters.

## Screenshots

![Adventure Selection](img/screenshot-1.png)
*Adventure selection interface with dropdown and new adventure button*

![Player Management](img/screenshot-2.png)
*Player tracking with detailed stats and D&D Beyond integration*

![Combat Encounter](img/screenshot-3.png)
*Active combat encounter with initiative tracking and turn management*

## Features

- 📊 **Intuitive UI** - Clean, modern interface with context-aware controls
- 💾 **Auto-save** - Changes are automatically saved to JSON files
- 📝 **Optimized File Format** - JSON files with intelligent compression:
  - Shortened field names (init/id vs initiative/dndBeyondUrl)
  - Stripped empty values and defaults
  - Character ID extraction (stores just "12345" vs full URL)
  - ~30% file size reduction while maintaining readability
- 🏰 **Multi-Adventure Support** - Create and manage multiple campaigns
- 📖 **Chapter Organization** - Organize encounters by chapters with dedicated notes
- 🎲 **Player Management** - Track detailed player stats including:
  - Player name, character name, race, class, level
  - HP, AC, speed, initiative bonus
  - Passive Perception, Insight, Investigation
  - D&D Beyond character links (with tooltips)
  - Notes field
- ⚔️ **Encounter Tracking** - Manage multiple encounters per chapter with:
  - Three states: unstarted, started, complete
  - Visual state indicators (completed encounters have green background)
  - Automatic player population
  - Turn-by-turn combat tracking
  - Round counter
  - Active turn highlighting
  - HP, Damage, and Healing tracking
  - Damage modal (Ctrl+D) for quick damage assignment
  - Healing modal (Ctrl+H) for healing tracking
  - Edit mode for completed encounters (✏️ button)
  - Context-sensitive controls (edit controls hidden during combat)
  - ESC key closes all modals
- 📊 **Statistics & Charts** - Comprehensive campaign analytics:
  - Initiative Distribution chart (per-player initiative rolls)
  - CR Over Time chart (encounter difficulty progression)
  - Damage Analysis chart with:
    - Stacked bars showing per-player damage contributions
    - Enemy damage dealt to players
    - "Other" category for environmental/untracked damage
- 🔄 **Initiative System** - Automatic initiative rolling with DEX modifiers
- 🎵 **Encounter Music** - Per-chapter and per-encounter background music:
  - Drop audio files into the local `music/` folder (gitignored)
  - One track per chapter, optional override per encounter
  - Encounter starts swap to combat music; ending/resetting reverts to chapter music
  - Global player in the header (play/pause, mute, volume, rescan)
  - Volume and mute persist across sessions (localStorage)
  - Plays fully offline once tracks are downloaded
- 🐉 **D&D Beyond Integration**:
  - Cookie-based authentication
  - 2,824+ monsters from D&D Beyond
  - Monster tooltips with full stats on hover
  - Just-in-time stat fetching (AC, HP, initiative modifier)
  - Automatic initiative rolling (d20 + modifier)
  - Smart caching with per-monster cache files
- ⭐ **XP Calculator** - Automatic XP calculation based on CR values
- 🎚️ **CR Customization** - Override auto-calculated encounter CR:
  - Edit CR directly in encounter header (edit mode)
  - Visual indicators (orange border = custom, gray = calculated)
  - Non-default values only saved to JSON
  - Useful for partial defeats, story adjustments, environmental factors
  - See [CR_CUSTOMIZATION.md](CR_CUSTOMIZATION.md) for details
- ⌨️ **Keyboard Shortcuts**:
  - Ctrl+D: Open damage tracking modal
  - Ctrl+H: Open healing tracking modal
  - Ctrl+Right Arrow: Next turn (during active encounter)
  - Ctrl+Left Arrow: Previous turn (during active encounter)
  - ESC: Close any open modal
- 🔗 **URL Routing** - Direct links to specific adventures and chapters
- 📍 **Scroll Persistence** - Automatically restores scroll position on page refresh
- 🎯 **Smart UI** - Context-aware interface that adapts to workflow:
  - Adventure selection page with dropdown
  - Adventure page with title and management controls
  - Clickable dice icon to return to adventure selection

## Setup

1. **Install Python** (3.8 or higher)

2. **Create a virtual environment and install dependencies**:

   **Linux / macOS:**
   ```bash
   # On Debian/Ubuntu you may first need: sudo apt install python3-venv
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

   **Windows (PowerShell):**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. **Run the application**:

   **Linux / macOS:**
   ```bash
   python app.py
   # or use the convenience script:
   ./scripts/start.sh
   ```

   **Windows (PowerShell):**
   ```powershell
   python app.py
   # or use the convenience script:
   .\scripts\start.ps1
   ```

   **Command Line Options:**
   - `--enable-upnp` or `--enable-external`: Enable UPnP port forwarding and dynamic DNS updates (off by default)
     ```bash
     python app.py --enable-upnp
     # or: ./scripts/start.sh --enable-upnp
     # or (PowerShell): .\scripts\start.ps1 -EnableUpnp
     ```

4. **Open in browser**:
   Navigate to `http://localhost:5000`

5. **⚠️ REQUIRED: Configure D&D Beyond Authentication**
   - The app **requires** D&D Beyond cookies to function
   - On first launch, you'll see a warning and must configure cookies before proceeding
   - See "First-Time Setup" section below for detailed instructions

## Usage

### First-Time Setup: D&D Beyond Integration (REQUIRED)

**⚠️ This step is mandatory** - the app cannot create adventures or fetch monster data without authentication.

1. **Get your cookies** from D&D Beyond:
   - Open [dndbeyond.com](https://www.dndbeyond.com) in your browser
   - **Log in** to your D&D Beyond account
   - Press **F12** to open Developer Tools
   - Go to the **Console** tab
   - Copy and paste this command: `document.cookie`
   - Press **Enter** and copy the entire result (a long string with multiple cookies)

2. **Configure the app**:
   - Click the ⚙️ Settings button (available on all pages)
   - Paste the cookie string into the text area
   - Click "Save Cookies"
   - Once successful, you can create adventures and add monsters

**Note:** The cookie string contains all authentication tokens needed to access D&D Beyond content. Monster details are fetched on-demand when you add them to encounters.

### Creating an Adventure
1. From the home page, click the + button
2. Enter a name for your adventure
3. Start adding players and encounters
4. The adventure title becomes the page header
5. Click the 🎲 dice icon to return to adventure selection

### Managing Players
- Click "+ " button in the Players section to add a new player
- Fill in player details:
  - Player name (real person's name)
  - Character name, race, class, level
  - Max HP, AC, Speed
  - Initiative bonus, Passive Perception/Insight/Investigation
  - Optional: D&D Beyond character URL (hover for tooltip)
  - Notes field for any additional info
- Click × to remove a player
- Changes are automatically saved

### Managing Chapters
- Click "+ " to create a new chapter
- Select a chapter from the dropdown to switch
- Add notes to each chapter using the Notes textarea
- Click × to delete the current chapter
- Encounters are organized by chapter

### Managing Encounters

**Creating Encounters:**
- Click "+ " in the Encounters section to create a new encounter
- Encounters auto-populate with current players
- Click + button to add monsters from the library (2,824+ monsters)
- Hover over monster names to see full stat blocks
- Stats (AC, HP, initiative) are fetched automatically from D&D Beyond

**Running Combat:**
1. **Before Starting** (unstarted state): 
   - All stats (Init, AC, Max HP) are editable
   - +, ↻, and × buttons visible for editing
2. **Click "Start"**: 
   - Encounter begins
   - Combatants sorted by initiative
   - Stats lock (except HP, DMG, Heal, and Notes)
   - Round counter starts at 1
   - Edit controls (+, ↻, ×) hidden
3. **During Combat**:
   - Active combatant highlighted with ▶ arrow
   - Click "Next" or "Prev" buttons to navigate turns
   - Use Ctrl+Right Arrow / Ctrl+Left Arrow for quick turn navigation
   - Track HP changes (red name when HP ≤ 0)
   - Track damage dealt (DMG column)
   - Track healing (Heal column)
   - Add notes/conditions
   - Use Ctrl+D for quick damage assignment
   - Use Ctrl+H for quick healing
4. **Click "End"**: 
   - Marks encounter complete
   - Encounter card background turns light green
   - Round counter preserved
   - Shows ✏️ Edit button when maximized
5. **Edit Completed Encounters**:
   - Click ✏️ (Edit) button on completed encounters
   - Enables editing of HP, DMG, and Heal columns
   - Click 💾 (Save) to finalize changes
6. **Click "Reset"**: 
   - Returns to unstarted state
   - Re-enables all editing controls

**Other Features:**
- Minimize/expand encounters with ▶/▼ button
- XP automatically calculated and displayed
- Monster names link to D&D Beyond pages (hover for tooltip)

## Encounter Music

The app can play background music tied to chapters and encounters. Everything is local: tracks are served from a `music/` folder in the repo so playback works fully offline, and the folder is gitignored so your library doesn't bloat the repo or get committed.

### How playback works

There are two layers of background music:

1. **Chapter music** - One track per chapter. Plays when the chapter is loaded and loops indefinitely.
2. **Encounter music** - Optional per-encounter override. When an encounter is **started**, playback hard-cuts to the encounter's track. When the encounter **ends** or is **reset**, playback reverts to the chapter track.

If an encounter has no music attached, starting it does nothing to playback - the chapter track keeps going.

A small global player in the adventure header shows the currently playing track and exposes play/pause, mute, volume, and a rescan (↻) button to pick up newly added files without restarting the server.

> **Note on autoplay:** browsers block audio playback until the user interacts with the page. The first time you load an adventure with music, the player will show a small "Click to enable music" prompt - click anywhere (or press any key) and playback starts.

### Setting it up

1. **Create the folder** (it's auto-created the first time the app starts, but you can do it manually):

   ```bash
   mkdir -p music
   ```

2. **Drop audio files in**. Supported extensions: `.mp3`, `.ogg`, `.oga`, `.m4a`, `.aac`, `.wav`, `.flac`, `.opus`, `.webm`. `.mp3` and `.ogg` are the safest bets across browsers.

3. **Pick tracks in the UI**:
   - Open a chapter and choose a track from the **🎵 Chapter Music** dropdown.
   - Open an encounter in edit mode and choose a track from its music dropdown (leave blank to inherit chapter music).
   - The ▶ buttons next to each dropdown play an ~8-second preview without changing the actual playback state.

4. **Add new files later** - drop them in `music/` and click the ↻ button on the global player. The dropdowns repopulate from the live folder via `GET /api/music`.

### Where to get music

I deliberately chose not to integrate with commercial streaming services (Spotify/Apple Music/etc.) - their APIs forbid offline use and DRM makes embedding impossible. Instead, here are good free or one-time-purchase sources for fantasy/TTRPG music that allow personal use:

- **[Tabletop Audio](https://tabletopaudio.com/)** - Long, seamlessly looping tracks built specifically for TTRPGs. Free downloads (CC license; verify each track's terms) and a Patreon for higher-quality WAVs. Tens of minutes per track or designed to loop without an obvious seam - exactly what we want.
- **[Michael Ghelfi Studios](https://www.youtube.com/c/MichaelGhelfi)** / **[Adrian von Ziegler](https://www.youtube.com/user/adrianvonziegler)** / **[Derek & Brandon Fiechter](https://www.youtube.com/c/DerekFiechter)** on YouTube - hour-long ambient/fantasy mixes. Some have official Bandcamp/Patreon downloads; check each artist's terms before downloading from YouTube.
- **[Kevin MacLeod (incompetech.com)](https://incompetech.com/music/royalty-free/music.html)** - royalty-free under CC-BY 4.0; great for short combat tracks that you'll loop.
- **[Free Music Archive](https://freemusicarchive.org/)** and **[OpenGameArt.org](https://opengameart.org/art-search-advanced?keys=&field_art_type_tid%5B%5D=12)** - searchable libraries with explicit licensing per track.
- **[Battlebards](https://battlebards.com/)** and **[Syrinscape](https://syrinscape.com/)** - paid TTRPG-focused libraries; you generally need to export/download the tracks for offline use here.

A few practical tips:

- **Prefer long, looping tracks** (10+ minutes, or designed to loop seamlessly) for chapter music - you'll be on a chapter for an entire session.
- **Combat tracks can be shorter** (3-5 min) and will loop. Look for ones whose start/end mesh well, or fade them yourself in Audacity.
- **Normalize loudness** if your sources vary wildly. The player has a single volume slider, so having tracks at consistent levels keeps you out of the mixer mid-session.
- **Convert obscure formats to .mp3 or .ogg** with `ffmpeg -i input.flac -b:a 192k output.mp3` if a particular file won't play in your browser.

Always double-check the license on individual tracks before redistributing - the folder is gitignored precisely because most music has terms that don't allow uploading copies elsewhere.

## File Format

Adventures are stored in the `adventures/` directory as JSON files. The format is optimized for storage efficiency while remaining human-readable.

**Optimizations:**
- Field names shortened: `init` instead of `initiative`, `id` instead of `dndBeyondUrl`
- Empty values, zeros, and defaults are stripped
- Character IDs stored as numbers only (e.g., "159764903" instead of full URL)
- Player combatants identified by absence of `name` field
- Monster details looked up from D&D Beyond cache
- ~30% file size reduction compared to verbose format

**Simplified Structure:**
```json
{
  "name": "My Adventure",
  "chapters": ["Chapter 1", "Chapter 2"],
  "chapterNotes": {
    "Chapter 1": "Notes about this chapter..."
  },
  "chapterMusic": {
    "Chapter 1": "forest-ambience.mp3"
  },
  "players": [
    {
      "playerName": "John",
      "name": "Thorin Ironshield",
      "race": "Dwarf",
      "class": "Fighter",
      "level": 5,
      "maxHp": 48,
      "ac": 18,
      "dndBeyondUrl": "159764903"
    }
  ],
  "encounters": [
    {
      "name": "Boss Fight",
      "chapter": "Chapter 1",
      "state": "complete",
      "currentRound": 3,
      "music": "boss-battle.mp3",
      "combatants": [
        {
          "init": 15,
          "hp": 32,
          "maxHp": 48,
          "dmg": 12,
          "heal": 5,
          "id": "159764903",
          "ac": 18
        },
        {
          "name": "Cultist",
          "init": 12,
          "maxHp": 9,
          "dmg": 3
        }
      ]
    }
  ]
}
```

**Key Points:**
- Combatants with `id` but no `name` are players (looked up from players array)
- Combatants with `name` are monsters/NPCs (details from D&D Beyond cache)
- Fields with default values (0, empty string, etc.) are omitted
- App automatically restores full field names and URLs when loading

## Tips

- **D&D Beyond Cookies**: Cookies expire periodically. If monster fetching stops working, re-export and import fresh cookies
- **Keyboard Shortcuts**: 
  - Ctrl+D for damage tracking (quick damage assignment between combatants)
  - Ctrl+H for healing tracking (track healing done)
  - Ctrl+Right Arrow for next turn (during active encounter)
  - Ctrl+Left Arrow for previous turn (during active encounter)
  - ESC to close any modal
- **Statistics Charts**: View campaign analytics on the main page showing initiative distributions, CR progression, and damage analysis
- **Damage Tracking**: The damage chart shows per-player contributions with an "Other" bar for environmental/untracked damage when totals don't match
- **Edit Completed Encounters**: Use the ✏️ button on completed encounters to adjust HP/DMG/Heal values after the fact
- **Initiative Rolling**: Initiative is automatically rolled (d20 + modifier) when monsters are added. Edit before starting the encounter
- **Encounter States**: 
  - Unstarted: Full editing capability, setup mode
  - Started: Combat in progress, limited editing (HP, DMG, Heal, Notes)
  - Complete: Finished encounter, shown with green background, editable via ✏️ button
- **Chapter Organization**: Use chapters to organize encounters by story progression
- **Chapter Notes**: Add session notes, NPC information, or plot points to each chapter
- **XP Tracking**: Total XP is automatically calculated from monster CR values
- **Visual Indicators**: 
  - ▶ arrow shows active turn
  - Red name indicates HP ≤ 0
  - Light green background for completed encounters
- **Monster Tooltips**: Hover over any monster name to see full stat block
- **Minimize Encounters**: Keep your interface clean by minimizing encounters you're not actively using
- **Scroll Position**: Page automatically remembers scroll position on refresh
- **Manual File Editing**: JSON files can be edited directly for bulk changes (field names will be shortened on next save)
- **Backup**: The JSON files are your data - back them up regularly!

## Project Structure

```
dnd-enc/
├── app.py                      # Flask backend with D&D Beyond integration
├── requirements.txt            # Python dependencies (Flask, requests, BeautifulSoup4)
├── scripts/
│   ├── start.ps1              # Windows PowerShell startup script
│   ├── start.sh               # Linux/macOS startup script
│   ├── run_tests.py           # Cross-platform test runner
│   └── setup_cookies.py       # Cross-platform D&D Beyond cookie helper
├── templates/
│   └── index.html             # Main HTML template
├── static/
│   ├── style.css              # Styling with toast notifications
│   ├── script.js              # Frontend JavaScript (~3500 lines)
│   └── chart.umd.min.js       # Chart.js library (local)
├── adventures/                 # JSON data files (auto-created)
│   └── Sample Adventure.json  # Example adventure (included)
├── music/                      # User-supplied music library (auto-created, gitignored)
│   └── *.mp3 / *.ogg / ...    # Drop tracks here for chapter/encounter music
└── .cache/                     # Cache directory (auto-created, gitignored)
    ├── cookies.json           # D&D Beyond authentication
    ├── monsters.json          # Monster library index
    └── monsters/              # Individual monster cache files
        └── {id}-{name}.json   # Per-monster cache with timestamp
```

## Technical Details

- **Backend**: Flask 3.0.0 with BeautifulSoup4 for web scraping
- **Frontend**: Vanilla JavaScript (no frameworks) with Chart.js for analytics
- **Data Storage**: Optimized JSON files with intelligent compression
- **Caching**: Per-monster cache files with individual timestamps
- **Authentication**: Cookie-based D&D Beyond session persistence
- **Monster Library**: 2,824 monsters from D&D Beyond
- **Dynamic Lookups**: Monster and player details fetched on-demand to reduce file size
- **URL Routing**: Adventure and chapter state preserved in URL parameters
- **State Management**: Three encounter states (unstarted, started, complete) with appropriate UI controls
- **Charts**: Initiative distribution, CR progression, and damage analysis with per-player breakdowns

## Sample Adventure

The included "Sample Adventure" demonstrates:
- Multiple chapters with notes
- Four diverse player characters with placeholder character IDs
- Encounters in different states:
  - Complete encounters with damage/healing tracking (finished combat with green background)
  - Started encounter (active combat with turn tracking)
  - Unstarted encounters (ready to begin)
- Proper use of DMG and Heal columns
- Damage tracking showing realistic combat scenarios
- Statistics charts with real data
- Chapter organization and navigation

Load it to see the full feature set in action!

## Testing

The project includes comprehensive test suites for both backend and frontend code.

### Quick Start

```bash
# Run all tests (backend + frontend) - works on Linux, macOS, and Windows
pytest && npm test

# Or use the cross-platform Python runner:
python scripts/run_tests.py
```

**Current Status:**
- ✅ **Backend**: 79 tests passing (6 D&D Beyond API tests skip without cookies)
- ✅ **Frontend**: 516 tests passing across 17 suites

### Test Suites

- **Backend Tests (pytest)**: Tests for Flask API endpoints, adventure management, PIN protection, session management, and caching
- **Frontend Tests (Jest)**: Tests for JavaScript logic, state management, calculations, DOM manipulation, and API integration

### Coverage

- **Backend**: Adventure CRUD, D&D Beyond cookie management, PIN protection, session management, caching, security
- **Frontend**: State management, XP calculations, HP tracking, modal interactions, API calls, error handling

### Optional: D&D Beyond Integration Tests

To enable the 6 skipped D&D Beyond API integration tests:
1. Set up cookies in the production app (via Settings)
2. Or run: `python scripts/setup_cookies.py` (cross-platform) or `.\scripts\setup_cookies.ps1` (Windows)

### Documentation

See [docs/TESTING.md](docs/TESTING.md) for detailed information on:
- Test setup and configuration
- Running specific tests
- Writing new tests
- Troubleshooting
- AI model integration

### For AI Models

Verify code changes don't break functionality:

```bash
# Run all tests (Linux/macOS/Windows - make sure the venv is activated)
pytest && npm test
```

On Windows PowerShell, you may first need to add Node.js to the session PATH:

```powershell
$env:Path += ';C:\Program Files\nodejs\'
pytest; npm test
```

All tests should pass (except 6 D&D Beyond tests if cookies aren't configured).


