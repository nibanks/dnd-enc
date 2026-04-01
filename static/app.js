/**
 * Main Application Entry Point
 * 
 * Initializes all modules and wires up the application.
 * This serves as the new modular entry point while maintaining
 * backward compatibility with the existing script.js.
 */

import { createStateManager } from './core/state.js';
import { createAPIClient } from './services/api.js';
import { createDOMHelpers } from './services/dom.js';
import { createModalManager } from './components/modalManager.js';
import { createEventHandlers } from './core/eventHandlers.js';
import * as helpers from './utils/helpers.js';

/**
 * Initialize and start the application
 * @param {Object} config - Optional configuration
 * @param {Document} config.document - Document object (for testing)
 * @param {Window} config.window - Window object (for testing)
 * @param {Function} config.fetch - Fetch function (for testing)
 * @returns {Object} Application instance
 */
export function initializeApp(config = {}) {
    const doc = config.document || document;
    const win = config.window || window;
    const fetchFn = config.fetch || fetch.bind(win);

    // ==================== MODULE INITIALIZATION ====================

    // Initialize state manager
    const state = createStateManager();

    // Initialize API client
    const api = createAPIClient({
        fetch: fetchFn,
        baseURL: config.apiBaseURL || '',
    });

    // Initialize DOM helpers
    const dom = createDOMHelpers({
        document: doc,
        window: win,
    });

    // Initialize modal manager
    const modalManager = createModalManager({
        dom: dom,
    });

    // Renderer functions (these call the legacy script.js functions)
    // These bridge to the existing rendering code until it's fully refactored
    const renderers = {
        renderAdventure: () => {
            if (typeof win.renderAdventure === 'function') {
                win.renderAdventure();
            }
        },
        renderChapterSelector: () => {
            if (typeof win.renderChapterSelector === 'function') {
                win.renderChapterSelector();
            }
        },
        renderPlayers: () => {
            if (typeof win.renderPlayers === 'function') {
                win.renderPlayers();
            }
        },
        renderEncounters: () => {
            if (typeof win.renderEncounters === 'function') {
                win.renderEncounters();
            }
        },
        loadAdventuresList: async () => {
            if (typeof win.loadAdventuresList === 'function') {
                await win.loadAdventuresList();
            }
        },
        autoSave: () => {
            if (typeof win.autoSave === 'function') {
                win.autoSave();
            }
        },
        updateChapterNotesDisplay: () => {
            if (typeof win.updateChapterNotesDisplay === 'function') {
                win.updateChapterNotesDisplay();
            }
        },
        checkCookieStatus: async () => {
            if (typeof win.checkCookieStatus === 'function') {
                await win.checkCookieStatus();
            }
        },
    };

    // Initialize event handlers
    const handlers = createEventHandlers({
        state,
        api,
        dom,
        modalManager,
        helpers,
        renderers,
    });

    // ==================== EVENT LISTENER SETUP ====================

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Adventure management
        const adventureSelect = dom.getElementById('adventureSelect');
        if (adventureSelect) {
            dom.addEventListener(adventureSelect, 'change', handlers.handleAdventureChange);
        }

        const newAdventureBtn = dom.getElementById('newAdventureBtn');
        if (newAdventureBtn) {
            dom.addEventListener(newAdventureBtn, 'click', handlers.createNewAdventure);
        }

        const deleteAdventureBtn = dom.getElementById('deleteAdventureBtn');
        if (deleteAdventureBtn) {
            dom.addEventListener(deleteAdventureBtn, 'click', handlers.deleteCurrentAdventure);
        }

        // Chapter management
        const chapterSelect = dom.getElementById('chapterSelect');
        if (chapterSelect) {
            dom.addEventListener(chapterSelect, 'change', handlers.handleChapterChange);
        }

        const chapterNotes = dom.getElementById('chapterNotes');
        if (chapterNotes) {
            dom.addEventListener(chapterNotes, 'input', handlers.handleChapterNotesChange);
        }

        // Player management
        const addPlayerBtn = dom.getElementById('addPlayerBtn');
        if (addPlayerBtn) {
            dom.addEventListener(addPlayerBtn, 'click', handlers.addPlayer);
        }

        // Encounter management
        const addEncounterBtn = dom.getElementById('addEncounterBtn');
        if (addEncounterBtn) {
            dom.addEventListener(addEncounterBtn, 'click', handlers.addEncounter);
        }

        // Modal triggers
        const adventureSettingsBtn = dom.getElementById('adventureSettingsBtn');
        if (adventureSettingsBtn) {
            dom.addEventListener(adventureSettingsBtn, 'click', handlers.openAdventureSettingsModal);
        }

        const settingsBtn = dom.getElementById('settingsBtn');
        if (settingsBtn) {
            dom.addEventListener(settingsBtn, 'click', handlers.openSettingsModal);
        }

        const settingsBtnSelection = dom.getElementById('settingsBtnSelection');
        if (settingsBtnSelection) {
            dom.addEventListener(settingsBtnSelection, 'click', handlers.openSettingsModal);
        }

        // Keyboard shortcuts
        dom.addEventListener(doc, 'keydown', handlers.handleKeyboardShortcut);

        // Save scroll position before unload
        dom.addEventListener(win, 'beforeunload', () => {
            sessionStorage.setItem('scrollPosition', win.scrollY.toString());
        });
    }

    /**
     * Initialize the application on DOM ready
     */
    async function initialize() {
        setupEventListeners();

        // Check cookie status first
        if (renderers.checkCookieStatus) {
            await renderers.checkCookieStatus();
        }

        // Load adventures list
        if (renderers.loadAdventuresList) {
            await renderers.loadAdventuresList();
        }

        // Load monsters from D&D Beyond
        if (win.loadMonsters) {
            win.loadMonsters();
        }

        // Setup monster search live update
        const monsterSearch = dom.getElementById('monsterSearch');
        if (monsterSearch && win.renderMonsterList) {
            dom.addEventListener(monsterSearch, 'input', (e) => {
                win.renderMonsterList(e.target.value);
            });
        }

        // Auto-load adventure from URL parameter
        const url = new URL(win.location.href);
        const adventureName = url.searchParams.get('adventure');
        if (adventureName) {
            // Check if we have cookies
            const hasCookies = win.hasCookies !== false;
            if (hasCookies) {
                const select = dom.getElementById('adventureSelect');
                if (select) {
                    select.value = adventureName;
                    // Trigger the change event to load the adventure
                    await handlers.handleAdventureChange({ target: select });
                }
            } else {
                // Redirect to home and show settings
                win.history.replaceState({}, '', '/');
                handlers.openSettingsModal();
            }
        }
    }

    // ==================== GLOBAL API (for compatibility) ====================

    // Expose handlers globally for inline onclick handlers (compatibility layer)
    win.appHandlers = handlers;

    // Helper function to migrate inline handlers
    win.migrateHandler = (handlerName, ...args) => {
        if (handlers[handlerName]) {
            return handlers[handlerName](...args);
        } else {
            console.warn(`Handler not found: ${handlerName}`);
        }
    };

    // Expose individual handlers for direct access (bridges inline onclick)
    // This allows gradual migration of onclick handlers
    Object.keys(handlers).forEach(key => {
        if (!win[key]) {  // Don't override if legacy function exists
            win[key] = handlers[key];
        }
    });

    // ==================== RETURN API ====================

    return {
        state,
        api,
        dom,
        modalManager,
        handlers,
        helpers,
        initialize,
        setupEventListeners,
    };
}

// ==================== AUTO-INITIALIZE ====================

// Auto-initialize when DOM is ready (unless in test environment)
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp();
            app.initialize();
            
            // Expose for debugging
            window.app = app;
        });
    } else {
        // DOM already loaded
        const app = initializeApp();
        app.initialize();
        window.app = app;
    }
}
