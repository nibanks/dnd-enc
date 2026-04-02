/**
 * Tests for D&D Encounter Tracker JavaScript functionality
 * Tests the modular ES6 architecture
 */

import { 
  DND_CLASSES, 
  DND_RACES, 
  CR_TO_XP, 
  LEVEL_THRESHOLDS,
  DND_CONDITIONS,
  CONDITION_ICONS 
} from '../static/utils/constants.js';

import {
  parseCR,
  formatNumber,
  escapeHTML,
  isCharacterUrl,
  getCombatantName,
  getCombatantDexScore,
  getDamageTypeClass,
  generateId,
  debounce
} from '../static/utils/helpers.js';

describe('D&D Constants - Classes and Races', () => {
  test('DND_CLASSES contains all 12 PHB classes', () => {
    expect(DND_CLASSES).toHaveLength(12);
    expect(DND_CLASSES).toContain('Fighter');
    expect(DND_CLASSES).toContain('Wizard');
    expect(DND_CLASSES).toContain('Rogue');
    expect(DND_CLASSES).toContain('Cleric');
  });

  test('DND_RACES contains common races', () => {
    expect(DND_RACES.length).toBeGreaterThan(20);
    expect(DND_RACES).toContain('Human');
    expect(DND_RACES).toContain('Elf');
    expect(DND_RACES).toContain('Dwarf');
    expect(DND_RACES).toContain('Dragonborn');
  });
});

describe('D&D Constants - CR to XP Mapping', () => {
  test('CR_TO_XP contains all standard CRs', () => {
    expect(CR_TO_XP['0']).toBe(10);
    expect(CR_TO_XP['1/8']).toBe(25);
    expect(CR_TO_XP['1/4']).toBe(50);
    expect(CR_TO_XP['1/2']).toBe(100);
    expect(CR_TO_XP['1']).toBe(200);
    expect(CR_TO_XP['10']).toBe(5900);
    expect(CR_TO_XP['20']).toBe(25000);
    expect(CR_TO_XP['30']).toBe(155000);
  });

  test('CR fractional values are correctly mapped', () => {
    expect(CR_TO_XP['1/8']).toBeLessThan(CR_TO_XP['1/4']);
    expect(CR_TO_XP['1/4']).toBeLessThan(CR_TO_XP['1/2']);
    expect(CR_TO_XP['1/2']).toBeLessThan(CR_TO_XP['1']);
  });

  test('CR XP values increase with CR rating', () => {
    expect(CR_TO_XP['0']).toBeLessThan(CR_TO_XP['1/8']);
    expect(CR_TO_XP['1/8']).toBeLessThan(CR_TO_XP['1/4']);
    expect(CR_TO_XP['1/4']).toBeLessThan(CR_TO_XP['1/2']);
    expect(CR_TO_XP['1/2']).toBeLessThan(CR_TO_XP['1']);
    expect(CR_TO_XP['1']).toBeLessThan(CR_TO_XP['5']);
    expect(CR_TO_XP['5']).toBeLessThan(CR_TO_XP['10']);
    expect(CR_TO_XP['10']).toBeLessThan(CR_TO_XP['20']);
    expect(CR_TO_XP['20']).toBeLessThan(CR_TO_XP['30']);
  });
});

describe('D&D Constants - Level Thresholds', () => {
  test('LEVEL_THRESHOLDS contains all 20 levels', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(20);
    expect(LEVEL_THRESHOLDS[0].level).toBe(1);
    expect(LEVEL_THRESHOLDS[19].level).toBe(20);
  });

  test('Level thresholds increase progressively', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i].xp).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1].xp);
    }
  });

  test('Level 1 starts at 0 XP', () => {
    expect(LEVEL_THRESHOLDS[0].xp).toBe(0);
  });
});

describe('D&D Constants - Conditions', () => {
  test('DND_CONDITIONS contains standard conditions', () => {
    expect(DND_CONDITIONS).toContain('Blinded');
    expect(DND_CONDITIONS).toContain('Charmed');
    expect(DND_CONDITIONS).toContain('Paralyzed');
    expect(DND_CONDITIONS).toContain('Unconscious');
  });

  test('CONDITION_ICONS maps all conditions to icons', () => {
    expect(CONDITION_ICONS['Blinded']).toBe('🙈');
    expect(CONDITION_ICONS['Charmed']).toBe('💖');
    expect(CONDITION_ICONS['Paralyzed']).toBe('🧊');
    expect(CONDITION_ICONS['Unconscious']).toBe('⚰️');
  });
});

describe('Helpers - parseCR', () => {
  test('parses whole number CRs', () => {
    expect(parseCR('1')).toBe(1);
    expect(parseCR('5')).toBe(5);
    expect(parseCR('20')).toBe(20);
  });

  test('parses fractional CRs', () => {
    expect(parseCR('1/8')).toBe(0.125);
    expect(parseCR('1/4')).toBe(0.25);
    expect(parseCR('1/2')).toBe(0.5);
  });

  test('handles numeric input', () => {
    expect(parseCR(5)).toBe(5);
    expect(parseCR(0.25)).toBe(0.25);
  });

  test('handles invalid input', () => {
    expect(parseCR('')).toBe(0);
    expect(parseCR(null)).toBe(0);
  });
});

describe('Helpers - formatNumber', () => {
  test('formats numbers with thousands separator', () => {
    const result = formatNumber(1000);
    expect(result).toMatch(/1[,\s]000/); // Handles different locale separators
  });

  test('handles small numbers', () => {
    expect(formatNumber(100)).toBeTruthy();
  });
});

describe('Helpers - escapeHTML', () => {
  test('escapes HTML special characters', () => {
    const result = escapeHTML('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  test('escapes ampersands', () => {
    const result = escapeHTML('Tom & Jerry');
    expect(result).toContain('&amp;');
  });
});

describe('Helpers - isCharacterUrl', () => {
  test('identifies character URLs', () => {
    expect(isCharacterUrl('/profile/username/characters/12345')).toBe(true);
    expect(isCharacterUrl('/characters/12345')).toBe(true);
  });

  test('rejects monster URLs', () => {
    expect(isCharacterUrl('/monsters/17140-goblin')).toBe(false);
  });

  test('handles null/undefined', () => {
    expect(isCharacterUrl(null)).toBe(false);
    expect(isCharacterUrl(undefined)).toBe(false);
    expect(isCharacterUrl('')).toBe(false);
  });
});

describe('Helpers - getCombatantName', () => {
  const players = [
    { 
      name: 'Aragorn', 
      dndBeyondUrl: '/characters/12345' 
    },
    { 
      name: 'Legolas', 
      dndBeyondUrl: '/characters/67890' 
    }
  ];

  test('returns monster name directly', () => {
    const combatant = { name: 'Goblin' };
    expect(getCombatantName(combatant, players)).toBe('Goblin');
  });

  test('looks up player name by ID', () => {
    const combatant = { id: '12345' };
    expect(getCombatantName(combatant, players)).toBe('Aragorn');
  });

  test('handles unknown player', () => {
    const combatant = { id: '99999' };
    expect(getCombatantName(combatant, players)).toBe('Unknown Player');
  });
});

describe('Helpers - getCombatantDexScore', () => {
  const players = [
    { 
      dndBeyondUrl: '/characters/12345',
      abilityScores: { dex: 16 }
    }
  ];

  test('returns player DEX score', () => {
    const combatant = { id: '12345' };
    expect(getCombatantDexScore(combatant, players)).toBe(16);
  });

  test('returns monster dexScore if available', () => {
    const combatant = { name: 'Goblin', dexScore: 14 };
    expect(getCombatantDexScore(combatant, players)).toBe(14);
  });

  test('defaults to 10 for unknown', () => {
    const combatant = { id: '99999' };
    expect(getCombatantDexScore(combatant, players)).toBe(10);
  });
});

describe('Helpers - getDamageTypeClass', () => {
  test('returns correct class for damage types', () => {
    expect(getDamageTypeClass('fire')).toBe('damage-fire');
    expect(getDamageTypeClass('cold')).toBe('damage-cold');
    expect(getDamageTypeClass('poison')).toBe('damage-poison');
  });

  test('handles case insensitivity', () => {
    expect(getDamageTypeClass('FIRE')).toBe('damage-fire');
    expect(getDamageTypeClass('Fire')).toBe('damage-fire');
  });

  test('returns empty string for unknown type', () => {
    expect(getDamageTypeClass('unknown')).toBe('');
    expect(getDamageTypeClass(null)).toBe('');
  });
});

describe('Helpers - generateId', () => {
  test('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  test('returns string', () => {
    expect(typeof generateId()).toBe('string');
  });
});

describe('Helpers - debounce', () => {
  jest.useFakeTimers();

  test('delays function execution', () => {
    const func = jest.fn();
    const debouncedFunc = debounce(func, 100);
    
    debouncedFunc();
    expect(func).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  test('cancels previous call', () => {
    const func = jest.fn();
    const debouncedFunc = debounce(func, 100);
    
    debouncedFunc();
    debouncedFunc();
    debouncedFunc();
    
    jest.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  jest.useRealTimers();
});

describe('Adventure Data Validation', () => {
  test('valid adventure structure', () => {
    const adventure = {
      name: 'Test Adventure',
      chapters: [
        {
          name: 'Chapter 1',
          encounters: []
        }
      ],
      players: []
    };

    expect(adventure.name).toBeDefined();
    expect(Array.isArray(adventure.chapters)).toBe(true);
    expect(Array.isArray(adventure.players)).toBe(true);
  });

  test('player data has required fields', () => {
    const player = {
      name: 'Test Player',
      level: 5,
      class: 'Fighter',
      race: 'Human',
      maxHp: 45,
      currentHp: 45,
      armorClass: 18
    };

    expect(player.name).toBeDefined();
    expect(player.level).toBeGreaterThan(0);
    expect(player.maxHp).toBeGreaterThanOrEqual(player.currentHp);
  });

  test('encounter data structure', () => {
    const encounter = {
      name: 'Test Encounter',
      monsters: [
        { name: 'Goblin', count: 3, url: 'monsters/17140-goblin' }
      ],
      description: 'A test encounter'
    };

    expect(encounter.name).toBeDefined();
    expect(Array.isArray(encounter.monsters)).toBe(true);
    expect(encounter.monsters[0].count).toBeGreaterThan(0);
  });
});
