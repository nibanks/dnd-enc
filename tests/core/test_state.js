/**
 * Tests for state management module
 */

import { createStateManager } from '../../static/core/state.js';

describe('state management', () => {
    let state;
    
    beforeEach(() => {
        state = createStateManager();
    });
    
    describe('getState', () => {
        test('returns initial state', () => {
            const currentState = state.getState();
            expect(currentState.currentAdventure).toBeNull();
            expect(currentState.currentChapter).toBeNull();
            expect(currentState.dndMonsters).toEqual({});
            expect(currentState.monstersLoaded).toBe(false);
            expect(currentState.hasCookies).toBe(false);
        });
        
        test('returns immutable copy', () => {
            const state1 = state.getState();
            const state2 = state.getState();
            expect(state1).not.toBe(state2);
        });
    });
    
    describe('get', () => {
        test('gets specific state value', () => {
            expect(state.get('monstersLoaded')).toBe(false);
            expect(state.get('playersExpanded')).toBe(true);
        });
    });
    
    describe('setState', () => {
        test('updates state with object', () => {
            state.setState({ monstersLoaded: true, hasCookies: true });
            expect(state.get('monstersLoaded')).toBe(true);
            expect(state.get('hasCookies')).toBe(true);
        });
        
        test('updates state with function', () => {
            state.setState({ monstersLoaded: true });
            state.setState(prev => ({
                monstersLoaded: !prev.monstersLoaded
            }));
            expect(state.get('monstersLoaded')).toBe(false);
        });
        
        test('maintains immutability', () => {
            const before = state.getState();
            state.setState({ monstersLoaded: true });
            expect(before.monstersLoaded).toBe(false);
        });
    });
    
    describe('subscribe', () => {
        test('calls listener on state change', () => {
            const listener = jest.fn();
            state.subscribe(listener);
            
            state.setState({ monstersLoaded: true });
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({ monstersLoaded: true }),
                expect.objectContaining({ monstersLoaded: false })
            );
        });
        
        test('unsubscribe stops receiving updates', () => {
            const listener = jest.fn();
            const unsubscribe = state.subscribe(listener);
            
            state.setState({ monstersLoaded: true });
            expect(listener).toHaveBeenCalledTimes(1);
            
            unsubscribe();
            state.setState({ hasCookies: true });
            expect(listener).toHaveBeenCalledTimes(1);
        });
        
        test('handles multiple listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            state.subscribe(listener1);
            state.subscribe(listener2);
            
            state.setState({ monstersLoaded: true });
            
            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
        });
        
        test('continues on listener error', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Test error');
            });
            const normalListener = jest.fn();
            
            state.subscribe(errorListener);
            state.subscribe(normalListener);
            
            // Should not throw
            expect(() => {
                state.setState({ monstersLoaded: true });
            }).not.toThrow();
            
            expect(normalListener).toHaveBeenCalled();
        });
    });
    
    describe('reset', () => {
        test('resets state to initial values', () => {
            state.setState({
                monstersLoaded: true,
                hasCookies: true,
                playersExpanded: false
            });
            
            state.reset();
            
            expect(state.get('monstersLoaded')).toBe(false);
            expect(state.get('hasCookies')).toBe(false);
            expect(state.get('playersExpanded')).toBe(true);
        });
        
        test('notifies listeners on reset', () => {
            const listener = jest.fn();
            state.subscribe(listener);
            
            state.reset();
            
            expect(listener).toHaveBeenCalled();
        });
    });
    
    describe('loadAdventure', () => {
        test('loads adventure with default chapter', () => {
            const adventure = {
                name: 'Test Adventure',
                chapters: ['Chapter 1', 'Chapter 2'],
                encounters: [],
                players: []
            };
            
            state.loadAdventure(adventure);
            
            expect(state.get('currentAdventure')).toEqual(adventure);
            expect(state.get('currentChapter')).toBe('Chapter 1');
        });
        
        test('loads adventure with specific chapter', () => {
            const adventure = {
                name: 'Test Adventure',
                chapters: ['Chapter 1', 'Chapter 2']
            };
            
            state.loadAdventure(adventure, 'Chapter 2');
            
            expect(state.get('currentAdventure')).toEqual(adventure);
            expect(state.get('currentChapter')).toBe('Chapter 2');
        });
        
        test('clears fetch status on load', () => {
            state.setState({ crFetchStatus: { '0_1': true } });
            
            const adventure = { name: 'Test', chapters: ['Ch1'] };
            state.loadAdventure(adventure);
            
            expect(state.get('crFetchStatus')).toEqual({});
        });
    });
    
    describe('updateAdventure', () => {
        beforeEach(() => {
            const adventure = {
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                encounters: [],
                players: []
            };
            state.loadAdventure(adventure);
        });
        
        test('updates adventure properties', () => {
            state.updateAdventure({ name: 'Updated Adventure' });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.name).toBe('Updated Adventure');
            expect(adventure.chapters).toEqual(['Chapter 1']);
        });
        
        test('does nothing if no adventure loaded', () => {
            state.setState({ currentAdventure: null });
            
            expect(() => {
                state.updateAdventure({ name: 'Test' });
            }).not.toThrow();
        });
        
        test('maintains immutability', () => {
            const before = state.get('currentAdventure');
            state.updateAdventure({ name: 'Updated' });
            
            expect(before.name).toBe('Test Adventure');
        });
    });
    
    describe('updateEncounter', () => {
        beforeEach(() => {
            const adventure = {
                name: 'Test',
                chapters: ['Ch1'],
                encounters: [
                    { name: 'Encounter 1', combatants: [] },
                    { name: 'Encounter 2', combatants: [] }
                ],
                players: []
            };
            state.loadAdventure(adventure);
        });
        
        test('updates specific encounter', () => {
            state.updateEncounter(0, { name: 'Updated Encounter' });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].name).toBe('Updated Encounter');
            expect(adventure.encounters[1].name).toBe('Encounter 2');
        });
        
        test('maintains immutability of other encounters', () => {
            const before = state.get('currentAdventure').encounters[1];
            state.updateEncounter(0, { name: 'Updated' });
            const after = state.get('currentAdventure').encounters[1];
            
            expect(before).toEqual(after);
        });
    });
    
    describe('updateCombatant', () => {
        beforeEach(() => {
            const adventure = {
                name: 'Test',
                chapters: ['Ch1'],
                encounters: [
                    {
                        name: 'Encounter 1',
                        combatants: [
                            { name: 'Goblin 1', hp: 7 },
                            { name: 'Goblin 2', hp: 7 }
                        ]
                    }
                ],
                players: []
            };
            state.loadAdventure(adventure);
        });
        
        test('updates specific combatant', () => {
            state.updateCombatant(0, 0, { hp: 3 });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].combatants[0].hp).toBe(3);
            expect(adventure.encounters[0].combatants[1].hp).toBe(7);
        });
        
        test('maintains immutability', () => {
            const before = state.get('currentAdventure').encounters[0].combatants[1];
            state.updateCombatant(0, 0, { hp: 3 });
            const after = state.get('currentAdventure').encounters[0].combatants[1];
            
            expect(before).toEqual(after);
        });
    });
    
    describe('player management', () => {
        beforeEach(() => {
            const adventure = {
                name: 'Test',
                chapters: ['Ch1'],
                encounters: [],
                players: [
                    { name: 'Player 1', level: 5 },
                    { name: 'Player 2', level: 3 }
                ]
            };
            state.loadAdventure(adventure);
        });
        
        test('updatePlayer updates specific player', () => {
            state.updatePlayer(0, { level: 6 });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.players[0].level).toBe(6);
            expect(adventure.players[1].level).toBe(3);
        });
        
        test('addPlayer adds new player', () => {
            state.addPlayer({ name: 'Player 3', level: 4 });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.players).toHaveLength(3);
            expect(adventure.players[2].name).toBe('Player 3');
        });
        
        test('removePlayer removes player', () => {
            state.removePlayer(0);
            
            const adventure = state.get('currentAdventure');
            expect(adventure.players).toHaveLength(1);
            expect(adventure.players[0].name).toBe('Player 2');
        });
    });
    
    describe('encounter management', () => {
        beforeEach(() => {
            const adventure = {
                name: 'Test',
                chapters: ['Ch1'],
                encounters: [
                    { name: 'Encounter 1', combatants: [] }
                ],
                players: []
            };
            state.loadAdventure(adventure);
        });
        
        test('addEncounter adds new encounter', () => {
            state.addEncounter({ name: 'Encounter 2', combatants: [] });
            
            const adventure = state.get('currentAdventure');
            expect(adventure.encounters).toHaveLength(2);
            expect(adventure.encounters[1].name).toBe('Encounter 2');
        });
        
        test('removeEncounter removes encounter', () => {
            state.addEncounter({ name: 'Encounter 2', combatants: [] });
            state.removeEncounter(0);
            
            const adventure = state.get('currentAdventure');
            expect(adventure.encounters).toHaveLength(1);
            expect(adventure.encounters[0].name).toBe('Encounter 2');
        });
    });
    
    describe('UI state management', () => {
        test('toggleUI toggles boolean state', () => {
            expect(state.get('playersExpanded')).toBe(true);
            
            state.toggleUI('playersExpanded');
            expect(state.get('playersExpanded')).toBe(false);
            
            state.toggleUI('playersExpanded');
            expect(state.get('playersExpanded')).toBe(true);
        });
        
        test('setEncounterEditMode sets edit mode for encounter', () => {
            state.setEncounterEditMode(0, true);
            
            const editMode = state.get('encounterEditMode');
            expect(editMode[0]).toBe(true);
        });
        
        test('setEncounterEditMode preserves other encounter states', () => {
            state.setEncounterEditMode(0, true);
            state.setEncounterEditMode(1, false);
            
            const editMode = state.get('encounterEditMode');
            expect(editMode[0]).toBe(true);
            expect(editMode[1]).toBe(false);
        });
    });
});
