/**
 * Pure business logic for D&D encounter calculations
 * No dependencies on DOM or global state
 */

// CR to XP mapping (D&D 5e)
export const CR_TO_XP = {
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

// XP thresholds for leveling (D&D 5e)
export const LEVEL_THRESHOLDS = [
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

/**
 * Parse CR string to numeric value for comparison
 * @param {string} cr - Challenge Rating (e.g., "1/4", "5", "1/2")
 * @returns {number} Numeric CR value
 */
export function parseCR(cr) {
    if (typeof cr !== 'string') {
        return parseFloat(cr) || 0;
    }
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr) || 0;
}

/**
 * Calculate ability modifier from ability score
 * @param {number} score - Ability score (1-30)
 * @returns {string} Formatted modifier (e.g., "+3", "-1")
 */
export function formatModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculate numeric ability modifier from ability score
 * @param {number} score - Ability score (1-30)
 * @returns {number} Numeric modifier
 */
export function calculateModifier(score) {
    return Math.floor((score - 10) / 2);
}

/**
 * Calculate proficiency bonus based on character level
 * @param {number} level - Character level (1-20)
 * @returns {number} Proficiency bonus
 */
export function calculateProficiencyBonus(level) {
    return 2 + Math.floor((level - 1) / 4);
}

/**
 * Get encounter difficulty multiplier based on number of monsters (D&D 5e DMG rules)
 * @param {number} monsterCount - Number of monsters in encounter
 * @returns {number} XP multiplier
 */
export function getEncounterMultiplier(monsterCount) {
    if (monsterCount === 0 || monsterCount === 1) return 1;
    if (monsterCount === 2) return 1.5;
    if (monsterCount >= 3 && monsterCount <= 6) return 2;
    if (monsterCount >= 7 && monsterCount <= 10) return 2.5;
    if (monsterCount >= 11 && monsterCount <= 14) return 3;
    return 4;
}

/**
 * Calculate total XP for an encounter from monster CRs
 * @param {Array} monsters - Array of monster objects with cr property
 * @param {Object} options - Optional parameters
 * @param {Object} options.monsterLookup - Monster database for CR lookup by name
 * @returns {number} Total adjusted XP for encounter
 */
export function calculateEncounterXPFromMonsters(monsters, options = {}) {
    if (!monsters || !Array.isArray(monsters)) return 0;
    
    const { monsterLookup = {} } = options;
    
    // Calculate base XP from monster CRs
    const totalXP = monsters.reduce((sum, monster) => {
        let cr = monster.cr || '';
        
        // If no CR, try to look up from monster database by name
        if (!cr && monster.name && monsterLookup) {
            const baseName = monster.name.replace(/\s+\d+$/, '');
            const monsterData = monsterLookup[baseName];
            cr = monsterData?.cr || '';
        }
        
        const xp = CR_TO_XP[cr] || 0;
        return sum + xp;
    }, 0);
    
    // Apply encounter multiplier
    const multiplier = getEncounterMultiplier(monsters.length);
    return Math.round(totalXP * multiplier);
}

/**
 * Convert XP value to equivalent CR
 * @param {number} xp - Total XP value
 * @returns {string} Equivalent CR string
 */
export function xpToCR(xp) {
    const xpToCRTable = [
        [10, '0'], [25, '1/8'], [50, '1/4'], [100, '1/2'],
        [200, '1'], [450, '2'], [700, '3'], [1100, '4'], [1800, '5'],
        [2300, '6'], [2900, '7'], [3900, '8'], [5000, '9'], [5900, '10'],
        [7200, '11'], [8400, '12'], [10000, '13'], [11500, '14'], [13000, '15'],
        [15000, '16'], [18000, '17'], [20000, '18'], [22000, '19'], [25000, '20'],
        [33000, '21'], [41000, '22'], [50000, '23'], [62000, '24'], [75000, '25'],
        [90000, '26'], [105000, '27'], [120000, '28'], [135000, '29'], [155000, '30']
    ];
    
    for (let i = xpToCRTable.length - 1; i >= 0; i--) {
        if (xp >= xpToCRTable[i][0]) {
            return xpToCRTable[i][1];
        }
    }
    
    return '0';
}

/**
 * Sort combatants by initiative with DEX tiebreaker
 * @param {Array} combatants - Array of combatant objects
 * @returns {Array} Sorted array (new array, does not mutate input)
 */
export function sortByInitiative(combatants) {
    if (!combatants || !Array.isArray(combatants)) return [];
    
    return [...combatants].sort((a, b) => {
        const initA = a.initiative || 0;
        const initB = b.initiative || 0;
        
        // Primary sort: initiative (higher first)
        if (initA !== initB) {
            return initB - initA;
        }
        
        // Tiebreaker 1: DEX score (higher first)
        const dexA = a.dexScore || 10;
        const dexB = b.dexScore || 10;
        if (dexA !== dexB) {
            return dexB - dexA;
        }
        
        // Tiebreaker 2: name (alphabetical for stable sort)
        const nameA = a.name || a.id || '';
        const nameB = b.name || b.id || '';
        return nameA.localeCompare(nameB);
    });
}

/**
 * Calculate passive skill value
 * @param {number} abilityScore - Relevant ability score
 * @param {boolean} isProficient - Whether character is proficient in the skill
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @returns {number} Passive skill value (10 + modifier + bonus if proficient)
 */
export function calculatePassiveSkill(abilityScore, isProficient, proficiencyBonus) {
    const modifier = calculateModifier(abilityScore);
    const bonus = isProficient ? proficiencyBonus : 0;
    return 10 + modifier + bonus;
}

/**
 * Roll initiative for a combatant
 * @param {number} initiativeBonus - Initiative modifier
 * @returns {number} Initiative roll result (d20 + bonus)
 */
export function rollInitiative(initiativeBonus = 0) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    return d20 + initiativeBonus;
}

/**
 * Roll damage dice
 * @param {string} diceExpression - Dice expression (e.g., "1d6+3", "2d8")
 * @returns {Object} Result object with total and individual rolls
 */
export function rollDice(diceExpression) {
    const match = diceExpression.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) {
        return { total: 0, rolls: [], bonus: 0 };
    }
    
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;
    
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + bonus;
    
    return { total, rolls, bonus, sides, count };
}
