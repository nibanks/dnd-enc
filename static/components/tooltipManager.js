/**
 * Tooltip Manager - Handles monster/character tooltips on hover
 */

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipMonster = null;

/**
 * Create the tooltip element if it doesn't exist
 */
function createTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'monster-tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
}

/**
 * Format ability score modifier
 */
function formatModifier(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Format action description text with proper spacing and bold keywords
 */
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

/**
 * Render tooltip content from entity details
 */
function renderTooltipContent(tooltip, entityName, details, isCharacter = false, encounterIndex = null, entityUrl = null) {
    if (!details) {
        tooltip.innerHTML = '<div class="monster-tooltip-loading">No details available</div>';
        return;
    }
    
    const CR_TO_XP = window.CR_TO_XP || {};
    const currentAdventure = window.currentAdventure;
    const CONDITION_ICONS = window.CONDITION_ICONS || {};
    
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

/**
 * Determine if URL is a character or monster based on URL pattern
 */
function isCharacterUrl(url) {
    return url && (url.includes('/profile/') || url.includes('/characters/'));
}

/**
 * Show monster/character tooltip on hover
 */
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
    
    const currentAdventure = window.currentAdventure;
    const DND_MONSTERS = window.DND_MONSTERS || {};
    const MONSTER_DETAILS_CACHE = window.MONSTER_DETAILS_CACHE || {};
    const monsterDetailsFetchStatus = window.monsterDetailsFetchStatus || {};
    
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
    window.monsterDetailsFetchStatus = monsterDetailsFetchStatus;
    
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
            window.monsterDetailsFetchStatus = monsterDetailsFetchStatus;
            
            // Only update if tooltip is still visible (don't check entityName to avoid race conditions)
            if (!tooltipElement || tooltipElement.style.display === 'none') {
                return;
            }
            
            // Check if there was an error
            if (!data.success || data.error) {
                // Check for authentication failure
                if (data.auth_failed && window.showCookieExpirationWarning) {
                    window.showCookieExpirationWarning(entityName);
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
                window.MONSTER_DETAILS_CACHE = MONSTER_DETAILS_CACHE;
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
            window.monsterDetailsFetchStatus = monsterDetailsFetchStatus;
            
            if (tooltipElement && tooltipElement.style.display !== 'none') {
                tooltip.innerHTML = `<div class="monster-tooltip-loading">Failed to load ${entityType} details</div>`;
            }
        });
}

/**
 * Hide the tooltip with a short delay
 */
function hideMonsterTooltip() {
    tooltipTimeout = setTimeout(() => {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
            currentTooltipMonster = null;
        }
    }, 100);
}

export const tooltipManager = {
    showMonsterTooltip,
    hideMonsterTooltip,
    createTooltipElement,
    formatModifier,
    formatActionDescription,
    renderTooltipContent,
    isCharacterUrl
};
