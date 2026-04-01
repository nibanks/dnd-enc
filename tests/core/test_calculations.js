/**
 * Tests for calculations module
 */

import {
    CR_TO_XP,
    parseCR,
    formatModifier,
    calculateModifier,
    calculateProficiencyBonus,
    getEncounterMultiplier,
    calculateEncounterXPFromMonsters,
    xpToCR,
    sortByInitiative,
    calculatePassiveSkill,
    rollInitiative,
    rollDice
} from '../../static/core/calculations.js';

describe('calculations module', () => {
    describe('parseCR', () => {
        test('parses whole number CR', () => {
            expect(parseCR('5')).toBe(5);
            expect(parseCR('10')).toBe(10);
            expect(parseCR('0')).toBe(0);
        });

        test('parses fractional CR', () => {
            expect(parseCR('1/8')).toBe(0.125);
            expect(parseCR('1/4')).toBe(0.25);
            expect(parseCR('1/2')).toBe(0.5);
        });

        test('handles numeric input', () => {
            expect(parseCR(5)).toBe(5);
            expect(parseCR(0.5)).toBe(0.5);
        });

        test('handles invalid input', () => {
            expect(parseCR('')).toBe(0);
            expect(parseCR(null)).toBe(0);
            expect(parseCR(undefined)).toBe(0);
        });
    });

    describe('formatModifier', () => {
        test('formats positive modifiers', () => {
            expect(formatModifier(16)).toBe('+3');
            expect(formatModifier(20)).toBe('+5');
            expect(formatModifier(12)).toBe('+1');
        });

        test('formats zero modifier', () => {
            expect(formatModifier(10)).toBe('+0');
            expect(formatModifier(11)).toBe('+0');
        });

        test('formats negative modifiers', () => {
            expect(formatModifier(8)).toBe('-1');
            expect(formatModifier(6)).toBe('-2');
            expect(formatModifier(3)).toBe('-4');
        });
    });

    describe('calculateModifier', () => {
        test('calculates correct modifiers', () => {
            expect(calculateModifier(10)).toBe(0);
            expect(calculateModifier(16)).toBe(3);
            expect(calculateModifier(8)).toBe(-1);
            expect(calculateModifier(20)).toBe(5);
        });
    });

    describe('calculateProficiencyBonus', () => {
        test('calculates bonus for levels 1-4', () => {
            expect(calculateProficiencyBonus(1)).toBe(2);
            expect(calculateProficiencyBonus(4)).toBe(2);
        });

        test('calculates bonus for levels 5-8', () => {
            expect(calculateProficiencyBonus(5)).toBe(3);
            expect(calculateProficiencyBonus(8)).toBe(3);
        });

        test('calculates bonus for levels 9-12', () => {
            expect(calculateProficiencyBonus(9)).toBe(4);
            expect(calculateProficiencyBonus(12)).toBe(4);
        });

        test('calculates bonus for levels 13-16', () => {
            expect(calculateProficiencyBonus(13)).toBe(5);
            expect(calculateProficiencyBonus(16)).toBe(5);
        });

        test('calculates bonus for levels 17-20', () => {
            expect(calculateProficiencyBonus(17)).toBe(6);
            expect(calculateProficiencyBonus(20)).toBe(6);
        });
    });

    describe('getEncounterMultiplier', () => {
        test('returns 1 for 0-1 monsters', () => {
            expect(getEncounterMultiplier(0)).toBe(1);
            expect(getEncounterMultiplier(1)).toBe(1);
        });

        test('returns 1.5 for 2 monsters', () => {
            expect(getEncounterMultiplier(2)).toBe(1.5);
        });

        test('returns 2 for 3-6 monsters', () => {
            expect(getEncounterMultiplier(3)).toBe(2);
            expect(getEncounterMultiplier(6)).toBe(2);
        });

        test('returns 2.5 for 7-10 monsters', () => {
            expect(getEncounterMultiplier(7)).toBe(2.5);
            expect(getEncounterMultiplier(10)).toBe(2.5);
        });

        test('returns 3 for 11-14 monsters', () => {
            expect(getEncounterMultiplier(11)).toBe(3);
            expect(getEncounterMultiplier(14)).toBe(3);
        });

        test('returns 4 for 15+ monsters', () => {
            expect(getEncounterMultiplier(15)).toBe(4);
            expect(getEncounterMultiplier(20)).toBe(4);
        });
    });

    describe('calculateEncounterXPFromMonsters', () => {
        test('calculates XP for single monster', () => {
            const monsters = [{ cr: '1' }];
            expect(calculateEncounterXPFromMonsters(monsters)).toBe(200);
        });

        test('calculates XP for multiple monsters with multiplier', () => {
            const monsters = [
                { cr: '1' },
                { cr: '1' }
            ];
            // 2 monsters: 200 + 200 = 400, multiplier 1.5 = 600
            expect(calculateEncounterXPFromMonsters(monsters)).toBe(600);
        });

        test('calculates XP with fractional CR', () => {
            const monsters = [
                { cr: '1/4' },
                { cr: '1/4' },
                { cr: '1/4' }
            ];
            // 3 monsters: 50 * 3 = 150, multiplier 2 = 300
            expect(calculateEncounterXPFromMonsters(monsters)).toBe(300);
        });

        test('looks up CR from monster database', () => {
            const monsters = [
                { name: 'Goblin 1' },
                { name: 'Goblin 2' }
            ];
            const monsterLookup = {
                'Goblin': { cr: '1/4' }
            };
            // 2 monsters: 50 * 2 = 100, multiplier 1.5 = 150
            expect(calculateEncounterXPFromMonsters(monsters, { monsterLookup })).toBe(150);
        });

        test('handles empty array', () => {
            expect(calculateEncounterXPFromMonsters([])).toBe(0);
        });

        test('handles null input', () => {
            expect(calculateEncounterXPFromMonsters(null)).toBe(0);
        });
    });

    describe('xpToCR', () => {
        test('converts XP to CR correctly', () => {
            expect(xpToCR(10)).toBe('0');
            expect(xpToCR(25)).toBe('1/8');
            expect(xpToCR(50)).toBe('1/4');
            expect(xpToCR(100)).toBe('1/2');
            expect(xpToCR(200)).toBe('1');
            expect(xpToCR(5900)).toBe('10');
            expect(xpToCR(25000)).toBe('20');
        });

        test('rounds down to nearest CR', () => {
            expect(xpToCR(150)).toBe('1/2');
            expect(xpToCR(5000)).toBe('9');
        });

        test('handles very high XP', () => {
            expect(xpToCR(155000)).toBe('30');
            expect(xpToCR(200000)).toBe('30');
        });

        test('handles very low XP', () => {
            expect(xpToCR(5)).toBe('0');
            expect(xpToCR(0)).toBe('0');
        });
    });

    describe('sortByInitiative', () => {
        test('sorts by initiative descending', () => {
            const combatants = [
                { name: 'A', initiative: 10 },
                { name: 'B', initiative: 15 },
                { name: 'C', initiative: 5 }
            ];
            const sorted = sortByInitiative(combatants);
            expect(sorted[0].name).toBe('B');
            expect(sorted[1].name).toBe('A');
            expect(sorted[2].name).toBe('C');
        });

        test('uses DEX as tiebreaker', () => {
            const combatants = [
                { name: 'A', initiative: 10, dexScore: 14 },
                { name: 'B', initiative: 10, dexScore: 16 },
                { name: 'C', initiative: 10, dexScore: 12 }
            ];
            const sorted = sortByInitiative(combatants);
            expect(sorted[0].name).toBe('B'); // DEX 16
            expect(sorted[1].name).toBe('A'); // DEX 14
            expect(sorted[2].name).toBe('C'); // DEX 12
        });

        test('uses name as final tiebreaker', () => {
            const combatants = [
                { name: 'Charlie', initiative: 10, dexScore: 14 },
                { name: 'Alice', initiative: 10, dexScore: 14 },
                { name: 'Bob', initiative: 10, dexScore: 14 }
            ];
            const sorted = sortByInitiative(combatants);
            expect(sorted[0].name).toBe('Alice');
            expect(sorted[1].name).toBe('Bob');
            expect(sorted[2].name).toBe('Charlie');
        });

        test('does not mutate input array', () => {
            const combatants = [
                { name: 'A', initiative: 10 },
                { name: 'B', initiative: 15 }
            ];
            const original = [...combatants];
            sortByInitiative(combatants);
            expect(combatants).toEqual(original);
        });

        test('handles empty array', () => {
            expect(sortByInitiative([])).toEqual([]);
        });

        test('handles null input', () => {
            expect(sortByInitiative(null)).toEqual([]);
        });
    });

    describe('calculatePassiveSkill', () => {
        test('calculates passive without proficiency', () => {
            expect(calculatePassiveSkill(14, false, 2)).toBe(12); // 10 + 2 mod
            expect(calculatePassiveSkill(10, false, 3)).toBe(10); // 10 + 0 mod
        });

        test('calculates passive with proficiency', () => {
            expect(calculatePassiveSkill(14, true, 2)).toBe(14); // 10 + 2 mod + 2 prof
            expect(calculatePassiveSkill(16, true, 3)).toBe(16); // 10 + 3 mod + 3 prof
        });

        test('handles negative modifiers', () => {
            expect(calculatePassiveSkill(8, false, 2)).toBe(9); // 10 - 1 mod
            expect(calculatePassiveSkill(8, true, 2)).toBe(11); // 10 - 1 mod + 2 prof
        });
    });

    describe('rollInitiative', () => {
        test('returns value in expected range', () => {
            for (let i = 0; i < 100; i++) {
                const result = rollInitiative(3);
                expect(result).toBeGreaterThanOrEqual(4); // 1 + 3
                expect(result).toBeLessThanOrEqual(23); // 20 + 3
            }
        });

        test('handles negative bonus', () => {
            for (let i = 0; i < 100; i++) {
                const result = rollInitiative(-2);
                expect(result).toBeGreaterThanOrEqual(-1); // 1 - 2
                expect(result).toBeLessThanOrEqual(18); // 20 - 2
            }
        });

        test('handles no bonus', () => {
            for (let i = 0; i < 100; i++) {
                const result = rollInitiative();
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(20);
            }
        });
    });

    describe('rollDice', () => {
        test('parses simple dice notation', () => {
            const result = rollDice('1d6');
            expect(result.count).toBe(1);
            expect(result.sides).toBe(6);
            expect(result.bonus).toBe(0);
            expect(result.rolls).toHaveLength(1);
            expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
            expect(result.rolls[0]).toBeLessThanOrEqual(6);
        });

        test('parses dice with bonus', () => {
            const result = rollDice('1d8+3');
            expect(result.count).toBe(1);
            expect(result.sides).toBe(8);
            expect(result.bonus).toBe(3);
            expect(result.total).toBeGreaterThanOrEqual(4); // 1 + 3
            expect(result.total).toBeLessThanOrEqual(11); // 8 + 3
        });

        test('parses multiple dice', () => {
            const result = rollDice('2d6');
            expect(result.count).toBe(2);
            expect(result.sides).toBe(6);
            expect(result.rolls).toHaveLength(2);
            expect(result.total).toBeGreaterThanOrEqual(2);
            expect(result.total).toBeLessThanOrEqual(12);
        });

        test('calculates correct total', () => {
            const result = rollDice('3d6+5');
            const expectedTotal = result.rolls.reduce((sum, r) => sum + r, 0) + 5;
            expect(result.total).toBe(expectedTotal);
        });

        test('handles invalid notation', () => {
            const result = rollDice('invalid');
            expect(result.total).toBe(0);
            expect(result.rolls).toEqual([]);
            expect(result.bonus).toBe(0);
        });
    });

    describe('CR_TO_XP constant', () => {
        test('contains all standard CRs', () => {
            expect(CR_TO_XP['0']).toBe(10);
            expect(CR_TO_XP['1/8']).toBe(25);
            expect(CR_TO_XP['1/4']).toBe(50);
            expect(CR_TO_XP['1/2']).toBe(100);
            expect(CR_TO_XP['1']).toBe(200);
            expect(CR_TO_XP['10']).toBe(5900);
            expect(CR_TO_XP['20']).toBe(25000);
            expect(CR_TO_XP['30']).toBe(155000);
        });

        test('XP values increase with CR', () => {
            expect(CR_TO_XP['0']).toBeLessThan(CR_TO_XP['1/8']);
            expect(CR_TO_XP['1/8']).toBeLessThan(CR_TO_XP['1/4']);
            expect(CR_TO_XP['1/4']).toBeLessThan(CR_TO_XP['1/2']);
            expect(CR_TO_XP['1/2']).toBeLessThan(CR_TO_XP['1']);
        });
    });
});
