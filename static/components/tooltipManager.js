/**
 * Tooltip Manager - Handles monster/character tooltips on hover
 */

import { showCookieExpirationWarning } from '../utils/helpers.js';

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipMonster = null;
let currentTooltipEntityKey = null;
let pendingPositionFrame = null;

/**
 * Create the tooltip element if it doesn't exist
 */
function createTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'monster-tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
        
        // Add event handlers once when creating the tooltip
        tooltipElement.addEventListener('mouseenter', () => {
            clearTimeout(tooltipTimeout);
        });
        
        tooltipElement.addEventListener('mouseleave', () => {
            hideMonsterTooltip();
        });
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
 * Format structured action from Format v2
 * @param {Object} action - Action object with type, hit, damage, etc.
 * @returns {string} Formatted action description
 */
function formatStructuredAction(action) {
    if (!action) return '';
    
    // If action has a description field, use it (old format or description-only legendary actions)
    if (action.description) {
        return formatActionDescription(action.description);
    }
    
    // Format v2: Build description from structured fields
    let parts = [];
    
    // Type and attack/save info
    if (action.type) {
        if (action.type.includes('Attack')) {
            parts.push(`<strong>${action.type}:</strong>`);
            if (action.hit) {
                parts.push(`${action.hit} to hit,`);
            }
            if (action.reach) {
                parts.push(`reach ${action.reach},`);
            }
            if (action.range) {
                parts.push(`range ${action.range},`);
            }
            parts.push('one target.');
        } else if (action.type === 'Saving Throw' || action.save) {
            parts.push(`<strong>Saving Throw:</strong>`);
            if (action.save) {
                parts.push(`DC ${action.save.dc} ${action.save.ability}`);
            }
            if (action.area) {
                parts.push(`(${action.area})`);
            }
        }
    }
    
    // Damage
    if (action.damage) {
        const hitLabel = action.type && action.type.includes('Attack') ? '<strong>Hit:</strong>' : '';
        parts.push(`${hitLabel} <strong>${action.damage}</strong>`);
    }
    
    // Second damage type
    if (action.damage2) {
        parts.push(`plus <strong>${action.damage2}</strong>`);
    }
    
    // Effects
    if (action.failureEffect) {
        parts.push(`<strong>Failure:</strong> ${action.failureEffect}`);
    }
    if (action.successEffect) {
        parts.push(`<strong>Success:</strong> ${action.successEffect}`);
    }
    if (action.halfDamageOnSave) {
        parts.push('(half damage on successful save)');
    }
    
    // Extra text
    if (action.extra) {
        parts.push(action.extra);
    }
    
    return parts.join(' ');
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
        // For monsters, show typeAndAlignment if available (format v2), otherwise build from size/type/alignment
        if (details.typeAndAlignment) {
            meta.push(details.typeAndAlignment);
        } else {
            // Old format: build from separate fields
            if (details.size) meta.push(details.size);
            if (details.type) meta.push(details.type);
            if (details.alignment) meta.push(details.alignment);
        }
    }
    if (meta.length > 0) {
        html += `<div class="monster-tooltip-meta">${meta.join(', ')}</div>`;
    }
    html += '</div>'; // Close monster-tooltip-header-text
    html += '</div>'; // Close monster-tooltip-header

    // "Players have identified this monster" checkbox (monsters only)
    // The setting is stored per-adventure by base monster name so that once the players
    // learn to identify any instance of a monster type, every encounter reveals it.
    if (!isCharacter) {
        const baseName = (entityName || '').replace(/\s+\d+$/, '').trim() || entityName || '';
        const identifiedList = (currentAdventure && Array.isArray(currentAdventure.identifiedMonsters))
            ? currentAdventure.identifiedMonsters
            : [];
        const isIdentified = baseName && identifiedList.includes(baseName);
        const escapedBaseName = baseName
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;');
        html += `<div class="monster-tooltip-identify" style="margin: 8px 0; padding: 6px 8px; background: #f3f1e8; border: 1px solid #d9d2bb; border-radius: 4px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; font-size: 12px; color: #5a4a2a;" title="When checked, the players can see this monster's real name on the spectator view. Applies to every instance of this monster across all encounters in this adventure.">
                <input type="checkbox" ${isIdentified ? 'checked' : ''}
                    onchange="toggleMonsterIdentified('${escapedBaseName}', this.checked)"
                    style="width: 14px; height: 14px; cursor: pointer; margin: 0;">
                Players have identified this monster
            </label>
        </div>`;
    }

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
    // Format v2: initBonus, old format: initiativeModifier
    const init = details.initiativeBonus !== undefined ? details.initiativeBonus : 
                 details.initBonus !== undefined ? details.initBonus :
                 details.initiativeModifier !== undefined ? details.initiativeModifier : details.initiative;
    if (init !== undefined) {
        const initDisplay = init >= 0 ? `+${init}` : `${init}`;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Initiative:</span><span class="monster-tooltip-stat-value">${initDisplay}</span></div>`;
    }
    if (!isCharacter && details.cr) {
        // Format v2 removed xp field - calculate from CR
        const xp = CR_TO_XP[details.cr] || '';
        const crDisplay = xp ? `${details.cr} (${xp} XP)` : details.cr;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">CR:</span><span class="monster-tooltip-stat-value">${crDisplay}</span></div>`;
    }
    // Format v2: profBonus (proficiency bonus)
    if (!isCharacter && details.profBonus !== undefined) {
        const profDisplay = details.profBonus >= 0 ? `+${details.profBonus}` : `${details.profBonus}`;
        html += `<div class="monster-tooltip-stat"><span class="monster-tooltip-stat-label">Prof. Bonus:</span><span class="monster-tooltip-stat-value">${profDisplay}</span></div>`;
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
    
    // Skills - Format v2: array of objects, old format: string or object
    if (details.skills) {
        let skillsText = '';
        if (Array.isArray(details.skills)) {
            // Format v2: array of objects like [{skill: "Stealth", mod: 5}]
            skillsText = details.skills
                .map(s => `${s.skill} ${s.mod >= 0 ? '+' : ''}${s.mod}`)
                .join(', ');
        } else if (typeof details.skills === 'string') {
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
    
    // Senses - Format v2: array of strings, old format: string
    if (details.senses) {
        let sensesText = '';
        if (Array.isArray(details.senses)) {
            // Format v2: array of strings like ["Darkvision 60 ft.", "Passive Perception 12"]
            sensesText = details.senses.join(', ');
        } else if (typeof details.senses === 'string') {
            sensesText = details.senses;
        }
        if (sensesText) {
            html += '<div class="monster-tooltip-section">';
            html += '<div class="monster-tooltip-section-title">Senses</div>';
            html += `<div class="monster-tooltip-section-content">${sensesText}</div>`;
            html += '</div>';
        }
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
    
    // Actions (for monsters) - includes both specialActions and structured actions
    const hasActions = !isCharacter && (details.specialActions || details.actions);
    if (hasActions && ((details.specialActions && details.specialActions.length > 0) || (details.actions && details.actions.length > 0))) {
        html += `<div class="monster-tooltip-section" data-encounter-index="${encounterIndex !== null ? encounterIndex : ''}">`;
        html += '<div class="monster-tooltip-section-title">Actions</div>';
        
        // Show special actions first (e.g., Multiattack)
        if (details.specialActions && details.specialActions.length > 0) {
            details.specialActions.forEach(action => {
                html += `<div class="monster-tooltip-action">`;
                html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
                html += `<div class="monster-tooltip-action-desc">${formatActionDescription(action.description)}</div>`;
                html += `</div>`;
            });
        }
        
        // Then show structured actions
        if (details.actions && details.actions.length > 0) {
            details.actions.forEach((action, actionIdx) => {
                html += `<div class="monster-tooltip-action">`;
                html += `<div class="monster-tooltip-action-name">${action.name}`;
                
                // Add [roll] button for DM only (if action has dice rolls or structured fields)
                const hasDescription = action.description && (/\d+d\d+|to hit|DC \d+/i.test(action.description));
                const hasStructuredData = action.type || action.hit || action.damage;
                if ((hasDescription || hasStructuredData) && currentAdventure) {
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
                html += `<div class="monster-tooltip-action-desc">${formatStructuredAction(action)}</div>`;
                html += `</div>`;
            });
        }
        html += '</div>';
    }
    
    // Bonus Actions (Format v2)
    if (!isCharacter && details.bonusActions && details.bonusActions.length > 0) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Bonus Actions</div>';
        details.bonusActions.forEach(action => {
            html += `<div class="monster-tooltip-action">`;
            html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
            html += `<div class="monster-tooltip-action-desc">${formatStructuredAction(action)}</div>`;
            html += `</div>`;
        });
        html += '</div>';
    }
    
    // Legendary Actions (for monsters) - Format v2 has structure with uses
    if (!isCharacter && details.legendaryActions) {
        // Format v2: object with uses and actions array
        if (typeof details.legendaryActions === 'object' && !Array.isArray(details.legendaryActions)) {
            const legendaryData = details.legendaryActions;
            if (legendaryData.actions && legendaryData.actions.length > 0) {
                html += '<div class="monster-tooltip-section">';
                html += '<div class="monster-tooltip-section-title">Legendary Actions';
                if (legendaryData.uses) {
                    html += ` (${legendaryData.uses})`;
                }
                html += '</div>';
                
                if (legendaryData.description) {
                    html += `<div class="monster-tooltip-section-content" style="margin-bottom: 8px;">${formatActionDescription(legendaryData.description)}</div>`;
                }
                
                legendaryData.actions.forEach(action => {
                    html += `<div class="monster-tooltip-action">`;
                    html += `<div class="monster-tooltip-action-name">${action.name}</div>`;
                    html += `<div class="monster-tooltip-action-desc">${formatStructuredAction(action)}</div>`;
                    html += `</div>`;
                });
                html += '</div>';
            }
        }
        // Old format: array of actions
        else if (Array.isArray(details.legendaryActions) && details.legendaryActions.length > 0) {
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
    }
    
    // Spellcasting (Format v2 - structured)
    if (!isCharacter && details.spellcasting) {
        html += '<div class="monster-tooltip-section">';
        html += '<div class="monster-tooltip-section-title">Spellcasting</div>';
        
        if (details.spellcasting.description) {
            html += `<div class="monster-tooltip-section-content">${formatActionDescription(details.spellcasting.description)}</div>`;
        }
        
        if (details.spellcasting.spells) {
            const spells = details.spellcasting.spells;
            
            // At Will spells
            if (spells.atWill && spells.atWill.length > 0) {
                html += `<div style="margin-top: 8px;"><strong>At Will:</strong> ${spells.atWill.join(', ')}</div>`;
            }
            
            // X/Day spells
            ['3PerDay', '2PerDay', '1PerDay'].forEach(key => {
                if (spells[key] && spells[key].length > 0) {
                    const label = key.replace('PerDay', '/Day');
                    html += `<div style="margin-top: 4px;"><strong>${label}:</strong> ${spells[key].join(', ')}</div>`;
                }
            });
            
            // Cantrips and leveled spell slots
            if (spells.cantrips && spells.cantrips.length > 0) {
                html += `<div style="margin-top: 4px;"><strong>Cantrips (at will):</strong> ${spells.cantrips.join(', ')}</div>`;
            }
            for (let level = 1; level <= 9; level++) {
                const key = `level${level}`;
                if (spells[key] && spells[key].length > 0) {
                    html += `<div style="margin-top: 4px;"><strong>${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} level:</strong> ${spells[key].join(', ')}</div>`;
                }
            }
        }
        
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

// Track last call time per entity to prevent rapid repeated calls
const lastCallTimes = new Map();

/**
 * Show monster/character tooltip on hover
 */
function showMonsterTooltip(entityName, entityUrl, event, encounterIndex = null) {
    const entryTime = performance.now();
    
    // Prevent infinite loop: only block if showing the EXACT same entity (name + url match)
    const entityKey = `${entityName}|${entityUrl}`;
    
    // Prevent rapid repeated calls (within 100ms) for same entity
    const lastCallTime = lastCallTimes.get(entityKey) || 0;
    if (entryTime - lastCallTime < 100) {
        return;
    }
    lastCallTimes.set(entityKey, entryTime);
    
    if (tooltipElement && tooltipElement.style.display === 'block' && entityKey === currentTooltipEntityKey) {
        // Already showing this exact entity - ignore repeated call to prevent infinite loop
        return;
    }
    
    clearTimeout(tooltipTimeout);
    
    // Cancel any pending position adjustments from previous tooltips
    if (pendingPositionFrame !== null) {
        cancelAnimationFrame(pendingPositionFrame);
        pendingPositionFrame = null;
    }
    
    const tooltip = createTooltipElement();
    
    // Position tooltip near the cursor (fixed position, doesn't follow mouse)
    const positionTooltip = (e) => {
        const offsetX = 40; // Increased from 15 to prevent covering source element
        const offsetY = 40; // Increased from 15 to prevent covering source element
        const padding = 20; // padding from viewport edges
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Set initial position to measure the tooltip size
        tooltip.style.left = (e.clientX + offsetX) + 'px';
        tooltip.style.top = (e.clientY + offsetY) + 'px';
        
        // Cancel any previously pending position adjustment
        if (pendingPositionFrame !== null) {
            cancelAnimationFrame(pendingPositionFrame);
        }
        
        // After rendering, check if it goes off screen and adjust
        pendingPositionFrame = requestAnimationFrame(() => {
            pendingPositionFrame = null;
            
            const rect = tooltip.getBoundingClientRect();
            
            let finalX = e.clientX + offsetX;
            let finalY = e.clientY + offsetY;
            
            // Adjust horizontal position if off screen
            if (rect.right > viewportWidth - padding) {
                // Try positioning to the left of cursor
                finalX = e.clientX - rect.width - offsetX;
                // If that's also off screen, clamp to viewport
                if (finalX < padding) {
                    finalX = viewportWidth - rect.width - padding;
                }
            }
            
            // Adjust vertical position if off screen
            if (rect.bottom > viewportHeight - padding) {
                // Try positioning above the cursor
                finalY = e.clientY - rect.height - offsetY;
                // If that's also off screen (tooltip too tall), position at top with scrolling
                if (finalY < padding) {
                    // Check if there's more room above or below cursor
                    const roomBelow = viewportHeight - e.clientY;
                    const roomAbove = e.clientY;
                    
                    if (roomAbove > roomBelow) {
                        // More room above - position at top of viewport
                        finalY = padding;
                    } else {
                        // More room below - position to fit in viewport
                        finalY = Math.max(padding, viewportHeight - rect.height - padding);
                    }
                }
            }
            
            // Ensure it's not off the left edge
            finalX = Math.max(padding, finalX);
            
            tooltip.style.left = finalX + 'px';
            tooltip.style.top = finalY + 'px';
        });
    };
    
    // Store current entity being displayed
    currentTooltipMonster = entityName;
    currentTooltipEntityKey = entityKey;
    
    // Check if this is a local player (using player: prefix) or local monster (monster: prefix)
    const isLocalPlayer = entityUrl.startsWith('player:');
    const isLocalMonster = entityUrl.startsWith('monster:');
    
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
    
    // For local monsters (no URL), try to find URL and update
    if (isLocalMonster && currentAdventure && currentAdventure.encounters) {
        // Use the specific encounter if index provided, otherwise search all
        const encountersToSearch = encounterIndex !== null && encounterIndex !== undefined
            ? [currentAdventure.encounters[encounterIndex]]
            : currentAdventure.encounters;
        
        // Strip trailing numbers to get base name (e.g., "Cultist 2" -> "Cultist")
        const baseEntityName = entityName.replace(/\s+\d+$/, '').trim();
        
        for (const encounter of encountersToSearch) {
            if (encounter && encounter.combatants) {
                // First check if any combatants with this base name NOW HAVE a URL (from previous hover)
                const combatantsWithUrl = encounter.combatants.filter(combatant => {
                    const combatantBaseName = (combatant.name || '').replace(/\s+\d+$/, '').trim();
                    return combatantBaseName === baseEntityName && combatant.dndBeyondUrl && combatant.dndBeyondUrl !== '';
                });
                
                if (combatantsWithUrl.length > 0) {
                    // Use the real URL for cache checking
                    entityUrl = combatantsWithUrl[0].dndBeyondUrl;
                    isLocalMonster = false; // Treat as normal monster now
                    cachedDetails = combatantsWithUrl[0];
                    break;
                }
                
                // Find all combatants matching the base name WITHOUT a URL (since those use monster: prefix)
                const matchingCombatants = encounter.combatants.filter(combatant => {
                    const combatantBaseName = combatant.name || combatant.monster;
                    if (!combatantBaseName) return false;
                    
                    const baseCombatantName = combatantBaseName.replace(/\s+\d+$/, '').trim();
                    return baseCombatantName === baseEntityName && !combatant.dndBeyondUrl;
                });
                
                // Use the first match (all variants share same base stats anyway)
                if (matchingCombatants.length > 0) {
                    cachedDetails = matchingCombatants[0];
                    break;
                }
            }
        }
        
        // If found monster without URL, fetch from D&D Beyond by name
        if (cachedDetails && !cachedDetails.dndBeyondUrl) {
            // Show loading state
            tooltip.innerHTML = `<div class="monster-tooltip-loading">Loading ${baseEntityName} from D&D Beyond...</div>`;
            tooltip.style.display = 'block';
            positionTooltip(event);
            
            // Fetch by monster name using search endpoint
            fetch(`/api/dndbeyond/monster/search/${encodeURIComponent(baseEntityName)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.url) {
                        // Update all matching combatants with the found URL
                        currentAdventure.encounters.forEach(encounter => {
                            if (encounter.combatants) {
                                encounter.combatants.forEach(c => {
                                    const cBaseName = (c.name || '').replace(/\s+\d+$/, '').trim();
                                    if (cBaseName === baseEntityName && !c.dndBeyondUrl) {
                                        c.dndBeyondUrl = data.url;
                                        if (data.ac) c.ac = data.ac;
                                        if (data.maxHp) c.maxHp = data.maxHp;
                                        if (data.cr) c.cr = data.cr;
                                        if (data.id) c.id = data.id;
                                    }
                                });
                            }
                        });
                        
                        if (window.autoSave) window.autoSave();
                        
                        // Cache the details if provided
                        if (data.details && data.details.abilities) {
                            MONSTER_DETAILS_CACHE[data.url] = data.details;
                            window.MONSTER_DETAILS_CACHE = MONSTER_DETAILS_CACHE;
                            
                            // Also cache to DND_MONSTERS for legacy code (using slug/id as key)
                            const monsterKey = data.details.slug || data.details.id || data.details.name;
                            if (monsterKey && window.DND_MONSTERS) {
                                window.DND_MONSTERS[monsterKey] = data.details;
                            }
                        }
                        
                        // Render tooltip with details
                        if (data.details) {
                            renderTooltipContent(tooltip, entityName, data.details, false, encounterIndex, data.url);
                            // Don't re-render immediately - it causes lag. Will update on next render cycle.
                        } else {
                            tooltip.innerHTML = `<div class="monster-tooltip-loading">Monster found! Refreshing...</div>`;
                            setTimeout(() => {
                                hideMonsterTooltip();
                                if (window.renderEncounters) window.renderEncounters();
                            }, 800);
                        }
                    } else {
                        tooltip.innerHTML = `<div class="monster-tooltip-loading">
                            <div style="font-weight: bold; margin-bottom: 8px;">${entityName}</div>
                            <div style="margin-top: 8px; font-size: 11px; color: #666;">
                                Monster not found in D&D Beyond. Please add it from the monster library or manually enter a URL.
                            </div>
                        </div>`;
                    }
                })
                .catch(error => {
                    console.error('[Tooltip ERROR] Failed to search for monster:', error);
                    tooltip.innerHTML = `<div class="monster-tooltip-loading">
                        <div style="font-weight: bold; margin-bottom: 8px;">${entityName}</div>
                        ${cachedDetails.hp !== undefined || cachedDetails.maxHp ? `<div>HP: ${cachedDetails.hp !== undefined ? cachedDetails.hp : cachedDetails.maxHp}${cachedDetails.maxHp ? '/' + cachedDetails.maxHp : ''}</div>` : ''}
                        <div style="margin-top: 8px; font-size: 11px; color: #999;">
                            Unable to fetch from D&D Beyond. Add from library for full stats.
                        </div>
                    </div>`;
                });
            
            return;
        }
        
        // Fallback for no match found
        if (isLocalMonster) {
            // No data found for local monster
            tooltip.innerHTML = `<div class="monster-tooltip-loading">
                <div style="margin-bottom: 8px;">${entityName}</div>
                <div style="font-size: 12px; color: #666;">
                    No additional details available.
                </div>
            </div>`;
            tooltip.style.display = 'block';
            positionTooltip(event);
            return;
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
    
    fetch(apiEndpoint)
        .then(response => response.json())
        .then(data => {
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
                window.MONSTER_DETAILS_CACHE = MONSTER_DETAILS_CACHE;
                
                // Also cache to DND_MONSTERS for legacy code and attack rolls (using slug/id as key)
                const monsterKey = details.slug || details.id || details.name;
                if (monsterKey && window.DND_MONSTERS) {
                    window.DND_MONSTERS[monsterKey] = details;
                }
            }
            
            renderTooltipContent(tooltip, entityName, details, isCharacter, encounterIndex, entityUrl);
            
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
 * Toggle whether players have identified a monster (by base name).
 * When identified, the spectator view reveals the monster's real name for
 * every instance of that monster across all encounters in the adventure.
 */
function toggleMonsterIdentified(baseName, checked) {
    const currentAdventure = window.currentAdventure;
    if (!currentAdventure || !baseName) return;

    if (!Array.isArray(currentAdventure.identifiedMonsters)) {
        currentAdventure.identifiedMonsters = [];
    }

    const list = currentAdventure.identifiedMonsters;
    const index = list.indexOf(baseName);

    if (checked && index === -1) {
        list.push(baseName);
    } else if (!checked && index !== -1) {
        list.splice(index, 1);
    }

    if (window.autoSave) window.autoSave();
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
    currentTooltipEntityKey = null;
        
export const tooltipManager = {
    showMonsterTooltip,
    hideMonsterTooltip,
    toggleMonsterIdentified,
    createTooltipElement,
    formatModifier,
    formatActionDescription,
    renderTooltipContent,
    isCharacterUrl
};
