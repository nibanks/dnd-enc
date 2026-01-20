# D&D Encounter Tracker

A web-based Dungeons & Dragons encounter tracker with D&D Beyond integration, featuring automatic stat population, initiative rolling, and spreadsheet-like interface for managing players and combat encounters.

## Features

- 📊 **Spreadsheet-like UI** - Easy-to-use table interface for managing data
- 💾 **Auto-save** - Changes are automatically saved to JSON files
- 📝 **Simple File Format** - JSON files that are easy to edit manually
- 🎲 **Player Management** - Track detailed player stats including:
  - Player name, character name, race, class, level
  - HP, AC, speed, initiative bonus
  - Passive Perception, Insight, Investigation
  - D&D Beyond character links
  - Notes field
- ⚔️ **Encounter Tracking** - Manage multiple encounters per adventure with:
  - Automatic player population
  - Turn-by-turn combat tracking (Start → Next Turn → End)
  - Round counter
  - Visual indicators (active turn arrow, HP<=0 red names)
  - Editable stats before encounter starts
- 🔄 **Initiative System** - Automatic initiative rolling with DEX modifiers
- 🐉 **D&D Beyond Integration**:
  - Cookie-based authentication
  - 2,824+ monsters from D&D Beyond
  - Just-in-time stat fetching (AC, HP, initiative modifier)
  - Automatic initiative rolling (d20 + modifier)
  - 30-day smart caching
- 📖 **Chapter System** - Organize encounters by chapter within adventures
- ⭐ **XP Calculator** - Automatic XP calculation based on CR values
- 📦 **Multiple Adventures** - Create and switch between different adventure files

## Setup

1. **Install Python** (3.8 or higher)

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python app.py
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5000`

## Usage

### First-Time Setup: D&D Beyond Integration

1. **Export Cookies** from your browser while logged into D&D Beyond:
   - Install a cookie export extension (e.g., "Cookie Editor" or "EditThisCookie")
   - Visit dndbeyond.com while logged in
   - Export all cookies as JSON

2. **Import Cookies** into the app:
   - Click the ⚙️ Settings button
   - Paste your cookies JSON into the text area
   - Click "Save Cookies"
   - Monster stats will now be fetched automatically when you add them

### Creating an Adventure
1. Click "New Adventure" button
2. Enter a name for your adventure
3. Start adding players and encounters

### Managing Players
- Click "+ Add Player" to add a new player
- Fill in player details:
  - Player name (real person's name)
  - Character name, race, class, level
  - Max HP, AC, Speed
  - Initiative bonus, Passive Perception/Insight/Investigation
  - Optional: D&D Beyond character URL (clickable link)
  - Notes field for any additional info
- Click 🔗 to copy shareable link
- Changes are automatically saved

### Managing Encounters

**Creating Encounters:**
- Click "+ Add Encounter" to create a new encounter
- Select a chapter from the dropdown
- Encounters auto-populate with current players
- Click + button to add monsters from the library (2,824+ monsters)
- Stats (AC, HP, initiative) are fetched automatically from D&D Beyond

**Running Combat:**
1. **Before Starting**: All stats (Init, AC, Max HP) are editable
2. **Click "Start"**: 
   - Encounter begins
   - Combatants sorted by initiative
   - Stats lock (except current HP)
   - Round counter starts at 1
3. **During Combat**:
   - Active combatant highlighted with ▶ arrow
   - Click "Next Turn" to advance
   - Track HP changes (red name when HP ≤ 0)
   - Add notes/conditions
4. **Click "End"**: Marks encounter complete
5. **Click "Reset"**: Returns to unstarted state

**Other Features:**
- Click ↻ to refresh player stats from Players section
- XP automatically calculated and displayed
- Monster names link to D&D Beyond pages

### File Format

Adventures are stored in the `adventures/` directory as JSON files. Example structure:

```json
{
  "name": "My Adventure",
  "players": [
    {
      "playerName": "John",
      "name": "Thorin Ironshield",
      "race": "Dwarf",
      "class": "Fighter",
      "level": 5,
      "maxHp": 45,
      "ac": 18,
      "speed": 25,
      "initiativeBonus": 2,
      "passivePerception": 14,
      "passiveInsight": 12,
      "passiveInvestigation": 12,
      "notes": "Uses a magic shield",
      "dndBeyondUrl": "https://www.dndbeyond.com/characters/12345"
    }
  ],
  "encounters": [
    {
      "name": "Boss Fight",
      "chapter": "Chapter 1",
      "state": "started",
      "currentTurn": 0,
      "currentRound": 3,
      "combatants": [
        {
          "name": "Thorin Ironshield",
          "initiative": 15,
          "hp": 32,
          "maxHp": 45,
          "ac": 18,
          "notes": "Concentrating on spell",
          "isActive": true,
          "isPlayer": true,
          "dndBeyondUrl": "https://www.dndbeyond.com/characters/12345"
        },
        {
          "name": "Cultist",
          "initiative": 12,
          "hp": 9,
          "maxHp": 9,
          "ac": 12,
          "cr": "1/8",
          "notes": "",
          "isActive": false,
          "isMonster": true,
          "dndBeyondUrl": "https://www.dndbeyond.com/monsters/16835-cultist"
        }
      ]
    }
  ]
}
```

You can edit these files directly with any text editor if needed.

### Cache Files

The `.cache/` directory stores:
- `cookies.json` - D&D Beyond authentication cookies
- `monsters.json` - Full monster library (2,824 monsters)
- `monster_details.json` - Detailed stats with 30-day expiration

## Tips

- **D&D Beyond Cookies**: Cookies expire periodically. If monster fetching stops working, re-export and import fresh cookies
- **Initiative Rolling**: Initiative is automatically rolled (d20 + modifier) when monsters are added. You can edit it before starting the encounter
- **Editable States**: Before encounter starts, all stats are editable. During combat, only HP and Notes can be changed
- **Chapter Organization**: Use chapters to organize encounters by story progression. Switch chapters with the dropdown
- **XP Tracking**: Total XP is automatically calculated from monster CR values
- **Visual Indicators**: 
  - ▶ arrow shows active turn
  - Red name indicates HP ≤ 0
  - Blue background for player combatants
- **Shareable Links**: Click 🔗 button on players to copy a direct link to that adventure
- **Turn Tracking**: "Next Turn" button cycles through initiative order and increments round counter
- **Notes**: Use the Notes column to track status effects, concentration, or other important combat information
- **Manual File Editing**: If you need to make bulk changes, you can edit the JSON files directly in the `adventures/` folder
- **Backup**: The JSON files are your data - back them up regularly!

## Project Structure

```
dnd-enc/
├── app.py                      # Flask backend server with D&D Beyond scraping
├── requirements.txt            # Python dependencies (Flask, requests, BeautifulSoup4)
├── templates/
│   └── index.html             # Main HTML template
├── static/
│   ├── style.css              # Styling with toast notifications
│   ├── script.js              # Frontend JavaScript (1420+ lines)
│   └── favicon.ico            # D&D Beyond favicon
├── adventures/                 # JSON data files (auto-created)
│   └── *.json                 # Adventure files
└── .cache/                     # Cache directory (auto-created)
    ├── cookies.json           # D&D Beyond authentication
    ├── monsters.json          # Monster library (2,824 monsters)
    └── monster_details.json   # Detailed stats with timestamps
```

## Technical Details

- **Backend**: Flask 3.0.0 with BeautifulSoup4 for web scraping
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Data Storage**: JSON files for easy editing and version control
- **Caching**: 30-day smart cache with timestamp-based expiration
- **Authentication**: Cookie-based D&D Beyond session persistence
- **Monster Library**: 2,824 monsters scraped from D&D Beyond
- **JIT Fetching**: Monster details fetched on-demand when added to encounters
- **Initiative System**: Automatic d20 rolling with DEX-based modifiers
- **URL Routing**: Adventure and chapter state preserved in URL parameters
