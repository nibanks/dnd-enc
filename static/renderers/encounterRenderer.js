/**
 * Encounter Renderer Module
 * Comprehensive encounter rendering, state management, and combatant interactions
 * Extracted from script.js - ~1500 lines of encounter logic
 */

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if combatant is a player (vs monster/NPC)
 */
export function isPlayerCombatant(combatant) {
    return !combatant.hasOwnProperty('name');
}

/**
 * Get combatant display name (look up from players if needed)
 */
export function getCombatantName(combatant) {
    const currentAdventure = window.currentAdventure;
    
    if (isPlayerCombatant(combatant)) {
        if (combatant.id && currentAdventure?.players) {
            const player = currentAdventure.players.find(p => {
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });
            if (player) return player.name;
        }
        return 'Unknown Player';
    }
    return combatant.name || '';
}

/**
 * Get DEX score for sorting tiebreaker
 */
export function getDexScore(combatant) {
    const currentAdventure = window.currentAdventure;
    
    if (isPlayerCombatant(combatant)) {
        if (combatant.id && currentAdventure?.players) {
            const player = currentAdventure.players.find(p => {
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });
            if (player?.abilityScores) {
                return player.abilityScores.dex || 10;
            }
        }
        return 10;
    }
    if (combatant.dexScore !== undefined) {
        return combatant.dexScore;
    }
    const bonus = combatant.initiativeBonus || 0;
    return 10 + (bonus * 2);
}

// ==================== CALCULATION FUNCTIONS ====================

/**
 * Calculate total XP for an encounter
 */
export function calculateEncounterXP(encounter) {
    if (!encounter || !encounter.combatants) return 0;
    
    const CR_TO_XP = window.CR_TO_XP || {};
    const DND_MONSTERS = window.DND_MONSTERS || {};
    
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

/**
 * Parse CR string to numeric value
 */
function parseCR(cr) {
    if (!cr) return 0;
    if (typeof cr === 'number') return cr;
    
    const crStr = String(cr);
    if (crStr.includes('/')) {
        const parts = crStr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(crStr) || 0;
}

/**
 * Format numeric CR back to string
 */
function formatCR(numericCR) {
    if (numericCR === 0) return '0';
    if (numericCR < 1) {
        if (numericCR === 0.125) return '1/8';
        if (numericCR === 0.25) return '1/4';
        if (numericCR === 0.5) return '1/2';
    }
    return String(Math.round(numericCR));
}

/**
 * Calculate default CR for an encounter based on combatants
 */
export function calculateDefaultEncounterCR(encounter) {
    if (!encounter || !encounter.combatants) return '0';
    
    const CR_TO_XP = window.CR_TO_XP || {};
    const DND_MONSTERS = window.DND_MONSTERS || {};
    
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

/**
 * Get encounter CR (custom or calculated)
 */
export function getEncounterCR(encounter) {
    if (encounter.totalCR) {
        return encounter.totalCR;
    }
    return calculateDefaultEncounterCR(encounter);
}

// ==================== DRAG & DROP HANDLERS ====================

let draggedEncounterIndex = null;
let dropTargetIndex = null;

export function handleDragStart(e) {
    const card = e.currentTarget.closest('.encounter-card');
    if (card) {
        draggedEncounterIndex = parseInt(card.dataset.encounterIndex);
        card.style.opacity = '0.4';
    }
    e.dataTransfer.effectAllowed = 'move';
}

export function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

export function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    const card = e.currentTarget.closest('.encounter-card') || e.currentTarget;
    if (card && card.dataset.encounterIndex) {
        const targetIndex = parseInt(card.dataset.encounterIndex);
        
        if (draggedEncounterIndex !== null && draggedEncounterIndex !== targetIndex) {
            dropTargetIndex = targetIndex;
        }
    }
    
    return false;
}

export function handleDragEnd(e) {
    const currentAdventure = window.currentAdventure;
    const renderEncounters = window.renderEncounters;
    
    if (draggedEncounterIndex !== null && dropTargetIndex !== null && draggedEncounterIndex !== dropTargetIndex) {
        const draggedEncounter = currentAdventure.encounters[draggedEncounterIndex];
        currentAdventure.encounters.splice(draggedEncounterIndex, 1);
        
        const newIndex = draggedEncounterIndex < dropTargetIndex ? dropTargetIndex - 1 : dropTargetIndex;
        currentAdventure.encounters.splice(newIndex, 0, draggedEncounter);
        
        if (renderEncounters) renderEncounters();
    } else {
        const card = e.currentTarget.closest('.encounter-card');
        if (card) {
            card.style.opacity = '1';
        }
    }
    
    draggedEncounterIndex = null;
    dropTargetIndex = null;
}

// ==================== MAIN RENDERING ====================

/**
 * Render all encounters for current chapter
 */
export function renderEncounters() {
    const container = document.getElementById('encountersContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const currentAdventure = window.currentAdventure;
    const currentChapter = window.currentChapter;
    
    if (!currentAdventure) {
        console.warn('renderEncounters called but currentAdventure is null');
        return;
    }
    
    if (!currentAdventure.encounters) {
        currentAdventure.encounters = [];
    }
    
    // Filter encounters by current chapter
    const chapterEncounters = currentAdventure.encounters
        .map((encounter, index) => ({ encounter, index }))
        .filter(({ encounter }) => encounter.chapter === currentChapter);
    
    chapterEncounters.forEach(({ encounter, index }) => {
        // Set default minimized state
        if (encounter.minimized === undefined) {
            encounter.minimized = encounter.state !== 'started';
        }
        
        // Sort started encounters by initiative on page load
        if (encounter.state === 'started') {
            encounter.combatants.forEach(combatant => {
                if (combatant.initiativeBonus === undefined || combatant.initiativeBonus === null) {
                    if (isPlayerCombatant(combatant) && combatant.id) {
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
                
                if (initA === initB) {
                    const dexA = getDexScore(a);
                    const dexB = getDexScore(b);
                    if (dexA === dexB) {
                        const nameA = getCombatantName(a) || a.id || '';
                        const nameB = getCombatantName(b) || b.id || '';
                        return nameA.localeCompare(nameB);
                    }
                    return dexB - dexA;
                }
                
                return initB - initA;
            });
            
            // Check if monsters need refresh
            const monstersNeedRefresh = encounter.combatants.some(c => 
                !isPlayerCombatant(c) && 
                c.dndBeyondUrl && 
                (c.initiativeBonus === undefined || c.initiativeBonus === null)
            );
            
            if (monstersNeedRefresh && window.refreshMonsterStats) {
                setTimeout(() => window.refreshMonsterStats(index, false), 100);
            }
        }
        
        const card = createEncounterCard(encounter, index);
        
        if (encounter.state === 'complete') {
            card.style.backgroundColor = '#e8f5e9';
        }
        
        container.appendChild(card);
        
        if (encounter.state === 'started' && window.updateSpectatorUrl) {
            window.updateSpectatorUrl(index);
        }
    });
}

/**
 * Create encounter card element
 */
export function createEncounterCard(encounter, encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounterEditMode = window.encounterEditMode || {};
    const cachedSpectatorUrl = window.cachedSpectatorUrl;
    const DND_MONSTERS = window.DND_MONSTERS || {};
    const crFetchStatus = window.crFetchStatus || {};
    const DND_CONDITIONS = window.DND_CONDITIONS || [];
    const CONDITION_ICONS = window.CONDITION_ICONS || {};
    
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
    
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    
    // Determine buttons based on encounter state
    let encounterButtons = '';
    if (encounter.state === 'started') {
        encounterButtons = `
            <button class="btn-small" onclick="previousTurn(${encounterIndex})" title="Go back to previous turn (Ctrl+Left Arrow)">⮜ Prev</button>
            <button class="btn-small" onclick="nextTurn(${encounterIndex})" title="Advance to next turn (Ctrl+Right Arrow)">Next ⮞</button>
            <button class="btn-small" onclick="endEncounter(${encounterIndex})" style="background: #e74c3c;" title="End encounter">End</button>
        `;
    } else if (encounter.state === 'complete') {
        encounterButtons = `
            <button class="btn-small" onclick="resetEncounter(${encounterIndex})" style="background: #ff9800;" title="Reset encounter to unstarted state">Reset</button>
        `;
    } else {
        encounterButtons = `
            <button class="btn-small" onclick="startEncounter(${encounterIndex})" style="background: #2ecc71;" title="Start encounter and sort by initiative">Start</button>
        `;
    }
    
    const minimizeIcon = encounter.minimized ? '▶' : '▼';
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
    
    // Render combatan ts
    const tbody = table.querySelector('tbody');
    if (!encounter.combatants) encounter.combatants = [];
    
    encounter.combatants.forEach((combatant, combatantIndex) => {
        const row = tbody.insertRow();
        const isPlayer = isPlayerCombatant(combatant);
        const combatantName = getCombatantName(combatant);
        const isActive = encounter.state === 'started' && encounter.activeCombatant === combatantName;
        
        row.className = isActive ? 'combatant-row active' : 'combatant-row';
        
        let ac = combatant.ac || 10;
        let cr = combatant.cr || '';
        let dndBeyondUrl = combatant.dndBeyondUrl || '';
        
        if (isPlayer) {
            const player = currentAdventure.players?.find(p => {
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });
            if (player) {
                ac = player.ac || 10;
                dndBeyondUrl = player.dndBeyondUrl || '';
            }
        } else if (combatant.name) {
            const baseName = combatant.name.split(' ')[0];
            const monster = DND_MONSTERS[baseName];
            if (monster) {
                if (!combatant.ac) ac = monster.ac || 10;
                if (!combatant.cr) cr = monster.cr || '';
                if (!combatant.dndBeyondUrl) dndBeyondUrl = monster.url || '';
            }
            
            if (!cr && (combatant.dndBeyondUrl || combatant.id)) {
                const monsterUrl = combatant.dndBeyondUrl || combatant.id;
                const fetchKey = `${encounterIndex}_${combatantIndex}`;
                if (monsterUrl && monsterUrl.includes('dndbeyond.com') && !crFetchStatus[fetchKey] && window.fetchCRFromCache) {
                    crFetchStatus[fetchKey] = true;
                    window.fetchCRFromCache(monsterUrl, encounterIndex, combatantIndex);
                }
            }
        }
        
        if (isPlayer && !isActive) {
            row.style.background = '#e8f4f8';
        }
        
        // Name display
        let nameHTML;
        const isUnconscious = (combatant.hp || 0) <= 0;
        const textColor = isUnconscious ? '#e74c3c' : '#2c5aa0';
        const inheritColor = isUnconscious ? '#e74c3c' : 'inherit';
        
        if (isPlayer) {
            const escapedName = combatantName.replace(/'/g, "\\'");
            const escapedUrl = dndBeyondUrl ? dndBeyondUrl.replace(/'/g, "\\'") : '';
            const playerUrl = escapedUrl || `player:${escapedName}`;
            
            if (dndBeyondUrl) {
                nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                    class="monster-name-hover" 
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event, ${encounterIndex})"
                    onmouseleave="hideMonsterTooltip()">${combatantName || ''}</a>`;
            } else {
                nameHTML = `<span style="font-weight: 500; color: ${inheritColor}; cursor: help;" 
                    class="monster-name-hover"
                    onmouseenter="showMonsterTooltip('${escapedName}', '${playerUrl}', event, ${encounterIndex})"
                    onmouseleave="hideMonsterTooltip()">${combatantName || ''}</span>`;
            }
        } else if (encounterEditMode[encounterIndex]) {
            nameHTML = `<input type="text" value="${(combatant.name || '').replace(/"/g, '&quot;')}" 
                style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-weight: 500;"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'name', this.value)">`;
        } else if (dndBeyondUrl) {
            const escapedUrl = dndBeyondUrl.replace(/'/g, "\\'");
            nameHTML = `<a href="${dndBeyondUrl}" target="_blank" style="color: ${textColor}; text-decoration: none; font-weight: 500;" 
                class="monster-name-hover" 
                onmouseenter="showMonsterTooltip('${combatantName.replace(/'/g, "\\'")}', '${escapedUrl}', event, ${encounterIndex})"
                onmouseleave="hideMonsterTooltip()">${combatantName || ''}</a>`;
        } else {
            nameHTML = `<span style="font-weight: 500; color: ${inheritColor};">${combatantName || ''}</span>`;
        }
        
        // Temp HP cell
        const tempHpValue = combatant.tempHp || 0;
        const tempHpCell = encounterEditMode[encounterIndex]
            ? `<input type="number" value="${tempHpValue}" style="width: 100%; text-align: center;" min="0"
                onchange="updateCombatant(${encounterIndex}, ${combatantIndex}, 'tempHp', Math.max(0, parseInt(this.value) || 0))">` 
            : `<span style="color: ${tempHpValue > 0 ? '#3498db' : '#999'}; font-weight: 500;">${tempHpValue}</span>`;
        
        // Conditions cell
        const conditions = combatant.conditions || [];
        const concentrating = combatant.concentrating || false;
        let conditionsCell = '';
        
        if (encounter.state === 'complete' && !encounterEditMode[encounterIndex]) {
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
        
        // Death saves for players at 0 HP
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
                const player = currentAdventure.players.find(p => p.dndBeyondUrl === combatant.id);
                if (player && player.initiativeBonus !== undefined) {
                    combatant.initiativeBonus = player.initiativeBonus;
                }
            }
        }
        
        // Format initiative display
        let initiativeDisplay;
        const init = combatant.initiative || 0;
        if (isPlayer || combatant.dexScore !== undefined) {
            const dexScore = getDexScore(combatant);
            initiativeDisplay = `${init}<span style="font-size: 0.8em;">.${dexScore}</span>`;
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
    
    // Treasure section
    if (!encounter.minimized) {
        const treasureDiv = document.createElement('div');
        treasureDiv.className = 'treasure-section';
        treasureDiv.style.cssText = 'background: #fff8dc; border: 2px solid #f39c12; border-radius: 5px; padding: 10px; margin: 10px 0; font-family: monospace;';
        
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

// ==================== ENCOUNTER MANAGEMENT ====================

export function toggleEncounterMinimize(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.minimized = !encounter.minimized;
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function updateEncounterName(encounterIndex, name) {
    const currentAdventure = window.currentAdventure;
    currentAdventure.encounters[encounterIndex].name = name;
    if (window.autoSave) window.autoSave();
}

export function updateEncounterCR(encounterIndex, newCR) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    
    if (newCR && newCR.trim() !== '') {
        encounter.totalCR = newCR.trim();
    } else {
        delete encounter.totalCR;
    }
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function removeEncounter(encounterIndex) {
    if (confirm('Delete this encounter?')) {
        const currentAdventure = window.currentAdventure;
        currentAdventure.encounters.splice(encounterIndex, 1);
        if (window.renderEncounters) window.renderEncounters();
        if (window.autoSave) window.autoSave();
    }
}

export function resetEncounter(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    const encounterEditMode = window.encounterEditMode || {};
    
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    delete encounterEditMode[encounterIndex];
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function toggleEncounterEdit(encounterIndex) {
    if (!window.encounterEditMode) {
        window.encounterEditMode = {};
    }
    window.encounterEditMode[encounterIndex] = !window.encounterEditMode[encounterIndex];
    if (window.renderEncounters) window.renderEncounters();
    
    if (!window.encounterEditMode[encounterIndex] && window.autoSave) {
        window.autoSave();
    }
}

// ==================== COMBATANT MANAGEMENT ====================

export function addCustomCombatant(encounterIndex) {
    const currentAdventure = window.currentAdventure;
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
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function updateCombatant(encounterIndex, combatantIndex, field, value) {
    const currentAdventure = window.currentAdventure;
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    if (field === 'hp') {
        const maxHp = combatant.maxHp || 0;
        const isPlayer = isPlayerCombatant(combatant);
        
        if (value > maxHp) {
            value = maxHp;
        }
        
        if (isPlayer && value < 0) {
            value = 0;
        }
    }
    
    combatant[field] = value;
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function removeCombatant(encounterIndex, combatantIndex) {
    if (confirm('Remove this combatant?')) {
        const currentAdventure = window.currentAdventure;
        currentAdventure.encounters[encounterIndex].combatants.splice(combatantIndex, 1);
        if (window.renderEncounters) window.renderEncounters();
        if (window.autoSave) window.autoSave();
    }
}

export function sortInitiative(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    
    encounter.combatants.forEach(combatant => {
        if (combatant.initiativeBonus === undefined || combatant.initiativeBonus === null) {
            if (isPlayerCombatant(combatant) && combatant.id) {
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
        
        if (initA === initB) {
            const dexA = getDexScore(a);
            const dexB = getDexScore(b);
            if (dexA === dexB) {
                const nameA = getCombatantName(a) || a.id || '';
                const nameB = getCombatantName(b) || b.id || '';
                return nameA.localeCompare(nameB);
            }
            return dexB - dexA;
        }
        
        return initB - initA;
    });
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function refreshPlayers(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    
    encounter.combatants = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    currentAdventure.players.forEach(player => {
        const playerId = player.dndBeyondUrl ? player.dndBeyondUrl.split('/').pop() : '';
        
        encounter.combatants.push({
            id: playerId,
            initiative: 0,
            initiativeBonus: player.initiativeBonus || 0,
            hp: player.maxHp || 0,
            maxHp: player.maxHp || 0,
            ac: player.ac || 10,
            notes: '',
            dndBeyondUrl: player.dndBeyondUrl || ''
        });
    });
    
    encounter.state = null;
    encounter.currentTurn = 0;
    encounter.currentRound = 0;
    encounter.activeCombatant = null;
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export async function refreshMonsterStats(encounterIndex, showNotification = true) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    if (!encounter || !encounter.combatants) return;
    
    const monsters = encounter.combatants.filter(c => !isPlayerCombatant(c) && c.dndBeyondUrl);
    
    if (monsters.length === 0) {
        if (showNotification && window.showToast) window.showToast('No monsters to refresh', 'info');
        return;
    }
    
    if (showNotification && window.showToast) window.showToast(`Refreshing ${monsters.length} monster(s)...`, 'info');
    
    const urlToMonsters = {};
    monsters.forEach(m => {
        if (m.dndBeyondUrl) {
            if (!urlToMonsters[m.dndBeyondUrl]) {
                urlToMonsters[m.dndBeyondUrl] = [];
            }
            urlToMonsters[m.dndBeyondUrl].push(m);
        }
    });
    
    for (const url of Object.keys(urlToMonsters)) {
        try {
            const encodedUrl = encodeURIComponent(url);
            const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.details) {
                    const details = data.details;
                    urlToMonsters[url].forEach(monster => {
                        if (details.initiativeModifier !== undefined) {
                            monster.initiativeBonus = details.initiativeModifier;
                            const d20 = Math.floor(Math.random() * 20) + 1;
                            monster.initiative = d20 + details.initiativeModifier;
                        }
                        if (details.abilities && details.abilities.dex) {
                            monster.dexScore = details.abilities.dex.score;
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
    
    if (showNotification && window.showToast) window.showToast('Monster stats refreshed!', 'success', 2000);
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

// ==================== SPECIAL FEATURES ====================

export function toggleDeathSave(encounterIndex, combatantIndex, type, value) {
    const currentAdventure = window.currentAdventure;
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    if (!combatant.deathSaves) {
        combatant.deathSaves = { successes: 0, failures: 0 };
    }
    
    if (combatant.deathSaves[type] === value) {
        combatant.deathSaves[type] = value - 1;
    } else {
        combatant.deathSaves[type] = value;
    }
    
    if (combatant.deathSaves.successes >= 3) {
        combatant.hp = 1;
        combatant.deathSaves = { successes: 0, failures: 0 };
        alert(`${getCombatantName(combatant)} has stabilized!`);
    } else if (combatant.deathSaves.failures >= 3) {
        alert(`${getCombatantName(combatant)} has died!`);
    }
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function openConditionsDialog(encounterIndex, combatantIndex) {
    const currentAdventure = window.currentAdventure;
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    const conditions = combatant.conditions || [];
    const concentrating = combatant.concentrating || false;
    const DND_CONDITIONS = window.DND_CONDITIONS || [];
    const CONDITION_ICONS = window.CONDITION_ICONS || {};
    
    let html = '<div style="max-height: 600px; overflow-y: auto; padding: 10px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 15px;">Manage Conditions</h3>';
    
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
    
    modal.setAttribute('data-encounter', encounterIndex);
    modal.setAttribute('data-combatant', combatantIndex);
    
    // Add ESC key handler to close modal
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeConditionsModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeConditionsModal();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

export function closeConditionsModal() {
    const modal = document.getElementById('conditionsModal');
    if (modal) {
        modal.remove();
    }
}

export function saveConditions(encounterIndex, combatantIndex) {
    const currentAdventure = window.currentAdventure;
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    const checkboxes = document.querySelectorAll('.condition-checkbox:checked');
    const selectedConditions = Array.from(checkboxes).map(cb => cb.value);
    
    const concentratingCheckbox = document.getElementById('cond-concentrating');
    const concentrating = concentratingCheckbox ? concentratingCheckbox.checked : false;
    
    combatant.conditions = selectedConditions;
    combatant.concentrating = concentrating;
    
    closeConditionsModal();
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function clearConditions(encounterIndex, combatantIndex) {
    const currentAdventure = window.currentAdventure;
    const combatant = currentAdventure.encounters[encounterIndex].combatants[combatantIndex];
    
    combatant.conditions = [];
    combatant.concentrating = false;
    
    closeConditionsModal();
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function generateLoot(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    
    const enemies = encounter.combatants.filter(c => !isPlayerCombatant(c));
    
    if (enemies.length === 0) {
        alert('No enemies in this encounter to generate loot from!');
        return;
    }
    
    let totalCR = 0;
    enemies.forEach(enemy => {
        const cr = enemy.cr || '0';
        if (cr === '1/8') totalCR += 0.125;
        else if (cr === '1/4') totalCR += 0.25;
        else if (cr === '1/2') totalCR += 0.5;
        else totalCR += parseFloat(cr) || 0;
    });
    
    let loot = [];
    
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
    
    if (totalCR >= 3) {
        const numGems = Math.floor(Math.random() * 3) + 1;
        const gemValues = [10, 50, 100, 500, 1000];
        const gemValue = gemValues[Math.min(Math.floor(totalCR / 4), 4)];
        const gemTypes = ['agate', 'quartz', 'onyx', 'jade', 'pearl', 'topaz', 'ruby', 'sapphire', 'emerald', 'diamond'];
        const gemType = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        loot.push(`Gems: ${numGems}× ${gemValue} GP ${gemType}`);
    }
    
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
    
    encounter.treasure = loot.join('\n');
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function clearLoot(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.treasure = '';
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function updateTreasure(encounterIndex, value) {
    const currentAdventure = window.currentAdventure;
    currentAdventure.encounters[encounterIndex].treasure = value;
    if (window.autoSave) window.autoSave();
}

// ==================== ENCOUNTER STATE ====================

export function startEncounter(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    
    encounter.combatants.sort((a, b) => {
        const initA = a.initiative || 0;
        const initB = b.initiative || 0;
        
        if (initA === initB) {
            const dexA = getDexScore(a);
            const dexB = getDexScore(b);
            if (dexA === dexB) {
                const nameA = getCombatantName(a) || a.id || '';
                const nameB = getCombatantName(b) || b.id || '';
                return nameA.localeCompare(nameB);
            }
            return dexB - dexA;
        }
        
        return initB - initA;
    });
    
    encounter.state = 'started';
    encounter.currentTurn = 0;
    encounter.currentRound = 1;
    
    if (encounter.combatants.length > 0) {
        encounter.activeCombatant = getCombatantName(encounter.combatants[0]);
    }
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
    
    if (window.updateSpectatorUrl) {
        window.updateSpectatorUrl(encounterIndex);
    }
}

export function endEncounter(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    encounter.state = 'complete';
    encounter.currentTurn = 0;
    encounter.activeCombatant = null;
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function nextTurn(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    const combatants = encounter.combatants;
    
    if (encounter.state !== 'started' || combatants.length === 0) return;
    
    let currentIndex = encounter.currentTurn || 0;
    currentIndex = (currentIndex + 1) % combatants.length;
    
    if (currentIndex === 0) {
        encounter.currentRound = (encounter.currentRound || 1) + 1;
    }
    
    encounter.activeCombatant = getCombatantName(combatants[currentIndex]);
    encounter.currentTurn = currentIndex;
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

export function previousTurn(encounterIndex) {
    const currentAdventure = window.currentAdventure;
    const encounter = currentAdventure.encounters[encounterIndex];
    const combatants = encounter.combatants;
    
    if (encounter.state !== 'started' || combatants.length === 0) return;
    
    let currentIndex = encounter.currentTurn || 0;
    currentIndex = (currentIndex - 1 + combatants.length) % combatants.length;
    
    if (currentIndex === combatants.length - 1) {
        encounter.currentRound = Math.max(1, (encounter.currentRound || 1) - 1);
    }
    
    encounter.activeCombatant = getCombatantName(combatants[currentIndex]);
    encounter.currentTurn = currentIndex;
    
    if (window.renderEncounters) window.renderEncounters();
    if (window.autoSave) window.autoSave();
}

// ==================== HELPER FUNCTIONS ====================

export async function fetchCRFromCache(monsterUrl, encounterIndex, combatantIndex) {
    const currentAdventure = window.currentAdventure;
    
    try {
        const encodedUrl = encodeURIComponent(monsterUrl);
        const response = await fetch(`/api/dndbeyond/monster/${encodedUrl}`);
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.success && data.details && data.details.cr) {
            const encounter = currentAdventure.encounters[encounterIndex];
            if (encounter && encounter.combatants[combatantIndex]) {
                const combatant = encounter.combatants[combatantIndex];
                const newCR = data.details.cr;
                
                if (combatant.cr !== newCR) {
                    combatant.cr = newCR;
                    if (window.renderEncounters) window.renderEncounters();
                    if (window.autoSave) window.autoSave();
                }
            }
        }
    } catch (error) {
        console.log(`Could not fetch CR for ${monsterUrl}:`, error.message);
    }
}

export async function updateSpectatorUrl(encounterIndex) {
    let cachedSpectatorUrl = window.cachedSpectatorUrl;
    
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
        window.cachedSpectatorUrl = url;
        
        const urlElement = document.getElementById(`spectatorUrl-${encounterIndex}`);
        const containerElement = document.getElementById(`spectatorUrlContainer-${encounterIndex}`);
        if (urlElement) {
            urlElement.textContent = url;
            urlElement.dataset.url = url;
            if (containerElement) {
                containerElement.style.display = '';
            }
        }
    } catch (error) {
        console.error('Error fetching server info:', error);
    }
}

export function copySpectatorUrl(encounterIndex) {
    const urlElement = document.getElementById(`spectatorUrl-${encounterIndex}`);
    if (urlElement && urlElement.dataset.url) {
        navigator.clipboard.writeText(urlElement.dataset.url).then(() => {
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
