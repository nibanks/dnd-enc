/**
 * Player Table Renderer Module
 * Handles rendering of the players table with expand/collapse and edit modes
 */

/**
 * Calculate ability score modifier
 * @param {number} score - Ability score
 * @returns {number} Modifier value
 */
function calculateModifier(score) {
    return Math.floor((score - 10) / 2);
}

/**
 * Calculate proficiency bonus based on level
 * @param {number} level - Character level
 * @returns {number} Proficiency bonus
 */
function calculateProficiencyBonus(level) {
    return 2 + Math.floor((level - 1) / 4);
}

/**
 * Render the players table
 * @param {Object} adventure - Current adventure object
 * @param {boolean} editMode - Whether in edit mode
 */
export function renderPlayers(adventure, editMode = false) {
    const tbody = document.getElementById('playersBody');
    if (!tbody) {
        console.warn('playersBody element not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!adventure) {
        console.warn('renderPlayers called but adventure is null');
        return;
    }
    
    if (!adventure.players) {
        adventure.players = [];
    }
    
    adventure.players.forEach((player, index) => {
        renderPlayerRow(tbody, player, index, editMode);
    });
}

/**
 * Render a single player row (with detail row)
 * @param {HTMLElement} tbody - Table body element
 * @param {Object} player - Player object
 * @param {number} index - Player index
 * @param {boolean} editMode - Whether in edit mode
 */
function renderPlayerRow(tbody, player, index, editMode) {
    // Initialize abilities if not present
    if (!player.abilityScores) {
        player.abilityScores = {
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
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
    
    // Calculate values
    const wisMod = calculateModifier(player.abilityScores.wis || 10);
    const intMod = calculateModifier(player.abilityScores.int || 10);
    const profBonus = calculateProficiencyBonus(player.level || 1);
    
    // Calculate passive values
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
    
    if (editMode) {
        row.innerHTML = renderPlayerEditRow(player, index, wisMod, intMod, profBonus, passivePerception, passiveInsight, passiveInvestigation);
    } else {
        row.innerHTML = renderPlayerViewRow(player, index, wisMod, intMod, profBonus, passivePerception, passiveInsight, passiveInvestigation);
    }
    
    // Ability scores detail row
    const detailRow = tbody.insertRow();
    detailRow.id = `player-detail-${index}`;
    detailRow.style.display = player.expanded ? 'table-row' : 'none';
    detailRow.style.backgroundColor = '#f8f9fa';
    
    if (editMode) {
        detailRow.innerHTML = renderPlayerDetailEditRow(player, index, profBonus);
    } else {
        detailRow.innerHTML = renderPlayerDetailViewRow(player, index, profBonus);
    }
}

/**
 * Render player row in edit mode
 */
function renderPlayerEditRow(player, index, wisMod, intMod, profBonus, passivePerception, passiveInsight, passiveInvestigation) {
    // Safety check for constants
    const classes = window.DND_CLASSES || [];
    const races = window.DND_RACES || [];
    
    const classOptions = classes.map(c => 
        `<option value="${c}" ${player.class === c ? 'selected' : ''}>${c}</option>`
    ).join('');
    const raceOptions = races.map(r => 
        `<option value="${r}" ${player.race === r ? 'selected' : ''}>${r}</option>`
    ).join('');
    
    return `
        <td><button class="btn-small player-toggle-stats" data-player-index="${index}" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
        <td><button class="btn-small player-edit-url" data-player-index="${index}" style="background: #3498db;" title="Edit D&D Beyond URL">🔗</button></td>
        <td><input type="text" class="player-field" data-player-index="${index}" data-field="playerName" value="${player.playerName || ''}" style="width: 90px;"></td>
        <td><input type="text" class="player-field" data-player-index="${index}" data-field="name" value="${player.name || ''}" style="width: 100px;"></td>
        <td><select class="player-field" data-player-index="${index}" data-field="race" style="width: 110px;"><option value="">Select Race</option>${raceOptions}</select></td>
        <td><select class="player-field" data-player-index="${index}" data-field="class" style="width: 110px;"><option value="">Select Class</option>${classOptions}</select></td>
        <td><input type="number" class="player-field" data-player-index="${index}" data-field="level" value="${player.level || 1}" style="width: 38px; text-align: center;"></td>
        <td><input type="number" class="player-field" data-player-index="${index}" data-field="maxHp" value="${player.maxHp || 0}" style="width: 45px; text-align: center;"></td>
        <td><input type="number" class="player-field" data-player-index="${index}" data-field="ac" value="${player.ac || 10}" style="width: 38px; text-align: center;"></td>
        <td><input type="number" class="player-field" data-player-index="${index}" data-field="speed" value="${player.speed || 30}" style="width: 38px; text-align: center;"></td>
        <td><input type="number" class="player-field" data-player-index="${index}" data-field="initiativeBonus" value="${player.initiativeBonus || 0}" style="width: 38px; text-align: center;"></td>
        <td style="text-align: center;"><span style="color: ${player.skillProficiencies.perception ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.perception ? ' + Prof(+' + profBonus + ')' : ''}">${passivePerception}</span></td>
        <td style="text-align: center;"><span style="color: ${player.skillProficiencies.investigation ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + INT(${intMod >= 0 ? '+' : ''}${intMod})${player.skillProficiencies.investigation ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInvestigation}</span></td>
        <td style="text-align: center;"><span style="color: ${player.skillProficiencies.insight ? '#27ae60' : '#666'}; font-weight: 500;" title="10 + WIS(${wisMod >= 0 ? '+' : ''}${wisMod})${player.skillProficiencies.insight ? ' + Prof(+' + profBonus + ')' : ''}">${passiveInsight}</span></td>
        <td style="width: 150px;"><input type="text" class="player-field" data-player-index="${index}" data-field="notes" value="${player.notes || ''}" style="width: 150px;"></td>
        <td><button class="btn-small player-remove" data-player-index="${index}" style="background: #e74c3c;" title="Delete this player">×</button></td>
    `;
}

/**
 * Render player row in view mode
 */
function renderPlayerViewRow(player, index, wisMod, intMod, profBonus, passivePerception, passiveInsight, passiveInvestigation) {
    const hasUrl = player.dndBeyondUrl && player.dndBeyondUrl.trim() !== '';
    
    return `
        <td><button class="btn-small player-toggle-stats" data-player-index="${index}" style="background: #95a5a6;" title="Show/hide ability scores">${player.expanded ? '▼' : '▶'}</button></td>
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

/**
 * Render player detail row in edit mode
 */
function renderPlayerDetailEditRow(player, index, profBonus) {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const abilityLabels = {
        str: 'STR',
        dex: 'DEX',
        con: 'CON',
        int: 'INT',
        wis: 'WIS',
        cha: 'CHA'
    };
    
    const abilityInputs = abilities.map(ability => {
        const score = player.abilityScores[ability] || 10;
        const modifier = calculateModifier(score);
        
        return `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <label style="font-size: 11px; color: #666; font-weight: 500;">${abilityLabels[ability]}</label>
                <input type="number" class="player-ability" data-player-index="${index}" data-ability="${ability}" value="${score}" style="width: 45px; text-align: center;" title="${abilityLabels[ability]}">
                <span style="font-size: 10px; color: #999;">${modifier >= 0 ? '+' : ''}${modifier}</span>
            </div>
        `;
    }).join('');
    
    return `
        <td colspan="2"></td>
        <td colspan="14" style="padding: 10px;">
            <div style="display: flex; gap: 20px; align-items: center;">
                <div>
                    <strong style="color: #666;">Ability Scores:</strong>
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        ${abilityInputs}
                    </div>
                </div>
                <div style="border-left: 1px solid #ddd; padding-left: 20px;">
                    <strong style="color: #666;">Skill Proficiencies:</strong>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 5px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="player-skill" data-player-index="${index}" data-skill="perception" ${player.skillProficiencies.perception ? 'checked' : ''}>
                            <span style="font-size: 13px;">Perception (WIS)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="player-skill" data-player-index="${index}" data-skill="investigation" ${player.skillProficiencies.investigation ? 'checked' : ''}>
                            <span style="font-size: 13px;">Investigation (INT)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="player-skill" data-player-index="${index}" data-skill="insight" ${player.skillProficiencies.insight ? 'checked' : ''}>
                            <span style="font-size: 13px;">Insight (WIS)</span>
                        </label>
                    </div>
                </div>
                <div style="margin-left: auto; color: #999; font-size: 12px;">
                    Proficiency Bonus: +${profBonus}
                </div>
            </div>
        </td>
    `;
}

/**
 * Render player detail row in view mode
 */
function renderPlayerDetailViewRow(player, index, profBonus) {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const abilityLabels = {
        str: 'STR',
        dex: 'DEX',
        con: 'CON',
        int: 'INT',
        wis: 'WIS',
        cha: 'CHA'
    };
    
    const abilityDisplay = abilities.map(ability => {
        const score = player.abilityScores[ability] || 10;
        const modifier = calculateModifier(score);
        
        return `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <label style="font-size: 11px; color: #666; font-weight: 500;">${abilityLabels[ability]}</label>
                <div style="width: 45px; text-align: center; padding: 4px; font-weight: 500;">${score}</div>
                <span style="font-size: 10px; color: #999;">${modifier >= 0 ? '+' : ''}${modifier}</span>
            </div>
        `;
    }).join('');
    
    return `
        <td colspan="2"></td>
        <td colspan="14" style="padding: 10px;">
            <div style="display: flex; gap: 20px; align-items: center;">
                <div>
                    <strong style="color: #666;">Ability Scores:</strong>
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        ${abilityDisplay}
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
    `;
}

/**
 * Sort players by field
 * @param {Object} adventure - Current adventure
 * @param {string} field - Field to sort by
 */
export function sortPlayers(adventure, field) {
    if (!adventure.players || adventure.players.length === 0) return;
    
    adventure.players.sort((a, b) => {
        let aVal, bVal;
        
        // Handle special calculated fields
        if (field === 'passivePerception') {
            const aProfBonus = calculateProficiencyBonus(a.level || 1);
            const bProfBonus = calculateProficiencyBonus(b.level || 1);
            const aWisMod = calculateModifier(a.abilityScores?.wis || 10);
            const bWisMod = calculateModifier(b.abilityScores?.wis || 10);
            aVal = 10 + aWisMod + (a.skillProficiencies?.perception ? aProfBonus : 0);
            bVal = 10 + bWisMod + (b.skillProficiencies?.perception ? bProfBonus : 0);
        } else if (field === 'passiveInvestigation') {
            const aProfBonus = calculateProficiencyBonus(a.level || 1);
            const bProfBonus = calculateProficiencyBonus(b.level || 1);
            const aIntMod = calculateModifier(a.abilityScores?.int || 10);
            const bIntMod = calculateModifier(b.abilityScores?.int || 10);
            aVal = 10 + aIntMod + (a.skillProficiencies?.investigation ? aProfBonus : 0);
            bVal = 10 + bIntMod + (b.skillProficiencies?.investigation ? bProfBonus : 0);
        } else if (field === 'passiveInsight') {
            const aProfBonus = calculateProficiencyBonus(a.level || 1);
            const bProfBonus = calculateProficiencyBonus(b.level || 1);
            const aWisMod = calculateModifier(a.abilityScores?.wis || 10);
            const bWisMod = calculateModifier(b.abilityScores?.wis || 10);
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
}

/**
 * Setup event delegation for player table interactions
 * @param {Function} onUpdate - Callback when players are updated
 */
export function setupPlayerEventDelegation(onUpdate) {
    const tbody = document.getElementById('playersBody');
    if (!tbody) return;
    
    // Use event delegation on tbody for all player interactions
    tbody.addEventListener('click', (e) => {
        const target = e.target;
        
        // Toggle stats button
        if (target.classList.contains('player-toggle-stats')) {
            const index = parseInt(target.dataset.playerIndex);
            onUpdate({type: 'toggleStats', index});
        }
        
        // Edit URL button
        if (target.classList.contains('player-edit-url')) {
            const index = parseInt(target.dataset.playerIndex);
            onUpdate({type: 'editUrl', index});
        }
        
        // Remove player button
        if (target.classList.contains('player-remove')) {
            const index = parseInt(target.dataset.playerIndex);
            onUpdate({type: 'remove', index});
        }
    });
    
    // Handle input changes
    tbody.addEventListener('change', (e) => {
        const target = e.target;
        
        // Player field updates
        if (target.classList.contains('player-field')) {
            const index = parseInt(target.dataset.playerIndex);
            const field = target.dataset.field;
            let value = target.value;
            
            // Parse numeric fields
            if (target.type === 'number') {
                value = parseInt(value);
            }
            
            onUpdate({type: 'updateField', index, field, value});
        }
        
        // Ability score updates
        if (target.classList.contains('player-ability')) {
            const index = parseInt(target.dataset.playerIndex);
            const ability = target.dataset.ability;
            const value = parseInt(target.value);
            
            onUpdate({type: 'updateAbility', index, ability, value});
        }
        
        // Skill proficiency updates
        if (target.classList.contains('player-skill')) {
            const index = parseInt(target.dataset.playerIndex);
            const skill = target.dataset.skill;
            const checked = target.checked;
            
            onUpdate({type: 'updateSkill', index, skill, checked});
        }
    });
}
