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
- 📝 **Simple File Format** - JSON files that are easy to edit manually
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
  - HP tracking with visual indicators (red names when HP ≤ 0)
  - Context-sensitive controls (edit controls hidden during combat)
- 🔄 **Initiative System** - Automatic initiative rolling with DEX modifiers
- 🐉 **D&D Beyond Integration**:
  - Cookie-based authentication
  - 2,824+ monsters from D&D Beyond
  - Monster tooltips with full stats on hover
  - Just-in-time stat fetching (AC, HP, initiative modifier)
  - Automatic initiative rolling (d20 + modifier)
  - Smart caching with per-monster cache files
- ⭐ **XP Calculator** - Automatic XP calculation based on CR values
- 🔗 **URL Routing** - Direct links to specific adventures and chapters
- 🎯 **Smart UI** - Context-aware interface that adapts to workflow:
  - Adventure selection page with dropdown
  - Adventure page with title and management controls
  - Clickable dice icon to return to adventure selection

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
   - Click "Save & Test Connection"
   - Monster stats will now be fetched automatically when you add them

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
   - Stats lock (except current HP and Notes)
   - Round counter starts at 1
   - Edit controls (+, ↻, ×) hidden
3. **During Combat**:
   - Active combatant highlighted with ▶ arrow
   - Click "Next Turn" to advance
   - Track HP changes (red name when HP ≤ 0)
   - Add notes/conditions
   - Only HP and Notes editable
4. **Click "End"**: 
   - Marks encounter complete
   - Encounter card background turns light green
   - Round counter preserved
5. **Click "Reset"**: 
   - Returns to unstarted state
   - Re-enables all editing controls

**Other Features:**
- Minimize/expand encounters with ▶/▼ button
- XP automatically calculated and displayed
- Monster names link to D&D Beyond pages (hover for tooltip)

## File Format

Adventures are stored in the `adventures/` directory as JSON files. The format uses references to reduce duplication - monster and player details are looked up dynamically from the D&D Beyond cache and players array.

**Simplified Structure:**
```json
{
  "name": "My Adventure",
  "chapters": ["Chapter 1", "Chapter 2"],
  "chapterNotes": {
    "Chapter 1": "Notes about this chapter..."
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
      "currentRound": 3,
      "activeCombatant": 0,
      "combatants": [
        {
          "name": "Thorin Ironshield",
          "initiative": 15,
          "hp": 32,
          "maxHp": 48,
          "notes": "Concentrating on spell",
          "isPlayer": true
        },
        {
          "name": "Cultist",
          "initiative": 12,
          "hp": 9,
          "maxHp": 9,
          "notes": "",
          "isPlayer": false
        }
      ]
    }
  ]
}
```

**Key Points:**
- Combatants only store instance-specific data (initiative, HP, notes)
- Player details (AC, D&D Beyond URL) are looked up from the `players` array
- Monster details (AC, CR, D&D Beyond URL) are looked up from the cached monster list
- This eliminates duplication and reduces file size by ~50%

## Tips

- **D&D Beyond Cookies**: Cookies expire periodically. If monster fetching stops working, re-export and import fresh cookies
- **Initiative Rolling**: Initiative is automatically rolled (d20 + modifier) when monsters are added. Edit before starting the encounter
- **Encounter States**: 
  - Unstarted: Full editing capability, setup mode
  - Started: Combat in progress, limited editing
  - Complete: Finished encounter, shown with green background
- **Chapter Organization**: Use chapters to organize encounters by story progression
- **Chapter Notes**: Add session notes, NPC information, or plot points to each chapter
- **XP Tracking**: Total XP is automatically calculated from monster CR values
- **Visual Indicators**: 
  - ▶ arrow shows active turn
  - Red name indicates HP ≤ 0
  - Light green background for completed encounters
- **Monster Tooltips**: Hover over any monster name to see full stat block
- **Minimize Encounters**: Keep your interface clean by minimizing encounters you're not actively using
- **Manual File Editing**: JSON files can be edited directly for bulk changes
- **Backup**: The JSON files are your data - back them up regularly!

## Project Structure

```
dnd-enc/
├── app.py                      # Flask backend with D&D Beyond integration
├── requirements.txt            # Python dependencies (Flask, requests, BeautifulSoup4)
├── start.ps1                   # PowerShell startup script
├── templates/
│   └── index.html             # Main HTML template
├── static/
│   ├── style.css              # Styling with toast notifications
│   └── script.js              # Frontend JavaScript (~2000 lines)
├── adventures/                 # JSON data files (auto-created)
│   └── Sample Adventure.json  # Example adventure (included)
└── .cache/                     # Cache directory (auto-created, gitignored)
    ├── cookies.json           # D&D Beyond authentication
    ├── monsters.json          # Monster library index
    └── monsters/              # Individual monster cache files
        └── {id}-{name}.json   # Per-monster cache with timestamp
```

## Technical Details

- **Backend**: Flask 3.0.0 with BeautifulSoup4 for web scraping
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Data Storage**: JSON files for easy editing and version control
- **Caching**: Per-monster cache files with individual timestamps
- **Authentication**: Cookie-based D&D Beyond session persistence
- **Monster Library**: 2,824 monsters from D&D Beyond
- **Dynamic Lookups**: Monster and player details fetched on-demand to reduce file size
- **URL Routing**: Adventure and chapter state preserved in URL parameters
- **State Management**: Three encounter states (unstarted, started, complete) with appropriate UI controls

## Sample Adventure

The included "Sample Adventure" demonstrates:
- Multiple chapters with notes
- Four diverse player characters
- Encounters in different states:
  - Complete encounter (finished combat with green background)
  - Started encounter (active combat with turn tracking)
  - Unstarted encounters (ready to begin)
- Proper use of notes for tracking combat conditions
- Chapter organization and navigation

Load it to see the full feature set in action!

