/**
 * Tests for utility helpers
 */

import {
    CONDITION_ICONS,
    getDamageTypeClass,
    formatActionDescription,
    getCombatantName,
    getCombatantDexScore,
    isCharacterUrl,
    formatNumber,
    debounce,
    generateId,
    getURLParameter
} from '../../static/utils/helpers.js';

describe('Utility Helpers', () => {
    describe('CONDITION_ICONS', () => {
        test('contains standard D&D conditions', () => {
            expect(CONDITION_ICONS['Blinded']).toBe('🙈');
            expect(CONDITION_ICONS['Stunned']).toBe('💫');
            expect(CONDITION_ICONS['Concentrating']).toBe('⚡');
        });
    });
    
    describe('getDamageTypeClass', () => {
        test('returns correct class for damage types', () => {
            expect(getDamageTypeClass('fire')).toBe('damage-fire');
            expect(getDamageTypeClass('Fire damage')).toBe('damage-fire');
            expect(getDamageTypeClass('cold')).toBe('damage-cold');
            expect(getDamageTypeClass('piercing')).toBe('damage-piercing');
        });
        
        test('returns empty string for unknown type', () => {
            expect(getDamageTypeClass('unknown')).toBe('');
            expect(getDamageTypeClass('')).toBe('');
            expect(getDamageTypeClass(null)).toBe('');
        });
    });
    
    describe('formatActionDescription', () => {
        test('adds spaces after periods before capitals', () => {
            const result = formatActionDescription('ft.Hit:');
            expect(result).toContain('ft.');
            expect(result).toContain('Hit');
        });
        
        test('adds spaces around dice rolls', () => {
            const result = formatActionDescription('4(1d4+2)piercing');
            expect(result).toContain('4 (');
            expect(result).toContain(') ');
        });
        
        test('bolds attack roll patterns', () => {
            const result = formatActionDescription('Melee Weapon Attack');
            expect(result).toContain('<strong>Melee Weapon Attack</strong>');
        });
        
        test('bolds damage types', () => {
            const result = formatActionDescription('deals fire damage');
            expect(result).toContain('<strong>fire</strong>');
        });
        
        test('bolds dice rolls', () => {
            const result = formatActionDescription('roll 2d6+3');
            expect(result).toContain('<strong>2d6+3</strong>');
        });
        
        test('handles empty input', () => {
            expect(formatActionDescription('')).toBe('');
            expect(formatActionDescription(null)).toBe('');
        });
    });
    
    describe('getCombatantName', () => {
        const players = [
            { name: 'Gandalf', dndBeyondUrl: 'https://dndbeyond.com/characters/12345' },
            { name: 'Aragorn', dndBeyondUrl: '67890' }
        ];
        
        test('returns name for monster combatants', () => {
            const monster = { name: 'Goblin' };
            expect(getCombatantName(monster, players)).toBe('Goblin');
        });
        
        test('looks up name for player combatants', () => {
            const player = { id: '12345' };
            expect(getCombatantName(player, players)).toBe('Gandalf');
        });
        
        test('handles player with just ID', () => {
            const player = { id: '67890' };
            expect(getCombatantName(player, players)).toBe('Aragorn');
        });
        
        test('returns Unknown Player if not found', () => {
            const player = { id: '99999' };
            expect(getCombatantName(player, players)).toBe('Unknown Player');
        });
    });
    
    describe('getCombatantDexScore', () => {
        const players = [
            {
                name: 'Gandalf',
                dndBeyondUrl: '12345',
                abilityScores: { dex: 16 }
            }
        ];
        
        test('returns DEX from player data', () => {
            const player = { id: '12345' };
            expect(getCombatantDexScore(player, players)).toBe(16);
        });
        
        test('returns stored dexScore for monsters', () => {
            const monster = { name: 'Goblin', dexScore: 14 };
            expect(getCombatantDexScore(monster, players)).toBe(14);
        });
        
        test('estimates DEX from initiative bonus', () => {
            const monster = { name: 'Orc', initiativeBonus: 2 };
            expect(getCombatantDexScore(monster, players)).toBe(14); // 10 + (2 * 2)
        });
        
        test('defaults to 10 if no data', () => {
            const unknown = { id: '99999' };
            expect(getCombatantDexScore(unknown, players)).toBe(10);
        });
    });
    
    describe('isCharacterUrl', () => {
        test('identifies character URLs', () => {
            expect(isCharacterUrl('https://dndbeyond.com/characters/12345')).toBe(true);
            expect(isCharacterUrl('https://dndbeyond.com/profile/user/characters/12345')).toBe(true);
        });
        
        test('identifies monster URLs as false', () => {
            expect(isCharacterUrl('https://dndbeyond.com/monsters/goblin')).toBe(false);
        });
        
        test('handles null/empty', () => {
            expect(isCharacterUrl(null)).toBe(false);
            expect(isCharacterUrl('')).toBe(false);
        });
    });
    
    describe('formatNumber', () => {
        test('formats numbers with thousands separator', () => {
            expect(formatNumber(1000)).toBe('1,000');
            expect(formatNumber(1234567)).toBe('1,234,567');
        });
        
        test('handles small numbers', () => {
            expect(formatNumber(100)).toBe('100');
            expect(formatNumber(0)).toBe('0');
        });
    });
    
    describe('debounce', () => {
        jest.useFakeTimers();
        
        test('delays function execution', () => {
            const func = jest.fn();
            const debounced = debounce(func, 100);
            
            debounced();
            expect(func).not.toHaveBeenCalled();
            
            jest.advanceTimersByTime(100);
            expect(func).toHaveBeenCalledTimes(1);
        });
        
        test('cancels previous call if called again', () => {
            const func = jest.fn();
            const debounced = debounce(func, 100);
            
            debounced();
            debounced();
            debounced();
            
            jest.advanceTimersByTime(100);
            expect(func).toHaveBeenCalledTimes(1);
        });
        
        afterEach(() => {
            jest.clearAllTimers();
        });
    });
    
    describe('generateId', () => {
        test('generates unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();
            
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(10);
        });
    });
    
    describe('getURLParameter', () => {
        test('gets URL parameter', () => {
            // Mock window.location
            delete window.location;
            window.location = new URL('http://localhost?test=value&foo=bar');
            
            expect(getURLParameter('test')).toBe('value');
            expect(getURLParameter('foo')).toBe('bar');
        });
        
        test('returns null for missing parameter', () => {
            delete window.location;
            window.location = new URL('http://localhost');
            
            expect(getURLParameter('missing')).toBeNull();
        });
    });
});
