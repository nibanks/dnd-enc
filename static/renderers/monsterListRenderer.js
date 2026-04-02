/**
 * Monster List Renderer Module
 * Handles monster selection modal, monster list rendering, and adding monsters to encounters
 */

// Track current encounter index for monster selection
let currentEncounterIndex = null;

/**
 * Parse CR string to numeric value for sorting
 * @param {string} cr - CR string (e.g., "1/2", "5", "1/4")
 * @returns {number} Numeric CR value
 */
function parseCR(cr) {
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

/**
 * Show cookie expiration warning banner
 * @param {string} monsterName - Name of monster that failed to load
 */
function showCookieExpirationWarning(monsterName) {
    // Only show warning once per session to avoid spam
    if (window.cookieWarningShown) return;
    window.cookieWarningShown = true;
    
    // Create notification banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff6b6b;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 500px;
        text-align: center;
        font-size: 14px;
    `;
    banner.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">🔒 Authentication Failed</div>
        <div style="margin-bottom: 12px;">Unable to load "${monsterName}" from D&D Beyond. Your cookies may be expired.</div>
        <button onclick="document.getElementById('settingsBtn').click(); this.parentElement.remove(); window.cookieWarningShown = false;" 
                style="background: white; color: #ff6b6b; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Update Cookies
        </button>
        <button onclick="this.parentElement.remove()" 
                style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 8px;">
            Dismiss
        </button>
    `;
    document.body.appendChild(banner);
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        if (banner.parentElement) {
            banner.remove();
        }
    }, 15000);
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '14px';
    toast.style.maxWidth = '300px';
    toast.textContent = message;
    
    const colors = {
        success: { bg: '#d4edda', text: '#155724' },
        error: { bg: '#f8d7da', text: '#721c24' },
        warning: { bg: '#fff3cd', text: '#856404' },
        info: { bg: '#d1ecf1', text: '#0c5460' }
    };
    
    const color = colors[type] || colors.info;
    toast.style.background = color.bg;
    toast.style.color = color.text;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

/**
 * Open monster selection modal
 */
export function openMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'flex';
    
    const searchInput = document.getElementById('monsterSearch');
    searchInput.value = '';
    searchInput.focus();
    
    // Initial render
    renderMonsterList('');
}

/**
 * Close monster selection modal
 */
export function closeMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'none';
    currentEncounterIndex = null;
}

/**
 * Render monster list based on search term
 * @param {string} searchTerm - Search filter
 */
export function renderMonsterList(searchTerm) {
    const monsterList = document.getElementById('monsterList');
    const monsterCount = document.getElementById('monsterCount');
    
    // Get all monsters sorted by CR
    const allMonsters = Object.keys(window.DND_MONSTERS).sort((a, b) => {
        const crA = parseCR(window.DND_MONSTERS[a].cr);
        const crB = parseCR(window.DND_MONSTERS[b].cr);
        return crA - crB;
    });
    
    // Filter by search term
    const searchLower = searchTerm.toLowerCase();
    const filtered = searchTerm ? 
        allMonsters.filter(name => name.toLowerCase().includes(searchLower)) :
        allMonsters;
    
    monsterCount.textContent = `Showing ${filtered.length} of ${allMonsters.length} monsters`;
    
    if (filtered.length === 0) {
        monsterList.innerHTML = '<div class="no-results">No monsters found. Try a different search term.</div>';
        return;
    }
    
    // Render monster items (limit to 50 for performance)
    const displayList = filtered.slice(0, 50);
    monsterList.innerHTML = displayList.map(name => {
        const monster = window.DND_MONSTERS[name];
        return `
            <div class="monster-item" onclick="selectMonster('${name.replace(/'/g, "\\'")}')">  
                <div class="monster-item-header">
                    <div class="monster-name">${name}</div>
                    <div class="monster-cr">CR ${monster.cr}</div>
                </div>
                <div class="monster-stats">
                    <div class="monster-stat">
                        <span class="monster-stat-label">Type:</span>
                        <span>${monster.type}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">Size:</span>
                        <span>${monster.size}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">Alignment:</span>
                        <span>${monster.alignment}</span>
                    </div>
                    <div class="monster-stat">
                        <span class="monster-stat-label">📖</span>
                        <span>D&D Beyond</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (filtered.length > 50) {
        monsterList.innerHTML += `<div class="no-results">...and ${filtered.length - 50} more. Refine your search to see them.</div>`;
    }
}

/**
 * Select monster and add to encounter
 * @param {string} monsterName - Name of monster to add
 */
export function selectMonster(monsterName) {
    console.log('selectMonster called with:', monsterName);
    const monster = window.DND_MONSTERS[monsterName];
    if (!monster) {
        console.error('Monster not found in DND_MONSTERS:', monsterName);
        console.log('Available monsters:', Object.keys(window.DND_MONSTERS).slice(0, 10));
        alert(`Monster "${monsterName}" not found in monster library.`);
        return;
    }
    
    // Validate we have a valid encounter selected
    if (!window.currentAdventure || !window.currentAdventure.encounters || currentEncounterIndex === null || !window.currentAdventure.encounters[currentEncounterIndex]) {
        console.error('No valid encounter selected');
        alert('Please create an encounter first before adding monsters.');
        closeMonsterModal();
        return;
    }
    
    // Save the encounter index before closing modal
    const encounterIndex = currentEncounterIndex;
    
    // Ensure combatants array exists
    if (!window.currentAdventure.encounters[encounterIndex].combatants) {
        window.currentAdventure.encounters[encounterIndex].combatants = [];
    }
    
    closeMonsterModal();
    
    // Ask for quantity
    const quantity = parseInt(prompt(`How many ${monsterName}(s)?`, '1')) || 1;
    
    // Find existing monsters with the same name to determine starting number
    const existingCombatants = window.currentAdventure.encounters[encounterIndex].combatants;
    let maxNumber = 0;
    
    // Check for existing monsters with this name
    existingCombatants.forEach(combatant => {
        // Skip player combatants (they don't have a name field)
        if (!combatant.name) return;
        
        // Check if name matches pattern "MonsterName" or "MonsterName N"
        if (combatant.name === monsterName) {
            maxNumber = Math.max(maxNumber, 1);
        } else if (combatant.name.startsWith(monsterName + ' ')) {
            const numMatch = combatant.name.match(new RegExp(`^${monsterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`));
            if (numMatch) {
                maxNumber = Math.max(maxNumber, parseInt(numMatch[1]));
            }
        }
    });
    
    // If there's an unnumbered monster and we're adding more, rename it to "MonsterName 1"
    if (maxNumber === 1) {
        const unnumbered = existingCombatants.find(c => c.name === monsterName);
        if (unnumbered) {
            unnumbered.name = `${monsterName} 1`;
        }
    }
    
    // Add monster(s) to the encounter
    for (let i = 0; i < quantity; i++) {
        const number = maxNumber + i + 1;
        const name = (quantity > 1 || maxNumber > 0) ? `${monsterName} ${number}` : monsterName;
        window.currentAdventure.encounters[encounterIndex].combatants.push({
            name: name,
            initiative: 0,
            hp: 0,  // Will be fetched from D&D Beyond
            maxHp: 0,  // Will be fetched from D&D Beyond
            ac: 10,  // Will be fetched from D&D Beyond
            cr: monster.cr,
            dndBeyondUrl: monster.url,
            notes: ''
        });
    }
    
    console.log(`Added ${quantity}x ${monsterName} to encounter`);
    
    // Call global renderer and auto-save (exposed from legacy script.js)
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
    
    // Fetch detailed stats from D&D Beyond (JIT)
    fetchMonsterDetails(monster.url, encounterIndex, monsterName);
}

/**
 * Fetch monster details from D&D Beyond (JIT)
 * @param {string} monsterUrl - D&D Beyond URL
 * @param {number} encounterIndex - Encounter index
 * @param {string} monsterName - Monster name
 */
export async function fetchMonsterDetails(monsterUrl, encounterIndex, monsterName) {
    if (!monsterUrl) {
        console.log('No URL provided for monster details');
        return;
    }
    
    try {
        console.log(`Fetching details for ${monsterName} from D&D Beyond...`);
        showToast(`Fetching ${monsterName} details from D&D Beyond...`, 'info', 2000);
        
        // URL encode just the URL part for the API
        const encodedUrl = encodeURIComponent(monsterUrl);
        const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            console.error(`Failed to fetch monster details: ${data.error}`);
            
            // Check if this is an authentication failure (expired cookies)
            if (data.auth_failed) {
                showCookieExpirationWarning(monsterName);
            }
            
            showToast(`Failed to fetch ${monsterName} details: ${data.error}`, 'error', 5000);
            return;
        }
        
        const details = data.details;
        
        // Check if we got any useful data
        if (!details.ac && !details.hp) {
            console.warn(`No AC or HP found for ${monsterName}`);
            showToast(`No stats found for ${monsterName} - please enter manually`, 'warning', 5000);
            return;
        }
        
        // Update all combatants with this monster name that have default values
        const encounter = window.currentAdventure.encounters[encounterIndex];
        if (!encounter || !encounter.combatants) return;
        
        let updated = 0;
        encounter.combatants.forEach(combatant => {
            // Skip player combatants (they don't have a name field)
            if (!combatant.name) return;
            
            // Check if this is a monster we just added (name matches or is numbered version)
            const isMatch = combatant.name === monsterName || 
                           combatant.name.startsWith(monsterName + ' ');
            
            if (isMatch && combatant.dndBeyondUrl === monsterUrl) {
                // Only update if values are still at defaults
                if (details.ac && combatant.ac === 10) {
                    combatant.ac = details.ac;
                }
                if (details.hp && combatant.maxHp === 0) {
                    combatant.maxHp = details.hp;
                    combatant.hp = details.hp;  // Set current HP to max
                }
                // Always update CR if available from D&D Beyond (more accurate than monster list)
                if (details.cr) {
                    combatant.cr = details.cr;
                }
                // Store initiative bonus for proper sorting
                if (details.initiativeModifier !== undefined) {
                    combatant.initiativeBonus = details.initiativeModifier;
                }
                // Store DEX score for tiebreaker sorting
                if (details.abilities && details.abilities.dex) {
                    combatant.dexScore = details.abilities.dex.score;
                }
                // Store avatar URL if available
                if (details.avatarUrl) {
                    combatant.avatarUrl = details.avatarUrl;
                }
                updated++;
            }
        });
        
        if (updated > 0) {
            console.log(`Updated ${updated} combatant(s) with fetched details`);
            const statsMsg = [];
            if (details.ac) statsMsg.push(`AC ${details.ac}`);
            if (details.hp) statsMsg.push(`HP ${details.hp}`);
            if (details.initiativeModifier !== undefined) {
                statsMsg.push(`Init ${details.initiativeModifier >= 0 ? '+' : ''}${details.initiativeModifier}`);
            }
            showToast(`✓ ${monsterName}: ${statsMsg.join(', ')}`, 'success');
            
            // Re-render encounters with updated stats
            if (window.renderEncounters) window.renderEncounters();
            if (window.autoSave) window.autoSave();
        } else {
            showToast(`No combatants updated for ${monsterName}`, 'warning');
        }
        
        // Roll initiative for newly added monsters if we have the modifier
        if (details.initiativeModifier !== undefined) {
            encounter.combatants.forEach(combatant => {
                // Skip player combatants (they don't have a name field)
                if (!combatant.name) return;
                
                const isMatch = combatant.name === monsterName || 
                               combatant.name.startsWith(monsterName + ' ');
                
                if (isMatch && combatant.dndBeyondUrl === monsterUrl && combatant.initiative === 0) {
                    // Roll d20 + modifier
                    const d20 = Math.floor(Math.random() * 20) + 1;
                    combatant.initiative = d20 + details.initiativeModifier;
                    console.log(`Rolled initiative for ${combatant.name}: ${d20} + ${details.initiativeModifier} = ${combatant.initiative}`);
                }
            });
            
            // Re-render with initiative rolls
            if (window.renderEncounters) window.renderEncounters();
            if (window.autoSave) window.autoSave();
        }
        
    } catch (error) {
        console.error('Error fetching monster details:', error);
        showToast(`Error fetching ${monsterName} details: ${error.message}`, 'error', 5000);
    }
}

/**
 * Add monster from library - opens modal for selection
 * @param {number} encounterIndex - Index of encounter to add monster to
 */
export async function addMonsterFromLibrary(encounterIndex) {
    // Ensure monsters are loaded
    if (!window.monstersLoaded) {
        if (window.loadMonsters) {
            await window.loadMonsters();
        }
    }
    
    currentEncounterIndex = encounterIndex;
    openMonsterModal();
}
/**
 * Load monsters from D&D Beyond
 * @returns {Promise<boolean>} True if monsters loaded successfully
 */
export async function loadMonsters() {
    if (window.monstersLoaded) return true;
    
    console.log('Loading monsters from backend proxy...');
    
    // Use backend proxy (bypasses CORS)
    try {
        const response = await fetch('/api/dndbeyond/monsters');
        const data = await response.json();
        
        if (data.success && data.monsters && Object.keys(data.monsters).length > 0) {
            window.DND_MONSTERS = data.monsters;
            window.monstersLoaded = true;
            console.log(`✓ Loaded ${Object.keys(window.DND_MONSTERS).length} monsters from D&D Beyond`);
            updateAuthButton(true);
            return true;
        } else {
            throw new Error(data.error || 'No monsters returned');
        }
    } catch (error) {
        console.error('Failed to load monsters from D&D Beyond:', error);
        window.DND_MONSTERS = {};
        window.monstersLoaded = false;
        updateAuthButton(false);
        return false;
    }
}

/**
 * Update authentication button UI
 * @param {boolean} authenticated - Whether user is authenticated
 */
export function updateAuthButton(authenticated) {
    const btn = document.getElementById('authDndBeyondBtn');
    if (btn) {
        if (authenticated) {
            btn.textContent = '✓ D&D Beyond Connected';
            btn.style.background = '#2ecc71';
        } else {
            btn.textContent = '🔒 Connect D&D Beyond';
            btn.style.background = '#e8491d';
        }
    }
}
