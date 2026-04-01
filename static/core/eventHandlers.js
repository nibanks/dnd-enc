/**
 * Event Handlers - Centralized event handling logic
 * 
 * All event handlers follow the pattern:
 * 1. Extract data from event
 * 2. Validate input
 * 3. Update state
 * 4. Trigger re-render
 * 5. Handle side effects (API calls, modals, etc.)
 */

/**
 * Create event handlers with injected dependencies
 * @param {Object} deps - Dependencies
 * @param {Object} deps.state - State manager
 * @param {Object} deps.api - API client
 * @param {Object} deps.dom - DOM helpers
 * @param {Object} deps.modalManager - Modal manager
 * @param {Object} deps.helpers - UI helpers
 * @param {Object} deps.renderers - Renderer functions {renderAdventure, renderPlayers, renderEncounters, etc.}
 * @returns {Object} Event handler functions
 */
export function createEventHandlers(deps) {
    const { state, api, dom, modalManager, helpers, renderers } = deps;

    // ==================== ADVENTURE MANAGEMENT ====================

    async function handleAdventureChange(event) {
        const adventureName = event.target.value;
        
        if (!adventureName) {
            dom.getElementById('adventureContent').style.display = 'none';
            return;
        }

        try {
            // Try to load adventure directly (will succeed if no PIN or already verified in session)
            let adventure;
            try {
                adventure = await api.getAdventure(adventureName);
            } catch (error) {
                // If 403, adventure requires PIN verification
                if (error.status === 403) {
                    // Protected adventure - prompt for PIN
                    const pin = prompt('This adventure is protected. Enter PIN:');
                    if (!pin) {
                        // User canceled - clear selection
                        event.target.value = '';
                        if (typeof window !== 'undefined') {
                            window.currentAdventure = null;
                        }
                        return;
                    }

                    // Verify PIN
                    const verifyResponse = await api.verifyAdventurePin(adventureName, pin);
                    if (!verifyResponse.ok) {
                        helpers.showToast('Incorrect PIN', 'error');
                        // Clear selection on incorrect PIN
                        event.target.value = '';
                        if (typeof window !== 'undefined') {
                            window.currentAdventure = null;
                        }
                        return;
                    }

                    // PIN verified, try loading again
                    adventure = await api.getAdventure(adventureName);
                } else {
                    // Other error, re-throw
                    throw error;
                }
            }

            state.loadAdventure(adventure);

            // Check URL for chapter parameter
            if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                const chapterParam = urlParams.get('chapter');
                
                // If chapter in URL exists in adventure, use it
                if (chapterParam && adventure.chapters && adventure.chapters.includes(chapterParam)) {
                    state.setState({ currentChapter: chapterParam });
                }
                
                // Sync legacy global variables for backward compatibility with script.js renderers
                window.currentAdventure = state.get('currentAdventure');
                window.currentChapter = state.get('currentChapter');
            }

            // Update URL (preserve chapter if it exists)
            const currentChapter = state.get('currentChapter');
            helpers.setURLParameter('adventure', adventureName);
            if (currentChapter) {
                helpers.setURLParameter('chapter', currentChapter);
            }

            // Show adventure content
            dom.getElementById('adventureContent').style.display = 'block';

            // Render everything
            if (renderers.renderAdventure) {
                renderers.renderAdventure();
            }
            if (renderers.renderChapterSelector) {
                renderers.renderChapterSelector();
            }
            if (renderers.renderPlayers) {
                renderers.renderPlayers();
            }
            if (renderers.renderEncounters) {
                renderers.renderEncounters();
            }

            // Restore scroll position
            const scrollPos = sessionStorage.getItem('scrollPosition');
            if (scrollPos) {
                setTimeout(() => window.scrollTo(0, parseInt(scrollPos)), 100);
            }
        } catch (error) {
            console.error('Error loading adventure:', error);
            helpers.showToast('Failed to load adventure', 'error');
            // Clear selection on error
            event.target.value = '';
            if (typeof window !== 'undefined') {
                window.currentAdventure = null;
            }
        }
    }

    async function createNewAdventure() {
        const name = prompt('Enter adventure name:');
        if (!name) return;

        try {
            await api.createAdventure({ name });
            
            // Reload adventures list (would need renderer)
            if (renderers.loadAdventuresList) {
                await renderers.loadAdventuresList();
            }

            // Select the new adventure
            dom.getElementById('adventureSelect').value = name;
            await handleAdventureChange({ target: { value: name } });

            helpers.showToast('Adventure created', 'success');
        } catch (error) {
            console.error('Error creating adventure:', error);
            helpers.showToast(error.message || 'Failed to create adventure', 'error');
        }
    }

    async function deleteCurrentAdventure() {
        const adventureSelect = dom.getElementById('adventureSelect');
        const name = adventureSelect.value;
        
        if (!name) return;

        if (!confirm(`Delete adventure "${name}"?`)) return;

        try {
            await api.deleteAdventure(name);
            
            // Reload adventures list
            if (renderers.loadAdventuresList) {
                await renderers.loadAdventuresList();
            }

            // Clear selection and hide content
            adventureSelect.value = '';
            dom.getElementById('adventureContent').style.display = 'none';

            // Clear URL parameters
            helpers.setURLParameter('adventure', null);
            helpers.setURLParameter('chapter', null);

            helpers.showToast('Adventure deleted', 'success');
        } catch (error) {
            console.error('Error deleting adventure:', error);
            helpers.showToast('Failed to delete adventure', 'error');
        }
    }

    // ==================== CHAPTER MANAGEMENT ====================

    function handleChapterChange(event) {
        const chapter = event.target.value;
        state.setState({ currentChapter: chapter });

        // Sync legacy global variable
        if (typeof window !== 'undefined') {
            window.currentChapter = chapter;
        }

        // Update URL
        helpers.setURLParameter('chapter', chapter);

        // Re-render encounters for this chapter
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Update chapter notes display
        if (renderers.updateChapterNotesDisplay) {
            renderers.updateChapterNotesDisplay();
        }
    }

    function handleChapterNotesChange(event) {
        const currentChapter = state.get('currentChapter');
        const notes = event.target.value;

        // Update chapter notes in state
        const adventure = state.get('currentAdventure');
        if (!adventure.chapterNotes) {
            adventure.chapterNotes = {};
        }
        adventure.chapterNotes[currentChapter] = notes;

        state.updateAdventure({ chapterNotes: adventure.chapterNotes });

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }
    }

    function addChapter() {
        const name = prompt('Enter chapter name:');
        if (!name) return;

        const adventure = state.get('currentAdventure');
        if (!adventure.chapters) {
            adventure.chapters = [];
        }

        if (adventure.chapters.includes(name)) {
            helpers.showToast('Chapter already exists', 'error');
            return;
        }

        adventure.chapters.push(name);
        state.updateAdventure({ chapters: adventure.chapters });

        // Re-render chapter selector
        if (renderers.renderChapterSelector) {
            renderers.renderChapterSelector();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Chapter added', 'success');
    }

    function deleteChapter() {
        const currentChapter = state.get('currentChapter');
        
        if (!confirm(`Delete chapter "${currentChapter}" and all its encounters?`)) {
            return;
        }

        const adventure = state.get('currentAdventure');
        
        // Remove chapter from list
        adventure.chapters = adventure.chapters.filter(c => c !== currentChapter);

        // Remove encounters in this chapter
        adventure.encounters = adventure.encounters.filter(e => e.chapter !== currentChapter);

        state.updateAdventure({ 
            chapters: adventure.chapters,
            encounters: adventure.encounters 
        });

        // Switch to first chapter
        const newChapter = adventure.chapters[0] || 'Chapter 1';
        state.setState({ currentChapter: newChapter });

        // Re-render
        if (renderers.renderChapterSelector) {
            renderers.renderChapterSelector();
        }if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Chapter deleted', 'success');
    }

    // ==================== PLAYER MANAGEMENT ====================

    function addPlayer() {
        const adventure = state.get('currentAdventure');
        if (!adventure.players) {
            adventure.players = [];
        }

        const newPlayer = {
            id: helpers.generateId(),
            playerName: '',
            name: '',
            race: '',
            class: '',
            level: 1,
            maxHp: 0,
            ac: 10,
            speed: 30,
            initiativeBonus: 0,
            dndBeyondUrl: '',
            abilityScores: {
                str: 10,
                dex: 10,
                con: 10,
                int: 10,
                wis: 10,
                cha: 10,
            },
            skillProficiencies: {
                perception: false,
                insight: false,
                investigation: false,
            },
        };

        adventure.players.push(newPlayer);
        state.updateAdventure({ players: adventure.players });

        // Re-render
        if (renderers.renderPlayers) {
            renderers.renderPlayers();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Player added', 'success');
    }

    function deletePlayer(index) {
        if (!confirm('Delete this player?')) return;

        const adventure = state.get('currentAdventure');
        adventure.players.splice(index, 1);
        
        state.updateAdventure({ players: adventure.players });

        // Re-render
        if (renderers.renderPlayers) {
            renderers.renderPlayers();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Player deleted', 'success');
    }

    function updatePlayer(index, field, value) {
        const adventure = state.get('currentAdventure');
        const player = adventure.players[index];

        if (!player) return;

        // Handle nested fields
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            if (!player[parent]) {
                player[parent] = {};
            }
            player[parent][child] = value;
        } else {
            player[field] = value;
        }

        state.updatePlayer(index, player);

        // Re-render if needed
        if (renderers.renderPlayers) {
            renderers.renderPlayers();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }
    }

    function togglePlayersEditMode() {
        const currentMode = state.get('playersEditMode') || false;
        state.setState({ playersEditMode: !currentMode });

        // Re-render players table
        if (renderers.renderPlayers) {
            renderers.renderPlayers();
        }

        // Update button text
        const btn = dom.getElementById('toggleEditPlayersBtn');
        if (btn) {
            btn.textContent = currentMode ? '✎' : '✓';
            btn.title = currentMode ? 'Edit' : 'Done';
        }
    }

    function togglePlayersSection() {
        const currentState = state.get('playersCollapsed') || false;
        state.setState({ playersCollapsed: !currentState });

        const playersTable = dom.getElementById('playersTable');
        const btn = dom.getElementById('togglePlayersBtn');

        if (playersTable) {
            playersTable.style.display = currentState ? 'table' : 'none';
        }

        if (btn) {
            btn.textContent = currentState ? '▼' : '▶';
        }
    }

    function sortPlayers(field) {
        const adventure = state.get('currentAdventure');
        const currentSort = state.get('playersSortField');
        const currentOrder = state.get('playersSortOrder') || 'asc';

        // Toggle order if same field
        let newOrder = 'asc';
        if (currentSort === field) {
            newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        }

        // Sort players
        adventure.players.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Handle null/undefined
            if (valA == null) valA = '';
            if (valB == null) valB = '';

            // Compare
            if (typeof valA === 'string') {
                return newOrder === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            } else {
                return newOrder === 'asc' 
                    ? valA - valB
                    : valB - valA;
            }
        });

        state.setState({ playersSortField: field, playersSortOrder: newOrder });
        state.updateAdventure({ players: adventure.players });

        // Re-render
        if (renderers.renderPlayers) {
            renderers.renderPlayers();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }
    }

    // ==================== ENCOUNTER MANAGEMENT ====================

    function addEncounter() {
        const adventure = state.get('currentAdventure');
        const currentChapter = state.get('currentChapter');
        
        if (!adventure.encounters) {
            adventure.encounters = [];
        }

        const newEncounter = {
            id: helpers.generateId(),
            name: `Encounter ${adventure.encounters.length + 1}`,
            chapter: currentChapter,
            combatants: [],
            state: 'planning', // planning, started, complete
            round: 0,
            minimized: false,
        };

        adventure.encounters.push(newEncounter);
        state.updateAdventure({ encounters: adventure.encounters });

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Encounter added', 'success');
    }

    function deleteEncounter(index) {
        if (!confirm('Delete this encounter?')) return;

        const adventure = state.get('currentAdventure');
        adventure.encounters.splice(index, 1);
        
        state.updateAdventure({ encounters: adventure.encounters });

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Encounter deleted', 'success');
    }

    function updateEncounter(index, updates) {
        state.updateEncounter(index, updates);

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }
    }

    function toggleEncounterMinimized(index) {
        const adventure = state.get('currentAdventure');
        const encounter = adventure.encounters[index];
        
        if (!encounter) return;

        encounter.minimized = !encounter.minimized;
        state.updateEncounter(index, { minimized: encounter.minimized });

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }
    }

    function startEncounter(index) {
        const adventure = state.get('currentAdventure');
        const encounter = adventure.encounters[index];

        if (!encounter || encounter.combatants.length === 0) {
            helpers.showToast('Add combatants before starting', 'error');
            return;
        }

        // Roll initiative for all combatants
        encounter.combatants.forEach(combatant => {
            if (combatant.initiative === undefined || combatant.initiative === null) {
                const bonus = combatant.initiativeBonus || 0;
                combatant.initiative = Math.floor(Math.random() * 20) + 1 + bonus;
            }
        });

        encounter.state = 'started';
        encounter.round = 1;
        encounter.minimized = false;

        state.updateEncounter(index, encounter);

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Combat started!', 'success');
    }

    function completeEncounter(index) {
        if (!confirm('Mark encounter as complete?')) return;

        state.updateEncounter(index, { state: 'complete', minimized: true });

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Encounter completed!', 'success');
    }

    function resetEncounter(index) {
        if (!confirm('Reset this encounter?')) return;

        const adventure = state.get('currentAdventure');
        const encounter = adventure.encounters[index];

        // Reset all combatants
        encounter.combatants.forEach(combatant => {
            combatant.hp = combatant.maxHp;
            combatant.initiative = null;
            combatant.conditions = [];
            combatant.concentrating = false;
        });

        encounter.state = 'planning';
        encounter.round = 0;

        state.updateEncounter(index, encounter);

        // Re-render
        if (renderers.renderEncounters) {
            renderers.renderEncounters();
        }

        // Auto-save
        if (renderers.autoSave) {
            renderers.autoSave();
        }

        helpers.showToast('Encounter reset', 'success');
    }

    // ==================== MODAL HANDLERS ====================

    function openSettingsModal() {
        modalManager.openModal('settingsModal');
    }

    function closeSettingsModal() {
        modalManager.closeModal('settingsModal');
    }

    function openAdventureSettingsModal() {
        modalManager.openModal('adventureSettingsModal');
    }

    function closeAdventureSettingsModal() {
        modalManager.closeModal('adventureSettingsModal');
    }

    // ==================== DAMAGE/HEAL MODAL HANDLERS ====================

    function openDamageModal() {
        const currentAdventure = state.get('currentAdventure');
        if (!currentAdventure) return;

        // Find an active encounter (started or just any encounter with combatants)
        let activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
        
        // If no started encounter, try to find any encounter with combatants
        if (!activeEncounter) {
            activeEncounter = currentAdventure.encounters?.find(e => e.combatants && e.combatants.length > 0);
        }
        
        if (!activeEncounter || !activeEncounter.combatants || activeEncounter.combatants.length === 0) {
            return; // Only works if there are combatants
        }

        const modal = dom.getElementById('damageModal');
        if (!modal) return;

        const fromSelect = dom.getElementById('damageFromSelect');
        const toSelect = dom.getElementById('damageToSelect');
        const amountInput = dom.getElementById('damageAmount');
        
        let acDisplay = dom.getElementById('damageTargetAC');
        if (!acDisplay) {
            // Add AC display if not present
            const acDiv = document.createElement('div');
            acDiv.id = 'damageTargetAC';
            acDiv.style.margin = '10px 0 0 0';
            acDiv.style.fontWeight = 'bold';
            acDiv.style.fontSize = '15px';
            acDiv.style.textAlign = 'right';
            toSelect.parentElement.appendChild(acDiv);
            acDisplay = acDiv;
        }

        // Clear and populate dropdowns
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';

        // Helper to get enemy status
        function isEnemy(attacker, target) {
            return window.isPlayerCombatant(attacker) !== window.isPlayerCombatant(target);
        }

        // Set default "from" to active combatant
        const activeCombatantIndex = activeEncounter.combatants.findIndex(
            c => window.getCombatantName(c) === activeEncounter.activeCombatant
        );
        let fromIndex = activeCombatantIndex >= 0 ? activeCombatantIndex : 0;

        // Populate "from" select
        activeEncounter.combatants.forEach((combatant, index) => {
            const optionFrom = document.createElement('option');
            optionFrom.value = index;
            optionFrom.textContent = window.getCombatantName(combatant);
            fromSelect.appendChild(optionFrom);
        });
        fromSelect.value = fromIndex;

        // Sort "to" list: enemies first, then alphabetical
        const attacker = activeEncounter.combatants[fromIndex];
        const sortedTargets = activeEncounter.combatants
            .map((combatant, idx) => ({ combatant, idx }))
            .sort((a, b) => {
                const aEnemy = isEnemy(attacker, a.combatant);
                const bEnemy = isEnemy(attacker, b.combatant);
                if (aEnemy !== bEnemy) return bEnemy - aEnemy; // enemies first
                const aName = window.getCombatantName(a.combatant).toLowerCase();
                const bName = window.getCombatantName(b.combatant).toLowerCase();
                return aName.localeCompare(bName);
            });

        sortedTargets.forEach(({ combatant, idx }) => {
            const optionTo = document.createElement('option');
            optionTo.value = idx;
            optionTo.textContent = window.getCombatantName(combatant);
            toSelect.appendChild(optionTo);
        });
        toSelect.value = sortedTargets[0]?.idx ?? 0;

        // Function to update AC display
        function updateACDisplay() {
            const targetIdx = parseInt(toSelect.value);
            const target = activeEncounter.combatants[targetIdx];
            let ac = '';
            if (target) {
                if (window.isPlayerCombatant(target)) {
                    // Look up player AC
                    const player = currentAdventure?.players?.find(p => {
                        const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                        return playerId === target.id;
                    });
                    ac = player?.ac ?? target.ac ?? '?';
                } else {
                    ac = target.ac ?? '?';
                }
            }
            acDisplay.textContent = `AC: ${ac}`;
        }
        updateACDisplay();
        toSelect.addEventListener('change', updateACDisplay);

        amountInput.value = 0;
        modal.style.display = 'flex';
        setTimeout(() => amountInput.focus(), 100);
    }

    function closeDamageModal() {
        const modal = dom.getElementById('damageModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function confirmDamage() {
        const currentAdventure = state.get('currentAdventure');
        const activeEncounter = currentAdventure?.encounters?.find(e => e.state === 'started');
        if (!activeEncounter) {
            closeDamageModal();
            return;
        }
        
        const fromIndex = parseInt(dom.getElementById('damageFromSelect').value);
        const toIndex = parseInt(dom.getElementById('damageToSelect').value);
        let amount = parseInt(dom.getElementById('damageAmount').value) || 0;
        
        if (amount <= 0) {
            closeDamageModal();
            return;
        }
        
        // Update the from combatant's DMG
        if (activeEncounter.combatants[fromIndex]) {
            activeEncounter.combatants[fromIndex].dmg = (activeEncounter.combatants[fromIndex].dmg || 0) + amount;
        }
        
        // Update the to combatant's HP (handle temp HP first)
        if (activeEncounter.combatants[toIndex]) {
            const target = activeEncounter.combatants[toIndex];
            const tempHp = target.tempHp || 0;
            
            // Apply damage to temp HP first
            if (tempHp > 0) {
                if (amount <= tempHp) {
                    target.tempHp = tempHp - amount;
                    amount = 0;
                } else {
                    target.tempHp = 0;
                    amount -= tempHp;
                }
            }
            
            // Apply remaining damage to regular HP
            if (amount > 0) {
                target.hp = (target.hp || 0) - amount;
                
                // Don't let player HP go below 0
                const isPlayer = window.isPlayerCombatant(target);
                if (isPlayer && target.hp < 0) {
                    target.hp = 0;
                }
            }
            
            // Check concentration (DC = 10 or half damage, whichever is higher)
            if (target.concentrating && amount > 0) {
                const dc = Math.max(10, Math.floor(amount / 2));
                const targetName = window.getCombatantName(target);
                setTimeout(() => {
                    if (confirm(`${targetName} is concentrating! Make a DC ${dc} Constitution save or lose concentration.`)) {
                        // Passed save - do nothing
                    } else {
                        // Failed save - lose concentration
                        target.concentrating = false;
                        if (window.renderEncounters) window.renderEncounters();
                        if (window.autoSave) window.autoSave();
                    }
                }, 100);
            }
            
            // Clear death saves if healing from 0 HP
            if (target.deathSaves && target.hp > 0) {
                target.deathSaves = { successes: 0, failures: 0 };
            }
        }
        
        // Re-render and close
        if (window.renderEncounters) window.renderEncounters();
        if (window.autoSave) window.autoSave();
        closeDamageModal();
    }

    function openHealModal() {
        const currentAdventure = state.get('currentAdventure');
        if (!currentAdventure) return;

        // Find an active encounter (started or just any encounter with combatants)
        let activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
        
        // If no started encounter, try to find any encounter with combatants
        if (!activeEncounter) {
            activeEncounter = currentAdventure.encounters?.find(e => e.combatants && e.combatants.length > 0);
        }
        
        if (!activeEncounter || !activeEncounter.combatants || activeEncounter.combatants.length === 0) {
            return; // Only works if there are combatants
        }
        
        const modal = dom.getElementById('healModal');
        if (!modal) return;
        
        const fromSelect = dom.getElementById('healFromSelect');
        const toSelect = dom.getElementById('healToSelect');
        const amountInput = dom.getElementById('healAmount');
        
        // Clear and populate dropdowns
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';
        
        activeEncounter.combatants.forEach((combatant, index) => {
            const combatantName = window.getCombatantName(combatant);
            
            const optionFrom = document.createElement('option');
            optionFrom.value = index;
            optionFrom.textContent = combatantName;
            fromSelect.appendChild(optionFrom);
            
            const optionTo = document.createElement('option');
            optionTo.value = index;
            optionTo.textContent = combatantName;
            toSelect.appendChild(optionTo);
        });
        
        // Set default "from" to active combatant
        const activeCombatantIndex = activeEncounter.combatants.findIndex(
            c => window.getCombatantName(c) === activeEncounter.activeCombatant
        );
        if (activeCombatantIndex >= 0) {
            fromSelect.value = activeCombatantIndex;
        }
        
        amountInput.value = 0;
        modal.style.display = 'flex';
        setTimeout(() => amountInput.focus(), 100);
    }

    function closeHealModal() {
        const modal = dom.getElementById('healModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function confirmHeal() {
        const currentAdventure = state.get('currentAdventure');
        const activeEncounter = currentAdventure?.encounters?.find(e => e.state === 'started');
        if (!activeEncounter) {
            closeHealModal();
            return;
        }
        
        const fromIndex = parseInt(dom.getElementById('healFromSelect').value);
        const toIndex = parseInt(dom.getElementById('healToSelect').value);
        const amount = parseInt(dom.getElementById('healAmount').value) || 0;
        
        if (amount <= 0) {
            closeHealModal();
            return;
        }
        
        // Update the from combatant's Heal
        if (activeEncounter.combatants[fromIndex]) {
            activeEncounter.combatants[fromIndex].heal = (activeEncounter.combatants[fromIndex].heal || 0) + amount;
        }
        
        // Update the to combatant's HP (increase it)
        if (activeEncounter.combatants[toIndex]) {
            const target = activeEncounter.combatants[toIndex];
            target.hp = (target.hp || 0) + amount;
            
            // Don't let HP go above maxHP
            const maxHp = target.maxHp || 0;
            if (target.hp > maxHp) {
                target.hp = maxHp;
            }
            
            // Clear death saves if healing from 0 HP
            if (target.deathSaves && target.hp > 0) {
                target.deathSaves = { successes: 0, failures: 0 };
            }
        }
        
        // Re-render and close
        if (window.renderEncounters) window.renderEncounters();
        if (window.autoSave) window.autoSave();
        closeHealModal();
    }

    // ==================== MONSTER MODAL HANDLERS ====================

    function openMonsterModal() {
        modalManager.openModal('monsterModal');
    }

    function closeMonsterModal() {
        modalManager.closeModal('monsterModal');
    }

    function openAttackResultModal(html) {
        const modal = modalManager.openModal('attackResultModal');
        if (modal) {
            const content = modal.querySelector('.modal-body');
            if (content) {
                content.innerHTML = html;
            }
        }
    }

    function closeAttackResultModal() {
        modalManager.closeModal('attackResultModal');
    }

    // ==================== COOKIE MANAGEMENT ====================

    async function saveCookies() {
        const input = dom.getElementById('cookieInput');
        if (!input) return;

        const cookieData = input.value.trim();
        if (!cookieData) {
            helpers.showToast('Please paste cookie data', 'error');
            return;
        }

        try {
            await api.saveCookies({ cookies: cookieData });
            helpers.showToast('Cookies saved successfully', 'success');
            
            // Reload to check cookie status
            if (renderers.checkCookieStatus) {
                await renderers.checkCookieStatus();
            }
        } catch (error) {
            console.error('Error saving cookies:', error);
            helpers.showToast('Failed to save cookies', 'error');
        }
    }

    async function clearCookies() {
        if (!confirm('Clear all saved cookies?')) return;

        try {
            await api.clearCookies();
            helpers.showToast('Cookies cleared', 'success');
            
            // Reload to check cookie status
            if (renderers.checkCookieStatus) {
                await renderers.checkCookieStatus();
            }
        } catch (error) {
            console.error('Error clearing cookies:', error);
            helpers.showToast('Failed to clear cookies', 'error');
        }
    }

    // ==================== KEYBOARD SHORTCUTS ====================

    function handleKeyboardShortcut(event) {
        // Ctrl+D - Damage modal
        if (event.ctrlKey && (event.key === 'd' || event.key === 'D')) {
            event.preventDefault();
            openDamageModal();
            return;
        }

        // Ctrl+H - Heal modal
        if (event.ctrlKey && (event.key === 'h' || event.key === 'H')) {
            event.preventDefault();
            openHealModal();
            return;
        }

        // Ctrl+Right Arrow - Next turn in active encounter
        if (event.ctrlKey && event.key === 'ArrowRight') {
            event.preventDefault();
            const activeEncounter = state.get('currentAdventure')?.encounters?.find(e => e.state === 'started');
            if (activeEncounter && window.nextTurn) {
                const encounterIndex = state.get('currentAdventure').encounters.indexOf(activeEncounter);
                if (encounterIndex >= 0) {
                    window.nextTurn(encounterIndex);
                }
            }
            return;
        }

        // Ctrl+Left Arrow - Previous turn in active encounter
        if (event.ctrlKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            const activeEncounter = state.get('currentAdventure')?.encounters?.find(e => e.state === 'started');
            if (activeEncounter && window.previousTurn) {
                const encounterIndex = state.get('currentAdventure').encounters.indexOf(activeEncounter);
                if (encounterIndex >= 0) {
                    window.previousTurn(encounterIndex);
                }
            }
            return;
        }

        // ESC - Close modals
        if (event.key === 'Escape') {
            modalManager.closeCurrentModal();
        }
    }

    // ==================== UTILITY HANDLERS ====================

    function openStatisticsInNewWindow() {
        const adventureName = dom.getElementById('adventureSelect').value;
        if (!adventureName) {
            helpers.showToast('Select an adventure first', 'error');
            return;
        }

        const url = `/statistics?adventure=${encodeURIComponent(adventureName)}`;
        window.open(url, '_blank');
    }

    // ==================== RETURN API ====================

    return {
        // Adventure
        handleAdventureChange,
        createNewAdventure,
        deleteCurrentAdventure,

        // Chapter
        handleChapterChange,
        handleChapterNotesChange,
        addChapter,
        deleteChapter,

        // Player
        addPlayer,
        deletePlayer,
        updatePlayer,
        togglePlayersEditMode,
        togglePlayersSection,
        sortPlayers,

        // Encounter
        addEncounter,
        deleteEncounter,
        updateEncounter,
        toggleEncounterMinimized,
        startEncounter,
        completeEncounter,
        resetEncounter,

        // Modals
        openSettingsModal,
        closeSettingsModal,
        openAdventureSettingsModal,
        closeAdventureSettingsModal,
        openDamageModal,
        closeDamageModal,
        confirmDamage,
        openHealModal,
        closeHealModal,
        confirmHeal,
        openMonsterModal,
        closeMonsterModal,
        openAttackResultModal,
        closeAttackResultModal,

        // Cookies
        saveCookies,
        clearCookies,

        // Keyboard
        handleKeyboardShortcut,

        // Utility
        openStatisticsInNewWindow,
    };
}
