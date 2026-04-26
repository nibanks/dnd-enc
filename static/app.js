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
import { musicService } from './services/musicService.js';
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

    // Renders the chapter music dropdown to match the current chapter's
    // selected track. Defined here so it can close over `dom`.
    function updateChapterMusicDisplay() {
        const select = dom.getElementById('chapterMusicSelect');
        if (!select) return;
        const adventure = state.get('currentAdventure');
        const currentChapter = state.get('currentChapter');
        const status = musicService.getStatus();
        const selected = (adventure && adventure.chapterMusic && adventure.chapterMusic[currentChapter]) || '';

        const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const options = ['<option value="">— none —</option>']
            .concat((status.available || []).map(name => {
                const sel = name === selected ? ' selected' : '';
                return `<option value="${escapeAttr(name)}"${sel}>${escapeAttr(name)}</option>`;
            }));
        select.innerHTML = options.join('');
    }

    // Combined renderers object for event handlers
    const renderers = {
        // Modular renderers
        renderAdventure: adventureRenderer.renderAdventure,
        renderChapterSelector: adventureRenderer.renderChapterSelector,
        updateChapterNotesDisplay: adventureRenderer.updateChapterNotesDisplay,
        updateChapterMusicDisplay,

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
        musicService,
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

        // Chapter music
        const chapterMusicSelect = dom.getElementById('chapterMusicSelect');
        if (chapterMusicSelect) {
            dom.addEventListener(chapterMusicSelect, 'change', handlers.handleChapterMusicChange);
        }
        const chapterMusicPreviewBtn = dom.getElementById('chapterMusicPreviewBtn');
        if (chapterMusicPreviewBtn) {
            dom.addEventListener(chapterMusicPreviewBtn, 'click', handlers.handleChapterMusicPreview);
        }

        // Global music player widget
        setupMusicPlayerUI();

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
     * Wire up the global music player widget at the top of an adventure.
     * Subscribes to musicService updates so the displayed track / play state
     * / unlock prompt always reflects reality.
     */
    function setupMusicPlayerUI() {
        const playerEl = dom.getElementById('musicPlayer');
        const trackEl = dom.getElementById('musicPlayerTrack');
        const timeEl = dom.getElementById('musicPlayerTime');
        const playPauseEl = dom.getElementById('musicPlayerPlayPause');
        const muteEl = dom.getElementById('musicPlayerMute');
        const volumeEl = dom.getElementById('musicPlayerVolume');
        const refreshEl = dom.getElementById('musicPlayerRefresh');
        const unlockEl = dom.getElementById('musicPlayerUnlock');
        const progressEl = dom.getElementById('musicPlayerProgress');
        const progressFillEl = dom.getElementById('musicPlayerProgressFill');
        const sentinelEl = dom.getElementById('musicPlayerSentinel');
        if (!playerEl || !trackEl) return;

        // Format seconds as M:SS (or H:MM:SS for very long tracks).
        function fmtTime(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
            const total = Math.floor(seconds);
            const s = total % 60;
            const m = Math.floor(total / 60) % 60;
            const h = Math.floor(total / 3600);
            const ss = String(s).padStart(2, '0');
            if (h > 0) {
                return `${h}:${String(m).padStart(2, '0')}:${ss}`;
            }
            return `${m}:${ss}`;
        }

        function render(status) {
            const s = status || musicService.getStatus();
            if (s.currentTrack) {
                trackEl.textContent = s.currentTrack;
                trackEl.classList.add('playing');
            } else {
                trackEl.textContent = '— silent —';
                trackEl.classList.remove('playing');
            }
            if (timeEl) {
                if (s.currentTrack && s.duration > 0) {
                    timeEl.textContent = `${fmtTime(s.currentTime)} / ${fmtTime(s.duration)}`;
                } else if (s.currentTrack) {
                    // Track loaded but duration not known yet (e.g. metadata still loading).
                    timeEl.textContent = fmtTime(s.currentTime);
                } else {
                    timeEl.textContent = '';
                }
            }
            if (progressFillEl) {
                const pct = (s.currentTrack && s.duration > 0)
                    ? Math.min(100, (s.currentTime / s.duration) * 100)
                    : 0;
                progressFillEl.style.width = pct + '%';
            }
            if (playPauseEl) {
                playPauseEl.textContent = s.isPlaying ? '⏸' : '▶';
                playPauseEl.title = s.isPlaying ? 'Pause' : 'Play';
            }
            if (muteEl) {
                muteEl.textContent = s.muted ? '🔇' : '🔊';
                muteEl.title = s.muted ? 'Unmute' : 'Mute';
            }
            if (volumeEl) {
                // Only update if the slider isn't currently focused, to avoid
                // fighting the user mid-drag.
                if (doc.activeElement !== volumeEl) {
                    volumeEl.value = String(s.volume);
                }
            }
            if (unlockEl) {
                unlockEl.style.display = s.needsUnlock ? '' : 'none';
            }
            // Pulse the floating icon only while we're actually playing.
            playerEl.classList.toggle('is-playing', !!s.isPlaying);
            // When collapsed in floating mode, hovering the pill should
            // surface the track name as a native browser tooltip - the
            // expanded controls aren't visible until you hover.
            const timeSuffix = (s.currentTrack && s.duration > 0)
                ? ` (${fmtTime(s.currentTime)} / ${fmtTime(s.duration)})`
                : '';
            playerEl.title = s.currentTrack
                ? `🎵 ${s.currentTrack}${s.muted ? ' (muted)' : ''}${timeSuffix}`
                : '🎵 No music';
        }

        // Initial paint with persisted volume
        if (volumeEl) volumeEl.value = String(musicService.getStatus().volume);
        render();

        musicService.subscribe(render);

        if (playPauseEl) {
            dom.addEventListener(playPauseEl, 'click', () => {
                const s = musicService.getStatus();
                if (s.isPlaying) {
                    musicService.pause();
                } else {
                    musicService.resume();
                }
            });
        }
        if (muteEl) {
            dom.addEventListener(muteEl, 'click', () => {
                const s = musicService.getStatus();
                musicService.setMuted(!s.muted);
            });
        }
        if (volumeEl) {
            dom.addEventListener(volumeEl, 'input', (e) => {
                musicService.setVolume(parseFloat(e.target.value));
            });
        }
        if (refreshEl) {
            dom.addEventListener(refreshEl, 'click', async () => {
                await musicService.refreshAvailable();
                if (renderers.updateChapterMusicDisplay) {
                    renderers.updateChapterMusicDisplay();
                }
                if (win.renderEncounters) win.renderEncounters();
                helpers.showToast('Music library refreshed', 'success', 1500);
            });
        }
        if (unlockEl) {
            dom.addEventListener(unlockEl, 'click', () => {
                musicService.resume();
            });
        }

        // Click-to-scrub on the progress bar. We compute the click position
        // as a fraction of the bar's width and seek to that point in the
        // current track's duration.
        if (progressEl) {
            dom.addEventListener(progressEl, 'click', (e) => {
                const s = musicService.getStatus();
                if (!s.currentTrack || !(s.duration > 0)) return;
                const rect = progressEl.getBoundingClientRect();
                if (rect.width <= 0) return;
                const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                musicService.seek(fraction * s.duration);
            });
        }

        // Once the user scrolls past the player's natural position, pin it
        // to the top-right as a compact pill that expands on hover. We
        // observe a 1px sentinel that lives in the player's normal spot in
        // the document flow - that way switching the player itself to
        // position:fixed doesn't confuse the observer.
        if (sentinelEl && typeof IntersectionObserver !== 'undefined') {
            const observer = new IntersectionObserver((entries) => {
                const entry = entries[0];
                if (!entry) return;
                // boundingClientRect.top < 0 means the sentinel has scrolled
                // above the viewport, i.e. the user is below the player's
                // natural location and we should pin.
                const scrolledPast = !entry.isIntersecting
                    && entry.boundingClientRect.top < 0;
                playerEl.classList.toggle('floating', scrolledPast);
            }, { threshold: 0 });
            observer.observe(sentinelEl);
        }
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
    win.updateEncounterMusic = encounterRenderer.updateEncounterMusic;
    win.previewEncounterMusic = encounterRenderer.previewEncounterMusic;

    // Expose the music service for inline handlers and debugging.
    win.musicService = musicService;
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
