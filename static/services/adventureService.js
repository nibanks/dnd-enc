/**
 * Adventure Service - Handles adventure-related operations
 */

/**
 * Create adventure service with dependencies
 * @param {Object} deps - Dependencies
 * @param {Object} deps.api - API client
 * @param {Object} deps.dom - DOM helpers
 * @param {Function} deps.getAdventure - Get current adventure from state
 * @param {Function} deps.getAdventureSelectValue - Get selected adventure name
 * @returns {Object} Service methods
 */
export function createAdventureService(deps = {}) {
    const { api, dom, getAdventure, getAdventureSelectValue } = deps;
    
    let autoSaveTimeout = null;

    /**
     * Load list of adventures into the dropdown
     */
    async function loadAdventuresList() {
        try {
            const adventures = await api.getAdventures();
            
            const select = dom.getElementById('adventureSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">-- Select Adventure --</option>';
            
            adventures.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading adventures list:', error);
        }
    }

    /**
     * Auto-save current adventure after a delay
     */
    function autoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(async () => {
            const name = getAdventureSelectValue();
            if (!name) return;
            
            const currentAdventure = getAdventure();
            
            // Safety check: only save if currentAdventure is loaded and matches the selected adventure
            if (!currentAdventure || currentAdventure.name !== name) {
                console.warn('AutoSave blocked: currentAdventure does not match selected adventure');
                return;
            }
            
            try {
                await api.updateAdventure(name, currentAdventure);
                showSaveIndicator();
            } catch (error) {
                if (error.status === 403) {
                    // Session expired or invalid - prompt for reload
                    alert('Your session has expired. Please reload the page and re-enter your PIN.');
                    // Clear state would be handled by event handler
                }
                console.error('Auto-save error:', error);
            }
        }, 500);
    }

    /**
     * Show temporary save indicator
     */
    function showSaveIndicator() {
        let indicator = document.querySelector('.auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'auto-save-indicator';
            indicator.textContent = '✓ Saved';
            document.body.appendChild(indicator);
        }
        
        indicator.style.display = 'block';
        indicator.style.opacity = '1';
        
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 300);
        }, 2000);
    }

    /**
     * Check cookie authentication status
     */
    async function checkCookieStatus() {
        try {
            const hasCookies = await api.checkCookieStatus();
            
            // Update global variable for legacy code compatibility
            if (typeof window !== 'undefined') {
                window.hasCookies = hasCookies;
            }
            
            updateUIForCookieStatus(hasCookies);
            return hasCookies;
        } catch (error) {
            console.error('Error checking cookie status:', error);
            
            // Update global variable for legacy code compatibility
            if (typeof window !== 'undefined') {
                window.hasCookies = false;
            }
            
            updateUIForCookieStatus(false);
            return false;
        }
    }

    /**
     * Update UI based on cookie authentication status
     * @param {boolean} hasCookies - Whether cookies are configured
     */
    function updateUIForCookieStatus(hasCookies) {
        const adventureSelect = dom.getElementById('adventureSelect');
        const newAdventureBtn = dom.getElementById('newAdventureBtn');
        
        if (!adventureSelect || !newAdventureBtn) return;
        
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
                    <button onclick="window.appHandlers?.openSettingsModal()" style="background: #9b59b6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        ⚙️ Open Settings to Configure
                    </button>
                `;
                
                const container = dom.getElementById('adventureSelectionHeader');
                if (container) {
                    container.insertAdjacentElement('afterend', warning);
                }
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

    return {
        loadAdventuresList,
        autoSave,
        checkCookieStatus,
        updateUIForCookieStatus,
    };
}
