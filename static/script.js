// Global state - Use var so these become window properties (accessible from modular code)
var currentAdventure = null;
var currentChapter = null;
var autoSaveTimeout = null;
var DND_MONSTERS = {}; // Will be populated dynamically or use fallback
var MONSTER_DETAILS_CACHE = {}; // Client-side cache for full monster details (with abilities, actions, etc.)
var monstersLoaded = false;
var hasCookies = false; // Track cookie authentication status
var playersExpanded = true; // Track players section state
var playersEditMode = false; // Track players edit mode
var encounterEditMode = {}; // Track edit mode for completed encounters by index
var cachedSpectatorUrl = null; // Cached spectator URL to prevent flashing
var crFetchStatus = {}; // Track CR fetch status to prevent duplicate fetches: {encounterIndex_combatantIndex: true}
var monsterDetailsFetchStatus = {}; // Track monster details fetch status to prevent duplicate fetches: {entityUrl: true}
var initialLoadComplete = false; // Track if initial render has completed to prevent network flooding

// D&D 5e/2024 Classes
const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

// D&D 5e/2024 Races
const DND_RACES = [
    'Aarakocra', 'Aasimar', 'Bugbear', 'Dragonborn', 'Dwarf', 'Elf', 'Firbolg', 
    'Genasi', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Half-Orc', 'Halfling', 
    'Hobgoblin', 'Human', 'Kenku', 'Kobold', 'Leonin', 'Lizardfolk', 'Orc', 
    'Satyr', 'Tabaxi', 'Tiefling', 'Tortle', 'Triton', 'Warforged', 'Yuan-ti'
];

// Expose globally for modular code
window.DND_CLASSES = DND_CLASSES;
window.DND_RACES = DND_RACES;

// CR to XP mapping (D&D 5e)
const CR_TO_XP = {
    '0': 10,
    '1/8': 25,
    '1/4': 50,
    '1/2': 100,
    '1': 200,
    '2': 450,
    '3': 700,
    '4': 1100,
    '5': 1800,
    '6': 2300,
    '7': 2900,
    '8': 3900,
    '9': 5000,
    '10': 5900,
    '11': 7200,
    '12': 8400,
    '13': 10000,
    '14': 11500,
    '15': 13000,
    '16': 15000,
    '17': 18000,
    '18': 20000,
    '19': 22000,
    '20': 25000,
    '21': 33000,
    '22': 41000,
    '23': 50000,
    '24': 62000,
    '25': 75000,
    '26': 90000,
    '27': 105000,
    '28': 120000,
    '29': 135000,
    '30': 155000
};

// Expose CR_TO_XP globally for encounterRenderer
window.CR_TO_XP = CR_TO_XP;

// D&D 5e XP thresholds for leveling
const LEVEL_THRESHOLDS = [
    { level: 1, xp: 0, color: '#ecf0f120' },
    { level: 2, xp: 300, color: '#d5e8d420' },
    { level: 3, xp: 900, color: '#d4edda20' },
    { level: 4, xp: 2700, color: '#cfe2ff20' },
    { level: 5, xp: 6500, color: '#e2e3e520' },
    { level: 6, xp: 14000, color: '#fff3cd20' },
    { level: 7, xp: 23000, color: '#ffe69c20' },
    { level: 8, xp: 34000, color: '#f8d7da20' },
    { level: 9, xp: 48000, color: '#f5c2c720' },
    { level: 10, xp: 64000, color: '#d1e7dd20' },
    { level: 11, xp: 85000, color: '#cff4fc20' },
    { level: 12, xp: 100000, color: '#e7e7e720' },
    { level: 13, xp: 120000, color: '#e0cffc20' },
    { level: 14, xp: 140000, color: '#ffd6cc20' },
    { level: 15, xp: 165000, color: '#d0f0c020' },
    { level: 16, xp: 195000, color: '#ffeaa720' },
    { level: 17, xp: 225000, color: '#ffe5d020' },
    { level: 18, xp: 265000, color: '#f7d6e620' },
    { level: 19, xp: 305000, color: '#d6eaf820' },
    { level: 20, xp: 355000, color: '#ffd70020' }
];

// Common D&D conditions
const DND_CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 
    'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentrating',
    'Blessed', 'Hasted', 'Raging', 'Hidden'
];

// Condition icons mapping
const CONDITION_ICONS = {
    'Blinded': '🙈',
    'Charmed': '💖',
    'Deafened': '🔇',
    'Frightened': '😱',
    'Grappled': '🤼',
    'Incapacitated': '😵',
    'Invisible': '👻',
    'Paralyzed': '🧊',
    'Petrified': '🗿',
    'Poisoned': '☠️',
    'Prone': '⬇️',
    'Restrained': '⛓️',
    'Stunned': '💫',
    'Unconscious': '⚰️',
    'Concentrating': '⚡',
    'Blessed': '✨',
    'Hasted': '⏩',
    'Raging': '💢',
    'Hidden': '🫥'
};

// Expose globally for encounterRenderer
window.DND_CONDITIONS = DND_CONDITIONS;
window.CONDITION_ICONS = CONDITION_ICONS;

// ==================== MODULAR ARCHITECTURE ====================
// All functionality moved to ES6 modules in static/ subdirectories.
// Modules are imported and initialized by app.js, exposed globally for compatibility.
//
// Module Locations:
//   - adventureService.js: Adventure CRUD, auto-save, cookie status
//   - monsterListRenderer.js: Monster library, selection modal, loadMonsters, updateAuthButton
//   - playerRenderer.js: Player list rendering, sorting, editing, stats management
//   - encounterRenderer.js: Encounter cards, initiative, CR/XP calculations, combatant management
//   - tooltipManager.js: Monster/character tooltips with stats and actions
//   - eventHandlers.js: Modal management, settings, damage/heal, PIN protection, cookies
//   - attackRollManager.js: Attack roll event handling, damage application
//   - helpers.js: Toast notifications, utility functions
//
// This file now only contains:
//   - Global state variables (var declarations for window.* access)
//   - D&D reference data constants (classes, races, CR/XP, conditions)
//   - All exposed globally via window.* for backward compatibility
