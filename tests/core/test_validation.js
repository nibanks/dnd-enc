/**
 * Tests for validation module
 */

import {
    DND_CLASSES,
    DND_RACES,
    DND_CONDITIONS,
    validateAbilityScore,
    validateHP,
    validateLevel,
    validateAC,
    validateInitiative,
    validatePIN,
    validateDnDBeyondURL,
    validateCR,
    sanitizeName,
    validatePlayer,
    validateEncounter,
    isPlayerCombatant
} from '../../static/core/validation.js';

describe('validation module', () => {
    describe('validateAbilityScore', () => {
        test('accepts valid scores', () => {
            expect(validateAbilityScore(10)).toBe(10);
            expect(validateAbilityScore(18)).toBe(18);
            expect(validateAbilityScore(20)).toBe(20);
        });

        test('clamps to minimum 1', () => {
            expect(validateAbilityScore(0)).toBe(1);
            expect(validateAbilityScore(-5)).toBe(1);
        });

        test('clamps to maximum 30', () => {
            expect(validateAbilityScore(35)).toBe(30);
            expect(validateAbilityScore(100)).toBe(30);
        });

        test('defaults invalid input to 10', () => {
            expect(validateAbilityScore('abc')).toBe(10);
            expect(validateAbilityScore(null)).toBe(10);
            expect(validateAbilityScore(undefined)).toBe(10);
        });

        test('parses string numbers', () => {
            expect(validateAbilityScore('15')).toBe(15);
            expect(validateAbilityScore('20')).toBe(20);
        });
    });

    describe('validateHP', () => {
        test('accepts valid HP', () => {
            expect(validateHP(10, 50)).toBe(10);
            expect(validateHP(50, 50)).toBe(50);
        });

        test('clamps to 0 minimum by default', () => {
            expect(validateHP(-5, 50)).toBe(0);
        });

        test('allows negative when specified', () => {
            expect(validateHP(-5, 50, true)).toBe(-5);
            expect(validateHP(-60, 50, true)).toBe(-50);
        });

        test('clamps to maxHp', () => {
            expect(validateHP(60, 50)).toBe(50);
            expect(validateHP(100, 50)).toBe(50);
        });

        test('defaults invalid input to 0', () => {
            expect(validateHP('abc', 50)).toBe(0);
            expect(validateHP(null, 50)).toBe(0);
        });
    });

    describe('validateLevel', () => {
        test('accepts valid levels', () => {
            expect(validateLevel(1)).toBe(1);
            expect(validateLevel(10)).toBe(10);
            expect(validateLevel(20)).toBe(20);
        });

        test('clamps to minimum 1', () => {
            expect(validateLevel(0)).toBe(1);
            expect(validateLevel(-5)).toBe(1);
        });

        test('clamps to maximum 20', () => {
            expect(validateLevel(21)).toBe(20);
            expect(validateLevel(100)).toBe(20);
        });

        test('defaults invalid input to 1', () => {
            expect(validateLevel('abc')).toBe(1);
            expect(validateLevel(null)).toBe(1);
        });
    });

    describe('validateAC', () => {
        test('accepts valid AC', () => {
            expect(validateAC(10)).toBe(10);
            expect(validateAC(18)).toBe(18);
            expect(validateAC(25)).toBe(25);
        });

        test('clamps to minimum 1', () => {
            expect(validateAC(0)).toBe(1);
            expect(validateAC(-5)).toBe(1);
        });

        test('clamps to maximum 30', () => {
            expect(validateAC(35)).toBe(30);
            expect(validateAC(100)).toBe(30);
        });

        test('defaults invalid input to 10', () => {
            expect(validateAC('abc')).toBe(10);
            expect(validateAC(null)).toBe(10);
        });
    });

    describe('validateInitiative', () => {
        test('accepts valid initiative', () => {
            expect(validateInitiative(15)).toBe(15);
            expect(validateInitiative(0)).toBe(0);
            expect(validateInitiative(-5)).toBe(-5);
        });

        test('clamps to minimum -10', () => {
            expect(validateInitiative(-15)).toBe(-10);
        });

        test('clamps to maximum 50', () => {
            expect(validateInitiative(60)).toBe(50);
        });

        test('defaults invalid input to 0', () => {
            expect(validateInitiative('abc')).toBe(0);
            expect(validateInitiative(null)).toBe(0);
        });
    });

    describe('validatePIN', () => {
        test('accepts valid 4-digit PINs', () => {
            expect(validatePIN('1234')).toBe(true);
            expect(validatePIN('0000')).toBe(true);
            expect(validatePIN('9999')).toBe(true);
        });

        test('accepts empty PIN', () => {
            expect(validatePIN('')).toBe(true);
            expect(validatePIN(null)).toBe(true);
            expect(validatePIN(undefined)).toBe(true);
        });

        test('rejects invalid PINs', () => {
            expect(validatePIN('123')).toBe(false);
            expect(validatePIN('12345')).toBe(false);
            expect(validatePIN('abcd')).toBe(false);
            expect(validatePIN('12a4')).toBe(false);
        });

        test('handles whitespace', () => {
            expect(validatePIN('  1234  ')).toBe(true);
            expect(validatePIN('  ')).toBe(true);
        });
    });

    describe('validateDnDBeyondURL', () => {
        test('accepts valid D&D Beyond URLs', () => {
            expect(validateDnDBeyondURL('https://www.dndbeyond.com/characters/12345')).toBe(true);
            expect(validateDnDBeyondURL('https://www.dndbeyond.com/monsters/5174957-scout')).toBe(true);
        });

        test('accepts monster ID format', () => {
            expect(validateDnDBeyondURL('5174957-scout')).toBe(true);
        });

        test('accepts empty URL', () => {
            expect(validateDnDBeyondURL('')).toBe(true);
            expect(validateDnDBeyondURL(null)).toBe(true);
        });

        test('rejects invalid URLs', () => {
            expect(validateDnDBeyondURL('http://google.com')).toBe(false);
            expect(validateDnDBeyondURL('invalid')).toBe(false);
        });
    });

    describe('validateCR', () => {
        test('accepts valid whole number CRs', () => {
            expect(validateCR('0')).toBe(true);
            expect(validateCR('1')).toBe(true);
            expect(validateCR('30')).toBe(true);
        });

        test('accepts valid fractional CRs', () => {
            expect(validateCR('1/8')).toBe(true);
            expect(validateCR('1/4')).toBe(true);
            expect(validateCR('1/2')).toBe(true);
        });

        test('rejects invalid CRs', () => {
            expect(validateCR('')).toBe(false);
            expect(validateCR('abc')).toBe(false);
            expect(validateCR('1.5')).toBe(false);
            expect(validateCR(null)).toBe(false);
        });
    });

    describe('sanitizeName', () => {
        test('trims whitespace', () => {
            expect(sanitizeName('  John  ')).toBe('John');
        });

        test('removes dangerous characters', () => {
            expect(sanitizeName('John<script>')).toBe('Johnscript');
            expect(sanitizeName('Test>value')).toBe('Testvalue');
        });

        test('preserves safe characters', () => {
            expect(sanitizeName("O'Brien")).toBe("O'Brien");
            expect(sanitizeName('Jean-Luc')).toBe('Jean-Luc');
        });

        test('handles empty input', () => {
            expect(sanitizeName('')).toBe('');
            expect(sanitizeName(null)).toBe('');
        });
    });

    describe('validatePlayer', () => {
        test('validates correct player', () => {
            const player = {
                name: 'Test Player',
                level: 5,
                maxHp: 40,
                ac: 16
            };
            const result = validatePlayer(player);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('requires name', () => {
            const player = { name: '', level: 5 };
            const result = validatePlayer(player);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Player name is required');
        });

        test('validates level range', () => {
            const player = { name: 'Test', level: 25 };
            const result = validatePlayer(player);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('validates maxHp', () => {
            const player = { name: 'Test', maxHp: -5 };
            const result = validatePlayer(player);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Max HP must be at least 1');
        });

        test('handles null player', () => {
            const result = validatePlayer(null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Player object is required');
        });
    });

    describe('validateEncounter', () => {
        test('validates correct encounter', () => {
            const encounter = {
                name: 'Test Encounter',
                combatants: [],
                chapter: 'Chapter 1'
            };
            const result = validateEncounter(encounter);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('requires name', () => {
            const encounter = { name: '', combatants: [], chapter: 'Ch1' };
            const result = validateEncounter(encounter);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Encounter name is required');
        });

        test('requires combatants array', () => {
            const encounter = { name: 'Test', chapter: 'Ch1' };
            const result = validateEncounter(encounter);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Combatants must be an array');
        });

        test('requires chapter', () => {
            const encounter = { name: 'Test', combatants: [] };
            const result = validateEncounter(encounter);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Encounter must have a chapter');
        });

        test('handles null encounter', () => {
            const result = validateEncounter(null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Encounter object is required');
        });
    });

    describe('isPlayerCombatant', () => {
        test('identifies player combatants', () => {
            const player = { id: '12345', initiative: 15 };
            expect(isPlayerCombatant(player)).toBe(true);
        });

        test('identifies monster combatants', () => {
            const monster = { name: 'Goblin', id: '67890', initiative: 10 };
            expect(isPlayerCombatant(monster)).toBe(false);
        });
    });

    describe('constants', () => {
        test('DND_CLASSES contains standard classes', () => {
            expect(DND_CLASSES).toContain('Fighter');
            expect(DND_CLASSES).toContain('Wizard');
            expect(DND_CLASSES).toContain('Rogue');
            expect(DND_CLASSES).toHaveLength(12);
        });

        test('DND_RACES contains common races', () => {
            expect(DND_RACES).toContain('Human');
            expect(DND_RACES).toContain('Elf');
            expect(DND_RACES).toContain('Dwarf');
        });

        test('DND_CONDITIONS contains standard conditions', () => {
            expect(DND_CONDITIONS).toContain('Blinded');
            expect(DND_CONDITIONS).toContain('Stunned');
            expect(DND_CONDITIONS).toContain('Concentrating');
        });
    });
});
