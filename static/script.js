// Global state - Use var so these become window properties (accessible from modular code)
var currentAdventure = null;
var currentChapter = null;
var autoSaveTimeout = null;
var DND_MONSTERS = {}; // Will be populated dynamically or use fallback
var MONSTER_DETAILS_CACHE = {}; // Client-side cache for full monster details (with abilities, actions, etc.)
var monstersLoaded = false;
var hasCookies = false; // Track cookie authentication status
var playersExpanded = true; // Track players section state
var playersEditMode = false; // Track players edit mode
var encounterEditMode = {}; // Track edit mode for completed encounters by index
var cachedSpectatorUrl = null; // Cached spectator URL to prevent flashing
var crFetchStatus = {}; // Track CR fetch status to prevent duplicate fetches: {encounterIndex_combatantIndex: true}
var monsterDetailsFetchStatus = {}; // Track monster details fetch status to prevent duplicate fetches: {entityUrl: true}

// D&D 5e/2024 Classes
const DND_CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

// D&D 5e/2024 Races
const DND_RACES = [
    'Aarakocra', 'Aasimar', 'Bugbear', 'Dragonborn', 'Dwarf', 'Elf', 'Firbolg', 
    'Genasi', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Half-Orc', 'Halfling', 
    'Hobgoblin', 'Human', 'Kenku', 'Kobold', 'Leonin', 'Lizardfolk', 'Orc', 
    'Satyr', 'Tabaxi', 'Tiefling', 'Tortle', 'Triton', 'Warforged', 'Yuan-ti'
];

// Expose globally for modular code
window.DND_CLASSES = DND_CLASSES;
window.DND_RACES = DND_RACES;

// CR to XP mapping (D&D 5e)
const CR_TO_XP = {
    '0': 10,
    '1/8': 25,
    '1/4': 50,
    '1/2': 100,
    '1': 200,
    '2': 450,
    '3': 700,
    '4': 1100,
    '5': 1800,
    '6': 2300,
    '7': 2900,
    '8': 3900,
    '9': 5000,
    '10': 5900,
    '11': 7200,
    '12': 8400,
    '13': 10000,
    '14': 11500,
    '15': 13000,
    '16': 15000,
    '17': 18000,
    '18': 20000,
    '19': 22000,
    '20': 25000,
    '21': 33000,
    '22': 41000,
    '23': 50000,
    '24': 62000,
    '25': 75000,
    '26': 90000,
    '27': 105000,
    '28': 120000,
    '29': 135000,
    '30': 155000
};

// Expose CR_TO_XP globally for encounterRenderer
window.CR_TO_XP = CR_TO_XP;

// D&D 5e XP thresholds for leveling
const LEVEL_THRESHOLDS = [
    { level: 1, xp: 0, color: '#ecf0f120' },
    { level: 2, xp: 300, color: '#d5e8d420' },
    { level: 3, xp: 900, color: '#d4edda20' },
    { level: 4, xp: 2700, color: '#cfe2ff20' },
    { level: 5, xp: 6500, color: '#e2e3e520' },
    { level: 6, xp: 14000, color: '#fff3cd20' },
    { level: 7, xp: 23000, color: '#ffe69c20' },
    { level: 8, xp: 34000, color: '#f8d7da20' },
    { level: 9, xp: 48000, color: '#f5c2c720' },
    { level: 10, xp: 64000, color: '#d1e7dd20' },
    { level: 11, xp: 85000, color: '#cff4fc20' },
    { level: 12, xp: 100000, color: '#e7e7e720' },
    { level: 13, xp: 120000, color: '#e0cffc20' },
    { level: 14, xp: 140000, color: '#ffd6cc20' },
    { level: 15, xp: 165000, color: '#d0f0c020' },
    { level: 16, xp: 195000, color: '#ffeaa720' },
    { level: 17, xp: 225000, color: '#ffe5d020' },
    { level: 18, xp: 265000, color: '#f7d6e620' },
    { level: 19, xp: 305000, color: '#d6eaf820' },
    { level: 20, xp: 355000, color: '#ffd70020' }
];

// Common D&D conditions
const DND_CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 
    'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 
    'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentrating',
    'Blessed', 'Hasted', 'Raging', 'Hidden'
];

// Condition icons mapping
const CONDITION_ICONS = {
    'Blinded': '🙈',
    'Charmed': '💖',
    'Deafened': '🔇',
    'Frightened': '😱',
    'Grappled': '🤼',
    'Incapacitated': '😵',
    'Invisible': '👻',
    'Paralyzed': '🧊',
    'Petrified': '🗿',
    'Poisoned': '☠️',
    'Prone': '⬇️',
    'Restrained': '⛓️',
    'Stunned': '💫',
    'Unconscious': '⚰️',
    'Concentrating': '⚡',
    'Blessed': '✨',
    'Hasted': '⏩',
    'Raging': '💢',
    'Hidden': '🫥'
};

// Expose globally for encounterRenderer
window.DND_CONDITIONS = DND_CONDITIONS;
window.CONDITION_ICONS = CONDITION_ICONS;

// Load monsters from D&D Beyond
async function loadMonsters() {
    if (monstersLoaded) return true;
    
    console.log('Loading monsters from backend proxy...');
    
    // Use backend proxy (bypasses CORS)
    try {
        const response = await fetch('/api/dndbeyond/monsters');
        const data = await response.json();
        
        // console.log('Backend response:', data); // Removed - logging large objects causes slowdown
        
        if (data.success && data.monsters && Object.keys(data.monsters).length > 0) {
            DND_MONSTERS = data.monsters;
            monstersLoaded = true;
            console.log(`✓ Loaded ${Object.keys(DND_MONSTERS).length} monsters from D&D Beyond`);
            updateAuthButton(true);
            return true;
        } else {
            throw new Error(data.error || 'No monsters returned');
        }
    } catch (error) {
        console.warn('Could not load from D&D Beyond, using fallback library:', error);
        // Use fallback monsters
        DND_MONSTERS = FALLBACK_MONSTERS;
        monsterserror('Failed to load monsters from D&D Beyond:', error);
        DND_MONSTERS = {};
        monstersLoaded = false;
        updateAuthButton(false);
        return false;
    }
}

// [MOVED] openAttackResultModal → eventHandlers.js

// [MOVED] closeAttackResultModal → eventHandlers.js

// Apply damage from attack result to selected player
function applyAttackResultToPlayer(playerIdx, resultHtml) {
    if (playerIdx === null || playerIdx === undefined || isNaN(playerIdx)) {
        return;
    }
    
    // Get the current encounter
    const idxToUse = Number(window.currentEncounterIndex);
    if (
        typeof currentAdventure !== 'object' ||
        !Array.isArray(currentAdventure.encounters) ||
        typeof idxToUse !== 'number' ||
        isNaN(idxToUse) ||
        !currentAdventure.encounters[idxToUse]
    ) {
        console.warn('[DMG] Invalid currentEncounterIndex, not updating any encounter.');
        return;
    }
    
    const encounter = currentAdventure.encounters[idxToUse];
    const combatants = encounter.combatants;
    const player = currentAdventure.players[playerIdx];
    
    // Find player combatant in this encounter
    let playerCombatant = null;
    if (combatants && player) {
        const playerId = player.dndBeyondUrl ? (player.dndBeyondUrl.split('/').pop() || player.dndBeyondUrl) : player.id;
        playerCombatant = combatants.find(c => {
            const cid = c.dndBeyondUrl ? (c.dndBeyondUrl.split('/').pop() || c.dndBeyondUrl) : c.id;
            return cid && playerId && cid == playerId;
        });
        if (!playerCombatant) {
            playerCombatant = combatants.find(c => c.name === player.name);
        }
    }
    
    // Parse damage from resultHtml
    let damage = 0;
    const critFail = /Critical Failure/.test(resultHtml);
    if (!critFail) {
        const dmgMatch = resultHtml.match(/<b>Damage:<\/b>\s*([^<]+)/i);
        if (dmgMatch) {
            const nums = dmgMatch[1].match(/-?\d+/g);
            if (nums) {
                damage = nums.map(Number).reduce((a, b) => a + b, 0);
            }
        }
    }
    
    // Apply damage to player HP
    if (damage > 0) {
        if (playerCombatant && typeof playerCombatant.hp === 'number') {
            playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
        } else if (player && typeof player.hp === 'number') {
            player.hp = Math.max(0, player.hp - damage);
        }
    }
    
    // Increment NPC DMG
    if (combatants) {
        const npc = combatants.find(c => typeof c.dmg === 'number' && (!c.id || !currentAdventure.players.some(p => p.id === c.id)));
        if (npc) {
            npc.dmg = (npc.dmg || 0) + damage;
        }
    }
    
    // Re-render and save
    if (typeof renderEncounters === 'function') renderEncounters();
    autoSave();
    closeAttackResultModal();
}

// Returns a CSS class for a given damage type (for color-coding)
function getDamageTypeClass(type) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t.includes('fire')) return 'damage-fire';
    if (t.includes('cold')) return 'damage-cold';
    if (t.includes('acid')) return 'damage-acid';
    if (t.includes('poison')) return 'damage-poison';
    if (t.includes('psychic')) return 'damage-psychic';
    if (t.includes('necrotic')) return 'damage-necrotic';
    if (t.includes('radiant')) return 'damage-radiant';
    if (t.includes('force')) return 'damage-force';
    if (t.includes('lightning')) return 'damage-lightning';
    if (t.includes('thunder')) return 'damage-thunder';
    if (t.includes('bludgeoning')) return 'damage-bludgeoning';
    if (t.includes('piercing')) return 'damage-piercing';
    if (t.includes('slashing')) return 'damage-slashing';
    return '';
}

// Event listener for [roll] button clicks
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('roll-attack-btn')) {
        e.stopPropagation();
        e.preventDefault();
        
        // Hide the tooltip so it doesn't block the modal
        hideMonsterTooltip();
        
        // Get encounter index and action index
        const tooltipDiv = e.target.closest('.monster-tooltip-section');
        const encounterIndex = tooltipDiv ? parseInt(tooltipDiv.getAttribute('data-encounter-index')) : null;
        const actionIdx = parseInt(e.target.getAttribute('data-action-idx'));
        const entityName = e.target.getAttribute('data-entity-name');
        const monsterId = e.target.getAttribute('data-monster-id');
        
        if (encounterIndex !== null) {
            window.currentEncounterIndex = encounterIndex;
        }
        
        // Get monster details
        let monsterDetails = null;
        if (monsterId && DND_MONSTERS && DND_MONSTERS[monsterId]) {
            monsterDetails = DND_MONSTERS[monsterId];
        }
        
        function handleRollWithDetails(details) {
            if (!details || !details.actions || !details.actions[actionIdx]) {
               openAttackResultModal('<span style="color:#e74c3c;">Action not found.</span>');
                return;
            }
            
            const action = details.actions[actionIdx];
            const actionName = action.name;
            const actionDesc = action.description;
            
            // Detect saving throw
            const saveMatch = actionDesc.match(/DC (\d+) ([A-Za-z]+) saving throw/i);
            
            // Parse damage expressions (handle formats like "5(1d6 + 2)piercing" or "5 (1d6 + 2) piercing")
            const damageParts = [];
            const diceDamageRegex = /([0-9]+)\s*\(([^)]+)\)\s*([A-Za-z]+)\s*damage/g;
            let match;
            while ((match = diceDamageRegex.exec(actionDesc)) !== null) {
                damageParts.push({
                    dice: match[2].replace(/\s+/g, ''),
                    type: match[3]
                });
            }
            
            // Roll damage
            function rollDiceExpression(expr) {
                const diceMatch = expr.match(/([0-9]+)d([0-9]+)(?:\+([0-9]+))?/);
                if (!diceMatch) return null;
                const num = parseInt(diceMatch[1]);
                const sides = parseInt(diceMatch[2]);
                const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
                let total = 0;
                for (let i = 0; i < num; i++) {
                    total += Math.floor(Math.random() * sides) + 1;
                }
                return total + bonus;
            }
            
            const damageRolls = damageParts.map(part => {
                const rolled = rollDiceExpression(part.dice);
                return { rolled, type: part.type, dice: part.dice };
            });
            
            const totalDamage = damageRolls.reduce((sum, r) => sum + (r.rolled || 0), 0);
            
            // Format damage output with color-coding
            const damageHtml = damageRolls.map(r => {
                const typeClass = getDamageTypeClass(r.type);
                const typeSpan = `<span class="${typeClass}" style="font-weight:bold;">${r.type}</span>`;
                return `${r.rolled} ${typeSpan} (${r.dice})`;
            }).join(', ');
            
            // Build result HTML
            let resultHtml = '';
            if (saveMatch) {
                const dc = saveMatch[1];
                const saveType = saveMatch[2];
                resultHtml = `<div><b>Each target must make a DC ${dc} ${saveType} saving throw.</b></div>`;
                resultHtml += `<div style="margin-top:8px;"><b>Damage:</b> ${damageHtml}</div>`;
            } else {
                // Parse attack bonus (handle formats like "+4to hit" or "+4 to hit")
                let attackBonus = 0;
                const attackMatch = actionDesc.match(/\+?([0-9]+)\s*to\s*hit/);
                if (attackMatch) {
                    attackBonus = parseInt(attackMatch[1]);
                }
                
                // Roll attack
                const d20 = Math.floor(Math.random() * 20) + 1;
                const attackTotal = d20 + attackBonus;
                
                let critMsg = '';
                if (d20 === 1) critMsg = '<span style="color:#e74c3c;">Critical Failure!</span>';
                if (d20 === 20) critMsg = '<span style="color:#2ecc71;">Critical Success!</span>';
                
                resultHtml = `<div><b>Attack Roll:</b> d20 (${d20}) + ${attackBonus} = <b>${attackTotal}</b></div>`;
                if (critMsg) resultHtml += `<div style="margin-top:4px;">${critMsg}</div>`;
                resultHtml += `<div style="margin-top:8px;"><b>Damage:</b> ${damageHtml}</div>`;
            }
            
            openAttackResultModal(resultHtml);
        }
        
        // Use cached details or fetch from API
        if (monsterDetails && monsterDetails.actions && monsterDetails.actions.length > actionIdx) {
            handleRollWithDetails(monsterDetails);
        } else if (monsterId) {
            fetch(`/api/dndbeyond/monster/${encodeURIComponent(monsterId)}`)
                .then(response => response.json())
                .then(data => {
                    const details = data.details || data.data || data;
                    if (details && details.actions) {
                        handleRollWithDetails(details);
                    } else {
                        openAttackResultModal('<span style="color:#e74c3c;">Action not found (API).</span>');
                    }
                })
                .catch(error => {
                    console.error('Error fetching monster details:', error);
                    openAttackResultModal('<span style="color:#e74c3c;">Failed to fetch monster details.</span>');
                });
        } else {
            openAttackResultModal('<span style="color:#e74c3c;">Monster details not found.</span>');
        }
    }
});

// ==================== END ATTACK ROLL MODAL ====================

// Update auth button appearance
function updateAuthButton(authenticated) {
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

// ==================== INITIALIZATION ====================
// Note: All event handling and initialization now managed by app.js (modular architecture)
// This script provides rendering functions only

// [MOVED] togglePlayersSection → eventHandlers.js

// [MOVED] openStatisticsInNewWindow → eventHandlers.js

// [MOVED] openSettingsModal → eventHandlers.js

// [MOVED] closeSettingsModal → eventHandlers.js

// [MOVED] openAdventureSettingsModal → eventHandlers.js

// [MOVED] closeAdventureSettingsModal → eventHandlers.js

async function saveAdventurePin() {
    const pinInput = document.getElementById('adventurePinInput');
    const pin = pinInput.value.trim();
    
    // Validate PIN (must be empty or 4 digits)
    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
        alert('PIN must be exactly 4 digits or empty');
        pinInput.focus();
        return;
    }
    
    // Get current adventure name
    const adventureName = currentAdventure.name;
    
    // Check if PIN is actually changing
    const oldPin = currentAdventure.pin || '';
    const pinChanged = oldPin !== pin;
    
    // Update adventure with new PIN (or remove if empty)
    if (pin) {
        currentAdventure.pin = pin;
        // Increment PIN version to invalidate all existing sessions
        if (pinChanged) {
            currentAdventure.pinVersion = (currentAdventure.pinVersion || 0) + 1;
        }
    } else {
        delete currentAdventure.pin;
        // Increment version even when removing PIN to invalidate sessions
        if (pinChanged) {
            currentAdventure.pinVersion = (currentAdventure.pinVersion || 0) + 1;
        }
    }
    
    // Save adventure with new PIN and version
    const saveResponse = await fetch(`/api/adventure/${adventureName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentAdventure)
    });
    
    if (saveResponse.status === 403) {
        alert('Your session is not valid. Please reload the page and re-enter your PIN.');
        return;
    }
    
    if (!saveResponse.ok) {
        alert('Failed to save PIN. Please try again.');
        return;
    }
    
    // Clear current session if PIN changed
    if (pinChanged) {
        try {
            await fetch(`/api/adventure/${adventureName}/invalidate-sessions`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }
    
    // Close modal and show confirmation
    closeAdventureSettingsModal();
    
    if (pin) {
        alert(`✓ DM Interface PIN set to: ${pin}\n\nUsers loading this adventure will need to enter this PIN.\nSpectator view remains accessible without PIN.\n\nAll existing sessions have been invalidated.`);
    } else {
        alert('✓ PIN protection removed\n\nAnyone can now load this adventure in the DM interface.');
    }
}

// [MOVED] openDamageModal → eventHandlers.js

// [MOVED] confirmDamage → eventHandlers.js

// [MOVED] openHealModal → eventHandlers.js

// [MOVED] confirmHeal → eventHandlers.js

// [MOVED] saveCookies → eventHandlers.js

// [MOVED] clearCookies → eventHandlers.js

function showCookieStatus(message, type) {
    const statusDiv = document.getElementById('cookieStatus');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    const colors = {
        success: '#d4edda',
        error: '#f8d7da',
        warning: '#fff3cd',
        info: '#d1ecf1'
    };
    
    statusDiv.style.background = colors[type] || colors.info;
    statusDiv.style.color = '#333';
}

// Show cookie expiration warning (used by tooltip and monster fetching)
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

// [MOVED] showToast → helpers.js



// Authenticate with D&D Beyond
function authenticateDndBeyond() {
    openSettingsModal();
}

// Load adventures list
async function loadAdventuresList() {
    const response = await fetch('/api/adventures');
    const adventures = await response.json();
    
    const select = document.getElementById('adventureSelect');
    select.innerHTML = '<option value="">-- Select Adventure --</option>';
    
    adventures.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Handle adventure selection
// Player rendering [MOVED TO playerRenderer.js]
// - renderPlayers() - Main rendering with edit/view modes
// - sortPlayers(field) - Sort players by field
// - togglePlayerStats(index) - Expand/collapse ability scores
// - updatePlayer(index, field, value) - Update player field
// - updatePlayerAbility(index, ability, value) - Update ability score
// - updatePlayerSkillProf(index, skill, isProficient) - Update skill proficiency
// - removePlayer(index) - Remove player
// - editPlayerUrl(index) - Edit D&D Beyond URL
// - togglePlayersEditMode() - Toggle edit mode
// All now use event delegation instead of inline onclick handlers

// Encounter rendering [MOVED TO encounterRenderer.js]
// All ~35 encounter functions (~1420 lines) moved to static/renderers/encounterRenderer.js
// Functions include:
//   Utilities: isPlayerCombatant, getCombatantName, getDexScore
//   Calculations: calculateEncounterXP, calculateDefaultEncounterCR, getEncounterCR, parseCR, formatCR
//   Drag & Drop: handleDragStart, handleDragOver, handleDrop, handleDragEnd
//   Main Rendering: renderEncounters, createEncounterCard
//   Management: toggleEncounterMinimize, updateEncounterName, updateEncounterCR, removeEncounter, resetEncounter, toggleEncounterEdit
//   Combatants: addCustomCombatant, updateCombatant, removeCombatant, sortInitiative, refreshPlayers, refreshMonsterStats
//   Special Features: toggleDeathSave, openConditionsDialog, saveConditions, clearConditions, generateLoot, clearLoot, updateTreasure
//   State Management: startEncounter, endEncounter, nextTurn, previousTurn
//   Helpers: fetchCRFromCache, updateSpectatorUrl, copySpectatorUrl, closeConditionsModal
//
// All functions exposed globally via window.* for onclick handler compatibility

// [MOVED] Tooltip system → tooltipManager.js
// - createTooltipElement
// - formatModifier
// - formatActionDescription
// - renderTooltipContent
// - isCharacterUrl
// - showMonsterTooltip
// - hideMonsterTooltip
