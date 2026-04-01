/**
 * Legacy Bridge - Compatibility layer between new modular code and old script.js
 * 
 * This file provides a clean interface to legacy rendering functions
 * while the new modular architecture handles state and event management.
 */

// Import from the old script.js - these functions will be loaded when script.js loads
// We just need to ensure they're accessible to the new app.js

/**
 * Wire up compatibility for inline onclick handlers
 * Redirects old function calls to new app handlers
 */
export function setupLegacyCompatibility() {
    // Wait for app to be available
    if (!window.app || !window.app.handlers) {
        console.warn('App not initialized yet, legacy compatibility pending');
        return;
    }

    const handlers = window.app.handlers;

    // Map old function names to new handlers
    const handlerMap = {
        // Modals
        'openSettingsModal': () => handlers.openSettingsModal(),
        'closeSettingsModal': () => handlers.closeSettingsModal(),
        'openAdventureSettingsModal': () => handlers.openAdventureSettingsModal(),
        'closeAdventureSettingsModal': () => handlers.closeAdventureSettingsModal(),
        'openMonsterModal': () => handlers.openMonsterModal(),
        'closeMonsterModal': () => handlers.closeMonsterModal(),
        'closeDamageModal': () => handlers.closeDamageModal(),
        'closeHealModal': () => handlers.closeHealModal(),
        'closeAttackResultModal': () => handlers.closeAttackResultModal(),
        
        // Cookies
        'saveCookies': () => handlers.saveCookies(),
        'clearCookies': () => handlers.clearCookies(),
        
        // Chapters
        'addChapter': () => handlers.addChapter(),
        'deleteChapter': () => handlers.deleteChapter(),
        
        // Players
        'sortPlayers': (field) => handlers.sortPlayers(field),
        'togglePlayersSection': () => handlers.togglePlayersSection(),
        'togglePlayersEditMode': () => handlers.togglePlayersEditMode(),
        
        // Utility
        'openStatisticsInNewWindow': () => handlers.openStatisticsInNewWindow(),
    };

    // Expose mapped handlers globally for inline onclick use
    Object.entries(handlerMap).forEach(([name, fn]) => {
        window[name] = fn;
    });

    console.log('✓ Legacy compatibility layer initialized');
}

/**
 * Call this after both script.js and app.js have loaded
 */
if (typeof document !== 'undefined') {
    // Auto-setup when DOM and app are ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(setupLegacyCompatibility, 100);
        });
    } else {
        setTimeout(setupLegacyCompatibility, 100);
    }
}
