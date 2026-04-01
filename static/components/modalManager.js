/**
 * Modal Manager - Centralized modal handling
 * 
 * Manages all modals in the application with consistent open/close behavior.
 * Supports both static HTML modals and dynamically created modals.
 */

/**
 * Create a modal manager instance
 * @param {Object} config - Configuration object
 * @param {Object} config.dom - DOM helpers for testability
 * @returns {Object} Modal manager API
 */
export function createModalManager(config = {}) {
    const dom = config.dom || {
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel),
        createElement: (tag) => document.createElement(tag),
        addEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
        appendChild: (parent, child) => parent.appendChild(child),
        remove: (el) => el.remove(),
    };

    // Track currently open modal
    let currentModal = null;

    /**
     * Open a modal by ID
     * @param {string} modalId - The modal element ID
     * @param {Object} options - Optional configuration
     * @param {Function} options.onOpen - Callback after modal opens
     * @param {boolean} options.closeOnEscape - Allow ESC to close (default: true)
     * @param {boolean} options.closeOnBackdrop - Allow backdrop click to close (default: true)
     */
    function openModal(modalId, options = {}) {
        const modal = dom.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal not found: ${modalId}`);
            return;
        }

        // Close any currently open modal first
        if (currentModal && currentModal !== modal) {
            closeCurrentModal();
        }

        // Show the modal
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        
        // Track as current modal
        currentModal = modal;

        // Setup event listeners if specified
        const closeOnEscape = options.closeOnEscape !== false;
        const closeOnBackdrop = options.closeOnBackdrop !== false;

        if (closeOnEscape) {
            setupEscapeHandler(modal);
        }

        if (closeOnBackdrop) {
            setupBackdropHandler(modal);
        }

        // Call onOpen callback if provided
        if (typeof options.onOpen === 'function') {
            options.onOpen(modal);
        }

        return modal;
    }

    /**
     * Close a specific modal by ID
     * @param {string} modalId - The modal element ID
     */
    function closeModal(modalId) {
        const modal = dom.getElementById(modalId);
        if (!modal) {
            return;
        }

        modal.style.display = 'none';
        modal.style.opacity = '0';

        if (currentModal === modal) {
            currentModal = null;
        }

        // Remove dynamic modals from DOM
        if (modal.hasAttribute('data-dynamic')) {
            dom.remove(modal);
        }
    }

    /**
     * Close the currently open modal (if any)
     */
    function closeCurrentModal() {
        if (!currentModal) {
            return;
        }

        const modalId = currentModal.id;
        if (modalId) {
            closeModal(modalId);
        } else {
            // Modal without ID, close directly
            currentModal.style.display = 'none';
            if (currentModal.hasAttribute('data-dynamic')) {
                dom.remove(currentModal);
            }
            currentModal = null;
        }
    }

    /**
     * Create and show a dynamic modal
     * @param {Object} config - Modal configuration
     * @param {string} config.id - Modal ID
     * @param {string} config.title - Modal title
     * @param {string} config.content - Modal content HTML
     * @param {Array} config.buttons - Array of button configs {text, onClick, style}
     * @param {Object} config.options - Open options
     * @returns {HTMLElement} The created modal element
     */
    function createModal({ id, title, content, buttons = [], options = {} }) {
        // Create modal structure
        const modal = dom.createElement('div');
        modal.className = 'modal';
        modal.id = id;
        modal.setAttribute('data-dynamic', 'true');

        let buttonsHtml = '';
        if (buttons.length > 0) {
            buttonsHtml = '<div style="display: flex; gap: 10px; margin-top: 20px; padding: 0 10px 10px 10px;">';
            buttons.forEach((btn, index) => {
                const style = btn.style || '';
                const dataAttr = btn.onClick ? `data-action="${index}"` : '';
                buttonsHtml += `<button class="btn" ${dataAttr} style="${style}">${btn.text}</button>`;
            });
            buttonsHtml += '</div>';
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: ${options.maxWidth || '500px'};">
                ${title ? `<div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" data-close>&times;</button>
                </div>` : ''}
                <div class="modal-body">
                    ${content}
                </div>
                ${buttonsHtml}
            </div>
        `;

        // Attach button handlers
        buttons.forEach((btn, index) => {
            if (btn.onClick) {
                const buttonEl = modal.querySelector(`[data-action="${index}"]`);
                if (buttonEl) {
                    dom.addEventListener(buttonEl, 'click', () => btn.onClick(modal));
                }
            }
        });

        // Attach close button handler
        const closeBtn = modal.querySelector('[data-close]');
        if (closeBtn) {
            dom.addEventListener(closeBtn, 'click', () => closeModal(id));
        }

        // Append to body
        dom.appendChild(document.body, modal);

        // Open the modal
        openModal(id, options);

        return modal;
    }

    /**
     * Setup ESC key handler for a modal
     */
    function setupEscapeHandler(modal) {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && currentModal === modal) {
                closeCurrentModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Setup backdrop click handler for a modal
     */
    function setupBackdropHandler(modal) {
        const handleBackdrop = (e) => {
            if (e.target === modal && currentModal === modal) {
                closeCurrentModal();
            }
        };
        dom.addEventListener(modal, 'click', handleBackdrop);
    }

    /**
     * Check if a modal is currently open
     * @param {string} modalId - Optional modal ID to check specifically
     * @returns {boolean}
     */
    function isModalOpen(modalId) {
        if (!currentModal) {
            return false;
        }
        if (modalId) {
            return currentModal.id === modalId;
        }
        return true;
    }

    /**
     * Get the currently open modal element
     * @returns {HTMLElement|null}
     */
    function getCurrentModal() {
        return currentModal;
    }

    /**
     * Update modal content
     * @param {string} modalId - The modal element ID
     * @param {string} content - New HTML content
     */
    function updateModalContent(modalId, content) {
        const modal = dom.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal not found: ${modalId}`);
            return;
        }

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = content;
        }
    }

    return {
        openModal,
        closeModal,
        closeCurrentModal,
        createModal,
        isModalOpen,
        getCurrentModal,
        updateModalContent,
    };
}

// Named modal IDs for convenience
export const MODAL_IDS = {
    ATTACK_RESULT: 'attackResultModal',
    SETTINGS: 'settingsModal',
    ADVENTURE_SETTINGS: 'adventureSettingsModal',
    DAMAGE: 'damageModal',
    HEAL: 'healModal',
    CONDITIONS: 'conditionsModal',
    MONSTER: 'monsterModal',
};
