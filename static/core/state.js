/**
 * State management module
 * Centralized immutable state with change listeners
 */

/**
 * Application state structure
 */
const initialState = {
    // Current adventure data
    currentAdventure: null,
    currentChapter: null,
    
    // Monster and character data
    dndMonsters: {},
    monsterDetailsCache: {},
    monstersLoaded: false,
    
    // Authentication state
    hasCookies: false,
    
    // UI state
    playersExpanded: true,
    playersEditMode: false,
    encounterEditMode: {},
    
    // Cache and status tracking
    crFetchStatus: {},
    monsterDetailsFetchStatus: {},
    cachedSpectatorUrl: null,
    
    // Auto-save state
    autoSaveTimeout: null
};

/**
 * Create a new state manager instance
 */
export function createStateManager() {
    let state = { ...initialState };
    const listeners = new Set();
    
    return {
        /**
         * Get current state (immutable copy)
         */
        getState() {
            return { ...state };
        },
        
        /**
         * Get a specific state value
         */
        get(key) {
            return state[key];
        },
        
        /**
         * Update state (immutable)
         * @param {Object|Function} updates - Object with updates or function (prevState) => updates
         */
        setState(updates) {
            const prevState = state;
            
            if (typeof updates === 'function') {
                updates = updates(prevState);
            }
            
            state = {
                ...prevState,
                ...updates
            };
            
            // Notify all listeners
            listeners.forEach(listener => {
                try {
                    listener(state, prevState);
                } catch (error) {
                    console.error('State listener error:', error);
                }
            });
        },
        
        /**
         * Update nested state (e.g., adventure property)
         * @param {string} path - Dot-separated path (e.g., 'currentAdventure.players')
         * @param {*} value - New value
         */
        setNested(path, value) {
            const keys = path.split('.');
            const updates = {};
            
            // Build nested object
            let current = updates;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...(state[keys[i]] || {}) };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            
            this.setState(updates);
        },
        
        /**
         * Subscribe to state changes
         * @param {Function} listener - Called with (newState, prevState)
         * @returns {Function} Unsubscribe function
         */
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        
        /**
         * Reset state to initial values
         */
        reset() {
            state = { ...initialState };
            listeners.forEach(listener => listener(state, {}));
        },
        
        /**
         * Load adventure data
         */
        loadAdventure(adventure, chapter = null) {
            this.setState({
                currentAdventure: adventure,
                currentChapter: chapter || adventure?.chapters?.[0] || null,
                crFetchStatus: {},  // Clear fetch status on new adventure
                encounterEditMode: {}  // Clear edit mode
            });
        },
        
        /**
         * Update current adventure (preserves immutability)
         */
        updateAdventure(updates) {
            const currentAdventure = state.currentAdventure;
            if (!currentAdventure) return;
            
            this.setState({
                currentAdventure: {
                    ...currentAdventure,
                    ...updates
                }
            });
        },
        
        /**
         * Update a specific encounter
         */
        updateEncounter(encounterIndex, updates) {
            const adventure = state.currentAdventure;
            if (!adventure || !adventure.encounters) return;
            
            const encounters = [...adventure.encounters];
            encounters[encounterIndex] = {
                ...encounters[encounterIndex],
                ...updates
            };
            
            this.updateAdventure({ encounters });
        },
        
        /**
         * Update a specific combatant in an encounter
         */
        updateCombatant(encounterIndex, combatantIndex, updates) {
            const adventure = state.currentAdventure;
            if (!adventure || !adventure.encounters) return;
            
            const encounters = [...adventure.encounters];
            const encounter = encounters[encounterIndex];
            const combatants = [...encounter.combatants];
            
            combatants[combatantIndex] = {
                ...combatants[combatantIndex],
                ...updates
            };
            
            encounters[encounterIndex] = {
                ...encounter,
                combatants
            };
            
            this.updateAdventure({ encounters });
        },
        
        /**
         * Update a player
         */
        updatePlayer(playerIndex, updates) {
            const adventure = state.currentAdventure;
            if (!adventure || !adventure.players) return;
            
            const players = [...adventure.players];
            players[playerIndex] = {
                ...players[playerIndex],
                ...updates
            };
            
            this.updateAdventure({ players });
        },
        
        /**
         * Add player
         */
        addPlayer(player) {
            const adventure = state.currentAdventure;
            if (!adventure) return;
            
            const players = [...(adventure.players || []), player];
            this.updateAdventure({ players });
        },
        
        /**
         * Remove player
         */
        removePlayer(playerIndex) {
            const adventure = state.currentAdventure;
            if (!adventure || !adventure.players) return;
            
            const players = adventure.players.filter((_, i) => i !== playerIndex);
            this.updateAdventure({ players });
        },
        
        /**
         * Add encounter
         */
        addEncounter(encounter) {
            const adventure = state.currentAdventure;
            if (!adventure) return;
            
            const encounters = [...(adventure.encounters || []), encounter];
            this.updateAdventure({ encounters });
        },
        
        /**
         * Remove encounter
         */
        removeEncounter(encounterIndex) {
            const adventure = state.currentAdventure;
            if (!adventure || !adventure.encounters) return;
            
            const encounters = adventure.encounters.filter((_, i) => i !== encounterIndex);
            this.updateAdventure({ encounters });
        },
        
        /**
         * Toggle UI state
         */
        toggleUI(key) {
            this.setState({ [key]: !state[key] });
        },
        
        /**
         * Set encounter edit mode for specific encounter
         */
        setEncounterEditMode(encounterIndex, isEditing) {
            const encounterEditMode = {
                ...state.encounterEditMode,
                [encounterIndex]: isEditing
            };
            this.setState({ encounterEditMode });
        }
    };
}

/**
 * Global singleton state manager
 * Can be replaced with instance for testing
 */
export const state = createStateManager();
