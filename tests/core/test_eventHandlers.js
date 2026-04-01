/**
 * Tests for eventHandlers.js
 */
import { createEventHandlers } from '../../static/core/eventHandlers.js';

describe('Event Handlers', () => {
    let handlers;
    let mockDeps;

    beforeEach(() => {
        // Mock dependencies
        mockDeps = {
            state: {
                get: jest.fn(),
                setState: jest.fn(),
                loadAdventure: jest.fn(),
                updateAdventure: jest.fn(),
                updateEncounter: jest.fn(),
                updatePlayer: jest.fn(),
            },
            api: {
                getAdventure: jest.fn(),
                verifyAdventurePin: jest.fn(),
                createAdventure: jest.fn(),
                deleteAdventure: jest.fn(),
                saveCookies: jest.fn(),
                clearCookies: jest.fn(),
            },
            dom: {
                getElementById: jest.fn((id) => ({
                    id,
                    value: '',
                    style: {},
                    querySelector: () => null,
                })),
            },
            modalManager: {
                openModal: jest.fn(),
                closeModal: jest.fn(),
                closeCurrentModal: jest.fn(),
            },
            helpers: {
                showToast: jest.fn(),
                generateId: jest.fn(() => 'test-id-123'),
                setURLParameter: jest.fn(),
            },
            renderers: {
                renderAdventure: jest.fn(),
                renderChapterSelector: jest.fn(),
                renderPlayers: jest.fn(),
                renderEncounters: jest.fn(),
                loadAdventuresList: jest.fn(),
                autoSave: jest.fn(),
                updateChapterNotesDisplay: jest.fn(),
                checkCookieStatus: jest.fn(),
            },
        };

        handlers = createEventHandlers(mockDeps);
    });

    describe('Adventure Management', () => {
        describe('handleAdventureChange', () => {
            test('hides content when no adventure selected', async () => {
                const contentDiv = { style: {} };
                mockDeps.dom.getElementById.mockReturnValue(contentDiv);

                await handlers.handleAdventureChange({ target: { value: '' } });

                expect(contentDiv.style.display).toBe('none');
            });

            test('loads adventure successfully', async () => {
                mockDeps.api.getAdventure.mockResolvedValue({
                    name: 'Test Adventure',
                    chapters: ['Chapter 1'],
                    players: [],
                    encounters: [],
                });

                await handlers.handleAdventureChange({ target: { value: 'Test Adventure' } });

                expect(mockDeps.api.getAdventure).toHaveBeenCalledWith('Test Adventure');
                expect(mockDeps.state.loadAdventure).toHaveBeenCalled();
                expect(mockDeps.renderers.renderAdventure).toHaveBeenCalled();
            });

            test('handles protected adventure with correct PIN', async () => {
                global.prompt = jest.fn(() => '1234');
                const apiError = new Error('PIN required');
                apiError.status = 403;
                mockDeps.api.getAdventure
                    .mockRejectedValueOnce(apiError)
                    .mockResolvedValueOnce({ name: 'Protected', chapters: ['Chapter 1'], players: [], encounters: [] });
                mockDeps.api.verifyAdventurePin.mockResolvedValue({ ok: true });

                await handlers.handleAdventureChange({ target: { value: 'Protected' } });

                expect(global.prompt).toHaveBeenCalled();
                expect(mockDeps.api.verifyAdventurePin).toHaveBeenCalledWith('Protected', '1234');
                expect(mockDeps.api.getAdventure).toHaveBeenCalledTimes(2);
                expect(mockDeps.state.loadAdventure).toHaveBeenCalled();
            });

            test('handles incorrect PIN', async () => {
                global.prompt = jest.fn(() => 'wrong');
                const apiError = new Error('PIN required');
                apiError.status = 403;
                mockDeps.api.getAdventure.mockRejectedValue(apiError);
                mockDeps.api.verifyAdventurePin.mockResolvedValue({ ok: false });

                await handlers.handleAdventureChange({ target: { value: 'Protected' } });

                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Incorrect PIN', 'error');
                expect(mockDeps.state.loadAdventure).not.toHaveBeenCalled();
            });

            test('handles PIN prompt cancellation', async () => {
                global.prompt = jest.fn(() => null);
                const apiError = new Error('PIN required');
                apiError.status = 403;
                mockDeps.api.getAdventure.mockRejectedValue(apiError);

                await handlers.handleAdventureChange({ target: { value: 'Protected' } });

                expect(mockDeps.api.getAdventure).toHaveBeenCalledTimes(1);
                expect(mockDeps.state.loadAdventure).not.toHaveBeenCalled();
            });

            test('handles load error', async () => {
                mockDeps.api.getAdventure.mockRejectedValue(new Error('Network error'));

                await handlers.handleAdventureChange({ target: { value: 'Test' } });

                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Failed to load adventure', 'error');
            });
        });

        describe('createNewAdventure', () => {
            test('creates adventure successfully', async () => {
                global.prompt = jest.fn(() => 'New Adventure');
                mockDeps.api.createAdventure.mockResolvedValue({});
                mockDeps.dom.getElementById.mockReturnValue({ value: '' });

                await handlers.createNewAdventure();

                expect(mockDeps.api.createAdventure).toHaveBeenCalledWith({ name: 'New Adventure' });
                expect(mockDeps.renderers.loadAdventuresList).toHaveBeenCalled();
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Adventure created', 'success');
            });

            test('handles cancellation', async () => {
                global.prompt = jest.fn(() => null);

                await handlers.createNewAdventure();

                expect(mockDeps.api.createAdventure).not.toHaveBeenCalled();
            });

            test('handles creation error', async () => {
                global.prompt = jest.fn(() => 'Test');
                mockDeps.api.createAdventure.mockRejectedValue(new Error('Failed'));

                await handlers.createNewAdventure();

                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Failed', 'error');
            });
        });

        describe('deleteCurrentAdventure', () => {
            test('deletes adventure after confirmation', async () => {
                global.confirm = jest.fn(() => true);
                mockDeps.dom.getElementById.mockImplementation((id) => {
                    if (id === 'adventureSelect') {
                        return { value: 'Test Adventure' };
                    }
                    if (id === 'adventureContent') {
                        return { style: {} };
                    }
                    return { value: '', style: {} };
                });
                mockDeps.api.deleteAdventure.mockResolvedValue({});

                await handlers.deleteCurrentAdventure();

                expect(global.confirm).toHaveBeenCalled();
                expect(mockDeps.api.deleteAdventure).toHaveBeenCalledWith('Test Adventure');
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Adventure deleted', 'success');
            });

            test('does not delete without confirmation', async () => {
                global.confirm = jest.fn(() => false);
                mockDeps.dom.getElementById.mockReturnValue({ value: 'Test' });

                await handlers.deleteCurrentAdventure();

                expect(mockDeps.api.deleteAdventure).not.toHaveBeenCalled();
            });

            test('does nothing when no adventure selected', async () => {
                mockDeps.dom.getElementById.mockReturnValue({ value: '' });

                await handlers.deleteCurrentAdventure();

                expect(mockDeps.api.deleteAdventure).not.toHaveBeenCalled();
            });
        });
    });

    describe('Chapter Management', () => {
        describe('handleChapterChange', () => {
            test('updates chapter and triggers re-render', () => {
                handlers.handleChapterChange({ target: { value: 'Chapter 2' } });

                expect(mockDeps.state.setState).toHaveBeenCalledWith({ currentChapter: 'Chapter 2' });
                expect(mockDeps.helpers.setURLParameter).toHaveBeenCalledWith('chapter', 'Chapter 2');
                expect(mockDeps.renderers.renderEncounters).toHaveBeenCalled();
            });
        });

        describe('addChapter', () => {
            test('adds new chapter', () => {
                global.prompt = jest.fn(() => 'Chapter 5');
                mockDeps.state.get.mockReturnValue({ chapters: ['Chapter 1'] });

                handlers.addChapter();

                expect(mockDeps.state.updateAdventure).toHaveBeenCalledWith({ 
                    chapters: ['Chapter 1', 'Chapter 5'] 
                });
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Chapter added', 'success');
            });

            test('prevents duplicate chapters', () => {
                global.prompt = jest.fn(() => 'Chapter 1');
                mockDeps.state.get.mockReturnValue({ chapters: ['Chapter 1'] });

                handlers.addChapter();

                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Chapter already exists', 'error');
            });
        });

        describe('deleteChapter', () => {
            test('deletes chapter and its encounters', () => {
                global.confirm = jest.fn(() => true);
                mockDeps.state.get
                    .mockReturnValueOnce('Chapter 2')
                    .mockReturnValueOnce({
                        chapters: ['Chapter 1', 'Chapter 2', 'Chapter 3'],
                        encounters: [
                            { chapter: 'Chapter 1', name: 'E1' },
                            { chapter: 'Chapter 2', name: 'E2' },
                            { chapter: 'Chapter 3', name: 'E3' },
                        ],
                    });

                handlers.deleteChapter();

                expect(mockDeps.state.updateAdventure).toHaveBeenCalledWith({
                    chapters: ['Chapter 1', 'Chapter 3'],
                    encounters: [
                        { chapter: 'Chapter 1', name: 'E1' },
                        { chapter: 'Chapter 3', name: 'E3' },
                    ],
                });
            });
        });
    });

    describe('Player Management', () => {
        describe('addPlayer', () => {
            test('adds new player with defaults', () => {
                mockDeps.state.get.mockReturnValue({ players: [] });

                handlers.addPlayer();

                const updateCall = mockDeps.state.updateAdventure.mock.calls[0][0];
                expect(updateCall.players).toHaveLength(1);
                expect(updateCall.players[0]).toMatchObject({
                    playerName: '',
                    name: '',
                    level: 1,
                    maxHp: 0,
                    ac: 10,
                });
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Player added', 'success');
            });
        });

        describe('deletePlayer', () => {
            test('deletes player after confirmation', () => {
                global.confirm = jest.fn(() => true);
                mockDeps.state.get.mockReturnValue({ 
                    players: [{ name: 'Player 1' }, { name: 'Player 2' }] 
                });

                handlers.deletePlayer(0);

                const updateCall = mockDeps.state.updateAdventure.mock.calls[0][0];
                expect(updateCall.players).toHaveLength(1);
                expect(updateCall.players[0].name).toBe('Player 2');
            });

            test('does not delete without confirmation', () => {
                global.confirm = jest.fn(() => false);
                mockDeps.state.get.mockReturnValue({ players: [{ name: 'Player 1' }] });

                handlers.deletePlayer(0);

                expect(mockDeps.state.updateAdventure).not.toHaveBeenCalled();
            });
        });

        describe('updatePlayer', () => {
            test('updates simple field', () => {
                mockDeps.state.get.mockReturnValue({
                    players: [{ name: 'Old Name', level: 1 }],
                });

                handlers.updatePlayer(0, 'name', 'New Name');

                expect(mockDeps.state.updatePlayer).toHaveBeenCalledWith(0, {
                    name: 'New Name',
                    level: 1,
                });
            });

            test('updates nested field', () => {
                mockDeps.state.get.mockReturnValue({
                    players: [{ abilityScores: { str: 10 } }],
                });

                handlers.updatePlayer(0, 'abilityScores.str', 14);

                const updateCall = mockDeps.state.updatePlayer.mock.calls[0][1];
                expect(updateCall.abilityScores.str).toBe(14);
            });
        });

        describe('sortPlayers', () => {
            test('sorts players by field', () => {
                mockDeps.state.get
                    .mockReturnValueOnce({
                        players: [
                            { name: 'Charlie', level: 3 },
                            { name: 'Alice', level: 1 },
                            { name: 'Bob', level: 2 },
                        ],
                    })
                    .mockReturnValueOnce(null)
                    .mockReturnValueOnce('asc');

                handlers.sortPlayers('name');

                const updateCall = mockDeps.state.updateAdventure.mock.calls[0][0];
                expect(updateCall.players[0].name).toBe('Alice');
                expect(updateCall.players[1].name).toBe('Bob');
                expect(updateCall.players[2].name).toBe('Charlie');
            });

            test('reverses order on second click', () => {
                mockDeps.state.get
                    .mockReturnValueOnce({ players: [{ level: 1 }, { level: 2 }] })
                    .mockReturnValueOnce('level')
                    .mockReturnValueOnce('asc');

                handlers.sortPlayers('level');

                const stateCall = mockDeps.state.setState.mock.calls[0][0];
                expect(stateCall.playersSortOrder).toBe('desc');
            });
        });
    });

    describe('Encounter Management', () => {
        describe('addEncounter', () => {
            test('adds new encounter', () => {
                mockDeps.state.get
                    .mockReturnValueOnce({ encounters: [] })
                    .mockReturnValueOnce('Chapter 1');

                handlers.addEncounter();

                const updateCall = mockDeps.state.updateAdventure.mock.calls[0][0];
                expect(updateCall.encounters).toHaveLength(1);
                expect(updateCall.encounters[0]).toMatchObject({
                    chapter: 'Chapter 1',
                    combatants: [],
                    state: 'planning',
                    round: 0,
                });
            });
        });

        describe('startEncounter', () => {
            test('starts encounter and rolls initiative', () => {
                mockDeps.state.get.mockReturnValue({
                    encounters: [{
                        combatants: [
                            { name: 'Fighter', initiativeBonus: 2 },
                            { name: 'Wizard', initiativeBonus: 1 },
                        ],
                        state: 'planning',
                    }],
                });

                handlers.startEncounter(0);

                const updateCall = mockDeps.state.updateEncounter.mock.calls[0][1];
                expect(updateCall.state).toBe('started');
                expect(updateCall.round).toBe(1);
                expect(updateCall.combatants[0].initiative).toBeDefined();
                expect(updateCall.combatants[1].initiative).toBeDefined();
            });

            test('prevents starting with no combatants', () => {
                mockDeps.state.get.mockReturnValue({
                    encounters: [{ combatants: [], state: 'planning' }],
                });

                handlers.startEncounter(0);

                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Add combatants before starting', 'error');
                expect(mockDeps.state.updateEncounter).not.toHaveBeenCalled();
            });
        });

        describe('resetEncounter', () => {
            test('resets encounter state', () => {
                global.confirm = jest.fn(() => true);
                mockDeps.state.get.mockReturnValue({
                    encounters: [{
                        combatants: [
                            { name: 'Goblin', hp: 3, maxHp: 7, initiative: 15, conditions: ['Prone'] },
                        ],
                        state: 'started',
                        round: 5,
                    }],
                });

                handlers.resetEncounter(0);

                const updateCall = mockDeps.state.updateEncounter.mock.calls[0][1];
                expect(updateCall.state).toBe('planning');
                expect(updateCall.round).toBe(0);
                expect(updateCall.combatants[0].hp).toBe(7);
                expect(updateCall.combatants[0].initiative).toBeNull();
                expect(updateCall.combatants[0].conditions).toEqual([]);
            });
        });
    });

    describe('Modal Handlers', () => {
        test('openSettingsModal', () => {
            handlers.openSettingsModal();
            expect(mockDeps.modalManager.openModal).toHaveBeenCalledWith('settingsModal');
        });

        test('closeSettingsModal', () => {
            handlers.closeSettingsModal();
            expect(mockDeps.modalManager.closeModal).toHaveBeenCalledWith('settingsModal');
        });

        test('openDamageModal', () => {
            handlers.openDamageModal();
            expect(mockDeps.modalManager.openModal).toHaveBeenCalledWith('damageModal');
        });

        test('openAttackResultModal with content', () => {
            const mockModal = {
                querySelector: jest.fn(() => ({ innerHTML: '' })),
            };
            mockDeps.modalManager.openModal.mockReturnValue(mockModal);

            handlers.openAttackResultModal('<p>Attack result</p>');

            expect(mockDeps.modalManager.openModal).toHaveBeenCalledWith('attackResultModal');
            expect(mockModal.querySelector).toHaveBeenCalledWith('.modal-body');
        });
    });

    describe('Cookie Management', () => {
        describe('saveCookies', () => {
            test('saves cookies successfully', async () => {
                mockDeps.dom.getElementById.mockReturnValue({ value: 'cookie-data' });
                mockDeps.api.saveCookies.mockResolvedValue({});

                await handlers.saveCookies();

                expect(mockDeps.api.saveCookies).toHaveBeenCalledWith({ cookies: 'cookie-data' });
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Cookies saved successfully', 'success');
            });

            test('handles empty input', async () => {
                mockDeps.dom.getElementById.mockReturnValue({ value: '  ' });

                await handlers.saveCookies();

                expect(mockDeps.api.saveCookies).not.toHaveBeenCalled();
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Please paste cookie data', 'error');
            });
        });

        describe('clearCookies', () => {
            test('clears cookies after confirmation', async () => {
                global.confirm = jest.fn(() => true);
                mockDeps.api.clearCookies.mockResolvedValue({});

                await handlers.clearCookies();

                expect(mockDeps.api.clearCookies).toHaveBeenCalled();
                expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Cookies cleared', 'success');
            });

            test('does not clear without confirmation', async () => {
                global.confirm = jest.fn(() => false);

                await handlers.clearCookies();

                expect(mockDeps.api.clearCookies).not.toHaveBeenCalled();
            });
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('Ctrl+D opens damage modal', () => {
            const event = { ctrlKey: true, key: 'd', preventDefault: jest.fn() };
            
            handlers.handleKeyboardShortcut(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockDeps.modalManager.openModal).toHaveBeenCalledWith('damageModal');
        });

        test('Ctrl+H opens heal modal', () => {
            const event = { ctrlKey: true, key: 'H', preventDefault: jest.fn() };
            
            handlers.handleKeyboardShortcut(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockDeps.modalManager.openModal).toHaveBeenCalledWith('healModal');
        });

        test('ESC closes current modal', () => {
            const event = { key: 'Escape' };
            
            handlers.handleKeyboardShortcut(event);

            expect(mockDeps.modalManager.closeCurrentModal).toHaveBeenCalled();
        });
    });

    describe('Utility Handlers', () => {
        test('openStatisticsInNewWindow', () => {
            global.window.open = jest.fn();
            mockDeps.dom.getElementById.mockReturnValue({ value: 'My Adventure' });

            handlers.openStatisticsInNewWindow();

            expect(window.open).toHaveBeenCalledWith('/statistics?adventure=My%20Adventure', '_blank');
        });

        test('openStatisticsInNewWindow shows error when no adventure', () => {
            mockDeps.dom.getElementById.mockReturnValue({ value: '' });

            handlers.openStatisticsInNewWindow();

            expect(mockDeps.helpers.showToast).toHaveBeenCalledWith('Select an adventure first', 'error');
        });
    });
});
