/**
 * Integration Tests - Adventure Management Flow
 * 
 * Tests complete workflows for adventure creation, loading, and management
 */
import { createStateManager } from '../../static/core/state.js';
import { createAPIClient } from '../../static/services/api.js';
import { createEventHandlers } from '../../static/core/eventHandlers.js';
import { createModalManager } from '../../static/components/modalManager.js';
import * as helpers from '../../static/utils/helpers.js';

describe('Integration: Adventure Management Flow', () => {
    let state;
    let api;
    let handlers;
    let mockFetch;
    let mockDOM;
    let renderers;

    beforeEach(() => {
        // Mock fetch
        mockFetch = jest.fn();

        // Initialize modules
        state = createStateManager();
        
        // Configure API with proper base URL
        api = createAPIClient({ 
            fetch: mockFetch,
            baseURL: '' 
        });

        // Mock DOM
        mockDOM = {
            getElementById: jest.fn((id) => ({
                id,
                value: '',
                style: {},
                querySelector: () => null,
                hasAttribute: jest.fn(() => false),
            })),
            addEventListener: jest.fn(),
        };

        const modalManager = createModalManager({ dom: mockDOM });

        // Mock renderers
        renderers = {
            renderAdventure: jest.fn(),
            renderChapterSelector: jest.fn(),
            renderPlayers: jest.fn(),
            renderEncounters: jest.fn(),
            loadAdventuresList: jest.fn(),
            autoSave: jest.fn(),
            updateChapterNotesDisplay: jest.fn(),
            checkCookieStatus: jest.fn(),
        };

        // Initialize handlers
        handlers = createEventHandlers({
            state,
            api,
            dom: mockDOM,
            modalManager,
            helpers,
            renderers,
        });
    });

    describe('Create and Load Adventure Flow', () => {
        test('complete flow: create → load → verify state', async () => {
            // Step 1: Create new adventure
            global.prompt = jest.fn(() => 'My First Adventure');
            api.createAdventure = jest.fn().mockResolvedValue({ success: true });

            await handlers.createNewAdventure();

            expect(api.createAdventure).toHaveBeenCalledWith(
                { name: 'My First Adventure' }
            );

            // Step 2: Load the adventure
            const adventureData = {
                name: 'My First Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            };

            api.verifyAdventurePin = jest.fn().mockResolvedValue({ ok: true });
            api.getAdventure = jest.fn().mockResolvedValue(adventureData);

            mockDOM.getElementById.mockImplementation((id) => {
                if (id === 'adventureSelect') return { value: 'My First Adventure' };
                if (id === 'adventureContent') return { style: {} };
                return { value: '', style: {} };
            });

            await handlers.handleAdventureChange({ 
                target: { value: 'My First Adventure' }
            });

            // Step 3: Verify state is loaded
            const currentAdventure = state.get('currentAdventure');
            expect(currentAdventure.name).toBe('My First Adventure');
            expect(currentAdventure.chapters).toEqual(['Chapter 1']);
            expect(renderers.renderAdventure).toHaveBeenCalled();
        });

        test('handles protected adventure flow', async () => {
            // Adventure requires PIN - first getAdventure call throws 403
            const apiError = new Error('PIN required');
            apiError.status = 403;
            
            api.getAdventure = jest.fn()
                .mockRejectedValueOnce(apiError)  // First load fails with 403
                .mockResolvedValueOnce({           // Second load (after PIN) succeeds
                    name: 'Secret Adventure',
                    chapters: ['Chapter 1'],
                    players: [],
                    encounters: [],
                });
            
            api.verifyAdventurePin = jest.fn().mockResolvedValue({ ok: true });

            global.prompt = jest.fn(() => '1234'); // User enters PIN

            mockDOM.getElementById.mockReturnValue({ value: '', style: {} });

            await handlers.handleAdventureChange({ 
                target: { value: 'Secret Adventure' }
            });

            expect(global.prompt).toHaveBeenCalled();
            expect(api.verifyAdventurePin).toHaveBeenCalledWith('Secret Adventure', '1234');
            expect(api.getAdventure).toHaveBeenCalledTimes(2);
        });
    });

    describe('Player Management Flow', () => {
        test('complete flow: add player → update stats → save', () => {
            // Setup adventure
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            // Add player
            handlers.addPlayer();

            let adventure = state.get('currentAdventure');
            expect(adventure.players).toHaveLength(1);
            expect(adventure.players[0].level).toBe(1);

            // Update player name
            handlers.updatePlayer(0, 'playerName', 'Alice');
            adventure = state.get('currentAdventure');
            expect(adventure.players[0].playerName).toBe('Alice');

            // Update nested ability score
            handlers.updatePlayer(0, 'abilityScores.str', 16);
            adventure = state.get('currentAdventure');
            expect(adventure.players[0].abilityScores.str).toBe(16);

            // Update level
            handlers.updatePlayer(0, 'level', 5);
            adventure = state.get('currentAdventure');
            expect(adventure.players[0].level).toBe(5);

            // Verify auto-save was called
            expect(renderers.autoSave).toHaveBeenCalled();
        });

        test('multiple players: add → sort → delete', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            // Add three players
            handlers.addPlayer();
            handlers.addPlayer();
            handlers.addPlayer();

            let adventure = state.get('currentAdventure');
            expect(adventure.players).toHaveLength(3);

            // Update names
            handlers.updatePlayer(0, 'name', 'Zara');
            handlers.updatePlayer(1, 'name', 'Bob');
            handlers.updatePlayer(2, 'name', 'Alice');

            // Sort by name
            handlers.sortPlayers('name');

            adventure = state.get('currentAdventure');
            expect(adventure.players[0].name).toBe('Alice');
            expect(adventure.players[1].name).toBe('Bob');
            expect(adventure.players[2].name).toBe('Zara');

            // Delete middle player
            global.confirm = jest.fn(() => true);
            handlers.deletePlayer(1);

            adventure = state.get('currentAdventure');
            expect(adventure.players).toHaveLength(2);
            expect(adventure.players[1].name).toBe('Zara');
        });
    });

    describe('Encounter Management Flow', () => {
        test('complete combat flow: create → add combatants → start → complete', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            state.setState({ currentChapter: 'Chapter 1' });

            // Add encounter
            handlers.addEncounter();

            let adventure = state.get('currentAdventure');
            expect(adventure.encounters).toHaveLength(1);
            expect(adventure.encounters[0].state).toBe('planning');

            // Add combatants manually (simulating monster addition)
            adventure.encounters[0].combatants = [
                { name: 'Goblin 1', maxHp: 7, hp: 7, initiativeBonus: 2 },
                { name: 'Goblin 2', maxHp: 7, hp: 7, initiativeBonus: 2 },
                { name: 'Orc', maxHp: 15, hp: 15, initiativeBonus: 0 },
            ];
            state.updateEncounter(0, adventure.encounters[0]);

            // Start encounter (rolls initiative)
            handlers.startEncounter(0);

            adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].state).toBe('started');
            expect(adventure.encounters[0].round).toBe(1);
            expect(adventure.encounters[0].combatants[0].initiative).toBeDefined();

            // Complete encounter
            global.confirm = jest.fn(() => true);
            handlers.completeEncounter(0);

            adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].state).toBe('complete');
        });

        test('encounter reset restores combatants', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [{
                    name: 'Test Encounter',
                    chapter: 'Chapter 1',
                    state: 'started',
                    round: 3,
                    combatants: [
                        { 
                            name: 'Goblin', 
                            maxHp: 7, 
                            hp: 2, 
                            initiative: 15,
                            conditions: ['Prone'],
                            concentrating: true,
                        },
                    ],
                }],
            });

            global.confirm = jest.fn(() => true);
            handlers.resetEncounter(0);

            const adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].state).toBe('planning');
            expect(adventure.encounters[0].round).toBe(0);
            expect(adventure.encounters[0].combatants[0].hp).toBe(7);
            expect(adventure.encounters[0].combatants[0].initiative).toBeNull();
            expect(adventure.encounters[0].combatants[0].conditions).toEqual([]);
            expect(adventure.encounters[0].combatants[0].concentrating).toBe(false);
        });
    });

    describe('Chapter Management Flow', () => {
        test('complete flow: add chapter → switch → add content → delete', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            state.setState({ currentChapter: 'Chapter 1' });

            // Add new chapter
            global.prompt = jest.fn(() => 'Chapter 2');
            handlers.addChapter();

            let adventure = state.get('currentAdventure');
            expect(adventure.chapters).toEqual(['Chapter 1', 'Chapter 2']);

            // Add encounters to both chapters
            handlers.addEncounter(); // Chapter 1 encounter
            
            handlers.handleChapterChange({ target: { value: 'Chapter 2' } });
            expect(state.get('currentChapter')).toBe('Chapter 2');
            
            handlers.addEncounter(); // Chapter 2 encounter

            adventure = state.get('currentAdventure');
            expect(adventure.encounters).toHaveLength(2);
            expect(adventure.encounters[0].chapter).toBe('Chapter 1');
            expect(adventure.encounters[1].chapter).toBe('Chapter 2');

            // Delete Chapter 2
            state.setState({ currentChapter: 'Chapter 2' });
            global.confirm = jest.fn(() => true);
            handlers.deleteChapter();

            adventure = state.get('currentAdventure');
            expect(adventure.chapters).toEqual(['Chapter 1']);
            expect(adventure.encounters).toHaveLength(1);
            expect(adventure.encounters[0].chapter).toBe('Chapter 1');
        });
    });

    describe('State Persistence Flow', () => {
        test('state persists across multiple operations', () => {
            // Initial setup
            state.loadAdventure({
                name: 'Persistent Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            // Add player
            handlers.addPlayer();
            handlers.updatePlayer(0, 'name', 'Test Hero');

            // Add encounter
            handlers.addEncounter();
            handlers.updateEncounter(0, { name: 'Boss Fight' });

            // Verify everything persists
            const adventure = state.get('currentAdventure');
            expect(adventure.name).toBe('Persistent Adventure');
            expect(adventure.players[0].name).toBe('Test Hero');
            expect(adventure.encounters[0].name).toBe('Boss Fight');
        });

        test('state updates trigger auto-save', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [],
            });

            renderers.autoSave.mockClear();

            // Each operation should trigger auto-save
            handlers.addPlayer();
            expect(renderers.autoSave).toHaveBeenCalledTimes(1);

            handlers.addEncounter();
            expect(renderers.autoSave).toHaveBeenCalledTimes(2);

            handlers.updatePlayer(0, 'name', 'Updated');
            expect(renderers.autoSave).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error Handling Flow', () => {
        test('handles API failures gracefully', async () => {
            // Create adventure fails
            global.prompt = jest.fn(() => 'Failed Adventure');
            mockFetch.mockRejectedValue(new Error('Network error'));

            await handlers.createNewAdventure();

            // Should show error toast
            expect(renderers.loadAdventuresList).not.toHaveBeenCalled();
        });

        test('handles missing adventure gracefully', async () => {
            const apiError = new Error('PIN required');
            apiError.status = 403;
            api.getAdventure = jest.fn().mockRejectedValue(apiError);
            api.verifyAdventurePin = jest.fn();
            global.prompt = jest.fn(() => null); // User cancels PIN prompt

            mockDOM.getElementById.mockReturnValue({ value: '', style: {}, hasAttribute: () => false });

            await handlers.handleAdventureChange({ 
                target: { value: 'NonExistent' }
            });

            // Adventure attempted to load once, triggered PIN prompt, user cancelled
            expect(api.getAdventure).toHaveBeenCalledTimes(1);
            expect(api.verifyAdventurePin).not.toHaveBeenCalled(); // PIN verification never reached
        });

        test('prevents starting encounter without combatants', () => {
            state.loadAdventure({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: [{
                    name: 'Empty Encounter',
                    chapter: 'Chapter 1',
                    combatants: [],
                    state: 'planning',
                }],
            });

            handlers.startEncounter(0);

            const adventure = state.get('currentAdventure');
            expect(adventure.encounters[0].state).toBe('planning');
        });
    });

    describe('Complete User Journey', () => {
        test('full session: create adventure → add players → create encounter → combat', async () => {
            // Step 1: Create adventure
            global.prompt = jest.fn()
                .mockReturnValueOnce('Dragon Heist'); // Adventure name

            api.createAdventure = jest.fn().mockResolvedValue({});

            await handlers.createNewAdventure();

            // Step 2: Load adventure
            api.verifyAdventurePin = jest.fn().mockResolvedValue({ ok: true });
            api.getAdventure = jest.fn().mockResolvedValue({
                name: 'Dragon Heist',
                chapters: ['Chapter 1', 'Chapter 2'],
                players: [],
                encounters: [],
            });

            mockDOM.getElementById.mockImplementation((id) => {
                if (id === 'adventureSelect') return { value: 'Dragon Heist', hasAttribute: () => false };
                if (id === 'adventureContent') return { style: {}, hasAttribute: () => false };
                return { value: '', style: {}, hasAttribute: () => false };
            });

            await handlers.handleAdventureChange({ target: { value: 'Dragon Heist' } });

            // Verify adventure is loaded
            expect(state.get('currentAdventure')).toBeDefined();
            expect(state.get('currentAdventure').name).toBe('Dragon Heist');

            // Step 3: Add multiple players
            handlers.addPlayer();
            handlers.updatePlayer(0, 'name', 'Thorin');
            handlers.updatePlayer(0, 'class', 'Fighter');
            handlers.updatePlayer(0, 'level', 3);

            handlers.addPlayer();
            handlers.updatePlayer(1, 'name', 'Elara');
            handlers.updatePlayer(1, 'class', 'Wizard');
            handlers.updatePlayer(1, 'level', 3);

            // Step 4: Create encounter
            state.setState({ currentChapter: 'Chapter 1' });
            handlers.addEncounter();
            handlers.updateEncounter(0, { name: 'Goblin Ambush' });

            // Step 5: Add monsters
            let adventure = state.get('currentAdventure');
            adventure.encounters[0].combatants = [
                { name: 'Goblin 1', maxHp: 7, hp: 7, initiativeBonus: 2 },
                { name: 'Goblin 2', maxHp: 7, hp: 7, initiativeBonus: 2 },
            ];
            state.updateEncounter(0, adventure.encounters[0]);

            // Step 6: Start combat
            handlers.startEncounter(0);

            // Final verification
            adventure = state.get('currentAdventure');
            expect(adventure.name).toBe('Dragon Heist');
            expect(adventure.players).toHaveLength(2);
            expect(adventure.players[0].name).toBe('Thorin');
            expect(adventure.encounters).toHaveLength(1);
            expect(adventure.encounters[0].state).toBe('started');
            expect(adventure.encounters[0].combatants).toHaveLength(2);
            expect(adventure.encounters[0].round).toBe(1);

            // Verify all combatants have initiative
            adventure.encounters[0].combatants.forEach(combatant => {
                expect(combatant.initiative).toBeDefined();
                expect(typeof combatant.initiative).toBe('number');
            });
        });
    });
});
