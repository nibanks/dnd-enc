/**
 * Utility helpers for formatting and common operations
 * These are UI-related helpers that don't fit in pure business logic
 */

/**
 * D&D condition icons mapping
 */
export const CONDITION_ICONS = {
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

/**
 * Get CSS class for damage type (for color-coding)
 * @param {string} type - Damage type
 * @returns {string} CSS class name
 */
export function getDamageTypeClass(type) {
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
 * Format action description text with proper spacing and bold keywords
 * @param {string} text - Raw action description
 * @returns {string} Formatted HTML string
 */
export function formatActionDescription(text) {
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
 * Get combatant display name (look up from players if needed)
 * @param {Object} combatant - Combatant object
 * @param {Array} players - Array of player objects
 * @returns {string} Display name
 */
export function getCombatantName(combatant, players = []) {
    // Check if this is a player combatant (no name field)
    if (!combatant.hasOwnProperty('name')) {
        // Look up player name by id field (which matches dndBeyondUrl)
        if (combatant.id) {
            const player = players.find(p => {
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

/**
 * Get DEX score for a combatant (for initiative tiebreaker)
 * @param {Object} combatant - Combatant object
 * @param {Array} players - Array of player objects
 * @returns {number} DEX score
 */
export function getCombatantDexScore(combatant, players = []) {
    // For players, look up DEX score
    if (!combatant.hasOwnProperty('name')) {
        if (combatant.id) {
            const player = players.find(p => {
                const playerId = p.dndBeyondUrl?.split('/').pop() || p.dndBeyondUrl;
                return playerId === combatant.id;
            });
            if (player && player.abilityScores) {
                return player.abilityScores.dex || 10;
            }
        }
        return 10; // Default DEX
    }
    
    // For monsters, use stored dexScore or fall back to calculating from initiativeBonus
    if (combatant.dexScore !== undefined) {
        return combatant.dexScore;
    }
    
    // Fallback: estimate from initiative bonus (bonus = (dex - 10) / 2)
    const bonus = combatant.initiativeBonus || 0;
    return 10 + (bonus * 2);
}

/**
 * Check if a URL is a character URL (vs monster URL)
 * @param {string} url - D&D Beyond URL
 * @returns {boolean} True if character URL
 */
export function isCharacterUrl(url) {
    if (!url) return false;
    return url.includes('/profile/') || url.includes('/characters/');
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate a simple unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type (info, success, error, warning)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
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
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    }
    return false;
}

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 */
export function getURLParameter(name) {
    const url = new URL(window.location);
    return url.searchParams.get(name);
}

/**
 * Set URL parameter without reload
 * @param {string} name - Parameter name
 * @param {string} value - Parameter value
 */
export function setURLParameter(name, value) {
    const url = new URL(window.location);
    if (value === null || value === undefined || value === '') {
        url.searchParams.delete(name);
    } else {
        url.searchParams.set(name, value);
    }
    window.history.pushState({}, '', url);
}

/**
 * Extract the base monster name from a combatant display name so we can
 * look it up in the D&D Beyond monster list. Strips, in either order:
 *   - a trailing parenthetical label, e.g. "Doppelganger (Zelina)"      -> "Doppelganger"
 *   - a trailing instance number,    e.g. "Kobold 3"                     -> "Kobold"
 * Handles both orderings so "Veteran (Disguised) 1" and "Veteran 1 (Disguised)"
 * both collapse to "Veteran".
 * @param {string} name - Combatant name
 * @returns {string} Base monster name suitable for lookup
 */
export function getMonsterBaseName(name) {
    if (!name) return '';
    let result = String(name);
    let prev;
    do {
        prev = result;
        result = result
            .replace(/\s*\([^)]*\)\s*$/, '')
            .replace(/\s+\d+$/, '')
            .trim();
    } while (result !== prev);
    return result;
}

/**
 * Parse CR string to numeric value for sorting/comparison
 * @param {string} cr - Challenge Rating (e.g., "1/4", "5", "1/2")
 * @returns {number} Numeric CR value
 */
export function parseCR(cr) {
    if (typeof cr !== 'string') {
        return parseFloat(cr) || 0;
    }
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr) || 0;
}

/**
 * Show cookie expiration warning banner
 * @param {string} monsterName - Name of monster that failed to load
 */
export function showCookieExpirationWarning(monsterName) {
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
