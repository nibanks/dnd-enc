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

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipMonster = null;

function createTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'monster-tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
}

function formatModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Format action description text with proper spacing and bold keywords
function formatActionDescription(text) {
    if (!text) return '';
    
    // Add space after periods before capital letters (e.g., "ft.Hit:" -> "ft. Hit:")
    text = text.replace(/\.([A-Z])/g, '. $1');
    
    // Add space after colons before numbers/text (e.g., "Roll:+3" -> "Roll: +3")
    text = text.replace(/:([+\-0-9])/g, ': $1');
    
    // Add space before "to hit" (e.g., "+4to hit" -> "+4 to hit")
    text = text.replace(/(\d+)(to\s+hit)/gi, '$1 $2');
    
    // Add spaces around parenthesized dice rolls (e.g., "4(1d4 + 2)piercing" -> "4 (1d4 + 2) piercing")
    text = text.replace(/(\d+)\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)([A-Za-z])/g, '$1 ($2) $3');
    
    // Bold attack roll patterns (e.g., "Melee Attack Roll", "Ranged Attack Roll", "Melee Weapon Attack")
    text = text.replace(/(Melee|Ranged)\s+(Weapon\s+)?(Attack|Spell\s+Attack)(\s+Roll)?/gi, '<strong>$&</strong>');
    
    // Bold damage types
    const damageTypes = [
        'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 
        'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'
    ];
    damageTypes.forEach(type => {
        const regex = new RegExp(`\\b(${type})\\b`, 'gi');
        text = text.replace(regex, '<strong>$1</strong>');
    });
    
    // Bold dice rolls (e.g., "1d4 + 1", "2d6", "1d8 + 3")
    text = text.replace(/\b(\d+d\d+(?:\s*[+\-]\s*\d+)?)\b/gi, '<strong>$1</strong>');
    
    // Bold "Hit:" and "Miss:"
    text = text.replace(/\b(Hit|Miss):/gi, '<strong>$1:</strong>');
    
    return text;
}

// Render tooltip content from entity details
function renderTooltipContent(tooltip, entityName, details, isCharacter = false, encounterIndex = null, entityUrl = null) {
    if (!details) {
        tooltip.innerHTML = '<div class="monster-tooltip-loading">No details available</div>';
        return;
    }
    
    let html = '';
    
    // Header with avatar
    html += '<div class="monster-tooltip-header">';
    
    // Add avatar if available
    if (details.avatarUrl) {
        html += `<img src="${details.avatarUrl}" alt="${entityName}" class="monster-tooltip-avatar" onerror="this.style.display='none'">`;
    }
    
    html += '<div class="monster-tooltip-header-text">';
    html += `<div class="monster-tooltip-title">${entityName}</div>`;
    
    // Meta information
    let meta = [];
    if (isCharacter) {
        // For characters, show summary (e.g., "Level 1 Tiefling Rogue")
        if (details.summary) {
            meta.push(details.summary);
        } else {
            // Build from classes array or flat fields
            if (details.classes && details.classes.length > 0) {
                const classStr = details.classes.map(c => `${c.name} ${c.level}`).join('/');
                meta.push(classStr);
            } else if (details.level && details.class) {
                meta.push(`Level ${details.level} ${details.class}`);
            } else if (details.class) {
                meta.push(details.class);
            }
            if (details.race) meta.push(details.race);
        }
        // Add player name if available and different from character name
        if (details.playerName && details.playerName !== entityName) {
            meta.push(`(${details.playerName})`);
        }
    } else {
        // For monsters, show size/type/alignment
        if (details.size) meta.push(details.size);
        if (details.type) meta.push(details.type);
        if (details.alignment) meta.push(details.alignment);
    }
    if (meta.length > 0) {
        html += `<div class="monster-tooltip-meta">${meta.join(', ')}</div>`;
    }
    html += '</div>'; // Close monster-tooltip-header-text
    html += '</div>'; // Close monster-tooltip-header
    
    // Basic Stats
    html += '<div class="monster-tooltip-stats">';
    if (details.ac) {
        const acDisplay = details.acType ? `${details.ac} (${details.acType})` : details.ac;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">AC:</span><span class="monster-tooltip-stat-value">${acDisplay}</span></div>`;
    }
    // Handle HP - check for object first (character format), then numeric/string (monster format)
    if (details.hp && typeof details.hp === 'object') {
        // Character format: {current: X, max: Y}
        const hpDisplay = details.hp.max ? `${details.hp.current || details.hp.max}/${details.hp.max}` : details.hp.current || details.hp.max;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    } else if (details.hp) {
        // Monster format: numeric HP value
        const hpDisplay = details.hitDice ? `${details.hp} (${details.hitDice})` : details.hp;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    } else if (details.maxHp) {
        // Alternative format: maxHp field
        const hpDisplay = details.hitDice ? `${details.maxHp} (${details.hitDice})` : details.maxHp;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">HP:</span><span class="monster-tooltip-stat-value">${hpDisplay}</span></div>`;
    }
    if (details.speed) {
        const speedDisplay = typeof details.speed === 'number' ? `${details.speed} ft.` : details.speed;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Speed:</span><span class="monster-tooltip-stat-value">${speedDisplay}</span></div>`;
    } else if (details.walkSpeed) {
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Speed:</span><span class="monster-tooltip-stat-value">${details.walkSpeed} ft.</span></div>`;
    }
    // Handle both initiativeBonus (monsters) and initiative (characters)
    const init = details.initiativeBonus !== undefined ? details.initiativeBonus : 
                 details.initiativeModifier !== undefined ? details.initiativeModifier : details.initiative;
    if (init !== undefined) {
        const initDisplay = init >= 0 ? `+${init}` : `${init}`;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Initiative:</span><span class="monster-tooltip-stat-value">${initDisplay}</span></div>`;
    }
    if (!isCharacter && details.cr) {
        const xp = details.xp || CR_TO_XP[details.cr] || '';
        const crDisplay = xp ? `${details.cr} (${xp} XP)` : details.cr;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">CR:</span><span class="monster-tooltip-stat-value">${crDisplay}</span></div>`;
    }
    html += '</div>';
    
    // Ability Scores - handle both old format (nested object) and new format (flat values with separate modifiers)
    const abilities = details.abilities || details.abilityScores;
    const abilityMods = details.ability_modifiers;
    if (abilities) {
        html += '<div class="monster-tooltip-abilities">';
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
            let score, mod;
            if (typeof abilities[ability] === 'object' && abilities[ability] !== null) {
                // Old format: {score: 10, modifier: 0}
                score = abilities[ability].score || 10;
                mod = abilities[ability].modifier !== undefined ? abilities[ability].modifier : formatModifier(score);
            } else if (typeof abilities[ability] === 'number') {
                // New format: abilities[ability] = 10, ability_modifiers[ability] = 0
                score = abilities[ability];
                mod = abilityMods && abilityMods[ability] !== undefined ? abilityMods[ability] : Math.floor((score - 10) / 2);
            } else {
                return; // Skip if no data
            }
            
            const modDisplay = mod >= 0 ? `+${mod}` : `${mod}`;
            html += `<div class="monster-tooltip-ability">
                <div class="monster-tooltip-ability-name">${ability.toUpperCase()}</div>
                <div class="monster-tooltip-ability-score">${score}</div>
                <div class="monster-tooltip-ability-mod">${modDisplay}</div>
            </div>`;
        });
        html += '</div>';
    }
    
    // Saving Throws
    if (details.savingThrows) {
        let saves = '';
        if (typeof details.savingThrows === 'string') {
            saves = details.savingThrows;
        } else if (typeof details.savingThrows === 'object' && Object.keys(details.savingThrows).length > 0) {
            saves = Object.entries(details.savingThrows)
                .map(([ability, bonus]) => `${ability.toUpperCase()} ${bonus >= 0 ? '+' : ''}${bonus}`)
                .join(', ');
        }
        if (saves) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Saving Throws</div>';
            html += `<div class="monster-tooltip-section-content">${saves}</div>`;
            html += '</div>';
        }
    }
    
    // Skills
    if (details.skills) {
        let skillsText = '';
        if (typeof details.skills === 'string') {
            // Parse "Deception+3,Stealth+5" format and add spaces
            skillsText = details.skills.replace(/([a-zA-Z]+)(\+|-)/g, '$1 $2');
        } else if (typeof details.skills === 'object' && Object.keys(details.skills).length > 0) {
            skillsText = Object.entries(details.skills)
                .map(([skill, bonus]) => `${skill} ${bonus >= 0 ? '+' : ''}${bonus}`)
                .join(', ');
        }
        if (skillsText) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Skills</div>';
            html += `<div class="monster-tooltip-section-content">${skillsText}</div>`;
            html += '</div>';
        }
    }
    
    // For characters, show passive senses
    if (isCharacter) {
        let passives = [];
        
        // Calculate passives from ability scores and skill proficiencies if available
        if (details.abilityScores) {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const level = details.level || 1;
            const profBonus = 2 + Math.floor((level - 1) / 4);
            
            const wisScore = details.abilityScores.wis || 10;
            const intScore = details.abilityScores.int || 10;
            const wisMod = calcMod(wisScore);
            const intMod = calcMod(intScore);
            
            const skillProfs = details.skillProficiencies || {};
            
            const passivePerception = 10 + wisMod + (skillProfs.perception ? profBonus : 0);
            const passiveInvestigation = 10 + intMod + (skillProfs.investigation ? profBonus : 0);
            const passiveInsight = 10 + wisMod + (skillProfs.insight ? profBonus : 0);
            
            passives.push(`Perception ${passivePerception}`);
            passives.push(`Investigation ${passiveInvestigation}`);
            passives.push(`Insight ${passiveInsight}`);
        } else {
            // Fallback to pre-calculated values if available
            if (details.passivePerception) passives.push(`Perception ${details.passivePerception}`);
            if (details.passiveInvestigation) passives.push(`Investigation ${details.passiveInvestigation}`);
            if (details.passiveInsight) passives.push(`Insight ${details.passiveInsight}`);
        }
        
        if (passives.length > 0) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Passive Senses</div>';
            html += `<div class="monster-tooltip-section-content">${passives.join(', ')}</div>`;
            html += '</div>';
        }
    }
    
    // Resistances/Immunities (for monsters)
    if (!isCharacter) {
        if (details.damageResistances) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Resistances</div>';
            html += `<div class="monster-tooltip-section-content">${details.damageResistances}</div>`;
            html += '</div>';
        }
        if (details.damageImmunities) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Immunities</div>';
            html += `<div class="monster-tooltip-section-content">${details.damageImmunities}</div>`;
            html += '</div>';
        }
        if (details.conditionImmunities) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Condition Immunities</div>';
            html += `<div class="monster-tooltip-section-content">${details.conditionImmunities}</div>`;
            html += '</div>';
        }
    }
    
    // Senses
    if (details.senses) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Senses</div>';
        html += `<div class="monster-tooltip-section-content">${details.senses}</div>`;
        html += '</div>';
    }
    
    // Languages
    if (details.languages) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Languages</div>';
        html += `<div class="monster-tooltip-section-content">${details.languages}</div>`;
        html += '</div>';
    }
    
    // Proficiencies (for characters)
    if (isCharacter && details.proficiencies) {
        for (const [label, items] of Object.entries(details.proficiencies)) {
            if (items) {
                html += '<div class="monster-tooltip-section">';
                html += `<div class="monster-tooltip-section-title">${label}</div>`;
                html += `<div class="monster-tooltip-section-content">${items}</div>`;
                html += '</div>';
            }
        }
    }
    
    // Features/Traits
    const featuresLabel = isCharacter ? 'Features & Traits' : 'Traits';
    const featuresArray = details.features || details.traits;
    
    if (featuresArray && featuresArray.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += `<div class="monster-tooltip-section-title">${featuresLabel}</div>`;
        featuresArray.forEach(feature => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${feature.name}</div>`;
            if (feature.description) {
                html += `<div class="monster-tooltip-action-desc">${formatActionDescription(feature.description)}</div>`;
            }
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Actions (for monsters)
    if (!isCharacter && details.actions && details.actions.length > 0) {
        html += `<div class="monster-tooltip-section" data-encounter-index="${encounterIndex !== null ? encounterIndex : ''}">`;
        html += '<div class="monster-tooltip-section-title">Actions</div>';
        details.actions.forEach((action, actionIdx) => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}`;
            
            // Add [roll] button for DM only (if action has dice rolls)
            const hasDiceRolls = action.description && (/\d+d\d+|to hit|DC \d+/i.test(action.description));
            if (hasDiceRolls && currentAdventure) {
                // Extract monster slug from entityUrl (e.g., "https://www.dndbeyond.com/monsters/5174957-scout" -> "scout")
                let monsterIdForBtn = details.slug || details.id || details.name;
                if (!monsterIdForBtn && entityUrl) {
                    const urlMatch = entityUrl.match(/\/monsters\/(\d+-)?([^/?#]+)/);
                    if (urlMatch) {
                        monsterIdForBtn = urlMatch[2]; // Extract just the slug without ID prefix
                    }
                }
                html += ` <button class="roll-attack-btn" data-action-idx="${actionIdx}" data-entity-name="${entityName}" data-monster-id="${monsterIdForBtn}" style="margin-left:8px; padding:2px 6px; font-size:11px; background:#3498db; color:white; border:none; border-radius:3px; cursor:pointer;">[roll]</button>`;
            }
            
            html += `</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(action.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Legendary Actions (for monsters)
    if (!isCharacter && details.legendaryActions && details.legendaryActions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Legendary Actions</div>';
        if (details.legendaryActionsDescription) {
            html += `<div class="monster-tooltip-section-content" style="margin-bottom: 8px;">${formatActionDescription(details.legendaryActionsDescription)}</div>`;
        }
        details.legendaryActions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(action.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Reactions (for monsters)
    if (!isCharacter && details.reactions && details.reactions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Reactions</div>';
        details.reactions.forEach(reaction => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${reaction.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatActionDescription(reaction.description)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    tooltip.innerHTML = html;
}

// Determine if URL is a character or monster based on URL pattern
function isCharacterUrl(url) {
    return url && (url.includes('/profile/') || url.includes('/characters/'));
}

function showMonsterTooltip(entityName, entityUrl, event, encounterIndex = null) {
    clearTimeout(tooltipTimeout);
    
    const tooltip = createTooltipElement();
    
    // Position tooltip near the cursor (fixed position, doesn't follow mouse)
    const positionTooltip = (e) => {
        const x = e.clientX + 15;
        const y = e.clientY + 15;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Set initial position
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
        
        // After rendering, check if it goes off screen and adjust
        requestAnimationFrame(() => {
            const rect = tooltip.getBoundingClientRect();
            
            let finalX = x;
            let finalY = y;
            
            // Adjust horizontal position if off screen
            if (rect.right > viewportWidth - 20) {
                finalX = viewportWidth - rect.width - 20;
            }
            
            // Adjust vertical position if off screen
            if (rect.bottom > viewportHeight - 20) {
                finalY = viewportHeight - rect.height - 20;
            }
            
            // Ensure it's not off the left or top
            finalX = Math.max(10, finalX);
            finalY = Math.max(10, finalY);
            
            tooltip.style.left = finalX + 'px';
            tooltip.style.top = finalY + 'px';
        });
    };
    
    // Store current entity being displayed
    currentTooltipMonster = entityName;
    
    // Add mouse enter/leave handlers to keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        clearTimeout(tooltipTimeout);
    });
    
    tooltip.addEventListener('mouseleave', () => {
        hideMonsterTooltip();
    });
    
    // Check if this is a local player (using player: prefix)
    const isLocalPlayer = entityUrl.startsWith('player:');
    
    // Determine if this is a character or monster
    const isCharacter = isLocalPlayer || isCharacterUrl(entityUrl);
    const entityType = isCharacter ? 'character' : 'monster';
    
    
    // First, try to find the entity in our current encounters or players (it's already loaded)
    let cachedDetails = null;
    
    if (isCharacter && currentAdventure && currentAdventure.players) {
        // Check players list for character details
        for (const player of currentAdventure.players) {
            if (player.name === entityName || (player.dndBeyondUrl === entityUrl) || isLocalPlayer) {
                cachedDetails = player;
                break;
            }
        }
    }
    
    if (!cachedDetails && currentAdventure && currentAdventure.encounters) {
        // Check encounters for cached data
        for (const encounter of currentAdventure.encounters) {
            if (encounter.combatants) {
                for (const combatant of encounter.combatants) {
                    if (combatant.name && combatant.name === entityName && combatant.dndBeyondUrl === entityUrl) {
                        cachedDetails = combatant;
                        break;
                    }
                }
            }
            if (cachedDetails) break;
        }
    }
    
    // If we have cached details with FULL info (abilities present), use them immediately
    // For characters, also use local player data even without abilities
    // For local players (player: prefix), always use local data
    if (cachedDetails && (cachedDetails.abilities || (isCharacter && cachedDetails.ac) || isLocalPlayer)) {
        tooltip.style.display = 'block';
        positionTooltip(event);
        renderTooltipContent(tooltip, entityName, cachedDetails, isCharacter, encounterIndex, entityUrl);
        return;
    }
    
    // If we have incomplete cached details (e.g., just HP/AC from encounter), show them immediately
    // as a preview while we fetch full details in the background
    if (cachedDetails && !isCharacter) {
        const previewHtml = `<div class="monster-tooltip-loading">
            <div style="font-weight: bold; margin-bottom: 8px;">${entityName}</div>
            ${cachedDetails.hp ? `<div>HP: ${cachedDetails.hp}/${cachedDetails.maxHp || cachedDetails.hp}</div>` : ''}
            ${cachedDetails.ac ? `<div>AC: ${cachedDetails.ac}</div>` : ''}
            <div style="margin-top: 8px; font-size: 11px; color: #999;">Loading full details...</div>
        </div>`;
        tooltip.innerHTML = previewHtml;
        tooltip.style.display = 'block';
        positionTooltip(event);
        // Continue to fetch full details below
    }
    
    // If this is a local player but no data found, show error
    if (isLocalPlayer) {
        tooltip.innerHTML = `<div class="monster-tooltip-loading">
            <div style="margin-bottom: 8px;">⚠️ Player data not found</div>
            <div style="font-size: 12px; color: #666;">
                Add this character to the Players section above.
            </div>
        </div>`;
        tooltip.style.display = 'block';
        positionTooltip(event);
        return;
    }
    
    // For monsters, check the MONSTER_DETAILS_CACHE first (client-side cache with full details)
    if (!isCharacter && MONSTER_DETAILS_CACHE[entityUrl]) {
        tooltip.style.display = 'block';
        positionTooltip(event);
        renderTooltipContent(tooltip, entityName, MONSTER_DETAILS_CACHE[entityUrl], isCharacter, encounterIndex, entityUrl);
        return;
    }
    
    // For monsters, check the DND_MONSTERS cache before fetching from server
    // Check even if cachedDetails exists but doesn't have full info (abilities)
    if (!isCharacter && (!cachedDetails || !cachedDetails.abilities) && DND_MONSTERS) {
        // Extract monster slug from URL (e.g., "scout" from "https://www.dndbeyond.com/monsters/5174957-scout")
        const urlMatch = entityUrl.match(/\/monsters\/(\d+-)?([^/?#]+)/);
        if (urlMatch) {
            const monsterIdWithSlug = urlMatch[0].replace('/monsters/', ''); // "5174957-scout"
            const monsterId = urlMatch[1] ? urlMatch[1].replace('-', '') : null; // "5174957"
            const monsterSlug = urlMatch[2]; // "scout"
            
            // Try multiple lookup strategies:
            // 1. Full ID-slug combo
            // 2. Just the ID
            // 3. Capitalized slug (Scout)
            // 4. Lowercase match by name in values
            let monsterData = DND_MONSTERS[monsterIdWithSlug] || 
                             DND_MONSTERS[monsterId] ||
                             DND_MONSTERS[monsterSlug.charAt(0).toUpperCase() + monsterSlug.slice(1)];
            
            if (monsterData && monsterData.abilities) {
                // Only use cache if it has full details (abilities present)
                cachedDetails = monsterData;
                tooltip.style.display = 'block';
                positionTooltip(event);
                renderTooltipContent(tooltip, entityName, cachedDetails, isCharacter, encounterIndex, entityUrl);
                return;
            }
        }
    }
    
    // Otherwise, show loading and fetch from server (unless preview already shown)
    if (!tooltip.innerHTML || tooltip.innerHTML.indexOf('Loading full details') === -1) {
        const loadingText = isCharacter ? 'Loading character details...' : 'Loading monster details...';
        tooltip.innerHTML = `<div class="monster-tooltip-loading">${loadingText}</div>`;
        tooltip.style.display = 'block';
        positionTooltip(event);
    }
    
    // Check if a fetch is already in progress for this entity
    if (monsterDetailsFetchStatus[entityUrl]) {
        return;
    }
    
    // Mark fetch as in progress
    monsterDetailsFetchStatus[entityUrl] = true;
    
    // Fetch details from appropriate endpoint
    const apiEndpoint = isCharacter ? 
        `/api/dndbeyond/character/${encodeURIComponent(entityUrl)}` :
        `/api/dndbeyond/monster/${encodeURIComponent(entityUrl)}`;
    
    const fetchStartTime = performance.now();
    console.log(`[TIMING] Fetch started for ${entityUrl}`);
    
    fetch(apiEndpoint)
        .then(response => {
            const fetchCompleteTime = performance.now();
            console.log(`[TIMING] Fetch complete: ${(fetchCompleteTime - fetchStartTime).toFixed(0)}ms`);
            return response.json();
        })
        .then(data => {
            const jsonParseTime = performance.now();
            console.log(`[TIMING] JSON parsed: ${(jsonParseTime - fetchStartTime).toFixed(0)}ms`);
            
            // Clear fetch status
            delete monsterDetailsFetchStatus[entityUrl];
            
            // Only update if tooltip is still visible (don't check entityName to avoid race conditions)
            if (!tooltipElement || tooltipElement.style.display === 'none') {
                return;
            }
            
            // Check if there was an error
            if (!data.success || data.error) {
                // Check for authentication failure
                if (data.auth_failed) {
                    showCookieExpirationWarning(entityName);
                }
                
                if (isCharacter) {
                    // For characters, fall back to local player data if available
                    if (currentAdventure && currentAdventure.players) {
                        for (const player of currentAdventure.players) {
                            if (player.name === entityName || (player.dndBeyondUrl && player.dndBeyondUrl === entityUrl)) {
                                renderTooltipContent(tooltip, entityName, player, true, encounterIndex, entityUrl);
                                return;
                            }
                        }
                    }
                    // No local data available
                    tooltip.innerHTML = `<div class="monster-tooltip-loading">
                        <div style="margin-bottom: 8px;">⚠️ Character sheet unavailable</div>
                        <div style="font-size: 12px; color: #666;">
                            To fetch live data from D&D Beyond, you need to:<br>
                            1. Log into D&D Beyond in your browser<br>
                            2. Export cookies and save them using the app<br>
                            <br>
                            Or add character stats in the Players table above.
                        </div>
                    </div>`;
                } else {
                    tooltip.innerHTML = `<div class="monster-tooltip-loading">⚠️ ${data.error || 'Failed to load details'}</div>`;
                }
                return;
            }
            
            // Use the details from the response
            const details = data.details || data.data || data;
            
            // Cache the full details for future use (only if it has full data)
            if (!isCharacter && details.abilities) {
                MONSTER_DETAILS_CACHE[entityUrl] = details;
            }
            
            const renderStartTime = performance.now();
            renderTooltipContent(tooltip, entityName, details, isCharacter, encounterIndex, entityUrl);
            const renderCompleteTime = performance.now();
            console.log(`[TIMING] Render complete: ${(renderCompleteTime - fetchStartTime).toFixed(0)}ms (render took ${(renderCompleteTime - renderStartTime).toFixed(0)}ms)`);
            console.log(`[TIMING] TOTAL tooltip load time: ${(renderCompleteTime - fetchStartTime).toFixed(0)}ms`);
            
            // Reposition after content is loaded in case size changed
            positionTooltip(event);
        })
        .catch(error => {
            console.error(`Error fetching ${entityType} details:`, error);
            
            // Clear fetch status
            delete monsterDetailsFetchStatus[entityUrl];
            
            if (tooltipElement && tooltipElement.style.display !== 'none') {
                tooltip.innerHTML = `<div class="monster-tooltip-loading">Failed to load ${entityType} details</div>`;
            }
        });
}

function hideMonsterTooltip() {
    tooltipTimeout = setTimeout(() => {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
            currentTooltipMonster = null;
        }
    }, 100);
}
