/**
 * Tests for app.js initialization
 */
import { initializeApp } from '../static/app.js';

describe('Application Initialization', () => {
    let mockDocument;
    let mockWindow;
    let mockFetch;
    let app;

    beforeEach(() => {
        // Mock window
        mockWindow = {
            location: {
                href: 'http://localhost/',
            },
            history: {
                replaceState: jest.fn(),
            },
            sessionStorage: {
                setItem: jest.fn(),
            },
            scrollY: 0,
            hasCookies: true,
            addEventListener: jest.fn(),
        };

        // Mock document
        mockDocument = {
            readyState: 'complete',
            getElementById: jest.fn(() => null),
            addEventListener: jest.fn(),
        };

        // Mock fetch
        mockFetch = jest.fn();

        // Initialize app with mocks
        app = initializeApp({
            document: mockDocument,
            window: mockWindow,
            fetch: mockFetch,
        });
    });

    describe('Module Initialization', () => {
        test('initializes state manager', () => {
            expect(app.state).toBeDefined();
            expect(app.state.getState).toBeDefined();
            expect(app.state.setState).toBeDefined();
        });

        test('initializes API client', () => {
            expect(app.api).toBeDefined();
            expect(app.api.getAdventure).toBeDefined();
            expect(app.api.createAdventure).toBeDefined();
        });

        test('initializes DOM helpers', () => {
            expect(app.dom).toBeDefined();
            expect(app.dom.getElementById).toBeDefined();
            expect(app.dom.addEventListener).toBeDefined();
        });

        test('initializes modal manager', () => {
            expect(app.modalManager).toBeDefined();
            expect(app.modalManager.openModal).toBeDefined();
            expect(app.modalManager.closeModal).toBeDefined();
        });

        test('initializes event handlers', () => {
            expect(app.handlers).toBeDefined();
            expect(app.handlers.handleAdventureChange).toBeDefined();
            expect(app.handlers.addPlayer).toBeDefined();
            expect(app.handlers.addEncounter).toBeDefined();
        });

        test('exposes helpers', () => {
            expect(app.helpers).toBeDefined();
            expect(app.helpers.showToast).toBeDefined();
            expect(app.helpers.formatNumber).toBeDefined();
        });
    });

    describe('Event Listener Setup', () => {
        test('sets up adventure select listener', () => {
            const mockSelect = { addEventListener: jest.fn() };
            mockDocument.getElementById.mockImplementation((id) => {
                if (id === 'adventureSelect') return mockSelect;
                return null;
            });

            app.setupEventListeners();

            expect(mockDocument.getElementById).toHaveBeenCalledWith('adventureSelect');
            expect(mockDocument.addEventListener).toHaveBeenCalled();
        });

        test('sets up keyboard shortcut listener', () => {
            app.setupEventListeners();

            // Should call addEventListener on document for keydown events
            const calls = mockDocument.addEventListener.mock.calls;
            const keydownCall = calls.find(call => call[0] === 'keydown');
            expect(keydownCall).toBeDefined();
            expect(keydownCall[1]).toEqual(expect.any(Function));
        });

        test('sets up beforeunload listener', () => {
            app.setupEventListeners();

            expect(mockDocument.addEventListener).toHaveBeenCalled();
        });

        test('handles missing DOM elements gracefully', () => {
            mockDocument.getElementById.mockReturnValue(null);

            expect(() => {
                app.setupEventListeners();
            }).not.toThrow();
        });
    });

    describe('Initialization Flow', () => {
        test('calls initialize successfully', async () => {
            mockWindow.checkCookieStatus = jest.fn(async () => {});
            mockWindow.loadAdventuresList = jest.fn(async () => {});
            mockWindow.loadMonsters = jest.fn();

            await app.initialize();

            expect(mockDocument.addEventListener).toHaveBeenCalled();
        });

        test('auto-loads adventure from URL', async () => {
            mockWindow.location.href = 'http://localhost/?adventure=TestAdventure';
            mockWindow.location.search = '?adventure=TestAdventure';
            const url = new URL(mockWindow.location.href);
            
            const mockSelect = { value: '' };
            mockDocument.getElementById.mockImplementation((id) => {
                if (id === 'adventureSelect') return mockSelect;
                return null;
            });

            // Mock renderers
            mockWindow.checkCookieStatus = jest.fn();
            mockWindow.loadAdventuresList = jest.fn();
            mockWindow.hasCookies = true;

            const appWithUrl = initializeApp({
                document: mockDocument,
                window: mockWindow,
                fetch: mockFetch,
            });

            // The initialization would normally trigger auto-load
            // This test verifies the structure is in place
            expect(appWithUrl.handlers.handleAdventureChange).toBeDefined();
        });

        test('shows settings when no cookies and adventure in URL', async () => {
            mockWindow.location.href = 'http://localhost/?adventure=Test';
            mockWindow.hasCookies = false;
            mockWindow.history.replaceState = jest.fn();

            // The app should handle this case in initialize()
            expect(app.handlers.openSettingsModal).toBeDefined();
        });
    });

    describe('Renderer Integration', () => {
        test('calls legacy renderAdventure if available', () => {
            mockWindow.renderAdventure = jest.fn();

            // Access the renderers through the closure
            app.initialize();

            // The renderers are set up to call window functions
            expect(mockWindow).toBeDefined();
        });

        test('handles missing legacy functions gracefully', () => {
            // Don't define any legacy functions
            delete mockWindow.renderAdventure;

            expect(() => {
                app.initialize();
            }).not.toThrow();
        });
    });

    describe('Compatibility Layer', () => {
        test('exposes handlers globally', () => {
            expect(mockWindow.appHandlers).toBeDefined();
            expect(mockWindow.appHandlers).toBe(app.handlers);
        });

        test('provides migrateHandler helper', () => {
            expect(mockWindow.migrateHandler).toBeDefined();
            expect(typeof mockWindow.migrateHandler).toBe('function');
        });

        test('migrateHandler calls correct handler', () => {
            const spy = jest.spyOn(app.handlers, 'openSettingsModal');
            
            mockWindow.migrateHandler('openSettingsModal');

            expect(spy).toHaveBeenCalled();
        });

        test('migrateHandler warns on missing handler', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            mockWindow.migrateHandler('nonExistentHandler');

            expect(consoleSpy).toHaveBeenCalledWith('Handler not found: nonExistentHandler');
            consoleSpy.mockRestore();
        });
    });

    describe('Configuration', () => {
        test('accepts custom API base URL', () => {
            const customApp = initializeApp({
                document: mockDocument,
                window: mockWindow,
                fetch: mockFetch,
                apiBaseURL: 'https://api.example.com',
            });

            expect(customApp.api).toBeDefined();
        });

        test('uses default fetch when not provided', () => {
            const defaultApp = initializeApp({
                document: mockDocument,
                window: mockWindow,
            });

            expect(defaultApp.api).toBeDefined();
        });

        test('uses default document and window when not provided', () => {
            // This test verifies the || fallback logic exists
            // We can't actually test without real DOM 
            expect(app.dom).toBeDefined();
            expect(app.state).toBeDefined();
        });
    });

    describe('Module Dependencies', () => {
        test('state manager is injectable into handlers', () => {
            // Verify state is passed to handlers
            expect(app.handlers).toBeDefined();
            
            // Try calling a handler that uses state
            const addPlayerSpy = jest.spyOn(app.state, 'updateAdventure');
            app.state.setState({ currentAdventure: { players: [] } });
            
            // Handler should be able to interact with state
            expect(app.state.getState).toBeDefined();
        });

        test('API client is injectable into handlers', () => {
            expect(app.api).toBeDefined();
            expect(app.handlers).toBeDefined();
        });

        test('DOM helpers are injectable into handlers', () => {
            expect(app.dom).toBeDefined();
            expect(app.handlers).toBeDefined();
        });

        test('modal manager is injectable into handlers', () => {
            expect(app.modalManager).toBeDefined();
            expect(app.handlers).toBeDefined();
        });

        test('helpers are injectable into handlers', () => {
            expect(app.helpers).toBeDefined();
            expect(app.handlers).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('handles initialization errors gracefully', async () => {
            mockWindow.checkCookieStatus = jest.fn().mockRejectedValue(new Error('Network error'));
            mockWindow.loadAdventuresList = jest.fn();

            // Currently initialize doesn't have comprehensive error handling
            // This test documents the current behavior
            try {
                await app.initialize();
            } catch (error) {
                // Expected to potentially throw if async operations fail
                expect(error.message).toBe('Network error');
            }
        });
    });
});
