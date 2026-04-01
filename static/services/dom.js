/**
 * DOM Abstraction Layer
 * Wraps DOM operations for testability
 */

/**
 * Create DOM helper with injectable document object
 * @param {Object} config - Configuration options
 * @param {Document} config.document - Document object (injectable for testing)
 * @param {Window} config.window - Window object (injectable for testing)
 * @returns {Object} DOM helper methods
 */
export function createDOMHelpers(config = {}) {
    const {
        document: doc = typeof document !== 'undefined' ? document : null,
        window: win = typeof window !== 'undefined' ? window : null
    } = config;
    
    if (!doc) {
        throw new Error('Document object is required');
    }
    
    return {
        // ==================== Element Selection ====================
        
        /**
         * Get element by ID
         * @param {string} id - Element ID
         * @returns {HTMLElement|null} Element or null
         */
        getElementById(id) {
            return doc.getElementById(id);
        },
        
        /**
         * Query selector (single element)
         * @param {string} selector - CSS selector
         * @returns {HTMLElement|null} First matching element or null
         */
        querySelector(selector) {
            return doc.querySelector(selector);
        },
        
        /**
         * Query selector all
         * @param {string} selector - CSS selector
         * @returns {NodeList} All matching elements
         */
        querySelectorAll(selector) {
            return doc.querySelectorAll(selector);
        },
        
        // ==================== Element Creation ====================
        
        /**
         * Create element
         * @param {string} tagName - Tag name (e.g., 'div', 'button')
         * @param {Object} options - Optional properties
         * @param {string} options.className - CSS class name
         * @param {string} options.id - Element ID
         * @param {string} options.textContent - Text content
         * @param {string} options.innerHTML - HTML content
         * @param {Object} options.style - Style properties
         * @param {Object} options.attributes - Additional attributes
         * @returns {HTMLElement} Created element
         */
        createElement(tagName, options = {}) {
            const element = doc.createElement(tagName);
            
            if (options.className) {
                element.className = options.className;
            }
            if (options.id) {
                element.id = options.id;
            }
            if (options.textContent) {
                element.textContent = options.textContent;
            }
            if (options.innerHTML) {
                element.innerHTML = options.innerHTML;
            }
            if (options.style) {
                Object.assign(element.style, options.style);
            }
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            
            return element;
        },
        
        /**
         * Create text node
         * @param {string} text - Text content
         * @returns {Text} Text node
         */
        createTextNode(text) {
            return doc.createTextNode(text);
        },
        
        // ==================== Element Manipulation ====================
        
        /**
         * Append child to element
         * @param {HTMLElement} parent - Parent element
         * @param {HTMLElement|Text} child - Child element or text node
         */
        appendChild(parent, child) {
            parent.appendChild(child);
        },
        
        /**
         * Remove child from element
         * @param {HTMLElement} parent - Parent element
         * @param {HTMLElement} child - Child element to remove
         */
        removeChild(parent, child) {
            parent.removeChild(child);
        },
        
        /**
         * Remove element from DOM
         * @param {HTMLElement} element - Element to remove
         */
        remove(element) {
            if (element && element.remove) {
                element.remove();
            } else if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },
        
        /**
         * Insert element before another
         * @param {HTMLElement} parent - Parent element
         * @param {HTMLElement} newElement - Element to insert
         * @param {HTMLElement} referenceElement - Insert before this element
         */
        insertBefore(parent, newElement, referenceElement) {
            parent.insertBefore(newElement, referenceElement);
        },
        
        /**
         * Replace element with another
         * @param {HTMLElement} oldElement - Element to replace
         * @param {HTMLElement} newElement - Replacement element
         */
        replaceElement(oldElement, newElement) {
            oldElement.parentNode.replaceChild(newElement, oldElement);
        },
        
        /**
         * Clear element's children
         * @param {HTMLElement} element - Element to clear
         */
        clearChildren(element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        },
        
        // ==================== Attributes & Properties ====================
        
        /**
         * Set attribute
         * @param {HTMLElement} element - Target element
         * @param {string} name - Attribute name
         * @param {string} value - Attribute value
         */
        setAttribute(element, name, value) {
            element.setAttribute(name, value);
        },
        
        /**
         * Get attribute
         * @param {HTMLElement} element - Target element
         * @param {string} name - Attribute name
         * @returns {string|null} Attribute value or null
         */
        getAttribute(element, name) {
            return element.getAttribute(name);
        },
        
        /**
         * Remove attribute
         * @param {HTMLElement} element - Target element
         * @param {string} name - Attribute name
         */
        removeAttribute(element, name) {
            element.removeAttribute(name);
        },
        
        /**
         * Set element property
         * @param {HTMLElement} element - Target element
         * @param {string} name - Property name
         * @param {*} value - Property value
         */
        setProperty(element, name, value) {
            element[name] = value;
        },
        
        /**
         * Get element property
         * @param {HTMLElement} element - Target element
         * @param {string} name - Property name
         * @returns {*} Property value
         */
        getProperty(element, name) {
            return element[name];
        },
        
        // ==================== Event Handling ====================
        
        /**
         * Add event listener
         * @param {HTMLElement} element - Target element
         * @param {string} eventType - Event type (e.g., 'click')
         * @param {Function} handler - Event handler function
         * @param {Object|boolean} options - Event listener options
         */
        addEventListener(element, eventType, handler, options) {
            element.addEventListener(eventType, handler, options);
        },
        
        /**
         * Remove event listener
         * @param {HTMLElement} element - Target element
         * @param {string} eventType - Event type
         * @param {Function} handler - Event handler function
         * @param {Object|boolean} options - Event listener options
         */
        removeEventListener(element, eventType, handler, options) {
            element.removeEventListener(eventType, handler, options);
        },
        
        /**
         * Dispatch custom event
         * @param {HTMLElement} element - Target element
         * @param {string} eventType - Event type
         * @param {Object} detail - Event detail data
         */
        dispatchEvent(element, eventType, detail = {}) {
            const event = new CustomEvent(eventType, { detail });
            element.dispatchEvent(event);
        },
        
        // ==================== Classes ====================
        
        /**
         * Add class to element
         * @param {HTMLElement} element - Target element
         * @param {string} className - Class name to add
         */
        addClass(element, className) {
            element.classList.add(className);
        },
        
        /**
         * Remove class from element
         * @param {HTMLElement} element - Target element
         * @param {string} className - Class name to remove
         */
        removeClass(element, className) {
            element.classList.remove(className);
        },
        
        /**
         * Toggle class on element
         * @param {HTMLElement} element - Target element
         * @param {string} className - Class name to toggle
         * @returns {boolean} True if class is now present
         */
        toggleClass(element, className) {
            return element.classList.toggle(className);
        },
        
        /**
         * Check if element has class
         * @param {HTMLElement} element - Target element
         * @param {string} className - Class name to check
         * @returns {boolean} True if class is present
         */
        hasClass(element, className) {
            return element.classList.contains(className);
        },
        
        // ==================== Styles ====================
        
        /**
         * Set inline style
         * @param {HTMLElement} element - Target element
         * @param {string} property - CSS property name
         * @param {string} value - CSS property value
         */
        setStyle(element, property, value) {
            element.style[property] = value;
        },
        
        /**
         * Set multiple styles
         * @param {HTMLElement} element - Target element
         * @param {Object} styles - Object with style properties
         */
        setStyles(element, styles) {
            Object.assign(element.style, styles);
        },
        
        /**
         * Get computed style
         * @param {HTMLElement} element - Target element
         * @param {string} property - CSS property name
         * @returns {string} Computed style value
         */
        getComputedStyle(element, property) {
            if (!win) return '';
            const computed = win.getComputedStyle(element);
            return computed[property];
        },
        
        // ==================== Window/Document Operations ====================
        
        /**
         * Scroll to position
         * @param {number} x - Horizontal position
         * @param {number} y - Vertical position
         */
        scrollTo(x, y) {
            if (win) {
                win.scrollTo(x, y);
            }
        },
        
        /**
         * Get scroll position
         * @returns {Object} Object with x and y scroll positions
         */
        getScrollPosition() {
            if (!win) return { x: 0, y: 0 };
            return {
                x: win.scrollX || win.pageXOffset,
                y: win.scrollY || win.pageYOffset
            };
        },
        
        /**
         * Focus element
         * @param {HTMLElement} element - Element to focus
         */
        focus(element) {
            element.focus();
        },
        
        /**
         * Blur element
         * @param {HTMLElement} element - Element to blur
         */
        blur(element) {
            element.blur();
        },
        
        // ==================== Form Operations ====================
        
        /**
         * Get form value
         * @param {HTMLInputElement} element - Input element
         * @returns {string|boolean|number} Input value
         */
        getValue(element) {
            if (element.type === 'checkbox') {
                return element.checked;
            }
            if (element.type === 'number') {
                return parseFloat(element.value) || 0;
            }
            return element.value;
        },
        
        /**
         * Set form value
         * @param {HTMLInputElement} element - Input element
         * @param {*} value - Value to set
         */
        setValue(element, value) {
            if (element.type === 'checkbox') {
                element.checked = !!value;
            } else {
                element.value = value;
            }
        }
    };
}

/**
 * Create mock DOM helpers for testing
 * @returns {Object} Mock DOM helpers
 */
export function createMockDOMHelpers() {
    return {
        getElementById: jest.fn(() => null),
        querySelector: jest.fn(() => null),
        querySelectorAll: jest.fn(() => []),
        createElement: jest.fn((tag) => ({
            tagName: tag.toUpperCase(),
            className: '',
            style: {},
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                toggle: jest.fn(),
                contains: jest.fn()
            },
            setAttribute: jest.fn(),
            getAttribute: jest.fn(),
            removeAttribute: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            appendChild: jest.fn(),
            removeChild: jest.fn(),
            remove: jest.fn()
        })),
        createTextNode: jest.fn((text) => ({ nodeValue: text })),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        remove: jest.fn(),
        insertBefore: jest.fn(),
        replaceElement: jest.fn(),
        clearChildren: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        removeAttribute: jest.fn(),
        setProperty: jest.fn(),
        getProperty: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
        toggleClass: jest.fn(),
        hasClass: jest.fn(),
        setStyle: jest.fn(),
        setStyles: jest.fn(),
        getComputedStyle: jest.fn(() => ''),
        scrollTo: jest.fn(),
        getScrollPosition: jest.fn(() => ({ x: 0, y: 0 })),
        focus: jest.fn(),
        blur: jest.fn(),
        getValue: jest.fn(),
        setValue: jest.fn()
    };
}

/**
 * Global DOM helpers instance
 */
export const dom = typeof document !== 'undefined' && typeof window !== 'undefined'
    ? createDOMHelpers({ document, window })
    : null;
