/**
 * Data validation and sanitization functions
 * Pure functions with no side effects
 */

// D&D 5e Classes
export const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

// D&D 5e Races
export const DND_RACES = [
    'Aarakocra', 'Aasimar', 'Bugbear', 'Dragonborn', 'Dwarf', 'Elf', 'Firbolg', 
    'Genasi', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Half-Orc', 'Halfling', 
    'Hobgoblin', 'Human', 'Kenku', 'Kobold', 'Leonin', 'Lizardfolk', 'Orc', 
    'Satyr', 'Tabaxi', 'Tiefling', 'Tortle', 'Triton', 'Warforged', 'Yuan-ti'
];

// Common D&D conditions
export const DND_CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 
    'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentrating',
    'Blessed', 'Hasted', 'Raging', 'Hidden'
];

/**
 * Validate and sanitize ability score
 * @param {*} score - Input score (may be any type)
 * @returns {number} Valid ability score (1-30)
 */
export function validateAbilityScore(score) {
    const num = parseInt(score);
    if (isNaN(num)) return 10;
    return Math.max(1, Math.min(30, num));
}

/**
 * Validate and sanitize HP value
 * @param {*} hp - Input HP
 * @param {number} maxHp - Maximum HP for bounds checking
 * @param {boolean} allowNegative - Whether to allow negative HP (for monsters)
 * @returns {number} Valid HP value
 */
export function validateHP(hp, maxHp, allowNegative = false) {
    const num = parseInt(hp);
    if (isNaN(num)) return 0;
    
    const min = allowNegative ? -maxHp : 0;
    const max = maxHp || 999;
    
    return Math.max(min, Math.min(max, num));
}

/**
 * Validate character level
 * @param {*} level - Input level
 * @returns {number} Valid level (1-20)
 */
export function validateLevel(level) {
    const num = parseInt(level);
    if (isNaN(num)) return 1;
    return Math.max(1, Math.min(20, num));
}

/**
 * Validate AC (Armor Class)
 * @param {*} ac - Input AC
 * @returns {number} Valid AC (1-30)
 */
export function validateAC(ac) {
    const num = parseInt(ac);
    if (isNaN(num)) return 10;
    return Math.max(1, Math.min(30, num));
}

/**
 * Validate initiative value
 * @param {*} initiative - Input initiative
 * @returns {number} Valid initiative (-10 to 50)
 */
export function validateInitiative(initiative) {
    const num = parseInt(initiative);
    if (isNaN(num)) return 0;
    return Math.max(-10, Math.min(50, num));
}

/**
 * Validate 4-digit PIN
 * @param {string} pin - Input PIN
 * @returns {boolean} True if valid 4-digit PIN or empty
 */
export function validatePIN(pin) {
    if (!pin || pin.trim() === '') return true;
    return /^\d{4}$/.test(pin.trim());
}

/**
 * Validate D&D Beyond URL
 * @param {string} url - Input URL
 * @returns {boolean} True if valid D&D Beyond URL or empty
 */
export function validateDnDBeyondURL(url) {
    if (!url || url.trim() === '') return true;
    return url.includes('dndbeyond.com/') || /^\d+-/.test(url);
}

/**
 * Validate challenge rating
 * @param {string} cr - Input CR
 * @returns {boolean} True if valid CR format
 */
export function validateCR(cr) {
    if (!cr) return false;
    // Valid formats: "0", "1/8", "1/4", "1/2", "1" through "30"
    return /^(\d+\/\d+|\d+)$/.test(cr);
}

/**
 * Sanitize player name (remove special characters)
 * @param {string} name - Input name
 * @returns {string} Sanitized name
 */
export function sanitizeName(name) {
    if (!name) return '';
    return name.trim().replace(/[<>]/g, '');
}

/**
 * Validate player data structure
 * @param {Object} player - Player object
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validatePlayer(player) {
    const errors = [];
    
    if (!player) {
        return { valid: false, errors: ['Player object is required'] };
    }
    
    if (!player.name || player.name.trim() === '') {
        errors.push('Player name is required');
    }
    
    if (player.level !== undefined) {
        const level = validateLevel(player.level);
        if (level !== player.level) {
            errors.push(`Invalid level: ${player.level} (must be 1-20)`);
        }
    }
    
    if (player.maxHp !== undefined && (isNaN(player.maxHp) || player.maxHp < 1)) {
        errors.push('Max HP must be at least 1');
    }
    
    if (player.ac !== undefined) {
        const ac = validateAC(player.ac);
        if (ac !== player.ac) {
            errors.push(`Invalid AC: ${player.ac} (must be 1-30)`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate encounter data structure
 * @param {Object} encounter - Encounter object
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateEncounter(encounter) {
    const errors = [];
    
    if (!encounter) {
        return { valid: false, errors: ['Encounter object is required'] };
    }
    
    if (!encounter.name || encounter.name.trim() === '') {
        errors.push('Encounter name is required');
    }
    
    if (!encounter.combatants || !Array.isArray(encounter.combatants)) {
        errors.push('Combatants must be an array');
    }
    
    if (encounter.chapter === undefined || encounter.chapter === null) {
        errors.push('Encounter must have a chapter');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if a combatant is a player (vs monster/NPC)
 * @param {Object} combatant - Combatant object
 * @returns {boolean} True if player combatant
 */
export function isPlayerCombatant(combatant) {
    // Players don't have a name field (name looked up from dndBeyondUrl)
    return !combatant.hasOwnProperty('name');
}
