// Global state
let currentAdventure = null;
let currentChapter = null;
let autoSaveTimeout = null;
let DND_MONSTERS = {}; // Will be populated dynamically or use fallback
let monstersLoaded = false;
let hasCookies = false; // Track cookie authentication status
let playersExpanded = true; // Track players section state
let playersEditMode = false; // Track players edit mode
let encounterEditMode = {}; // Track edit mode for completed encounters by index
let initiativeChart = null; // Chart instance for initiative distribution
let crChart = null; // Chart instance for CR over time
let damageChart = null; // Chart instance for damage dealt per encounter
let cachedSpectatorUrl = null; // Cached spectator URL to prevent flashing
let crFetchStatus = {}; // Track CR fetch status to prevent duplicate fetches: {encounterIndex_combatantIndex: true}

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

// Load monsters from D&D Beyond
async function loadMonsters() {
    if (monstersLoaded) return true;
    
    console.log('Loading monsters from backend proxy...');
    
    // Use backend proxy (bypasses CORS)
    try {
        const response = await fetch('/api/dndbeyond/monsters');
        const data = await response.json();
        
        console.log('Backend response:', data);
        
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check cookie status first
    await checkCookieStatus();
    
    await loadAdventuresList();
    setupEventListeners();
    // Load monsters from D&D Beyond
    loadMonsters();
    
    // Setup monster search live update
    const monsterSearch = document.getElementById('monsterSearch');
    if (monsterSearch) {
        monsterSearch.addEventListener('input', (e) => {
            renderMonsterList(e.target.value);
        });
    }
    
    // Save scroll position before page unload
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    });
    
    // Auto-load adventure from URL parameter
    const url = new URL(window.location);
    const adventureName = url.searchParams.get('adventure');
    if (adventureName) {
        // Only auto-load if we have cookies
        if (hasCookies) {
            const select = document.getElementById('adventureSelect');
            select.value = adventureName;
            // Trigger the change event to load the adventure
            await handleAdventureChange({ target: select });
        } else {
            // Redirect to home and show settings
            window.history.replaceState({}, '', '/');
            openSettingsModal();
        }
    }
});

function setupEventListeners() {
    document.getElementById('adventureSelect').addEventListener('change', handleAdventureChange);
    document.getElementById('newAdventureBtn').addEventListener('click', createNewAdventure);
    document.getElementById('deleteAdventureBtn').addEventListener('click', deleteCurrentAdventure);
    document.getElementById('chapterSelect').addEventListener('change', handleChapterChange);
    document.getElementById('chapterNotes').addEventListener('input', handleChapterNotesChange);
    document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);
    document.getElementById('addEncounterBtn').addEventListener('click', addEncounter);
    document.getElementById('adventureSettingsBtn').addEventListener('click', openAdventureSettingsModal);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('settingsBtnSelection').addEventListener('click', openSettingsModal);
    
    // Keyboard shortcut for damage tracking (Ctrl+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            e.stopPropagation();
            openDamageModal();
            return false;
        }
        
        // Keyboard shortcut for heal tracking (Ctrl+H)
        if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            e.stopPropagation();
            openHealModal();
            return false;
        }
        
        // Keyboard shortcut for next turn (Ctrl+N)
        if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopPropagation();
            // Find the active encounter
            const activeEncounterIndex = currentAdventure?.encounters?.findIndex(e => e.state === 'started');
            if (activeEncounterIndex !== undefined && activeEncounterIndex >= 0) {
                nextTurn(activeEncounterIndex);
            }
            return false;
        }
        
        // Keyboard shortcut for previous turn (Ctrl+P)
        if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            e.stopPropagation();
            // Find the active encounter
            const activeEncounterIndex = currentAdventure?.encounters?.findIndex(e => e.state === 'started');
            if (activeEncounterIndex !== undefined && activeEncounterIndex >= 0) {
                previousTurn(activeEncounterIndex);
            }
            return false;
        }
        
        // ESC key closes any open modal
        if (e.key === 'Escape') {
            const monsterModal = document.getElementById('monsterModal');
            const settingsModal = document.getElementById('settingsModal');
            const adventureSettingsModal = document.getElementById('adventureSettingsModal');
            const damageModal = document.getElementById('damageModal');
            const healModal = document.getElementById('healModal');
            const conditionsModal = document.getElementById('conditionsModal');
            
            if (monsterModal && monsterModal.style.display === 'flex') {
                closeMonsterModal();
            } else if (settingsModal && settingsModal.style.display === 'flex') {
                closeSettingsModal();
            } else if (adventureSettingsModal && adventureSettingsModal.style.display === 'flex') {
                closeAdventureSettingsModal();
            } else if (damageModal && damageModal.style.display === 'flex') {
                closeDamageModal();
            } else if (healModal && healModal.style.display === 'flex') {
                closeHealModal();
            } else if (conditionsModal) {
                // Save conditions on ESC
                const encounterIndex = parseInt(conditionsModal.getAttribute('data-encounter'));
                const combatantIndex = parseInt(conditionsModal.getAttribute('data-combatant'));
                saveConditions(encounterIndex, combatantIndex);
            }
        }
    }, true);
}

// Toggle players section
function togglePlayersSection() {
    playersExpanded = !playersExpanded;
    const container = document.getElementById('playersTableContainer');
    const btn = document.getElementById('togglePlayersBtn');
    
    if (playersExpanded) {
        container.style.display = 'block';
        btn.textContent = '▼';
    } else {
        container.style.display = 'none';
        btn.textContent = '▶';
    }
}

// Toggle statistics section
let statsExpanded = false;

function toggleStatsSection() {
    statsExpanded = !statsExpanded;
    const container = document.getElementById('statsContainer');
    const btn = document.getElementById('toggleStatsBtn');
    
    if (statsExpanded) {
        container.style.display = 'block';
        btn.textContent = '▼';
        renderStatistics();
    } else {
        container.style.display = 'none';
        btn.textContent = '▶';
    }
}

function renderStatistics() {
    if (!currentAdventure || !currentAdventure.players || !currentAdventure.encounters) {
        return;
    }
    
    renderInitiativeChart();
    renderCRChart();
    renderDamageChart();
}

function renderInitiativeChart() {
    const ctx = document.getElementById('initiativeChart');
    if (!ctx) return;
    
    // Collect initiative data for each player
    const playerInitiatives = {};
    
    // Initialize for each player
    currentAdventure.players.forEach(player => {
        playerInitiatives[player.name] = [];
    });
    
    // Collect all initiative rolls from encounters that have been started
    currentAdventure.encounters.forEach(encounter => {
        // Only include encounters that have been started or completed
        if (encounter.state === 'started' || encounter.state === 'complete') {
            if (encounter.combatants) {
                encounter.combatants.forEach(combatant => {
                    if (isPlayerCombatant(combatant)) {
                        const playerName = getCombatantName(combatant);
                        if (playerInitiatives[playerName] !== undefined) {
                            playerInitiatives[playerName].push(combatant.initiative || 0);
                        }
                    }
                });
            }
        }
    });
    
    // Find min and max initiative across all players
    let minInit = Infinity;
    let maxInit = -Infinity;
    Object.values(playerInitiatives).forEach(initiatives => {
        if (initiatives.length > 0) {
            minInit = Math.min(minInit, ...initiatives);
            maxInit = Math.max(maxInit, ...initiatives);
        }
    });
    
    // If no data, return early
    if (minInit === Infinity || maxInit === -Infinity) {
        return;
    }
    
    // Count frequency of each initiative value for each player
    const datasets = [];
    const colors = [
        '#e74c3c',  // Red
        '#3498db',  // Blue
        '#2ecc71',  // Green
        '#f39c12',  // Orange
        '#9b59b6',  // Purple
        '#e91e63',  // Pink
        '#00bcd4',  // Cyan
        '#ff5722'   // Deep Orange
    ];
    
    let colorIndex = 0;
    Object.entries(playerInitiatives).forEach(([playerName, initiatives]) => {
        if (initiatives.length === 0) return;
        
        // Count frequency
        const frequency = {};
        initiatives.forEach(init => {
            frequency[init] = (frequency[init] || 0) + 1;
        });
        
        // Create data points for all initiative values from min to max
        const data = [];
        for (let i = minInit; i <= maxInit; i++) {
            data.push({
                x: i,
                y: frequency[i] || 0
            });
        }
        
        const color = colors[colorIndex % colors.length];
        datasets.push({
            label: playerName,
            data: data,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        });
        
        colorIndex++;
    });
    
    // Destroy existing chart if it exists
    if (initiativeChart) {
        initiativeChart.destroy();
    }
    
    // Create new chart
    initiativeChart = new Chart(ctx, {
        type: 'bar',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' time(s) at initiative ' + context.parsed.x;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Initiative Score'
                    },
                    ticks: {
                        stepSize: 1
                    },
                    stacked: true
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Count'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    },
                    beginAtZero: true,
                    stacked: true
                }
            }
        }
    });
}

function renderCRChart() {
    const canvas = document.getElementById('crChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Calculate total CR for each encounter using the proper calculation
    const encounterData = [];
    
    currentAdventure.encounters.forEach((encounter, index) => {
        const crString = getEncounterCR(encounter);
        let crValue = 0;
        
        // Convert CR string to numeric value for chart
        if (crString.includes('/')) {
            const parts = crString.split('/');
            crValue = parseInt(parts[0]) / parseInt(parts[1]);
        } else {
            crValue = parseFloat(crString) || 0;
        }
        
        encounterData.push({
            x: index + 1,
            y: crValue,
            label: encounter.name || `Encounter ${index + 1}`,
            state: encounter.state
        });
    });
    
    // Destroy existing chart if it exists
    if (crChart) {
        crChart.destroy();
    }
    
    // Create new chart
    crChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Total Encounter CR',
                data: encounterData,
                borderColor: '#e74c3c',
                backgroundColor: '#e74c3c20',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: encounterData.map(d => d.state === 'complete' ? '#e74c3c' : '#3498db'),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                segment: {
                    borderColor: ctx => {
                        const curr = ctx.p1DataIndex;
                        return encounterData[curr]?.state === 'complete' ? '#e74c3c' : '#3498db';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return encounterData[context[0].dataIndex].label;
                        },
                        label: function(context) {
                            return 'Total CR: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Encounter Number'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Challenge Rating'
                    },
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    }
                }
            }
        }
    });
}

function renderDamageChart() {
    const canvas = document.getElementById('damageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Collect all player names
    const playerNames = currentAdventure.players?.map(p => p.name) || [];
    
    // Colors for players (matching initiative chart)
    const colors = [
        '#e74c3c',  // Red
        '#3498db',  // Blue
        '#2ecc71',  // Green
        '#f39c12',  // Orange
        '#9b59b6',  // Purple
        '#e91e63',  // Pink
        '#00bcd4',  // Cyan
        '#ff5722'   // Deep Orange
    ];
    
    // Build datasets for each player + "Other"
    const datasets = [];
    
    // First, create total enemy damage dealt dataset (separate stack)
    const totalEnemyDamageData = [];
    currentAdventure.encounters.forEach((encounter, index) => {
        if (!encounter.combatants) {
            totalEnemyDamageData.push({ x: index + 1, y: 0 });
            return;
        }
        
        // Calculate total damage dealt by enemies (sum of dmg field for monsters/NPCs)
        let totalEnemyDamage = 0;
        encounter.combatants.forEach(combatant => {
            if (!isPlayerCombatant(combatant)) {
                totalEnemyDamage += combatant.dmg || 0;
            }
        });
        
        totalEnemyDamageData.push({ x: index + 1, y: totalEnemyDamage });
    });
    
    datasets.push({
        label: 'Enemy Damage',
        data: totalEnemyDamageData,
        backgroundColor: '#e7474780',
        borderColor: '#c0392b',
        borderWidth: 2,
        stack: 'taken'
    });
    
    // Create a dataset for each player
    playerNames.forEach((playerName, idx) => {
        const color = colors[idx % colors.length];
        const playerData = [];
        
        currentAdventure.encounters.forEach((encounter, index) => {
            if (!encounter.combatants) {
                playerData.push({ x: index + 1, y: 0 });
                return;
            }
            
            // Sum damage for this player in this encounter
            let playerDamage = 0;
            encounter.combatants.forEach(combatant => {
                if (isPlayerCombatant(combatant)) {
                    const combatantName = getCombatantName(combatant);
                    if (combatantName === playerName) {
                        playerDamage += combatant.dmg || 0;
                    }
                }
            });
            
            playerData.push({ x: index + 1, y: playerDamage });
        });
        
        datasets.push({
            label: playerName,
            data: playerData,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            stack: 'players'
        });
    });
    
    // Create "Other" dataset for unattributed damage
    const otherData = [];
    currentAdventure.encounters.forEach((encounter, index) => {
        if (!encounter.combatants) {
            otherData.push({ x: index + 1, y: 0 });
            return;
        }
        
        // Calculate total actual damage (maxHp - currentHp for all monsters)
        let totalDamage = 0;
        encounter.combatants.forEach(combatant => {
            if (!isPlayerCombatant(combatant)) {
                const maxHp = combatant.maxHp || 0;
                const currentHp = combatant.hp || 0;
                const damageTaken = Math.max(0, maxHp - currentHp);
                totalDamage += damageTaken;
            }
        });
        
        // Calculate total tracked player damage
        let trackedDamage = 0;
        encounter.combatants.forEach(combatant => {
            if (isPlayerCombatant(combatant)) {
                trackedDamage += combatant.dmg || 0;
            }
        });
        
        // Difference is "Other" damage
        const otherDamage = Math.max(0, totalDamage - trackedDamage);
        otherData.push({ x: index + 1, y: otherDamage });
    });
    
    // Only add "Other" if there's any unattributed damage
    const hasOtherDamage = otherData.some(d => d.y > 0);
    if (hasOtherDamage) {
        datasets.push({
            label: 'Other',
            data: otherData,
            backgroundColor: '#95a5a6',
            borderColor: '#7f8c8d',
            borderWidth: 1,
            stack: 'players'
        });
    }
    
    // Destroy existing chart if it exists
    if (damageChart) {
        damageChart.destroy();
    }
    
    // Create new stacked bar chart
    damageChart = new Chart(ctx, {
        type: 'bar',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const encounterIndex = context[0].parsed.x - 1;
                            const encounter = currentAdventure.encounters[encounterIndex];
                            return encounter?.name || `Encounter ${encounterIndex + 1}`;
                        },
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' HP';
                        },
                        footer: function(context) {
                            const total = context.reduce((sum, item) => sum + item.parsed.y, 0);
                            return 'Total: ' + total + ' HP';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Encounter Number'
                    },
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Total Damage (HP)'
                    },
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Settings Modal
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

// Adventure Settings Modal
function openAdventureSettingsModal() {
    const modal = document.getElementById('adventureSettingsModal');
    const pinInput = document.getElementById('adventurePinInput');
    const pinStatusText = document.getElementById('pinStatusText');
    
    // Load current PIN if it exists
    const currentPin = currentAdventure.pin || '';
    pinInput.value = currentPin;
    
    // Update status text
    if (currentPin) {
        pinStatusText.textContent = `Current PIN: ${currentPin}`;
        pinStatusText.style.color = '#27ae60';
    } else {
        pinStatusText.textContent = 'No PIN set';
        pinStatusText.style.color = '#666';
    }
    
    modal.style.display = 'flex';
    setTimeout(() => pinInput.focus(), 100);
}

function closeAdventureSettingsModal() {
    const modal = document.getElementById('adventureSettingsModal');
    modal.style.display = 'none';
}

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

// Damage Modal
function openDamageModal() {
    // Find an active encounter (started or just any encounter with combatants)
    let activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    
    // If no started encounter, try to find any encounter with combatants
    if (!activeEncounter) {
        activeEncounter = currentAdventure.encounters?.find(e => e.combatants && e.combatants.length > 0);
    }
    
    if (!activeEncounter || !activeEncounter.combatants || activeEncounter.combatants.length === 0) {
        return; // Only works if there are combatants
    }
    
    const modal = document.getElementById('damageModal');
    if (!modal) {
        return;
    }
    
    const fromSelect = document.getElementById('damageFromSelect');
    const toSelect = document.getElementById('damageToSelect');
    const amountInput = document.getElementById('damageAmount');
    
    // Clear and populate dropdowns
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    activeEncounter.combatants.forEach((combatant, index) => {
        const combatantName = getCombatantName(combatant);
        
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
        c => getCombatantName(c) === activeEncounter.activeCombatant
    );
    if (activeCombatantIndex >= 0) {
        fromSelect.value = activeCombatantIndex;
    }
    
    amountInput.value = 0;
    modal.style.display = 'flex';
    setTimeout(() => amountInput.focus(), 100);
}

function closeDamageModal() {
    const modal = document.getElementById('damageModal');
    modal.style.display = 'none';
}

function confirmDamage() {
    const activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    if (!activeEncounter) {
        closeDamageModal();
        return;
    }
    
    const fromIndex = parseInt(document.getElementById('damageFromSelect').value);
    const toIndex = parseInt(document.getElementById('damageToSelect').value);
    let amount = parseInt(document.getElementById('damageAmount').value) || 0;
    
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
            const isPlayer = isPlayerCombatant(target);
            if (isPlayer && target.hp < 0) {
                target.hp = 0;
            }
        }
        
        // Check concentration (DC = 10 or half damage, whichever is higher)
        if (target.concentrating && amount > 0) {
            const dc = Math.max(10, Math.floor(amount / 2));
            const targetName = getCombatantName(target);
            setTimeout(() => {
                if (confirm(`${targetName} is concentrating! Make a DC ${dc} Constitution save or lose concentration.`)) {
                    // Passed save - do nothing
                } else {
                    // Failed save - lose concentration
                    target.concentrating = false;
                    renderEncounters();
                    autoSave();
                }
            }, 100);
        }
        
        // Clear death saves if healing from 0 HP
        if (target.deathSaves && target.hp > 0) {
            target.deathSaves = { successes: 0, failures: 0 };
        }
    }
    
    // Re-render and close
    renderEncounters();
    autoSave();
    closeDamageModal();
}

// Heal Modal
function openHealModal() {
    // Find an active encounter (started or just any encounter with combatants)
    let activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    
    // If no started encounter, try to find any encounter with combatants
    if (!activeEncounter) {
        activeEncounter = currentAdventure.encounters?.find(e => e.combatants && e.combatants.length > 0);
    }
    
    if (!activeEncounter || !activeEncounter.combatants || activeEncounter.combatants.length === 0) {
        return; // Only works if there are combatants
    }
    
    const modal = document.getElementById('healModal');
    if (!modal) {
        return;
    }
    
    const fromSelect = document.getElementById('healFromSelect');
    const toSelect = document.getElementById('healToSelect');
    const amountInput = document.getElementById('healAmount');
    
    // Clear and populate dropdowns
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    activeEncounter.combatants.forEach((combatant, index) => {
        const combatantName = getCombatantName(combatant);
        
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
        c => getCombatantName(c) === activeEncounter.activeCombatant
    );
    if (activeCombatantIndex >= 0) {
        fromSelect.value = activeCombatantIndex;
    }
    
    amountInput.value = 0;
    modal.style.display = 'flex';
    setTimeout(() => amountInput.focus(), 100);
}

function closeHealModal() {
    const modal = document.getElementById('healModal');
    modal.style.display = 'none';
}

function confirmHeal() {
    const activeEncounter = currentAdventure.encounters?.find(e => e.state === 'started');
    if (!activeEncounter) {
        closeHealModal();
        return;
    }
    
    const fromIndex = parseInt(document.getElementById('healFromSelect').value);
    const toIndex = parseInt(document.getElementById('healToSelect').value);
    const amount = parseInt(document.getElementById('healAmount').value) || 0;
    
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
    renderEncounters();
    closeHealModal();
}

// Check cookie status
async function checkCookieStatus() {
    try {
        const response = await fetch('/api/dndbeyond/cookie-status');
        const result = await response.json();
        hasCookies = result.hasCookies;
        updateUIForCookieStatus();
    } catch (error) {
        console.error('Error checking cookie status:', error);
        hasCookies = false;
        updateUIForCookieStatus();
    }
}

// Update UI based on cookie authentication status
function updateUIForCookieStatus() {
    const adventureSelect = document.getElementById('adventureSelect');
    const newAdventureBtn = document.getElementById('newAdventureBtn');
    const adventureSelectionHeader = document.getElementById('adventureSelectionHeader');
    
    if (!hasCookies) {
        // Disable adventure controls
        adventureSelect.disabled = true;
        newAdventureBtn.disabled = true;
        
        // Add warning message if not already present
        if (!document.getElementById('cookieWarning')) {
            const warning = document.createElement('div');
            warning.id = 'cookieWarning';
            warning.style.cssText = 'background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;';
            warning.innerHTML = `
                <h3 style="margin: 0 0 10px 0; color: #856404;">⚠️ Authentication Required</h3>
                <p style="margin: 0 0 10px 0; color: #856404;">You must configure D&D Beyond cookies before using this app.</p>
                <button onclick="openSettingsModal()" style="background: #9b59b6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    ⚙️ Open Settings to Configure
                </button>
            `;
            adventureSelectionHeader.parentNode.insertBefore(warning, adventureSelectionHeader.nextSibling);
        }
    } else {
        // Enable adventure controls
        adventureSelect.disabled = false;
        newAdventureBtn.disabled = false;
        
        // Remove warning if present
        const warning = document.getElementById('cookieWarning');
        if (warning) {
            warning.remove();
        }
    }
}

async function saveCookies() {
    const cookieInput = document.getElementById('cookieInput');
    const cookieString = cookieInput.value.trim();
    
    if (!cookieString) {
        showCookieStatus('Please paste your cookies first.', 'error');
        return;
    }
    
    let cookies;
    
    // Try to parse as JSON first (EditThisCookie format or key-value object)
    try {
        cookies = JSON.parse(cookieString);
        console.log('Parsed as JSON:', Array.isArray(cookies) ? 'EditThisCookie array format' : 'Key-value object format');
    } catch (e) {
        // Not JSON - try to parse as browser cookie string (name1=value1; name2=value2)
        console.log('Not JSON, parsing as browser cookie string');
        cookies = {};
        cookieString.split(';').forEach(cookie => {
            const [name, ...value] = cookie.trim().split('=');
            if (name) {
                cookies[name] = value.join('=');
            }
        });
    }
    
    try {
        // Send cookies to backend (backend will auto-detect format)
        const response = await fetch('/api/dndbeyond/set-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showCookieStatus(`✓ Saved ${result.count} cookies! You can now use D&D Beyond features.`, 'success');
            // Update cookie status and UI
            await checkCookieStatus();
        } else {
            showCookieStatus('Failed to save cookies: ' + result.error, 'error');
        }
    } catch (error) {
        showCookieStatus('Error: ' + error.message, 'error');
    }
}

function clearCookies() {
    if (confirm('Clear saved D&D Beyond cookies? This will prevent you from using the app until you reconfigure.')) {
        fetch('/api/dndbeyond/clear-cookies', { method: 'POST' });
        document.getElementById('cookieInput').value = '';
        showCookieStatus('Cookies cleared. You must reconfigure to use the app.', 'warning');
        
        // Update cookie status and UI
        hasCookies = false;
        updateUIForCookieStatus();
        
        // Reset to fallback
        monstersLoaded = false;
        DND_MONSTERS = {};
        loadMonsters();
    }
}

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

// Show toast notification (for monster fetch feedback)
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
async function handleAdventureChange(e) {
    const name = e.target.value;
    if (!name) {
        document.getElementById('adventureContent').style.display = 'none';
        document.getElementById('adventureSelectionHeader').style.display = 'flex';
        document.getElementById('adventureHeader').style.display = 'none';
        // Clear URL parameter
        const url = new URL(window.location);
        url.searchParams.delete('adventure');
        window.history.pushState({}, '', url);
        return;
    }
    
    // Check if cookies are configured
    if (!hasCookies) {
        alert('You must configure D&D Beyond cookies before loading adventures. Click Settings (⚙️) to set up.');
        openSettingsModal();
        e.target.value = ''; // Reset selection
        return;
    }
    
    const response = await fetch(`/api/adventure/${name}`);
    
    // Check if PIN is required
    if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.requiresPin) {
            // Prompt for PIN
            const pin = prompt(`Adventure "${name}" is protected.\n\nEnter the 4-digit PIN:`);
            if (!pin) {
                // User canceled - reset everything
                e.target.value = ''; // Reset selection
                currentAdventure = null;
                document.getElementById('adventureContent').style.display = 'none';
                document.getElementById('adventureSelectionHeader').style.display = 'flex';
                document.getElementById('adventureHeader').style.display = 'none';
                // Clear URL parameters
                const url = new URL(window.location);
                url.searchParams.delete('adventure');
                url.searchParams.delete('chapter');
                window.history.pushState({}, '', url);
                return;
            }
            
            // Verify PIN
            const verifyResponse = await fetch(`/api/adventure/${name}/verify-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            
            if (!verifyResponse.ok) {
                alert('Incorrect PIN');
                // Wrong PIN - reset everything
                e.target.value = ''; // Reset selection
                currentAdventure = null;
                document.getElementById('adventureContent').style.display = 'none';
                document.getElementById('adventureSelectionHeader').style.display = 'flex';
                document.getElementById('adventureHeader').style.display = 'none';
                // Clear URL parameters
                const url = new URL(window.location);
                url.searchParams.delete('adventure');
                url.searchParams.delete('chapter');
                window.history.pushState({}, '', url);
                return;
            }
            
            // PIN verified, load again
            const retryResponse = await fetch(`/api/adventure/${name}`);
            currentAdventure = await retryResponse.json();
        } else {
            alert('Error loading adventure: ' + errorData.error);
            e.target.value = '';
            currentAdventure = null;
            return;
        }
    } else {
        currentAdventure = await response.json();
    }
    
    // Clear CR fetch status when loading new adventure
    crFetchStatus = {};
    
    // Update header to show adventure title
    document.getElementById('adventureSelectionHeader').style.display = 'none';
    document.getElementById('adventureHeader').style.display = 'flex';
    document.getElementById('adventureTitleText').textContent = currentAdventure.name;
    
    // Initialize chapters if not present
    if (!currentAdventure.chapters) {
        currentAdventure.chapters = ['Chapter 1'];
    }
    if (!currentAdventure.encounters) {
        currentAdventure.encounters = [];
    }
    
    // Ensure all encounters have a chapter
    currentAdventure.encounters.forEach(enc => {
        if (!enc.chapter) {
            enc.chapter = currentAdventure.chapters[0];
        }
    });
    
    // Get chapter from URL or use first chapter
    const urlParams = new URLSearchParams(window.location.search);
    const chapterParam = urlParams.get('chapter');
    if (chapterParam && currentAdventure.chapters.includes(chapterParam)) {
        currentChapter = chapterParam;
    } else {
        currentChapter = currentAdventure.chapters[0];
    }
    
    // Update URL parameters
    const url = new URL(window.location);
    url.searchParams.set('adventure', name);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    document.getElementById('adventureContent').style.display = 'block';
    
    // Restore scroll position after content is rendered
    setTimeout(() => {
        const savedScrollY = sessionStorage.getItem('scrollPosition');
        if (savedScrollY !== null) {
            window.scrollTo(0, parseInt(savedScrollY, 10));
            sessionStorage.removeItem('scrollPosition');
        }
    }, 100);
}

// Create new adventure
async function createNewAdventure() {
    // Check if cookies are configured
    if (!hasCookies) {
        alert('You must configure D&D Beyond cookies before creating adventures. Click Settings (⚙️) to set up.');
        openSettingsModal();
        return;
    }
    
    const name = prompt('Enter adventure name:');
    if (!name) return;
    
    const response = await fetch('/api/adventure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    
    if (response.ok) {
        await loadAdventuresList();
        document.getElementById('adventureSelect').value = name;
        await handleAdventureChange({ target: { value: name } });
    } else {
        const error = await response.json();
        alert(error.error);
    }
}

// Delete current adventure
async function deleteCurrentAdventure() {
    const name = document.getElementById('adventureSelect').value;
    if (!name) return;
    
    if (!confirm(`Delete adventure "${name}"?`)) return;
    
    await fetch(`/api/adventure/${name}`, { method: 'DELETE' });
    await loadAdventuresList();
    document.getElementById('adventureSelect').value = '';
    document.getElementById('adventureContent').style.display = 'none';
    
    // Clear state
    crFetchStatus = {};
    
    // Clear URL parameters
    const url = new URL(window.location);
    url.searchParams.delete('adventure');
    url.searchParams.delete('chapter');
    window.history.pushState({}, '', url);
}

// Handle chapter change
function handleChapterChange(event) {
    currentChapter = event.target.value;
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    // Update chapter notes display
    updateChapterNotesDisplay();
    
    renderEncounters();
}

// Handle chapter notes change
function handleChapterNotesChange(event) {
    if (!currentAdventure.chapterNotes) {
        currentAdventure.chapterNotes = {};
    }
    currentAdventure.chapterNotes[currentChapter] = event.target.value;
    autoSave();
}

// Update chapter notes display
function updateChapterNotesDisplay() {
    const notesTextarea = document.getElementById('chapterNotes');
    if (notesTextarea) {
        notesTextarea.value = (currentAdventure.chapterNotes && currentAdventure.chapterNotes[currentChapter]) || '';
    }
}

// Add new chapter
function addChapter() {
    const name = prompt('Enter chapter name:');
    if (!name) return;
    
    if (currentAdventure.chapters.includes(name)) {
        alert('A chapter with this name already exists.');
        return;
    }
    
    currentAdventure.chapters.push(name);
    currentChapter = name;
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    autoSave();
}

// Delete current chapter
function deleteChapter() {
    if (currentAdventure.chapters.length === 1) {
        alert('Cannot delete the last chapter.');
        return;
    }
    
    if (!confirm(`Delete chapter "${currentChapter}" and all its encounters? This cannot be undone.`)) {
        return;
    }
    
    // Remove encounters in this chapter
    currentAdventure.encounters = currentAdventure.encounters.filter(enc => enc.chapter !== currentChapter);
    
    // Remove chapter
    currentAdventure.chapters = currentAdventure.chapters.filter(ch => ch !== currentChapter);
    
    // Switch to first chapter
    currentChapter = currentAdventure.chapters[0];
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('chapter', currentChapter);
    window.history.pushState({}, '', url);
    
    renderAdventure();
    autoSave();
}

// Render adventure
function renderAdventure() {
    renderChapterSelector();
    updateChapterNotesDisplay();
    renderPlayers();
    renderEncounters();
}

// Render chapter selector
function renderChapterSelector() {
    const selector = document.getElementById('chapterSelect');
    selector.innerHTML = currentAdventure.chapters.map(chapter => 
        `<option value="${chapter}" ${chapter === currentChapter ? 'selected' : ''}>${chapter}</option>`
    ).join('');
}

// Render players table
function sortPlayers(field) {
    if (!currentAdventure.players || currentAdventure.players.length === 0) return;
    
    currentAdventure.players.sort((a, b) => {
        let aVal, bVal;
        
        // Handle special calculated fields
        if (field === 'passivePerception') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aWisMod = calcMod(a.abilityScores?.wis || 10);
            const bWisMod = calcMod(b.abilityScores?.wis || 10);
            aVal = 10 + aWisMod + (a.skillProficiencies?.perception ? aProfBonus : 0);
            bVal = 10 + bWisMod + (b.skillProficiencies?.perception ? bProfBonus : 0);
        } else if (field === 'passiveInvestigation') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aIntMod = calcMod(a.abilityScores?.int || 10);
            const bIntMod = calcMod(b.abilityScores?.int || 10);
            aVal = 10 + aIntMod + (a.skillProficiencies?.investigation ? aProfBonus : 0);
            bVal = 10 + bIntMod + (b.skillProficiencies?.investigation ? bProfBonus : 0);
        } else if (field === 'passiveInsight') {
            const calcMod = (score) => Math.floor((score - 10) / 2);
            const aProfBonus = 2 + Math.floor(((a.level || 1) - 1) / 4);
            const bProfBonus = 2 + Math.floor(((b.level || 1) - 1) / 4);
            const aWisMod = calcMod(a.abilityScores?.wis || 10);
            const bWisMod = calcMod(b.abilityScores?.wis || 10);
            aVal = 10 + aWisMod + (a.skillProficiencies?.insight ? aProfBonus : 0);
            bVal = 10 + bWisMod + (b.skillProficiencies?.insight ? bProfBonus : 0);
        } else {
            aVal = a[field];
            bVal = b[field];
        }
        
        // Handle undefined/null values
        if (aVal === undefined || aVal === null) aVal = '';
        if (bVal === undefined || bVal === null) bVal = '';
        
        // For numeric fields, sort largest to smallest
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return bVal - aVal;  // Descending order
        }
        
        // For string fields, sort alphabetically (A-Z)
        return String(aVal).localeCompare(String(bVal));
    });
    
    renderPlayers();
    autoSave();
}

function renderPlayers() {
    const tbody = document.getElementById('playersBody');
    tbody.innerHTML = '';
    
    if (!currentAdventure.players) {
        currentAdventure.players = [];
    }
    
    currentAdventure.players.forEach((player, index) => {
        const classOptions = DND_CLASSES.map(c => `<option value="${c}" ${player.class === c ? 'selected' : ''}>${c}</option>`).join('');
        const raceOptions = DND_RACES.map(r => `<option value="${r}" ${player.race === r ? 'selected' : ''}>${r}</option>`).join('');
        
        // Initialize abilities if not present
        if (!player.abilityScores) {
            player.abilityScores = {
                str: 10,
                dex: 10,
                con: 10,
                int: 10,
                wis: 10,
                cha: 10
            };
        }
        
        // Initialize skill proficiencies if not present
        if (!player.skillProficiencies) {
            player.skillProficiencies = {
                perception: false,
                insight: false,
                investigation: false
            };
        }
        
        // Calculate ability modifiers
        const calcMod = (score) => Math.floor((score - 10) / 2);
        const wisMod = calcMod(player.abilityScores.wis || 10);
        const intMod = calcMod(player.abilityScores.int || 10);
        
        // Calculate proficiency bonus based on level
        const profBonus = 2 + Math.floor(((player.level || 1) - 1) / 4);
        
        // Calculate passive values (10 + modifier + proficiency if proficient)
        const passivePerception = 10 + wisMod + (player.skillProficiencies.perception ? profBonus : 0);
        const passiveInsight = 10 + wisMod + (player.skillProficiencies.insight ? profBonus : 0);
        const passiveInvestigation = 10 + intMod + (player.skillProficiencies.investigation ? profBonus : 0);
        
        // Track expanded state
        if (player.expanded === undefined) {
            player.expanded = false;
        }
        
        // Main row
        const row = tbody.insertRow();
        row.id = `player-row-${index}`;
        
        if (playersEditMode) {
            // Edit mode: show input fields
            row.innerHTML = `
                <td><button class="btn-small" onclick="togglePlayerStats(${index})" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
                <td><button class="btn-small" onclick="editPlayerUrl(${index})" style="background: #3498db;" title="Edit D&D Beyond URL">🔗</button></td>
                <td><input type="text" value="${player.playerName || ''}" onchange="updatePlayer(${index}, 'playerName', this.value)" style="width: 90px;"></td>
                <td><input type="text" value="${player.name || ''}" onchange="updatePlayer(${index}, 'name', this.value)" style="width: 100px;"></td>
                <td><select onchange="updatePlayer(${index}, 'race', this.value)" style="width: 110px;"><option value="">Select Race</option>${raceOptions}</select></td>
                <td><select onchange="updatePlayer(${index}, 'class', this.value)" style="width: 110px;"><option value="">Select Class</option>${classOptions}</select></td>
                <td><input type="number" value="${player.level || 1}" onchange="updatePlayer(${index}, 'level', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.maxHp || 0}" onchange="updatePlayer(${index}, 'maxHp', parseInt(this.value))" style="width: 45px; text-align: center;"></td>
                <td><input type="number" value="${player.ac || 10}" onchange="updatePlayer(${index}, 'ac', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.speed || 30}" onchange="updatePlayer(${index}, 'speed', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td><input type="number" value="${player.initiativeBonus || 0}" onchange="updatePlayer(${index}, 'initiativeBonus', parseInt(this.value))" style="width: 38px; text-align: center;"></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.perception ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.perception ? ' + Prof(+' + profBonus + ')' : ''}">${passivePerception}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.investigation ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + INT(${intMod >= 0 ? '+' : ''}${intMod})${player.skillProficiencies.investigation ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInvestigation}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.insight ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.insight ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInsight}</span></td>
                <td style="width: 150px;"><input type="text" value="${player.notes || ''}" onchange="updatePlayer(${index}, 'notes', this.value)" style="width: 150px;"></td>
                <td><button class="btn-small" onclick="removePlayer(${index})" style="background: #e74c3c;" title="Delete this player">×</button></td>
            `;
        } else {
            // View mode: show read-only display
            const hasUrl = player.dndBeyondUrl && player.dndBeyondUrl.trim() !== '';
            row.innerHTML = `
                <td><button class="btn-small" onclick="togglePlayerStats(${index})" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
                <td>${hasUrl ? `<a href="${player.dndBeyondUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 4px 8px; font-size: 16px; background: #3498db; color: white; text-decoration: none; border-radius: 3px; cursor: pointer;" title="Open in D&D Beyond">🔗</a>` : '<span style="display: inline-block; padding: 4px 8px; font-size: 16px; color: #ccc;">🔗</span>'}</td>
                <td style="padding: 8px;">${player.playerName || '—'}</td>
                <td style="padding: 8px; font-weight: 500;">${player.name || '—'}</td>
                <td style="padding: 8px;">${player.race || '—'}</td>
                <td style="padding: 8px;">${player.class || '—'}</td>
                <td style="text-align: center; padding: 8px;">${player.level || 1}</td>
                <td style="text-align: center; padding: 8px;">${player.maxHp || 0}</td>
                <td style="text-align: center; padding: 8px;">${player.ac || 10}</td>
                <td style="text-align: center; padding: 8px;">${player.speed || 30}</td>
                <td style="text-align: center; padding: 8px;">${player.initiativeBonus >= 0 ? '+' : ''}${player.initiativeBonus || 0}</td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.perception ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.perception ? ' + Prof(+' + profBonus + ')' : ''}">${passivePerception}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.investigation ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + INT(${intMod >= 0 ? '+' : ''}${intMod})${player.skillProficiencies.investigation ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInvestigation}</span></td>
                <td style="text-align: center;"><span style="color: ${player.skillProficiencies.insight ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.insight ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInsight}</span></td>
                <td style="padding: 8px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${player.notes || ''}">${player.notes || '—'}</td>
                <td></td>
            `;
        }
        
        // Ability scores row (expandable)
        const detailRow = tbody.insertRow();
        detailRow.id = `player-detail-${index}`;
        detailRow.style.display = player.expanded ? 'table-row' : 'none';
        detailRow.style.backgroundColor = '#f8f9fa';
        
        if (playersEditMode) {
            // Edit mode: show input fields and checkboxes
            detailRow.innerHTML = `
                <td colspan="2"></td>
                <td colspan="14" style="padding: 10px;">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div>
                            <strong style="color: #666;">Ability Scores:</strong>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">STR</label>
                                    <input type="number" value="${player.abilityScores.str || 10}" onchange="updatePlayerAbility(${index}, 'str', parseInt(this.value))" style="width: 45px; text-align: center;" title="Strength">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.str || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.str || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">DEX</label>
                                    <input type="number" value="${player.abilityScores.dex || 10}" onchange="updatePlayerAbility(${index}, 'dex', parseInt(this.value))" style="width: 45px; text-align: center;" title="Dexterity">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.dex || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.dex || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CON</label>
                                    <input type="number" value="${player.abilityScores.con || 10}" onchange="updatePlayerAbility(${index}, 'con', parseInt(this.value))" style="width: 45px; text-align: center;" title="Constitution">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.con || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.con || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">INT</label>
                                    <input type="number" value="${player.abilityScores.int || 10}" onchange="updatePlayerAbility(${index}, 'int', parseInt(this.value))" style="width: 45px; text-align: center;" title="Intelligence">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.int || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.int || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">WIS</label>
                                    <input type="number" value="${player.abilityScores.wis || 10}" onchange="updatePlayerAbility(${index}, 'wis', parseInt(this.value))" style="width: 45px; text-align: center;" title="Wisdom">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.wis || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.wis || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CHA</label>
                                    <input type="number" value="${player.abilityScores.cha || 10}" onchange="updatePlayerAbility(${index}, 'cha', parseInt(this.value))" style="width: 45px; text-align: center;" title="Charisma">
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.cha || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.cha || 10)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="border-left: 1px solid #ddd; padding-left: 20px;">
                            <strong style="color: #666;">Skill Proficiencies:</strong>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.perception ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'perception', this.checked)">
                                    <span style="font-size: 13px;">Perception (WIS)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.investigation ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'investigation', this.checked)">
                                    <span style="font-size: 13px;">Investigation (INT)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" ${player.skillProficiencies.insight ? 'checked' : ''} onchange="updatePlayerSkillProf(${index}, 'insight', this.checked)">
                                    <span style="font-size: 13px;">Insight (WIS)</span>
                                </label>
                            </div>
                        </div>
                        <div style="margin-left: auto; color: #999; font-size: 12px;">
                            Proficiency Bonus: +${profBonus}
                        </div>
                    </div>
                </td>
            </tr>
            `;
        } else {
            // View mode: show read-only display with formatted modifiers
            detailRow.innerHTML = `
                <td colspan="2"></td>
                <td colspan="14" style="padding: 10px;">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div>
                            <strong style="color: #666;">Ability Scores:</strong>
                            <div style="display: flex; gap: 10px; margin-top: 5px;">
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">STR</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.str || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.str || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.str || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">DEX</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.dex || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.dex || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.dex || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CON</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.con || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.con || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.con || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">INT</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.int || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.int || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.int || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">WIS</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.wis || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.wis || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.wis || 10)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <label style="font-size: 11px; color: #666; font-weight: 500;">CHA</label>
                                    <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${player.abilityScores.cha || 10}</div>
                                    <span style="font-size: 10px; color: #999;">${calcMod(player.abilityScores.cha || 10) >= 0 ? '+' : ''}${calcMod(player.abilityScores.cha || 10)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="border-left: 1px solid #ddd; padding-left: 20px;">
                            <strong style="color: #666;">Skill Proficiencies:</strong>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.perception ? '#27ae60' : '#999'};">${player.skillProficiencies.perception ? '✓' : '—'} Perception (WIS)</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.investigation ? '#27ae60' : '#999'};">${player.skillProficiencies.investigation ? '✓' : '—'} Investigation (INT)</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 13px; color: ${player.skillProficiencies.insight ? '#27ae60' : '#999'};">${player.skillProficiencies.insight ? '✓' : '—'} Insight (WIS)</span>
                                </div>
                            </div>
                        </div>
                        <div style="margin-left: auto; color: #999; font-size: 12px;">
                            Proficiency Bonus: +${profBonus}
                        </div>
                    </div>
                </td>
            </tr>
            `;
        }
    });
}

// Toggle player ability scores visibility
function togglePlayerStats(index) {
    currentAdventure.players[index].expanded = !currentAdventure.players[index].expanded;
    renderPlayers();
    autoSave();
}

// Toggle players edit mode
function togglePlayersEditMode() {
    playersEditMode = !playersEditMode;
    const btn = document.getElementById('toggleEditPlayersBtn');
    const addBtn = document.getElementById('addPlayerBtn');
    if (playersEditMode) {
        btn.textContent = '💾';
        btn.title = 'Save';
        btn.style.background = '#27ae60';
        addBtn.style.display = 'block';
    } else {
        btn.textContent = '✏️';
        btn.title = 'Edit';
        btn.style.background = '#f39c12';
        addBtn.style.display = 'none';
    }
    renderPlayers();
}

// Update player skill proficiency
function updatePlayerSkillProf(index, skill, isProficient) {
    if (!currentAdventure.players[index].skillProficiencies) {
        currentAdventure.players[index].skillProficiencies = {
            perception: false,
            insight: false,
            investigation: false
        };
    }
    currentAdventure.players[index].skillProficiencies[skill] = isProficient;
    renderPlayers(); // Re-render to update passive values
    autoSave();
}

// Update player
function updatePlayer(index, field, value) {
    currentAdventure.players[index][field] = value;
    autoSave();
}

// Update player ability score
function updatePlayerAbility(index, ability, value) {
    if (!currentAdventure.players[index].abilityScores) {
        currentAdventure.players[index].abilityScores = {
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
        };
    }
    currentAdventure.players[index].abilityScores[ability] = value;
    renderPlayers(); // Re-render to show updated modifiers
    autoSave();
}

// Toggle player stats expanded/collapsed
function togglePlayerStats(index) {
    currentAdventure.players[index].expanded = !currentAdventure.players[index].expanded;
    renderPlayers();
}

// Edit player D&D Beyond URL
function editPlayerUrl(index) {
    const player = currentAdventure.players[index];
    const url = prompt('Enter D&D Beyond URL for ' + player.name + ':', player.dndBeyondUrl || '');
    if (url !== null) {
        currentAdventure.players[index].dndBeyondUrl = url;
        renderPlayers();
        autoSave();
    }
}

// Add new player
function addPlayer() {
    currentAdventure.players.push({
        name: '',
        playerName: '',
        race: '',
        class: '',
        level: 1,
        abilityScores: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        skillProficiencies: {
            perception: false,
            insight: false,
            investigation: false
        },
        maxHp: 0,
        ac: 10,
        speed: 30,
        initiativeBonus: 0,
        notes: '',
        expanded: false
    });
    renderPlayers();
    autoSave();
}

// Remove player
function removePlayer(index) {
    if (confirm('Remove this player?')) {
        currentAdventure.players.splice(index, 1);
        renderPlayers();
        autoSave();
    }
}

// Check if combatant is a player
function isPlayerCombatant(combatant) {
    // If combatant has no name field, it's a player (name looked up from dndBeyondUrl)
    // If combatant has a name field, it's a monster/NPC
    return !combatant.hasOwnProperty('name');
}

// Get combatant display name (look up from players if needed)
function getCombatantName(combatant) {
    if (isPlayerCombatant(combatant)) {
        // Look up player name by id field (which matches dndBeyondUrl)
        if (combatant.id) {
            const player = currentAdventure?.players?.find(p => {
                // Handle both full URL and just ID formats
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });
            if (player) {
                return player.name;
            }
        }
        return 'Unknown Player';
    }
    return combatant.name || '';
}

// Render encounters
// Drag and drop state
let draggedEncounterIndex = null;
let dropTargetIndex = null;

function handleDragStart(e) {
    // Get the encounter card (parent of header)
    const card = e.currentTarget.closest('.encounter-card');
    if (card) {
        draggedEncounterIndex = parseInt(card.dataset.encounterIndex);
        card.style.opacity = '0.4';
    }
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    // Get the encounter card
    const card = e.currentTarget.closest('.encounter-card') || e.currentTarget;
    if (card && card.dataset.encounterIndex) {
        const targetIndex = parseInt(card.dataset.encounterIndex);
        
        if (draggedEncounterIndex !== null && draggedEncounterIndex !== targetIndex) {
            dropTargetIndex = targetIndex;
        }
    }
    
    return false;
}

function handleDragEnd(e) {
    if (draggedEncounterIndex !== null && dropTargetIndex !== null && draggedEncounterIndex !== dropTargetIndex) {
        // Reorder the encounters array
        const draggedEncounter = currentAdventure.encounters[draggedEncounterIndex];
        currentAdventure.encounters.splice(draggedEncounterIndex, 1);
        
        // Calculate new insertion index
        const newIndex = draggedEncounterIndex < dropTargetIndex ? dropTargetIndex - 1 : dropTargetIndex;
        currentAdventure.encounters.splice(newIndex, 0, draggedEncounter);
        
        // Re-render immediately
        renderEncounters();
    } else {
        // Restore opacity on the card
        const card = e.currentTarget.closest('.encounter-card');
        if (card) {
            card.style.opacity = '1';
        }
    }
    
    draggedEncounterIndex = null;
    dropTargetIndex = null;
}

function renderEncounters() {
    const container = document.getElementById('encountersContainer');
    container.innerHTML = '';
    
    if (!currentAdventure.encounters) {
        currentAdventure.encounters = [];
    }
    
    // Filter encounters by current chapter
    const chapterEncounters = currentAdventure.encounters
        .map((encounter, index) => ({ encounter, index }))
        .filter(({ encounter }) => encounter.chapter === currentChapter);
    
    chapterEncounters.forEach(({ encounter, index }) => {
        // Set default minimized state: minimized unless encounter is started
        if (encounter.minimized === undefined) {
            encounter.minimized = encounter.state !== 'started';
        }
        
        // Sort started encounters by initiative on page load
        if (encounter.state === 'started') {
            // Populate initiativeBonus if missing and sort
            encounter.combatants.forEach(combatant => {
                if (combatant.initiativeBonus === undefined || combatant.initiativeBonus === null) {
                    if (isPlayerCombatant(combatant) && combatant.id) {
                        // Look up from players list
                        const player = currentAdventure.players.find(p => p.dndBeyondUrl === combatant.id);
                        if (player && player.initiativeBonus !== undefined) {
                            combatant.initiativeBonus = player.initiativeBonus;
                        }
                    }
                }
            });
            
            encounter.combatants.sort((a, b) => {
                const initA = a.initiative || 0;
                const initB = b.initiative || 0;
                
                // If initiative is the same, use initiative bonus as tiebreaker
                if (initA === initB) {
                    const bonusA = a.initiativeBonus || 0;
                    const bonusB = b.initiativeBonus || 0;
                    if (bonusA === bonusB) {
                        // Final tiebreaker: use combatant name/id for stable sort
                        const nameA = getCombatantName(a) || a.id || '';
                        const nameB = getCombatantName(b) || b.id || '';
                        return nameA.localeCompare(nameB);
                    }
                    return bonusB - bonusA;
                }
                
                return initB - initA;
            });
            
            // Check if any monsters are missing initiativeBonus
            const monstersNeedRefresh = encounter.combatants.some(c => 
                !isPlayerCombatant(c) && 
                c.dndBeyondUrl && 
                (c.initiativeBonus === undefined || c.initiativeBonus === null)
            );
            
            // Auto-refresh monster stats on page load if needed (silently)
            if (monstersNeedRefresh) {
                setTimeout(() => refreshMonsterStats(index, false), 100);
            }
        }
        
        const card = createEncounterCard(encounter, index);
        
        // Set background color for completed encounters
        if (encounter.state === 'complete') {
            card.style.backgroundColor = '#e8f5e9'; // Light green background
        }
        
        container.appendChild(card);
        
        // Update spectator URL for active encounters
        if (encounter.state === 'started') {
            updateSpectatorUrl(index);
        }
    });
}

// Calculate total XP for an encounter
function calculateEncounterXP(encounter) {
    if (!encounter.combatants) return 0;
    
    // If custom CR is set, convert it to XP
    if (encounter.totalCR !== undefined && encounter.totalCR !== null && encounter.totalCR !== '') {
        const xp = CR_TO_XP[encounter.totalCR] || 0;
        return xp.toLocaleString();
    }
    
    // Otherwise calculate from monsters
    const monsters = encounter.combatants.filter(combatant => !isPlayerCombatant(combatant));
    
    const totalXP = monsters.reduce((sum, combatant) => {
        // Try to get CR from combatant first, then look up in monster list
        let cr = combatant.cr || '';
        
        // If no CR stored, try looking up from monster database
        if (!cr && combatant.name) {
            // Extract base monster name (remove numbering like "Cultist 1" -> "Cultist")
            const baseName = combatant.name.replace(/\s+\d+$/, '');
            const monster = DND_MONSTERS[baseName];
            cr = monster?.cr || '';
            
            // If still no CR and we have a D&D Beyond URL, extract monster ID and look up
            if (!cr && (combatant.dndBeyondUrl || combatant.id)) {
                const url = combatant.dndBeyondUrl || combatant.id;
                const monsterIdMatch = url.match(/(\d+)-([^\/]+)$/);
                if (monsterIdMatch) {
                    const monsterName = monsterIdMatch[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    const foundMonster = DND_MONSTERS[monsterName];
                    if (foundMonster) {
                        cr = foundMonster.cr || '';
                    }
                }
            }
        }
        
        const xp = CR_TO_XP[cr] || 0;
        return sum + xp;
    }, 0);
    
    // Apply multiplier based on number of monsters (D&D 5e rules)
    const monsterCount = monsters.length;
    let multiplier = 1;
    if (monsterCount === 0) multiplier = 1;
    else if (monsterCount === 1) multiplier = 1;
    else if (monsterCount === 2) multiplier = 1.5;
    else if (monsterCount >= 3 && monsterCount <= 6) multiplier = 2;
    else if (monsterCount >= 7 && monsterCount <= 10) multiplier = 2.5;
    else if (monsterCount >= 11 && monsterCount <= 14) multiplier = 3;
    else multiplier = 4;
    
    const adjustedXP = Math.round(totalXP * multiplier);
    return adjustedXP.toLocaleString();
}

// Calculate the default CR based on monsters in encounter
function calculateDefaultEncounterCR(encounter) {
    if (!encounter.combatants) return '0';
    
    const monsters = encounter.combatants.filter(combatant => !isPlayerCombatant(combatant));
    
    // Calculate total base XP
    const totalXP = monsters.reduce((sum, combatant) => {
        let cr = combatant.cr || '';
        
        if (!cr && combatant.name) {
            const baseName = combatant.name.replace(/\s+\d+$/, '');
            const monster = DND_MONSTERS[baseName];
            cr = monster?.cr || '';
            
            // If still no CR and we have a D&D Beyond URL, extract monster ID and look up
            if (!cr && (combatant.dndBeyondUrl || combatant.id)) {
                const url = combatant.dndBeyondUrl || combatant.id;
                const monsterIdMatch = url.match(/(\d+)-([^\/]+)$/);
                if (monsterIdMatch) {
                    const monsterName = monsterIdMatch[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    const foundMonster = DND_MONSTERS[monsterName];
                    if (foundMonster) {
                        cr = foundMonster.cr || '';
                    }
                }
            }
        }
        
        const xp = CR_TO_XP[cr] || 0;
        return sum + xp;
    }, 0);
    
    // Apply multiplier based on number of monsters (D&D 5e rules)
    const monsterCount = monsters.length;
    let multiplier = 1;
    if (monsterCount === 0) multiplier = 1;
    else if (monsterCount === 1) multiplier = 1;
    else if (monsterCount === 2) multiplier = 1.5;
    else if (monsterCount >= 3 && monsterCount <= 6) multiplier = 2;
    else if (monsterCount >= 7 && monsterCount <= 10) multiplier = 2.5;
    else if (monsterCount >= 11 && monsterCount <= 14) multiplier = 3;
    else multiplier = 4;
    
    const adjustedXP = Math.round(totalXP * multiplier);
    
    // Convert adjusted XP back to equivalent CR
    const xpToCR = [
        [10, '0'], [25, '1/8'], [50, '1/4'], [100, '1/2'],
        [200, '1'], [450, '2'], [700, '3'], [1100, '4'], [1800, '5'],
        [2300, '6'], [2900, '7'], [3900, '8'], [5000, '9'], [5900, '10'],
        [7200, '11'], [8400, '12'], [10000, '13'], [11500, '14'], [13000, '15'],
        [15000, '16'], [18000, '17'], [20000, '18'], [22000, '19'], [25000, '20'],
        [33000, '21'], [41000, '22'], [50000, '23'], [62000, '24'], [75000, '25'],
        [90000, '26'], [105000, '27'], [120000, '28'], [135000, '29'], [155000, '30']
    ];
    
    for (let i = xpToCR.length - 1; i >= 0; i--) {
        if (adjustedXP >= xpToCR[i][0]) {
            return xpToCR[i][1];
        }
    }
    
    return '0';
}

// Get the CR to display (custom if set, otherwise calculated)
function getEncounterCR(encounter) {
    // If custom totalCR is set, use it
    if (encounter.totalCR !== undefined && encounter.totalCR !== null && encounter.totalCR !== '') {
        return encounter.totalCR;
    }
    // Otherwise, calculate it
    return calculateDefaultEncounterCR(encounter);
}

// Update encounter CR
function updateEncounterCR(encounterIndex, newCR) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Clean the input
    newCR = newCR.trim();
    
    // Calculate default CR
    const defaultCR = calculateDefaultEncounterCR(encounter);
    
    // If empty or matches default, remove custom CR
    if (newCR === '' || newCR === defaultCR) {
        delete encounter.totalCR;
    } else {
        // Set custom CR
        encounter.totalCR = newCR;
    }
    
    saveAdventure();
    renderEncounters();
}

// Create encounter card
function createEncounterCard(encounter, encounterIndex) {
    const card = document.createElement('div');
    card.className = 'encounter-card';
    card.dataset.encounterIndex = encounterIndex;
    
    const header = document.createElement('div');
    header.className = 'encounter-header';
    
    // Make header draggable
    header.draggable = true;
    header.addEventListener('dragstart', handleDragStart);
    header.addEventListener('dragover', handleDragOver);
    header.addEventListener('drop', handleDrop);
    header.addEventListener('dragend', handleDragEnd);
    
    // Also need dragover/drop on card for proper drop zones
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    
    // Determine which buttons to show based on encounter state
    let encounterButtons = '';
    if (encounter.state === 'started') {
        // Encounter is active - show Next Turn and End
        encounterButtons = `
            <button class="btn-small" onclick="nextTurn(${encounterIndex})" title="Advance to next turn">Next Turn</button>
            <button class="btn-small" onclick="endEncounter(${encounterIndex})" style="background: #e74c3c;" title="End encounter">End</button>
        `;
    } else if (encounter.state === 'complete') {
        // Encounter ended - show Reset button (Edit button will be in top right)
        encounterButtons = `
            <button class="btn-small" onclick="resetEncounter(${encounterIndex})" style="background: #ff9800;" title="Reset encounter to unstarted state">Reset</button>
        `;
    } else {
        // Encounter not started - show Start button
        encounterButtons = `
            <button class="btn-small" onclick="startEncounter(${encounterIndex})" style="background: #2ecc71;" title="Start encounter and sort by initiative">Start</button>
        `;
    }
    
    const minimizeIcon = encounter.minimized ? '▶' : '▼';
    
    // Show encounter controls only if not started or completed
    const showControls = !encounter.state || encounter.state === 'unstarted';
    
    header.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <button class="btn-small" onclick="toggleEncounterMinimize(${encounterIndex})" title="${encounter.minimized ? 'Expand' : 'Minimize'}" style="background: #95a5a6;">${minimizeIcon}</button>
                    ${showControls ? `
                        <input type="text" class="encounter-title" value="${encounter.name || 'New Encounter'}" 
                               onchange="updateEncounterName(${encounterIndex}, this.value)" style="border: 1px solid #ddd; padding: 5px; width: 280px; max-width: 280px;">
                    ` : `
                        <span class="encounter-title" style="font-size: 20px; font-weight: 600; width: 280px; max-width: 280px;">${encounter.name || 'New Encounter'}</span>
                    `}
                    ${encounterEditMode[encounterIndex] ? `
                        <span style="color: #666; font-size: 14px; font-weight: 500; white-space: nowrap; margin-left: 10px;">CR:</span>
                        <input type="text" class="cr-input" value="${getEncounterCR(encounter)}" 
                               onchange="updateEncounterCR(${encounterIndex}, this.value)" 
                               placeholder="${calculateDefaultEncounterCR(encounter)}"
                               title="${encounter.totalCR ? 'Custom CR (default: ' + calculateDefaultEncounterCR(encounter) + ')' : 'Auto-calculated CR'}"
                               style="border: 1px solid ${encounter.totalCR ? '#f39c12' : '#ddd'}; padding: 5px; width: 60px; text-align: center;">
                        <span style="color: #666; font-size: 14px; font-weight: 500; white-space: nowrap;">| XP: ${calculateEncounterXP(encounter)}</span>
                    ` : `
                        <span style="color: #666; font-size: 14px; font-weight: 500; white-space: nowrap; margin-left: 10px;">CR: ${getEncounterCR(encounter)} | XP: ${calculateEncounterXP(encounter)}</span>
                    `}
                    ${encounter.state === 'started' ? `
                        <span id="spectatorUrlContainer-${encounterIndex}" style="${cachedSpectatorUrl ? '' : 'display: none;'} color: #2e7d32; font-size: 14px; white-space: nowrap; margin-left: 25px;">
                            📺 <span id="spectatorUrl-${encounterIndex}" style="font-family: monospace; color: #1976d2; user-select: all; cursor: pointer;" onclick="copySpectatorUrl(${encounterIndex})" title="Click to copy">${cachedSpectatorUrl || ''}</span>
                        </span>
                    ` : ''}
                </div>
                <div class="encounter-controls">
                    ${!encounter.minimized ? `
                        <button class="btn-small" onclick="toggleEncounterEdit(${encounterIndex})" style="background: ${encounterEditMode[encounterIndex] ? '#27ae60' : '#9b59b6'}; font-size: 16px;" title="${encounterEditMode[encounterIndex] ? 'Save changes' : 'Edit number fields'}">${encounterEditMode[encounterIndex] ? '💾' : '✎'}</button>
                    ` : ''}
                    ${showControls ? `
                        <button class="btn-small" onclick="addMonsterFromLibrary(${encounterIndex})" style="background: #27ae60;" title="Add a monster to this encounter">+</button>
                        <button class="btn-small" onclick="refreshPlayers(${encounterIndex})" style="background: #3498db;" title="Refresh player stats from Players section">↻ Players</button>
                        <button class="btn-small" onclick="refreshMonsterStats(${encounterIndex})" style="background: #e67e22;" title="Refresh monster stats from D&D Beyond cache">↻ Monsters</button>
                    ` : ''}
                    ${showControls ? `
                        <button class="btn-small" onclick="removeEncounter(${encounterIndex})" style="background: #e74c3c;" title="Delete this encounter">×</button>
                    ` : ''}
                </div>
            </div>
            <div style="display: ${encounter.minimized ? 'none' : 'flex'}; align-items: center; gap: 15px;">
                <span style="color: #666; font-weight: 500;">Round ${encounter.currentRound || 1}</span>
                <div class="encounter-controls">
                    ${encounterButtons}
                </div>
            </div>
        </div>
    `;
    card.appendChild(header);
    
    // Combatants table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    if (encounter.minimized) {
        tableContainer.style.display = 'none';
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th style="width: 30px;">Turn</th>
                <th style="width: 120px;">Name</th>
                <th style="width: 60px; text-align: center;">CR</th>
                <th style="width: 60px; text-align: center;">Init</th>
                <th style="width: 60px; text-align: center;">AC</th>
                <th style="width: 60px; text-align: center;">MaxHP</th>
                <th style="width: 60px; text-align: center;">HP</th>
                <th style="width: 60px; text-align: center;">Temp</th>
                <th style="width: 60px; text-align: center;">DMG</th>
                <th style="width: 60px; text-align: center;">Heal</th>
                <th style="width: 100px; text-align: center;">Status</th>
                <th>Notes</th>
                <th style="width: 40px;"></th>
            </tr>
        </thead>
        <tbody id="combatants-${encounterIndex}"></tbody>
    `;
    
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    
    // Render combatants
    const tbody = table.querySelector('tbody');
    if (!encounter.combatants) encounter.combatants = [];
    
    encounter.combatants.forEach((combatant, combatantIndex) => {
        const row = tbody.insertRow();
        const isPlayer = isPlayerCombatant(combatant);
        
        if (isPlayer) {

        }
        
        // Get combatant name
        const combatantName = getCombatantName(combatant);
        
        const isActive = encounter.state === 'started' && encounter.activeCombatant === combatantName;
        row.className = isActive ? 'combatant-row active' : 'combatant-row';
        
        // Look up details from player list or monster list
        let ac = combatant.ac || 10;
        let cr = combatant.cr || '';
        let dndBeyondUrl = combatant.dndBeyondUrl || '';
        
        if (isPlayer) {
            // Look up player details from players array using id field
            const player = currentAdventure.players?.find(p => {
                // Handle both full URL and just ID formats
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });

            if (player) {
                ac = player.ac || 10;
                dndBeyondUrl = player.dndBeyondUrl || '';
            }
        } else if (combatant.name) {
            // Look up monster details from DND_MONSTERS (only if not already saved on combatant)
            const baseName = combatant.name.split(' ')[0]; // Get base name (e.g., "Cultist" from "Cultist 2")
            const monster = DND_MONSTERS[baseName];
            if (monster) {
                // Only use dictionary values if combatant doesn't have them saved
                if (!combatant.ac) {
                    ac = monster.ac || 10;
                }
                if (!combatant.cr) {
                    cr = monster.cr || '';
                }
                if (!combatant.dndBeyondUrl) {
                    dndBeyondUrl = monster.url || '';
                }
            }
            
            // If still no CR but we have a D&D Beyond URL/ID, try to fetch from cached details
            if (!cr && (combatant.dndBeyondUrl || combatant.id)) {
                const monsterUrl = combatant.dndBeyondUrl || combatant.id;
                const fetchKey = `${encounterIndex}_${combatantIndex}`;
                // Only fetch if we haven't already fetched or aren't currently fetching
                if (monsterUrl && monsterUrl.includes('dndbeyond.com') && !crFetchStatus[fetchKey]) {
                    // Mark as fetching to prevent duplicate requests
                    crFetchStatus[fetchKey] = true;
                    // Try to get CR from server-side cache asynchronously
                    fetchCRFromCache(monsterUrl, encounterIndex, combatantIndex);
                }
            }
        }
        
        // Apply player background only if not active
        if (isPlayer && !isActive) {
            row.style.background = '#e8f4f8';
        }
        
        // Determine name display (clickable link or input)
        let nameHTML;
        const isUnconscious = (combatant.hp || 0) <= 0;
        const textColor = isUnconscious ? '#e74c3c' : '#2c5aa0';
        const inheritColor = isUnconscious ? '#e74c3c' : 'inherit';
        
        if (isPlayer) {
            // Players: always show tooltip with player data, link to URL if available
            const escapedName = combatantName.replace(/'/g, "\\'");
            const escapedUrl = dndBeyondUrl ? dndBeyondUrl.replace(/'/g, "\\'") : '';
            const playerUrl = escapedUrl || `player:${escapedName}`; // Use special identifier for local player data
            
            if (dndBeyondUrl) {
                nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                    class="monster-name-hover" 
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event)"
                    onmouseleave="hideMonsterTooltip()">${combatantName || ''}</a>`;
            } else {
                nameHTML = `<span style="font-weight: 500; color: ${inheritColor}; cursor: help;" 
                    class="monster-name-hover"
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event)"
                    onmouseleave="hideMonsterTooltip()">${combatantName || ''}</span>`;
            }
        } else if (encounterEditMode[encounterIndex]) {
            // Edit mode: show editable input for monster names
            nameHTML = `<input type="text" value="${(combatant.name || '').replace(/"/g, '&quot;')}" 
                style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-weight: 500;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'name', this.value)">`;
        } else if (dndBeyondUrl) {
            // NPCs/Monsters with URL: Make name a clickable link with tooltip
            const escapedUrl = dndBeyondUrl.replace(/'/g, "\\'");
            nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                class="monster-name-hover" 
                onmouseenter="showMonsterTooltip('${combatantName.replace(/'/g, "\\'")}', '${escapedUrl}', event)"
                onmouseleave="hideMonsterTooltip()">${combatantName || ''}</a>`;
        } else {
            // Monsters without URLs
            nameHTML = `<span style="font-weight: 500; color: ${inheritColor};">${combatantName || ''}</span>`;
        }
        
        // Build temp HP cell
        const tempHpValue = combatant.tempHp || 0;
        const tempHpCell = encounterEditMode[encounterIndex]
            ? `<input type="number" value="${tempHpValue}" style="width: 100%; text-align: center;" min="0"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'tempHp', Math.max(0, parseInt(this.value) || 0))">` 
            : `<span style="color: ${tempHpValue > 0 ? '#3498db' : '#999'}; font-weight: 500;">${tempHpValue}</span>`;
        
        // Build conditions cell
        const conditions = combatant.conditions || [];
        const concentrating = combatant.concentrating || false;
        let conditionsCell = '';
        
        if (encounter.state === 'complete' && !encounterEditMode[encounterIndex]) {
            // View mode: show condition badges only
            if (conditions.length === 0 && !concentrating) {
                conditionsCell = '<span style="color: #999;">-</span>';
            } else {
                const badges = conditions.map(c => {
                    const icon = CONDITION_ICONS[c] || '';
                    return `<span class="condition-badge" title="${c}">${icon}</span>`;
                }).join(' ');
                const concBadge = concentrating ? `<span class="condition-badge" title="Concentrating">${CONDITION_ICONS['Concentrating']}</span>` : '';
                conditionsCell = badges + concBadge;
            }
        } else {
            // Edit/active mode: show clickable icons or button
            if (conditions.length === 0 && !concentrating) {
                conditionsCell = `<button class="btn-small" onclick="openConditionsDialog(${encounterIndex}, ${combatantIndex})" 
                    style="background: #9b59b6; padding: 2px 6px; font-size: 11px;" title="Manage conditions">
                    -
                </button>`;
            } else {
                const badges = conditions.map(c => {
                    const icon = CONDITION_ICONS[c] || '';
                    return `<span class="condition-badge" style="cursor: pointer;" title="${c}" onclick="openConditionsDialog(${encounterIndex}, ${combatantIndex})">${icon}</span>`;
                }).join(' ');
                const concBadge = concentrating ? `<span class="condition-badge" style="cursor: pointer;" title="Concentrating" onclick="openConditionsDialog(${encounterIndex}, ${combatantIndex})">${CONDITION_ICONS['Concentrating']}</span>` : '';
                conditionsCell = badges + concBadge;
            }
        }
        
        // Build death saves cell for players at 0 HP
        let deathSavesCell = '';
        if (isPlayer && (combatant.hp || 0) <= 0 && encounter.state !== 'complete') {
            const saves = combatant.deathSaves || { successes: 0, failures: 0 };
            deathSavesCell = `
                <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px; font-size: 11px;">
                    <div title="Success" style="display: flex; gap: 2px;">
                        ${[1,2,3].map(i => `<span class="death-save-box ${saves.successes >= i ? 'checked' : ''}" 
                            onclick="toggleDeathSave(${encounterIndex}, ${combatantIndex}, 'successes', ${i})">✓</span>`).join('')}
                    </div>
                    <div title="Failure" style="display: flex; gap: 2px;">
                        ${[1,2,3].map(i => `<span class="death-save-box failure ${saves.failures >= i ? 'checked' : ''}" 
                            onclick="toggleDeathSave(${encounterIndex}, ${combatantIndex}, 'failures', ${i})">✗</span>`).join('')}
                    </div>
                </div>`;
        }
        
        // Populate initiativeBonus if missing
        if (combatant.initiativeBonus === undefined || combatant.initiativeBonus === null) {
            if (isPlayer && combatant.id) {
                // Look up from players list
                const player = currentAdventure.players.find(p => p.dndBeyondUrl === combatant.id);
                if (player && player.initiativeBonus !== undefined) {
                    combatant.initiativeBonus = player.initiativeBonus;
                }
            }
            // For monsters, initiativeBonus should come from fetchMonsterDetails
            // If still missing, it won't display the decimal
        }
        
        // Format initiative display with dex modifier
        let initiativeDisplay;
        const init = combatant.initiative || 0;
        const initBonus = combatant.initiativeBonus;
        if (initBonus !== undefined && initBonus !== null) {
            const modifier = initBonus < 0 ? 0 : initBonus;
            initiativeDisplay = `${init}<span style="font-size: 0.8em;">.${modifier}</span>`;
        } else {
            initiativeDisplay = init;
        }
        
        row.innerHTML = `
            <td style="text-align: center;">${(encounter.state === 'started' && encounter.activeCombatant === combatantName) ? '▶' : ''}</td>
            <td>${nameHTML}${deathSavesCell}</td>
            <td style="text-align: center;">${isPlayer ? '<span style="color: #999;">-</span>' : `<span style="color: #666; font-weight: 500;">${cr}</span>`}</td>
            <td style="text-align: center;">${!encounter.state || encounterEditMode[encounterIndex] ? `<input type="number" value="${combatant.initiative || 0}" style="text-align: center;" onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'initiative', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${initiativeDisplay}</span>`}</td>
            <td style="text-align: center;"><span style="color: #666; font-weight: 500;">${ac}</span></td>
            <td style="text-align: center;">${!encounter.state || encounterEditMode[encounterIndex] ? `<input type="number" value="${combatant.maxHp || 0}" style="text-align: center; width: 100%;" onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'maxHp', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.maxHp || 0}</span>`}</td>
            <td style="text-align: center;">${encounterEditMode[encounterIndex] ? `<input type="number" class="hp-input" value="${combatant.hp || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'hp', parseInt(this.value))">` : `<span style="color: ${(combatant.hp || 0) <= 0 ? '#e74c3c' : '#666'}; font-weight: 500;">${combatant.hp || 0}</span>`}</td>
            <td style="text-align: center;">${tempHpCell}</td>
            <td style="text-align: center;">${encounterEditMode[encounterIndex] ? `<input type="number" class="dmg-input" value="${combatant.dmg || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'dmg', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.dmg || 0}</span>`}</td>
            <td style="text-align: center;">${encounterEditMode[encounterIndex] ? `<input type="number" class="heal-input" value="${combatant.heal || 0}" style="width: 100%; text-align: center; box-sizing: border-box; padding-left: 12px; padding-right: 0;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'heal', parseInt(this.value))">` : `<span style="color: #666; font-weight: 500;">${combatant.heal || 0}</span>`}</td>
            <td style="text-align: center;">${conditionsCell}</td>
            <td><input type="text" value="${combatant.notes || ''}" 
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'notes', this.value)"></td>
            <td>${showControls ? `<button class="btn-small" onclick="removeCombatant(${encounterIndex}, ${combatantIndex})" style="background: #e74c3c;" title="Delete this combatant">×</button>` : ''}</td>
        `;
    });
    
    // Treasure section (always shown at the end)
    if (!encounter.minimized) {
        const treasureDiv = document.createElement('div');
        treasureDiv.className = 'treasure-section';
        treasureDiv.style.cssText = 'background: #fff8dc; border: 2px solid #f39c12; border-radius: 5px; padding: 10px; margin: 10px 0; font-family: monospace;';
        
        // Initialize treasure if it doesn't exist
        if (!encounter.treasure) {
            encounter.treasure = 'No treasure generated yet. Click regenerate to generate treasure.';
        }
        
        treasureDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <strong style="color: #d68910;">💰 Treasure & Loot:</strong>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-small" onclick="generateLoot(${encounterIndex})" style="background: #3498db;" title="Regenerate treasure">↻</button>
                </div>
            </div>
            <div id="treasure-content-${encounterIndex}" style="white-space: pre-wrap; color: #333;">${encounterEditMode[encounterIndex] ? `<textarea style="width: 100%; min-height: 100px; font-family: monospace; padding: 5px; border: 1px solid #ddd; border-radius: 3px;" onchange="updateTreasure(${encounterIndex}, this.value)">${encounter.treasure}</textarea>` : encounter.treasure}</div>
        `;
        card.appendChild(treasureDiv);
    }
    
    return card;
}

// Add encounter
function addEncounter() {
    // Auto-populate with players
    const combatants = currentAdventure.players.map(player => {
        // Extract player ID from dndBeyondUrl
        const playerId = player.dndBeyondUrl?.split('/').pop() || player.dndBeyondUrl || '';
        return {
            id: playerId,
            initiative: 0,
            hp: player.maxHp || 0,
            maxHp: player.maxHp || 0,
            ac: player.ac || 10,
            notes: '',
            dndBeyondUrl: player.dndBeyondUrl || ''
        };
    });
    
    const newEncounterIndex = currentAdventure.encounters.length;
    
    currentAdventure.encounters.push({
        name: 'New Encounter',
        chapter: currentChapter,
        combatants: combatants,
        currentTurn: 0,
        minimized: false  // Expanded by default for new encounters
    });
    renderEncounters();
    autoSave();
    
    // Focus the title input of the newly added encounter
    setTimeout(() => {
        const encounterCards = document.querySelectorAll('.encounter-title');
        // Find the encounter card for this chapter
        const chapterEncounters = currentAdventure.encounters
            .map((encounter, index) => ({ encounter, index }))
            .filter(({ encounter }) => encounter.chapter === currentChapter);
        
        // The new encounter is the last one in the filtered list
        const newEncounterPosition = chapterEncounters.findIndex(({ index }) => index === newEncounterIndex);
        if (newEncounterPosition >= 0 && encounterCards[newEncounterPosition]) {
            encounterCards[newEncounterPosition].focus();
            encounterCards[newEncounterPosition].select();
        }
    }, 50);
}

// Toggle encounter minimize state
function toggleEncounterMinimize(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.minimized = !encounter.minimized;
    renderEncounters();
    autoSave();
}

// Update encounter name
function updateEncounterName(encounterIndex, name) {
    currentAdventure.encounters[encounterIndex].name = name;
    autoSave();
}

// Remove encounter
function removeEncounter(encounterIndex) {
    if (confirm('Delete this encounter?')) {
        currentAdventure.encounters.splice(encounterIndex, 1);
        renderEncounters();
        autoSave();
    }
}

// Add monster from library
let currentEncounterIndex = null;

async function addMonsterFromLibrary(encounterIndex) {
    // Ensure monsters are loaded
    if (!monstersLoaded) {
        await loadMonsters();
    }
    
    currentEncounterIndex = encounterIndex;
    openMonsterModal();
}

// Open monster selection modal
function openMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'flex';
    
    const searchInput = document.getElementById('monsterSearch');
    searchInput.value = '';
    searchInput.focus();
    
    // Initial render
    renderMonsterList('');
}

// Close monster modal
function closeMonsterModal() {
    const modal = document.getElementById('monsterModal');
    modal.style.display = 'none';
    currentEncounterIndex = null;
}

// Render monster list based on search
function renderMonsterList(searchTerm) {
    const monsterList = document.getElementById('monsterList');
    const monsterCount = document.getElementById('monsterCount');
    
    // Get all monsters sorted by CR
    const allMonsters = Object.keys(DND_MONSTERS).sort((a, b) => {
        const crA = parseCR(DND_MONSTERS[a].cr);
        const crB = parseCR(DND_MONSTERS[b].cr);
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
        const monster = DND_MONSTERS[name];
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

// Select monster and add to encounter
function selectMonster(monsterName) {
    console.log('selectMonster called with:', monsterName);
    const monster = DND_MONSTERS[monsterName];
    if (!monster) {
        console.error('Monster not found in DND_MONSTERS:', monsterName);
        console.log('Available monsters:', Object.keys(DND_MONSTERS).slice(0, 10));
        alert(`Monster "${monsterName}" not found in monster library.`);
        return;
    }
    
    console.log('Monster found:', monster);
    
    // Validate we have a valid encounter selected
    if (!currentAdventure || !currentAdventure.encounters || currentEncounterIndex === null || !currentAdventure.encounters[currentEncounterIndex]) {
        console.error('No valid encounter selected');
        alert('Please create an encounter first before adding monsters.');
        closeMonsterModal();
        return;
    }
    
    // Save the encounter index before closing modal
    const encounterIndex = currentEncounterIndex;
    
    // Ensure combatants array exists
    if (!currentAdventure.encounters[encounterIndex].combatants) {
        currentAdventure.encounters[encounterIndex].combatants = [];
    }
    
    closeMonsterModal();
    
    // Ask for quantity
    const quantity = parseInt(prompt(`How many ${monsterName}(s)?`, '1')) || 1;
    
    // Find existing monsters with the same name to determine starting number
    const existingCombatants = currentAdventure.encounters[encounterIndex].combatants;
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
        currentAdventure.encounters[encounterIndex].combatants.push({
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
    renderEncounters();
    autoSave();
    
    // Fetch detailed stats from D&D Beyond (JIT)
    fetchMonsterDetails(monster.url, encounterIndex, monsterName);
}

// Fetch monster details from D&D Beyond (JIT)
async function fetchMonsterDetails(monsterUrl, encounterIndex, monsterName) {
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
        console.log(`Fetched details for ${monsterName}:`, details);
        
        // Check if we got any useful data
        if (!details.ac && !details.hp) {
            console.warn(`No AC or HP found for ${monsterName}`);
            showToast(`No stats found for ${monsterName} - please enter manually`, 'warning', 5000);
            return;
        }
        
        // Update all combatants with this monster name that have default values
        const encounter = currentAdventure.encounters[encounterIndex];
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
            renderEncounters();
            autoSave();
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
            renderEncounters();
            autoSave();
        }
        
    } catch (error) {
        console.error('Error fetching monster details:', error);
        showToast(`Error fetching ${monsterName} details: ${error.message}`, 'error', 5000);
    }
}

// Fetch CR from cached monster data
async function fetchCRFromCache(monsterUrl, encounterIndex, combatantIndex) {
    try {
        const encodedUrl = encodeURIComponent(monsterUrl);
        const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.success && data.details && data.details.cr) {
            // Update the combatant's CR only if it changed
            const encounter = currentAdventure.encounters[encounterIndex];
            if (encounter && encounter.combatants[combatantIndex]) {
                const combatant = encounter.combatants[combatantIndex];
                const newCR = data.details.cr;
                
                // Only update and re-render if the CR actually changed
                if (combatant.cr !== newCR) {
                    combatant.cr = newCR;
                    renderEncounters();
                    autoSave();
                }
            }
        }
    } catch (error) {
        // Silently fail - this is just for backfilling missing CRs
        console.log(`Could not fetch CR for ${monsterUrl}:`, error.message);
    }
}


// Helper to parse CR for sorting
function parseCR(cr) {
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

// Add custom combatant (old function renamed)
function addCustomCombatant(encounterIndex) {
    currentAdventure.encounters[encounterIndex].combatants.push({
        name: '',
        initiative: 0,
        hp: 0,
        maxHp: 0,
        ac: 10,
        cr: '',
        dndBeyondUrl: '',
        notes: ''
    });
    renderEncounters();
    autoSave();
}

// Update combatant
function updateCombatant(encounterIndex, combatantIndex, field, value) {
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    // Apply HP constraints
    if (field === 'hp') {
        const maxHp = combatant.maxHp || 0;
        const isPlayer = isPlayerCombatant(combatant);
        
        // Don't let HP go above maxHP
        if (value > maxHp) {
            value = maxHp;
        }
        
        // Don't let player HP go below 0
        if (isPlayer && value < 0) {
            value = 0;
        }
    }
    
    combatant[field] = value;
    renderEncounters();
    autoSave();
}

// Remove combatant
function removeCombatant(encounterIndex, combatantIndex) {
    if (confirm('Remove this combatant?')) {
        currentAdventure.encounters[encounterIndex].combatants.splice(combatantIndex, 1);
        renderEncounters();
        autoSave();
    }
}

// Sort by initiative
function sortInitiative(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Populate initiativeBonus if missing
    encounter.combatants.forEach(combatant => {
        if (combatant.initiativeBonus === undefined || combatant.initiativeBonus === null) {
            if (isPlayerCombatant(combatant) && combatant.id) {
                // Look up from players list
                const player = currentAdventure.players.find(p => p.dndBeyondUrl === combatant.id);
                if (player && player.initiativeBonus !== undefined) {
                    combatant.initiativeBonus = player.initiativeBonus;
                }
            }
        }
    });
    
    encounter.combatants.sort((a, b) => {
        const initA = a.initiative || 0;
        const initB = b.initiative || 0;
        
        // If initiative is the same, use initiative bonus as tiebreaker
        if (initA === initB) {
            const bonusA = a.initiativeBonus || 0;
            const bonusB = b.initiativeBonus || 0;
            if (bonusA === bonusB) {
                // Final tiebreaker: use combatant name/id for stable sort
                const nameA = getCombatantName(a) || a.id || '';
                const nameB = getCombatantName(b) || b.id || '';
                return nameA.localeCompare(nameB);
            }
            return bonusB - bonusA;
        }
        
        return initB - initA;
    });
    renderEncounters();
    autoSave();
}

// Refresh players in encounter from top players list
function refreshPlayers(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Remove all player combatants from the encounter
    encounter.combatants = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    // Add all players from the Players section
    currentAdventure.players.forEach(player => {
        // Extract just the ID from dndBeyondUrl (handles both full URLs and bare IDs)
        const playerId = player.dndBeyondUrl ? player.dndBeyondUrl.split('/').pop() : '';
        
        encounter.combatants.push({
            id: playerId, // Store player ID for lookup
            initiative: 0,
            initiativeBonus: player.initiativeBonus || 0,
            hp: player.maxHp || 0,
            maxHp: player.maxHp || 0,
            ac: player.ac || 10,
            notes: '',
            dndBeyondUrl: player.dndBeyondUrl || ''
        });
    });
    
    // Reset encounter to never started state
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    renderEncounters();
    autoSave();
}

// Refresh monster stats (including initiativeBonus) from cache
async function refreshMonsterStats(encounterIndex, showNotification = true) {
    const encounter = currentAdventure.encounters[encounterIndex];
    if (!encounter || !encounter.combatants) return;
    
    const monsters = encounter.combatants.filter(c => !isPlayerCombatant(c) && c.dndBeyondUrl);
    
    if (monsters.length === 0) {
        if (showNotification) showToast('No monsters to refresh', 'info');
        return;
    }
    
    if (showNotification) showToast(`Refreshing ${monsters.length} monster(s)...`, 'info');
    
    // Group by URL to avoid duplicate fetches
    const urlToMonsters = {};
    monsters.forEach(m => {
        if (m.dndBeyondUrl) {
            if (!urlToMonsters[m.dndBeyondUrl]) {
                urlToMonsters[m.dndBeyondUrl] = [];
            }
            urlToMonsters[m.dndBeyondUrl].push(m);
        }
    });
    
    // Fetch each unique monster
    for (const url of Object.keys(urlToMonsters)) {
        try {
            const encodedUrl = encodeURIComponent(url);
            const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.details) {
                    const details = data.details;
                    // Update all monsters with this URL
                    urlToMonsters[url].forEach(monster => {
                        if (details.initiativeModifier !== undefined) {
                            monster.initiativeBonus = details.initiativeModifier;
                            // Roll new initiative with the updated bonus
                            const d20 = Math.floor(Math.random() * 20) + 1;
                            monster.initiative = d20 + details.initiativeModifier;
                        }
                        if (details.ac) monster.ac = details.ac;
                        if (details.hp) {
                            monster.maxHp = details.hp;
                            if (monster.hp === 0) monster.hp = details.hp;
                        }
                        if (details.cr) monster.cr = details.cr;
                        if (details.avatarUrl) monster.avatarUrl = details.avatarUrl;
                    });
                }
            }
        } catch (error) {
            console.error('Error refreshing monster:', error);
        }
    }
    
    if (showNotification) showToast('Monster stats refreshed!', 'success', 2000);
    renderEncounters();
    autoSave();
}

// Toggle death save success/failure
function toggleDeathSave(encounterIndex, combatantIndex, type, value) {
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    // Initialize death saves if not present
    if (!combatant.deathSaves) {
        combatant.deathSaves = { successes: 0, failures: 0 };
    }
    
    // Toggle the value
    if (combatant.deathSaves[type] === value) {
        combatant.deathSaves[type] = value - 1;
    } else {
        combatant.deathSaves[type] = value;
    }
    
    // Check for stabilization or death
    if (combatant.deathSaves.successes >= 3) {
        combatant.hp = 1;
        combatant.deathSaves = { successes: 0, failures: 0 };
        alert(`${getCombatantName(combatant)} has stabilized!`);
    } else if (combatant.deathSaves.failures >= 3) {
        alert(`${getCombatantName(combatant)} has died!`);
    }
    
    renderEncounters();
    autoSave();
}

// Open conditions dialog
function openConditionsDialog(encounterIndex, combatantIndex) {
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    const conditions = combatant.conditions || [];
    const concentrating = combatant.concentrating || false;
    
    // Build checkbox list
    let html = '<div style="max-height: 600px; overflow-y: auto; padding: 10px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 15px;">Manage Conditions</h3>';
    
    // All conditions checkboxes (including Concentrating)
    html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">';
    DND_CONDITIONS.forEach(condition => {
        let checked = false;
        if (condition === 'Concentrating') {
            checked = concentrating;
        } else {
            checked = conditions.includes(condition);
        }
        const icon = CONDITION_ICONS[condition] || '';
        const inputId = condition === 'Concentrating' ? 'id="cond-concentrating"' : 'class="condition-checkbox"';
        html += `<label style="display: flex; align-items: center; cursor: pointer; padding: 5px;">
            <input type="checkbox" ${inputId} value="${condition}" ${checked ? 'checked' : ''} 
                style="width: 16px; height: 16px; margin-right: 6px;">
            ${icon} ${condition}
        </label>`;
    });
    html += '</div>';
    html += '</div>';
    
    // Show modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'conditionsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            ${html}
            <div style="display: flex; gap: 10px; margin-top: 20px; padding: 0 10px 10px 10px;">
                <button class="btn" onclick="clearConditions(${encounterIndex}, ${combatantIndex})" style="flex: 1; background: #95a5a6;">Clear</button>
                <button class="btn" onclick="saveConditions(${encounterIndex}, ${combatantIndex})" style="flex: 1;">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Store modal reference for save function
    modal.setAttribute('data-encounter', encounterIndex);
    modal.setAttribute('data-combatant', combatantIndex);
}

// Close conditions modal
function closeConditionsModal() {
    const modal = document.getElementById('conditionsModal');
    if (modal) {
        modal.remove();
    }
}

// Save conditions from dialog
function saveConditions(encounterIndex, combatantIndex) {
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    // Get selected conditions
    const checkboxes = document.querySelectorAll('.condition-checkbox:checked');
    const selectedConditions = Array.from(checkboxes).map(cb => cb.value);
    
    // Get concentration state
    const concentratingCheckbox = document.getElementById('cond-concentrating');
    const concentrating = concentratingCheckbox ? concentratingCheckbox.checked : false;
    
    // Update combatant
    combatant.conditions = selectedConditions;
    combatant.concentrating = concentrating;
    
    closeConditionsModal();
    renderEncounters();
    autoSave();
}

// Clear all conditions
function clearConditions(encounterIndex, combatantIndex) {
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    // Clear all conditions
    combatant.conditions = [];
    combatant.concentrating = false;
    
    closeConditionsModal();
    renderEncounters();
    autoSave();
}


// Reset encounter to unstarted state
function resetEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Reset to unstarted state
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    // Clear edit mode
    delete encounterEditMode[encounterIndex];
    
    renderEncounters();
    autoSave();
}

// Toggle edit mode for completed encounters
function toggleEncounterEdit(encounterIndex) {
    encounterEditMode[encounterIndex] = !encounterEditMode[encounterIndex];
    renderEncounters();
    
    // If we're saving (turning edit mode off), trigger autosave
    if (!encounterEditMode[encounterIndex]) {
        autoSave();
    }
}

// Generate treasure/loot based on encounter enemies
function generateLoot(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    
    // Get all non-player combatants
    const enemies = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    if (enemies.length === 0) {
        alert('No enemies in this encounter to generate loot from!');
        return;
    }
    
    // Calculate total CR value
    let totalCR = 0;
    enemies.forEach(enemy => {
        const cr = enemy.cr || '0';
        if (cr === '1/8') totalCR += 0.125;
        else if (cr === '1/4') totalCR += 0.25;
        else if (cr === '1/2') totalCR += 0.5;
        else totalCR += parseFloat(cr) || 0;
    });
    
    let loot = [];
    
    // Individual treasure (coins)
    if (totalCR < 1) {
        const copper = Math.floor(Math.random() * 20) + 1;
        const silver = Math.floor(Math.random() * 10);
        loot.push(`Coins: ${copper} CP${silver > 0 ? ', ' + silver + ' SP' : ''}`);
    } else if (totalCR < 5) {
        const silver = Math.floor(Math.random() * 30) + 10;
        const gold = Math.floor(Math.random() * 10);
        loot.push(`Coins: ${silver} SP${gold > 0 ? ', ' + gold + ' GP' : ''}`);
    } else if (totalCR < 11) {
        const gold = Math.floor(Math.random() * 50) + 20;
        const platinum = Math.floor(Math.random() * 5);
        loot.push(`Coins: ${gold} GP${platinum > 0 ? ', ' + platinum + ' PP' : ''}`);
    } else if (totalCR < 17) {
        const gold = Math.floor(Math.random() * 100) + 50;
        const platinum = Math.floor(Math.random() * 20) + 5;
        loot.push(`Coins: ${gold} GP, ${platinum} PP`);
    } else {
        const gold = Math.floor(Math.random() * 200) + 100;
        const platinum = Math.floor(Math.random() * 50) + 20;
        loot.push(`Coins: ${gold} GP, ${platinum} PP`);
    }
    
    // Add gems/art objects for higher CR
    if (totalCR >= 3) {
        const numGems = Math.floor(Math.random() * 3) + 1;
        const gemValues = [10, 50, 100, 500, 1000];
        const gemValue = gemValues[Math.min(Math.floor(totalCR / 4), 4)];
        const gemTypes = ['agate', 'quartz', 'onyx', 'jade', 'pearl', 'topaz', 'ruby', 'sapphire', 'emerald', 'diamond'];
        const gemType = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        loot.push(`Gems: ${numGems}× ${gemValue} GP ${gemType}`);
    }
    
    // Add art objects for high CR
    if (totalCR >= 5) {
        const artItems = [
            'silver ewer',
            'carved bone statuette',
            'gold bracelet',
            'embroidered silk handkerchief',
            'small gold idol',
            'gold dragon comb with red garnet eye',
            'painted wooden mask',
            'silver chalice with moonstones'
        ];
        const artValue = totalCR >= 10 ? 750 : totalCR >= 7 ? 250 : 100;
        const artItem = artItems[Math.floor(Math.random() * artItems.length)];
        loot.push(`Art: ${artValue} GP ${artItem}`);
    }
    
    // Magic items for very high CR
    if (totalCR >= 8) {
        const magicItems = [
            'Potion of Healing',
            'Potion of Greater Healing',
            'Spell Scroll (random spell)',
            '+1 Weapon',
            'Bag of Holding',
            'Cloak of Protection',
            'Ring of Protection',
            'Wand of Magic Missiles',
            'Boots of Elvenkind',
            'Gauntlets of Ogre Power'
        ];
        const numItems = totalCR >= 15 ? 2 : 1;
        for (let i = 0; i < numItems; i++) {
            const item = magicItems[Math.floor(Math.random() * magicItems.length)];
            loot.push(`Magic Item: ${item}`);
        }
    }
    
    // Mundane equipment
    const mundaneItems = [
        'rope (50 ft)',
        'torches (5)',
        'rations (1 week)',
        'waterskin',
        'bedroll',
        'tinderbox',
        'backpack',
        'common clothes',
        'belt pouch',
        'hempen rope'
    ];
    if (Math.random() > 0.5) {
        const item = mundaneItems[Math.floor(Math.random() * mundaneItems.length)];
        loot.push(`Equipment: ${item}`);
    }
    
    // Set the treasure
    encounter.treasure = loot.join('\n');
    
    renderEncounters();
    autoSave();
}

// Clear treasure from encounter
function clearLoot(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.treasure = '';
    renderEncounters();
    autoSave();
}

// Toggle treasure editing mode
// Update treasure text
function updateTreasure(encounterIndex, value) {
    currentAdventure.encounters[encounterIndex].treasure = value;
    autoSave();
}

// Start encounter - sort by initiative and mark as started
function startEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.combatants.sort((a, b) => {
        const initA = a.initiative || 0;
        const initB = b.initiative || 0;
        
        // If initiative is the same, use initiative bonus as tiebreaker
        if (initA === initB) {
            const bonusA = a.initiativeBonus || 0;
            const bonusB = b.initiativeBonus || 0;
            if (bonusA === bonusB) {
                // Final tiebreaker: use combatant name/id for stable sort
                const nameA = getCombatantName(a) || a.id || '';
                const nameB = getCombatantName(b) || b.id || '';
                return nameA.localeCompare(nameB);
            }
            return bonusB - bonusA;
        }
        
        return initB - initA;
    });
    encounter.state = 'started';
    encounter.currentTurn = 0;
    encounter.currentRound = 1;
    
    // Set first combatant as active
    if (encounter.combatants.length > 0) {
        encounter.activeCombatant = getCombatantName(encounter.combatants[0]);
    }
    
    renderEncounters();
    autoSave();
    
    // Fetch and display spectator URL
    updateSpectatorUrl(encounterIndex);
}

// Fetch server info and update spectator URL display
async function updateSpectatorUrl(encounterIndex) {
    // If we already have the URL cached, use it immediately
    if (cachedSpectatorUrl) {
        const urlElement = document.getElementById(`spectatorUrl-${encounterIndex}`);
        const containerElement = document.getElementById(`spectatorUrlContainer-${encounterIndex}`);
        if (urlElement) {
            urlElement.textContent = cachedSpectatorUrl;
            urlElement.dataset.url = cachedSpectatorUrl;
            if (containerElement) {
                containerElement.style.display = '';
            }
        }
        return;
    }
    
    try {
        const response = await fetch('/api/server-info');
        const data = await response.json();
        const url = `http://${data.ip}:${data.port}/spectator`;
        cachedSpectatorUrl = url; // Cache for future use
        
        const urlElement = document.getElementById(`spectatorUrl-${encounterIndex}`);
        const containerElement = document.getElementById(`spectatorUrlContainer-${encounterIndex}`);
        if (urlElement) {
            urlElement.textContent = url;
            urlElement.dataset.url = url;
            // Show the container now that we have the URL
            if (containerElement) {
                containerElement.style.display = '';
            }
        }
    } catch (error) {
        console.error('Error fetching server info:', error);
    }
}

// Copy spectator URL to clipboard
function copySpectatorUrl(encounterIndex) {
    const urlElement = document.getElementById(`spectatorUrl-${encounterIndex}`);
    if (urlElement && urlElement.dataset.url) {
        navigator.clipboard.writeText(urlElement.dataset.url).then(() => {
            // Visual feedback
            const originalText = urlElement.textContent;
            urlElement.textContent = '✓ Copied!';
            urlElement.style.color = '#4caf50';
            setTimeout(() => {
                urlElement.textContent = originalText;
                urlElement.style.color = '#1976d2';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy URL. Please copy manually: ' + urlElement.dataset.url);
        });
    }
}

// End encounter - mark as not started
function endEncounter(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.state = 'complete';
    encounter.currentTurn = 0;
    // Keep currentRound to show final count
    
    // Clear active state
    encounter.activeCombatant = null;
    
    renderEncounters();
    autoSave();
}

// Next turn
function nextTurn(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    const combatants = encounter.combatants;
    
    // Only advance turn if encounter is started
    if (encounter.state !== 'started' || combatants.length === 0) return;
    
    // Find next
    let currentIndex = encounter.currentTurn || 0;
    currentIndex = (currentIndex + 1) % combatants.length;
    
    // Increment round when we wrap back to the first combatant
    if (currentIndex === 0) {
        encounter.currentRound = (encounter.currentRound || 1) + 1;
    }
    
    encounter.activeCombatant = getCombatantName(combatants[currentIndex]);
    encounter.currentTurn = currentIndex;
    
    renderEncounters();
    autoSave();
}

function previousTurn(encounterIndex) {
    const encounter = currentAdventure.encounters[encounterIndex];
    const combatants = encounter.combatants;
    
    // Only go back if encounter is started
    if (encounter.state !== 'started' || combatants.length === 0) return;
    
    // Find previous
    let currentIndex = encounter.currentTurn || 0;
    currentIndex = (currentIndex - 1 + combatants.length) % combatants.length;
    
    // Decrement round when we wrap back to the last combatant
    if (currentIndex === combatants.length - 1) {
        encounter.currentRound = Math.max(1, (encounter.currentRound || 1) - 1);
    }
    
    encounter.activeCombatant = getCombatantName(combatants[currentIndex]);
    encounter.currentTurn = currentIndex;
    
    renderEncounters();
    autoSave();
}

// Auto-save
function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        const name = document.getElementById('adventureSelect').value;
        if (!name) return;
        
        // Safety check: only save if currentAdventure is loaded and matches the selected adventure
        if (!currentAdventure || currentAdventure.name !== name) {
            console.warn('AutoSave blocked: currentAdventure does not match selected adventure');
            return;
        }
        
        const response = await fetch(`/api/adventure/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentAdventure)
        });
        
        if (response.status === 403) {
            // Session expired or invalid - clear state and prompt for reload
            alert('Your session has expired. Please reload the page and re-enter your PIN.');
            currentAdventure = null;
            document.getElementById('adventureSelect').value = '';
            document.getElementById('adventureContent').style.display = 'none';
            return;
        }
        
        if (response.ok) {
            showSaveIndicator();
        }
    }, 500);
}

// Show save indicator
function showSaveIndicator() {
    let indicator = document.querySelector('.auto-save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'auto-save-indicator';
        indicator.textContent = '✓ Saved';
        document.body.appendChild(indicator);
    }
    
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
}
// Monster Tooltip System
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
function renderTooltipContent(tooltip, entityName, details, isCharacter = false) {
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
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Actions</div>';
        details.actions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
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

function showMonsterTooltip(entityName, entityUrl, event) {
    console.log('showMonsterTooltip called:', entityName, entityUrl);
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
        console.log('Using cached details:', cachedDetails);
        tooltip.style.display = 'block';
        positionTooltip(event);
        renderTooltipContent(tooltip, entityName, cachedDetails, isCharacter);
        return;
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
    
    console.log('No full cached details, fetching from server...');
    
    // Otherwise, show loading and fetch from server
    const loadingText = isCharacter ? 'Loading character details...' : 'Loading monster details...';
    tooltip.innerHTML = `<div class="monster-tooltip-loading">${loadingText}</div>`;
    tooltip.style.display = 'block';
    positionTooltip(event);
    
    // Fetch details from appropriate endpoint
    const apiEndpoint = isCharacter ? 
        `/api/dndbeyond/character/${encodeURIComponent(entityUrl)}` :
        `/api/dndbeyond/monster/${encodeURIComponent(entityUrl)}`;
    
    console.log('Fetching from:', apiEndpoint);
    
    fetch(apiEndpoint)
        .then(response => {
            console.log('Response received:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            console.log('Data structure - success:', data.success, 'details:', data.details ? 'exists' : 'missing', 'error:', data.error);
            // Only update if this is still the current tooltip
            if (currentTooltipMonster !== entityName) return;
            
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
                                renderTooltipContent(tooltip, entityName, player, true);
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
            console.log('Extracted details:', details);
            console.log('Details has abilities?', details.abilities ? 'yes' : 'no');
            console.log('Details has hp?', details.hp !== undefined ? 'yes' : 'no');
            renderTooltipContent(tooltip, entityName, details, isCharacter);
            
            // Reposition after content is loaded in case size changed
            positionTooltip(event);
        })
        .catch(error => {
            console.error(`Error fetching ${entityType} details:`, error);
            if (currentTooltipMonster === entityName) {
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