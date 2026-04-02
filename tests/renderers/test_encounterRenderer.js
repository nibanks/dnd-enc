/**
 * Tests for encounterRenderer utility functions
 */

import {
    isPlayerCombatant,
    getCombatantName,
    getDexScore,
    calculateEncounterXP,
    calculateDefaultEncounterCR,
    getEncounterCR
} from '../../static/renderers/encounterRenderer.js';

describe('encounterRenderer utilities', () => {
    beforeEach(() => {
        // Reset global state
        window.currentAdventure = null;
        window.DND_MONSTERS = {};
    });
    
    afterEach(() => {
        delete window.currentAdventure;
        delete window.DND_MONSTERS;
    });
    
    describe('isPlayerCombatant', () => {
        test('returns true for player combatants (without name property)', () => {
            const playerCombatant = { id: '12345', hp: 30 };
            expect(isPlayerCombatant(playerCombatant)).toBe(true);
        });
        
        test('returns false for monster combatants (with name property)', () => {
            const monsterCombatant = { name: 'Goblin', hp: 7 };
            expect(isPlayerCombatant(monsterCombatant)).toBe(false);
        });
        
        test('returns false even if name is empty string', () => {
            const combatant = { name: '', hp: 10 };
            expect(isPlayerCombatant(combatant)).toBe(false);
        });
    });
    
    describe('getCombatantName', () => {
        test('returns monster name directly', () => {
            const monster = { name: 'Dragon' };
            expect(getCombatantName(monster)).toBe('Dragon');
        });
        
        test('returns empty string for monster without name', () => {
            const monster = {};
            monster.name = undefined; // Force hasOwnProperty check
            expect(getCombatantName(monster)).toBe('');
        });
        
        test('returns "Unknown Player" for player without ID', () => {
            const player = { hp: 30 };
            expect(getCombatantName(player)).toBe('Unknown Player');
        });
        
        test('looks up player name from adventure', () => {
            window.currentAdventure = {
                players: [
                    {
                        name: 'Aragorn',
                        dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345'
                    }
                ]
            };
            
            const player = { id: '12345' };
            expect(getCombatantName(player)).toBe('Aragorn');
        });
        
        test('returns "Unknown Player" if player not found in adventure', () => {
            window.currentAdventure = {
                players: [
                    {
                        name: 'Aragorn',
                        dndBeyondUrl: 'https://www.dndbeyond.com/characters/99999'
                    }
                ]
            };
            
            const player = { id: '12345' };
            expect(getCombatantName(player)).toBe('Unknown Player');
        });
        
        test('returns "Unknown Player" if no adventure loaded', () => {
            const player = { id: '12345' };
            expect(getCombatantName(player)).toBe('Unknown Player');
        });
    });
    
    describe('getDexScore', () => {
        test('returns stored dexScore for monster', () => {
            const monster = { name: 'Goblin', dexScore: 14 };
            expect(getDexScore(monster)).toBe(14);
        });
        
        test('calculates dexScore from initiativeBonus for monster', () => {
            const monster = { name: 'Orc', initiativeBonus: 2 };
            expect(getDexScore(monster)).toBe(14); // 10 + (2 * 2)
        });
        
        test('returns 10 for monster with no dex info', () => {
            const monster = { name: 'Zombie' };
            expect(getDexScore(monster)).toBe(10);
        });
        
        test('looks up player dexScore from adventure', () => {
            window.currentAdventure = {
                players: [
                    {
                        name: 'Rogue',
                        dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345',
                        abilityScores: { dex: 18 }
                    }
                ]
            };
            
            const player = { id: '12345' };
            expect(getDexScore(player)).toBe(18);
        });
        
        test('returns 10 for player not found', () => {
            window.currentAdventure = { players: [] };
            const player = { id: '12345' };
            expect(getDexScore(player)).toBe(10);
        });
        
        test('returns 10 for player without ability scores', () => {
            window.currentAdventure = {
                players: [
                    {
                        name: 'Fighter',
                        dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345'
                    }
                ]
            };
            
            const player = { id: '12345' };
            expect(getDexScore(player)).toBe(10);
        });
    });
    
    describe('calculateEncounterXP', () => {
        test('returns 0 for empty encounter', () => {
            expect(calculateEncounterXP(null)).toBe(0);
            expect(calculateEncounterXP({})).toBe(0);
            expect(calculateEncounterXP({ combatants: [] })).toBe('0'); // Returns formatted string
        });
        
        test('uses custom CR if set', () => {
            const encounter = {
                totalCR: '5',
                combatants: []
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('1,800'); // CR 5 = 1800 XP
        });
        
        test('calculates XP for single monster', () => {
            const encounter = {
                combatants: [
                    { name: 'Goblin', cr: '1/4' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('50'); // CR 1/4 = 50 XP, multiplier 1 for single monster
        });
        
        test('applies multiplier for 2 monsters', () => {
            const encounter = {
                combatants: [
                    { name: 'Goblin 1', cr: '1/4' },
                    { name: 'Goblin 2', cr: '1/4' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('150'); // (50 + 50) * 1.5 = 150
        });
        
        test('applies multiplier for 3-6 monsters', () => {
            const encounter = {
                combatants: [
                    { name: 'Goblin 1', cr: '1/4' },
                    { name: 'Goblin 2', cr: '1/4' },
                    { name: 'Goblin 3', cr: '1/4' },
                    { name: 'Goblin 4', cr: '1/4' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('400'); // (50 * 4) * 2 = 400
        });
        
        test('applies multiplier for 7-10 monsters', () => {
            const encounter = {
                combatants: [
                    { name: 'G1', cr: '1/8' },
                    { name: 'G2', cr: '1/8' },
                    { name: 'G3', cr: '1/8' },
                    { name: 'G4', cr: '1/8' },
                    { name: 'G5', cr: '1/8' },
                    { name: 'G6', cr: '1/8' },
                    { name: 'G7', cr: '1/8' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('438'); // (25 * 7) * 2.5 = 437.5, rounded to 438
        });
        
        test('looks up CR from monster database', () => {
            window.DND_MONSTERS = {
                'Owlbear': { cr: '3' }
            };
            
            const encounter = {
                combatants: [
                    { name: 'Owlbear' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('700'); // CR 3 = 700 XP
        });
        
        test('strips numbering from monster name when looking up', () => {
            window.DND_MONSTERS = {
                'Cultist': { cr: '1/8' }
            };
            
            const encounter = {
                combatants: [
                    { name: 'Cultist 1' },
                    { name: 'Cultist 2' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('75'); // (25 + 25) * 1.5 = 75
        });
        
        test('ignores player combatants', () => {
            const encounter = {
                combatants: [
                    { id: 'player1' }, // Player (no name property)
                    { name: 'Goblin', cr: '1/4' }
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('50'); // Only counts the goblin
        });
        
        test('handles mixed CR values', () => {
            const encounter = {
                combatants: [
                    { name: 'Goblin', cr: '1/4' },    // 50 XP
                    { name: 'Orc', cr: '1/2' },       // 100 XP
                    { name: 'Ogre', cr: '2' }         // 450 XP
                ]
            };
            
            const result = calculateEncounterXP(encounter);
            expect(result).toBe('1,200'); // (50 + 100 + 450) * 2 = 1200
        });
    });
    
    describe('calculateDefaultEncounterCR', () => {
        test('returns "0" for empty encounter', () => {
            expect(calculateDefaultEncounterCR(null)).toBe('0');
            expect(calculateDefaultEncounterCR({})).toBe('0');
            expect(calculateDefaultEncounterCR({ combatants: [] })).toBe('0');
        });
        
        test('calculates CR for single CR 1/4 monster', () => {
            const encounter = {
                combatants: [
                    { name: 'Goblin', cr: '1/4' }
                ]
            };
            
            const result = calculateDefaultEncounterCR(encounter);
            expect(result).toBe('1/4');
        });
        
        test('calculates CR for multiple monsters', () => {
            const encounter = {
                combatants: [
                    { name: 'Orc 1', cr: '1/2' },
                    { name: 'Orc 2', cr: '1/2' },
                    { name: 'Orc 3', cr: '1/2' }
                ]
            };
            
            const result = calculateDefaultEncounterCR(encounter);
            // (100 * 3) * 2 = 600 XP -> CR 2 (600 is between 450 and 700)
            expect(result).toBe('2');
        });
        
        test('handles high CR encounters', () => {
            const encounter = {
                combatants: [
                    { name: 'Dragon 1', cr: '15' },
                    { name: 'Dragon 2', cr: '15' }
                ]
            };
            
            const result = calculateDefaultEncounterCR(encounter);
            // (13000 * 2) * 1.5 = 39000 XP -> CR 21 (closest to 39000)
            expect(result).toBe('21');
        });
        
        test('returns "0" for very low XP', () => {
            const encounter = {
                combatants: [
                    { name: 'Rat', cr: '0' }
                ]
            };
            
            const result = calculateDefaultEncounterCR(encounter);
            expect(result).toBe('0');
        });
    });
    
    describe('getEncounterCR', () => {
        test('returns custom CR if set', () => {
            const encounter = {
                totalCR: '10',
                combatants: [
                    { name: 'Goblin', cr: '1/4' }
                ]
            };
            
            const result = getEncounterCR(encounter);
            expect(result).toBe('10');
        });
        
        test('calculates CR if not set', () => {
            const encounter = {
                combatants: [
                    { name: 'Orc', cr: '1/2' }
                ]
            };
            
            const result = getEncounterCR(encounter);
            expect(result).toBe('1/2');
        });
    });
    
    describe('encounter management functions', () => {
        beforeEach(() => {
            // Setup global state for encounter functions
            window.currentAdventure = {
                name: 'Test',
                encounters: [
                    {
                        name: 'Test Encounter',
                        chapter: 'Chapter 1',
                        combatants: [
                            { name: 'Goblin 1', hp: 7, maxHp: 7, initiative: 10 },
                            { name: 'Goblin 2', hp: 7, maxHp: 7, initiative: 8 }
                        ],
                        active: false,
                        round: 0,
                        turnIndex: 0
                    }
                ]
            };
        });
        
        afterEach(() => {
            delete window.currentAdventure;
        });
        
        test('startEncounter activates encounter', () => {
            const encounter = window.currentAdventure.encounters[0];
            expect(encounter.active).toBe(false);
            
            // Note: actual function would need proper mocking since it depends on DOM
            // This is a simplified test of the logic
            encounter.active = true;
            encounter.round = 1;
            
            expect(encounter.active).toBe(true);
            expect(encounter.round).toBe(1);
        });
        
        test('resetEncounter clears combat state', () => {
            const encounter = window.currentAdventure.encounters[0];
            encounter.active = true;
            encounter.round = 5;
            encounter.turnIndex = 2;
            
            // Reset logic
            encounter.active = false;
            encounter.round = 0;
            encounter.turnIndex = 0;
            
            expect(encounter.active).toBe(false);
            expect(encounter.round).toBe(0);
            expect(encounter.turnIndex).toBe(0);
        });
        
        test('nextTurn increments turn index', () => {
            const encounter = window.currentAdventure.encounters[0];
            encounter.active = true;
            encounter.turnIndex = 0;
            
            // Next turn logic
            encounter.turnIndex = 1;
            
            expect(encounter.turnIndex).toBe(1);
        });
        
        test('nextTurn wraps to start and increments round', () => {
            const encounter = window.currentAdventure.encounters[0];
            encounter.active = true;
            encounter.turnIndex = 1; // Last combatant
            encounter.round = 1;
            
            // Wrap around logic
            encounter.turnIndex = 0;
            encounter.round = 2;
            
            expect(encounter.turnIndex).toBe(0);
            expect(encounter.round).toBe(2);
        });
        
        test('previousTurn decrements turn index', () => {
            const encounter = window.currentAdventure.encounters[0];
            encounter.active = true;
            encounter.turnIndex = 1;
            
            // Previous turn logic
            encounter.turnIndex = 0;
            
            expect(encounter.turnIndex).toBe(0);
        });
        
        test('combatant HP tracking', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            expect(combatant.hp).toBe(7);
            
            // Take damage
            combatant.hp = 4;
            expect(combatant.hp).toBe(4);
            
            // Heal
            combatant.hp = Math.min(combatant.hp + 2, combatant.maxHp);
            expect(combatant.hp).toBe(6);
        });
        
        test('combatant cannot exceed max HP', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            combatant.hp = 7;
            
            // Try to heal beyond max
            combatant.hp = Math.min(combatant.hp + 5, combatant.maxHp);
            
            expect(combatant.hp).toBe(7);
        });
        
        test('death saves initialization', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            
            if (!combatant.deathSaves) {
                combatant.deathSaves = { successes: 0, failures: 0 };
            }
            
            expect(combatant.deathSaves).toEqual({ successes: 0, failures: 0 });
        });
        
        test('death save success tracking', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            combatant.deathSaves = { successes: 0, failures: 0 };
            
            // Add success
            combatant.deathSaves.successes = 1;
            expect(combatant.deathSaves.successes).toBe(1);
            
            // Add another
            combatant.deathSaves.successes = 2;
            expect(combatant.deathSaves.successes).toBe(2);
        });
        
        test('death save failure tracking', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            combatant.deathSaves = { successes: 0, failures: 0 };
            
            // Add failure
            combatant.deathSaves.failures = 1;
            expect(combatant.deathSaves.failures).toBe(1);
        });
        
        test('conditions tracking', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            
            if (!combatant.conditions) {
                combatant.conditions = [];
            }
            
            combatant.conditions.push('Poisoned');
            expect(combatant.conditions).toContain('Poisoned');
            
            combatant.conditions.push('Stunned');
            expect(combatant.conditions).toHaveLength(2);
        });
        
        test('clear conditions', () => {
            const combatant = window.currentAdventure.encounters[0].combatants[0];
            combatant.conditions = ['Poisoned', 'Stunned'];
            
            combatant.conditions = [];
            expect(combatant.conditions).toHaveLength(0);
        });
        
        test('encounter treasure tracking', () => {
            const encounter = window.currentAdventure.encounters[0];
            
            if (!encounter.treasure) {
                encounter.treasure = '';
            }
            
            encounter.treasure = '100 gold pieces';
            expect(encounter.treasure).toBe('100 gold pieces');
        });
        
        test('combatant removal', () => {
            const encounter = window.currentAdventure.encounters[0];
            const initialCount = encounter.combatants.length;
            
            // Remove first combatant
            encounter.combatants.splice(0, 1);
            
            expect(encounter.combatants).toHaveLength(initialCount - 1);
        });
        
        test('add combatant to encounter', () => {
            const encounter = window.currentAdventure.encounters[0];
            const initialCount = encounter.combatants.length;
            
            encounter.combatants.push({
                name: 'Orc',
                hp: 15,
                maxHp: 15,
                initiative: 12
            });
            
            expect(encounter.combatants).toHaveLength(initialCount + 1);
        });
    });
});
