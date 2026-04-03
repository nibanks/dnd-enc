/**
 * Attack Roll Manager
 * Handles attack rolls from monster tooltips and applies damage to players
 */

/**
 * Get CSS class for damage type (for color-coding)
 * @param {string} type - Damage type (e.g., "fire", "cold", "acid")
 * @returns {string} CSS class name
 */
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

/**
 * Apply damage from attack result to selected player
 * @param {number} playerIdx - Player index
 * @param {string} resultHtml - HTML result from attack roll
 */
function applyAttackResultToPlayer(playerIdx, resultHtml) {
    if (playerIdx === null || playerIdx === undefined || isNaN(playerIdx)) {
        return;
    }
    
    // Get the current encounter
    const idxToUse = Number(window.currentEncounterIndex);
    const currentAdventure = window.currentAdventure;
    
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
    if (typeof window.renderEncounters === 'function') window.renderEncounters();
    if (typeof window.autoSave === 'function') window.autoSave();
    if (typeof window.closeAttackResultModal === 'function') window.closeAttackResultModal();
}

/**
 * Initialize attack roll event listener
 * @param {Object} deps - Dependencies
 * @param {Function} deps.hideMonsterTooltip - Function to hide monster tooltip
 * @param {Function} deps.openAttackResultModal - Function to open attack result modal
 * @param {Object} deps.DND_MONSTERS - Monster data object
 */
export function initializeAttackRollHandler(deps = {}) {
    const { hideMonsterTooltip, openAttackResultModal, DND_MONSTERS } = deps;
    
    // Expose applyAttackResultToPlayer globally for modal use
    window.applyAttackResultToPlayer = applyAttackResultToPlayer;
    
    // Event listener for [roll] button clicks
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('roll-attack-btn')) {
            e.stopPropagation();
            e.preventDefault();
            
            // Hide the tooltip so it doesn't block the modal
            if (hideMonsterTooltip) hideMonsterTooltip();
            
            // Get encounter index and action index
            const tooltipDiv = e.target.closest('.monster-tooltip-section');
            const encounterIndex = tooltipDiv ? parseInt(tooltipDiv.getAttribute('data-encounter-index')) : null;
            const actionIdx = parseInt(e.target.getAttribute('data-action-idx'));
            const entityName = e.target.getAttribute('data-entity-name');
            const monsterId = e.target.getAttribute('data-monster-id');
            
            if (encounterIndex !== null) {
                window.currentEncounterIndex = encounterIndex;
            }
            
            // Get monster details from cache
            let monsterDetails = null;
            const MONSTER_DETAILS_CACHE = window.MONSTER_DETAILS_CACHE || {};
            
            // Try DND_MONSTERS first (old cache)
            if (monsterId && DND_MONSTERS && DND_MONSTERS[monsterId]) {
                monsterDetails = DND_MONSTERS[monsterId];
            }
            
            // Try MONSTER_DETAILS_CACHE if not found (new cache from tooltips)
            if (!monsterDetails && monsterId && MONSTER_DETAILS_CACHE) {
                // Try exact match first
                monsterDetails = MONSTER_DETAILS_CACHE[monsterId];
                
                // If not found, try to match by URL pattern (monsterId might be a slug)
                if (!monsterDetails) {
                    for (const url in MONSTER_DETAILS_CACHE) {
                        if (url.includes(`/${monsterId}`) || url.endsWith(monsterId)) {
                            monsterDetails = MONSTER_DETAILS_CACHE[url];
                            break;
                        }
                    }
                }
            }
            
            function handleRollWithDetails(details) {
                if (!details || !details.actions || !details.actions[actionIdx]) {
                    if (openAttackResultModal) {
                        openAttackResultModal('<span style="color:#e74c3c;">Action not found.</span>');
                    }
                    return;
                }
                
                const action = details.actions[actionIdx];
                const actionName = action.name;
                // Format v2: action may not have description, use structured fields
                const actionDesc = action.description || '';
                
                // Detect saving throw - check structured field first
                let saveMatch = null;
                if (action.save) {
                    // Format v2: structured save data
                    saveMatch = { dc: action.save.dc, ability: action.save.ability };
                } else if (actionDesc) {
                    // Old format: parse from description
                    const match = actionDesc.match(/DC (\d+) ([A-Za-z]+) saving throw/i);
                    if (match) {
                        saveMatch = { dc: parseInt(match[1]), ability: match[2] };
                    }
                }
                
                // Parse damage expressions - handle both format v2 (structured) and old format (description text)
                const damageParts = [];
                
                // Format v2: use structured damage fields
                if (action.damage) {
                    // Parse "17 (3d8 + 4) Piercing" format
                    const dmgMatch = action.damage.match(/(\d+)\s*\(([^)]+)\)\s*([A-Za-z]+)/);
                    if (dmgMatch) {
                        damageParts.push({
                            dice: dmgMatch[2].replace(/\s+/g, ''),
                            type: dmgMatch[3]
                        });
                    }
                }
                if (action.damage2) {
                    const dmgMatch = action.damage2.match(/(\d+)\s*\(([^)]+)\)\s*([A-Za-z]+)/);
                    if (dmgMatch) {
                        damageParts.push({
                            dice: dmgMatch[2].replace(/\s+/g, ''),
                            type: dmgMatch[3]
                        });
                    }
                }
                
                // Old format: parse from description text
                if (actionDesc && damageParts.length === 0) {
                    const diceDamageRegex = /([0-9]+)\s*\(([^)]+)\)\s*([A-Za-z]+)\s*damage/g;
                    let match;
                    while ((match = diceDamageRegex.exec(actionDesc)) !== null) {
                        damageParts.push({
                            dice: match[2].replace(/\s+/g, ''),
                            type: match[3]
                        });
                    }
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
                let attackData = null;
                
                if (saveMatch) {
                    const dc = saveMatch.dc || saveMatch[1];
                    const saveType = saveMatch.ability || saveMatch[2];
                    resultHtml = `<div><b>Each target must make a DC ${dc} ${saveType} saving throw.</b></div>`;
                    resultHtml += `<div style="margin-top:8px;"><b>Damage:</b> ${damageHtml}</div>`;
                    attackData = { isSavingThrow: true };
                } else {
                    // Parse attack bonus - use structured field first (format v2)
                    let attackBonus = 0;
                    if (action.hit !== undefined) {
                        // Format v2: structured hit bonus
                        attackBonus = action.hit;
                    } else if (actionDesc) {
                        // Old format: parse from description
                        const attackMatch = actionDesc.match(/\+?([0-9]+)\s*to\s*hit/);
                        if (attackMatch) {
                            attackBonus = parseInt(attackMatch[1]);
                        }
                    }
                    
                    // Roll attack
                    const d20 = Math.floor(Math.random() * 20) + 1;
                    const attackTotal = d20 + attackBonus;
                    
                    let critMsg = '';
                    const isCritSuccess = d20 === 20;
                    const isCritFail = d20 === 1;
                    if (isCritFail) critMsg = '<span style="color:#e74c3c;">Critical Failure!</span>';
                    if (isCritSuccess) critMsg = '<span style="color:#2ecc71;">Critical Success!</span>';
                    
                    resultHtml = `<div><b>Attack Roll:</b> d20 (${d20}) + ${attackBonus} = <b>${attackTotal}</b></div>`;
                    if (critMsg) resultHtml += `<div style="margin-top:4px;">${critMsg}</div>`;
                    resultHtml += `<div style="margin-top:8px;"><b>Damage:</b> ${damageHtml}</div>`;
                    
                    attackData = {
                        attackTotal: attackTotal,
                        isCritSuccess: isCritSuccess,
                        isCritFail: isCritFail,
                        isSavingThrow: false
                    };
                }
                
                if (openAttackResultModal) {
                    openAttackResultModal(resultHtml, attackData);
                }
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
                            if (openAttackResultModal) {
                                openAttackResultModal('<span style="color:#e74c3c;">Action not found (API).</span>');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching monster details:', error);
                        if (openAttackResultModal) {
                            openAttackResultModal('<span style="color:#e74c3c;">Failed to fetch monster details.</span>');
                        }
                    });
            } else {
                if (openAttackResultModal) {
                    openAttackResultModal('<span style="color:#e74c3c;">Monster details not found.</span>');
                }
            }
        }
    });
}
