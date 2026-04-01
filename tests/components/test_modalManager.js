/**
 * Tests for modalManager.js
 */
import { createModalManager, MODAL_IDS } from '../../static/components/modalManager.js';

describe('Modal Manager', () => {
    let manager;
    let mockDOM;
    let mockElements;

    beforeEach(() => {
        // Reset mock elements
        mockElements = {
            testModal: {
                id: 'testModal',
                style: { display: '', opacity: '' },
                hasAttribute: () => false,
                querySelector: () => null,
            },
            dynamicModal: {
                id: 'dynamicModal',
                className: '',
                innerHTML: '',
                style: { display: '', opacity: '' },
                hasAttribute: (attr) => attr === 'data-dynamic',
                querySelector: (sel) => {
                    if (sel === '.modal-body') {
                        return { innerHTML: '' };
                    }
                    return null;
                },
                setAttribute: jest.fn(),
            },
        };

        // Mock DOM helpers
        mockDOM = {
            getElementById: jest.fn((id) => mockElements[id] || null),
            querySelector: jest.fn(),
            createElement: jest.fn((tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    id: '',
                    innerHTML: '',
                    style: {},
                    setAttribute: jest.fn(),
                    hasAttribute: jest.fn((attr) => attr === 'data-dynamic'),
                    querySelector: jest.fn((sel) => {
                        if (sel === '.modal-body') {
                            return { innerHTML: '' };
                        }
                        if (sel.startsWith('[data-action=')) {
                            const index = sel.match(/\d+/)[0];
                            return { mockButton: true, index };
                        }
                        if (sel === '[data-close]') {
                            return { mockCloseBtn: true };
                        }
                        return null;
                    }),
                };
                return el;
            }),
            addEventListener: jest.fn(),
            appendChild: jest.fn(),
            remove: jest.fn(),
        };

        manager = createModalManager({ dom: mockDOM });
    });

    describe('openModal', () => {
        test('opens existing modal by ID', () => {
            manager.openModal('testModal');

            expect(mockDOM.getElementById).toHaveBeenCalledWith('testModal');
            expect(mockElements.testModal.style.display).toBe('flex');
            expect(mockElements.testModal.style.opacity).toBe('1');
        });

        test('warns when modal not found', () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            manager.openModal('nonexistent');

            expect(consoleWarn).toHaveBeenCalledWith('Modal not found: nonexistent');
            consoleWarn.mockRestore();
        });

        test('closes previous modal when opening new one', () => {
            manager.openModal('testModal');
            manager.openModal('dynamicModal');

            expect(mockElements.testModal.style.display).toBe('none');
            expect(mockElements.dynamicModal.style.display).toBe('flex');
        });

        test('calls onOpen callback if provided', () => {
            const onOpen = jest.fn();
            
            manager.openModal('testModal', { onOpen });

            expect(onOpen).toHaveBeenCalledWith(mockElements.testModal);
        });

        test('does not close same modal twice', () => {
            manager.openModal('testModal');
            const firstDisplay = mockElements.testModal.style.display;
            
            manager.openModal('testModal');

            expect(mockElements.testModal.style.display).toBe('flex');
        });
    });

    describe('closeModal', () => {
        test('closes modal by ID', () => {
            manager.openModal('testModal');
            manager.closeModal('testModal');

            expect(mockElements.testModal.style.display).toBe('none');
            expect(mockElements.testModal.style.opacity).toBe('0');
        });

        test('removes dynamic modals from DOM', () => {
            manager.openModal('dynamicModal');
            manager.closeModal('dynamicModal');

            expect(mockDOM.remove).toHaveBeenCalledWith(mockElements.dynamicModal);
        });

        test('does not fail when closing non-existent modal', () => {
            expect(() => {
                manager.closeModal('nonexistent');
            }).not.toThrow();
        });

        test('clears current modal reference', () => {
            manager.openModal('testModal');
            manager.closeModal('testModal');

            expect(manager.isModalOpen()).toBe(false);
        });
    });

    describe('closeCurrentModal', () => {
        test('closes currently open modal', () => {
            manager.openModal('testModal');
            manager.closeCurrentModal();

            expect(mockElements.testModal.style.display).toBe('none');
        });

        test('does nothing when no modal is open', () => {
            expect(() => {
                manager.closeCurrentModal();
            }).not.toThrow();
        });
    });

    describe('createModal', () => {
        test('creates dynamic modal with title and content', () => {
            const config = {
                id: 'newModal',
                title: 'Test Title',
                content: '<p>Test content</p>',
            };

            const modal = manager.createModal(config);

            expect(mockDOM.createElement).toHaveBeenCalledWith('div');
            expect(modal.className).toBe('modal');
            expect(modal.id).toBe('newModal');
            expect(modal.innerHTML).toContain('Test Title');
            expect(modal.innerHTML).toContain('<p>Test content</p>');
        });

        test('creates modal with buttons', () => {
            const onClick = jest.fn();
            const config = {
                id: 'buttonModal',
                title: 'Test',
                content: 'Content',
                buttons: [
                    { text: 'Cancel', style: 'background: #95a5a6;' },
                    { text: 'Save', onClick },
                ],
            };

            const modal = manager.createModal(config);

            expect(modal.innerHTML).toContain('Cancel');
            expect(modal.innerHTML).toContain('Save');
            expect(modal.innerHTML).toContain('background: #95a5a6;');
        });

        test('appends modal to document body', () => {
            const config = {
                id: 'appendTest',
                content: 'Test',
            };

            manager.createModal(config);

            expect(mockDOM.appendChild).toHaveBeenCalled();
        });

        test('marks modal as dynamic', () => {
            const config = {
                id: 'dynamicTest',
                content: 'Test',
            };

            const modal = manager.createModal(config);

            expect(modal.setAttribute).toHaveBeenCalledWith('data-dynamic', 'true');
        });

        test('opens modal after creation', () => {
            const config = {
                id: 'autoOpenTest',
                content: 'Test',
            };

            manager.createModal(config);

            expect(mockDOM.getElementById).toHaveBeenCalledWith('autoOpenTest');
        });

        test('creates modal without title', () => {
            const config = {
                id: 'noTitle',
                content: 'Just content',
            };

            const modal = manager.createModal(config);

            expect(modal.innerHTML).not.toContain('modal-header');
            expect(modal.innerHTML).toContain('Just content');
        });

        test('supports custom max-width', () => {
            const config = {
                id: 'customWidth',
                content: 'Test',
                options: { maxWidth: '800px' },
            };

            const modal = manager.createModal(config);

            expect(modal.innerHTML).toContain('max-width: 800px');
        });
    });

    describe('isModalOpen', () => {
        test('returns false when no modal is open', () => {
            expect(manager.isModalOpen()).toBe(false);
        });

        test('returns true when modal is open', () => {
            manager.openModal('testModal');

            expect(manager.isModalOpen()).toBe(true);
        });

        test('checks specific modal by ID', () => {
            manager.openModal('testModal');

            expect(manager.isModalOpen('testModal')).toBe(true);
            expect(manager.isModalOpen('otherModal')).toBe(false);
        });
    });

    describe('getCurrentModal', () => {
        test('returns null when no modal is open', () => {
            expect(manager.getCurrentModal()).toBeNull();
        });

        test('returns current modal element', () => {
            manager.openModal('testModal');

            expect(manager.getCurrentModal()).toBe(mockElements.testModal);
        });
    });

    describe('updateModalContent', () => {
        test('updates modal body content', () => {
            const modalBody = { innerHTML: 'old content' };
            mockElements.testModal.querySelector = () => modalBody;

            manager.updateModalContent('testModal', '<p>new content</p>');

            expect(modalBody.innerHTML).toBe('<p>new content</p>');
        });

        test('warns when modal not found', () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

            manager.updateModalContent('nonexistent', 'content');

            expect(consoleWarn).toHaveBeenCalledWith('Modal not found: nonexistent');
            consoleWarn.mockRestore();
        });

        test('handles missing modal body gracefully', () => {
            mockElements.testModal.querySelector = () => null;

            expect(() => {
                manager.updateModalContent('testModal', 'content');
            }).not.toThrow();
        });
    });

    describe('MODAL_IDS constants', () => {
        test('exports modal ID constants', () => {
            expect(MODAL_IDS.ATTACK_RESULT).toBe('attackResultModal');
            expect(MODAL_IDS.SETTINGS).toBe('settingsModal');
            expect(MODAL_IDS.ADVENTURE_SETTINGS).toBe('adventureSettingsModal');
            expect(MODAL_IDS.DAMAGE).toBe('damageModal');
            expect(MODAL_IDS.HEAL).toBe('healModal');
            expect(MODAL_IDS.CONDITIONS).toBe('conditionsModal');
            expect(MODAL_IDS.MONSTER).toBe('monsterModal');
        });
    });

    describe('default DOM usage', () => {
        test('uses real DOM when no config provided', () => {
            // Create manager without mock DOM
            const realManager = createModalManager();

            // Should not throw when trying to use real DOM methods
            expect(realManager).toBeDefined();
            expect(realManager.openModal).toBeDefined();
        });
    });
});
