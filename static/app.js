/**
 * Main Application Entry Point
 * 
 * Initializes all modules and wires up the application.
 * This serves as the new modular entry point.
 */

import { createStateManager } from './core/state.js';
import { createAPIClient } from './services/api.js';
import { createDOMHelpers } from './services/dom.js';
import { createModalManager } from './components/modalManager.js';
import { createEventHandlers } from './core/eventHandlers.js';
import { createAdventureRenderer } from './renderers/adventureRenderer.js';
import { createAdventureService } from './services/adventureService.js';
import * as monsterListRenderer from './renderers/monsterListRenderer.js';
import * as playerRenderer from './renderers/playerRenderer.js';
import * as encounterRenderer from './renderers/encounterRenderer.js';
import * as helpers from './utils/helpers.js';
import { tooltipManager } from './components/tooltipManager.js';
import { initializeAttackRollHandler } from './utils/attackRollManager.js';
import { DND_CLASSES, DND_RACES, CR_TO_XP, LEVEL_THRESHOLDS, DND_CONDITIONS, CONDITION_ICONS } from './utils/constants.js';

// ==================== GLOBAL STATE INITIALIZATION ====================
// Initialize global state on window object for backward compatibility
window.currentAdventure = null;
window.currentChapter = null;
window.autoSaveTimeout = null;
window.DND_MONSTERS = {};
window.MONSTER_DETAILS_CACHE = {};
window.monstersLoaded = false;
window.hasCookies = false;
window.playersExpanded = true;
window.playersEditMode = false;
window.encounterEditMode = {};
window.cachedSpectatorUrl = null;
window.crFetchStatus = {};
window.monsterDetailsFetchStatus = {};
window.initialLoadComplete = false;

// Expose D&D constants globally for backward compatibility
window.DND_CLASSES = DND_CLASSES;
window.DND_RACES = DND_RACES;
window.CR_TO_XP = CR_TO_XP;
window.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS;
window.DND_CONDITIONS = DND_CONDITIONS;
window.CONDITION_ICONS = CONDITION_ICONS;

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

    // Initialize adventure service
    const adventureService = createAdventureService({
        api: api,
        dom: dom,
        getAdventure: () => state.get('currentAdventure'),
        getAdventureSelectValue: () => {
            const select = dom.getElementById('adventureSelect');
            return select ? select.value : '';
        },
    });

    // Renderer functions - mix of modular renderers and legacy bridges
    // Legacy script.js renderers (players, encounters) called until fully refactored
    const legacyRenderers = {
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
    };

    // Initialize adventure renderer (modular)
    const adventureRenderer = createAdventureRenderer({
        getElementById: (id) => dom.getElementById(id),
        getAdventure: () => state.get('currentAdventure'),
        getChapter: () => state.get('currentChapter'),
        otherRenderers: legacyRenderers,
    });

    // Combined renderers object for event handlers
    const renderers = {
        // Modular renderers
        renderAdventure: adventureRenderer.renderAdventure,
        renderChapterSelector: adventureRenderer.renderChapterSelector,
        updateChapterNotesDisplay: adventureRenderer.updateChapterNotesDisplay,
        
        // Legacy bridges
        renderPlayers: legacyRenderers.renderPlayers,
        renderEncounters: legacyRenderers.renderEncounters,
        
        // Adventure service methods (modular)
        loadAdventuresList: adventureService.loadAdventuresList,
        autoSave: adventureService.autoSave,
        checkCookieStatus: adventureService.checkCookieStatus,
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

        // Home link (dice emoji)
        const homeLink = dom.getElementById('homeLink');
        if (homeLink) {
            dom.addEventListener(homeLink, 'click', (e) => {
                e.preventDefault();
                handlers.goHome();
            });
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
        
        // Setup player event delegation
        setupPlayerEventDelegation();

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
                    
                    // Mark initial load as complete after a short delay to allow rendering to finish
                    // This prevents network flooding from hundreds of simultaneous CR fetches
                    setTimeout(() => {
                        win.initialLoadComplete = true;
                        
                        // Now batch fetch all missing CRs with staggered timing
                        if (win.fetchAllMissingCRs) {
                            win.fetchAllMissingCRs();
                        }
                    }, 500);
                }
            } else {
                // Redirect to home and show settings
                win.history.replaceState({}, '', '/');
                handlers.openSettingsModal();
            }
        } else {
            // No adventure parameter - mark as loaded immediately
            setTimeout(() => {
                win.initialLoadComplete = true;
            }, 500);
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

    // Expose service functions globally for legacy script.js compatibility
    win.autoSave = adventureService.autoSave;
    win.loadAdventuresList = adventureService.loadAdventuresList;
    win.checkCookieStatus = adventureService.checkCookieStatus;

    // Expose monster list renderer functions globally for script.js and inline onclick handlers
    win.loadMonsters = monsterListRenderer.loadMonsters;
    win.renderMonsterList = monsterListRenderer.renderMonsterList;
    win.selectMonster = monsterListRenderer.selectMonster;
    win.openMonsterModal = monsterListRenderer.openMonsterModal;
    win.closeMonsterModal = monsterListRenderer.closeMonsterModal;
    win.addMonsterFromLibrary = monsterListRenderer.addMonsterFromLibrary;
    win.fetchMonsterDetails = monsterListRenderer.fetchMonsterDetails;

    // ==================== ENCOUNTER RENDERER INTEGRATION ====================
    
    // Expose encounter renderer functions globally for inline onclick handlers
    win.renderEncounters = encounterRenderer.renderEncounters;
    win.createEncounterCard = encounterRenderer.createEncounterCard;
    win.isPlayerCombatant = encounterRenderer.isPlayerCombatant;
    win.getCombatantName = encounterRenderer.getCombatantName;
    win.getDexScore = encounterRenderer.getDexScore;
    win.calculateEncounterXP = encounterRenderer.calculateEncounterXP;
    win.calculateDefaultEncounterCR = encounterRenderer.calculateDefaultEncounterCR;
    win.getEncounterCR = encounterRenderer.getEncounterCR;
    win.toggleEncounterMinimize = encounterRenderer.toggleEncounterMinimize;
    win.updateEncounterName = encounterRenderer.updateEncounterName;
    win.toggleEncounterDescription = encounterRenderer.toggleEncounterDescription;
    win.updateEncounterDescription = encounterRenderer.updateEncounterDescription;
    win.updateEncounterCR = encounterRenderer.updateEncounterCR;
    win.removeEncounter = encounterRenderer.removeEncounter;
    win.resetEncounter = encounterRenderer.resetEncounter;
    win.toggleEncounterEdit = encounterRenderer.toggleEncounterEdit;
    win.addCustomCombatant = encounterRenderer.addCustomCombatant;
    win.updateCombatant = encounterRenderer.updateCombatant;
    win.removeCombatant = encounterRenderer.removeCombatant;
    win.sortInitiative = encounterRenderer.sortInitiative;
    win.refreshPlayers = encounterRenderer.refreshPlayers;
    win.refreshMonsterStats = encounterRenderer.refreshMonsterStats;
    win.toggleDeathSave = encounterRenderer.toggleDeathSave;
    win.openConditionsDialog = encounterRenderer.openConditionsDialog;
    win.closeConditionsModal = encounterRenderer.closeConditionsModal;
    win.saveConditions = encounterRenderer.saveConditions;
    win.clearConditions = encounterRenderer.clearConditions;
    win.generateLoot = encounterRenderer.generateLoot;
    win.clearLoot = encounterRenderer.clearLoot;
    win.updateTreasure = encounterRenderer.updateTreasure;
    win.startEncounter = encounterRenderer.startEncounter;
    win.endEncounter = encounterRenderer.endEncounter;
    win.nextTurn = encounterRenderer.nextTurn;
    win.previousTurn = encounterRenderer.previousTurn;
    win.fetchCRFromCache = encounterRenderer.fetchCRFromCache;
    win.fetchAllMissingCRs = encounterRenderer.fetchAllMissingCRs;
    win.updateSpectatorUrl = encounterRenderer.updateSpectatorUrl;
    win.copySpectatorUrl = encounterRenderer.copySpectatorUrl;
    win.handleDragStart = encounterRenderer.handleDragStart;
    win.handleDragOver = encounterRenderer.handleDragOver;
    win.handleDrop = encounterRenderer.handleDrop;
    win.handleDragEnd = encounterRenderer.handleDragEnd;

    // ==================== TOOLTIP MANAGER INTEGRATION ====================
    
    // Expose tooltip functions globally for onclick handlers
    window.showMonsterTooltip = tooltipManager.showMonsterTooltip;
    window.hideMonsterTooltip = tooltipManager.hideMonsterTooltip;
    window.toggleMonsterIdentified = tooltipManager.toggleMonsterIdentified;

    // ==================== ATTACK ROLL MANAGER INTEGRATION ====================
    
    // Initialize attack roll event handler with dependencies
    initializeAttackRollHandler({
        hideMonsterTooltip: tooltipManager.hideMonsterTooltip,
        openAttackResultModal: handlers.openAttackResultModal
    });

    // ==================== PLAYER RENDERER INTEGRATION ====================
    
    // Wrapper function for renderPlayers that uses the modular renderer
    win.renderPlayers = () => {
        const adventure = win.currentAdventure;
        const editMode = win.playersEditMode || false;
        playerRenderer.renderPlayers(adventure, editMode);
    };
    
    // Player management functions
    win.togglePlayersEditMode = () => {
        win.playersEditMode = !win.playersEditMode;
        const btn = document.getElementById('toggleEditPlayersBtn');
        const addBtn = document.getElementById('addPlayerBtn');
        if (win.playersEditMode) {
            btn.textContent = '💾';
            btn.title = 'Save';
            btn.style.background = '#27ae60';
            if (addBtn) addBtn.style.display = 'block';
        } else {
            btn.textContent = '✏️';
            btn.title = 'Edit';
            btn.style.background = '#f39c12';
            if (addBtn) addBtn.style.display = 'none';
        }
        win.renderPlayers();
    };
    
    win.sortPlayers = (field) => {
        if (!win.currentAdventure) return;
        playerRenderer.sortPlayers(win.currentAdventure, field);
        win.renderPlayers();
        if (win.autoSave) win.autoSave();
    };
    
    // Setup player event delegation after DOM is ready
    function setupPlayerEventDelegation() {
        playerRenderer.setupPlayerEventDelegation((event) => {
            if (!win.currentAdventure || !win.currentAdventure.players) return;
            
            const player = win.currentAdventure.players[event.index];
            if (!player) return;
            
            switch (event.type) {
                case 'toggleStats':
                    player.expanded = !player.expanded;
                    win.renderPlayers();
                    break;
                    
                case 'editUrl':
                    const url = prompt('Enter D&D Beyond URL for ' + player.name + ':', player.dndBeyondUrl || '');
                    if (url !== null) {
                        player.dndBeyondUrl = url;
                        win.renderPlayers();
                        if (win.autoSave) win.autoSave();
                    }
                    break;
                    
                case 'remove':
                    if (confirm('Remove this player?')) {
                        win.currentAdventure.players.splice(event.index, 1);
                        win.renderPlayers();
                        if (win.autoSave) win.autoSave();
                    }
                    break;
                    
                case 'updateField':
                    player[event.field] = event.value;
                    if (win.autoSave) win.autoSave();
                    break;
                    
                case 'updateAbility':
                    if (!player.abilityScores) {
                        player.abilityScores = {
                            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
                        };
                    }
                    player.abilityScores[event.ability] = event.value;
                    win.renderPlayers(); // Re-render to show updated modifiers
                    if (win.autoSave) win.autoSave();
                    break;
                    
                case 'updateSkill':
                    if (!player.skillProficiencies) {
                        player.skillProficiencies = {
                            perception: false,
                            insight: false,
                            investigation: false
                        };
                    }
                    player.skillProficiencies[event.skill] = event.checked;
                    win.renderPlayers(); // Re-render to update passive values
                    if (win.autoSave) win.autoSave();
                    break;
            }
        });
    }

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
