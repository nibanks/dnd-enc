/**
 * Tests for DOM abstraction layer
 */

import { createDOMHelpers, createMockDOMHelpers } from '../../static/services/dom.js';

describe('DOM Helpers', () => {
    let mockDocument;
    let mockWindow;
    let dom;
    
    beforeEach(() => {
        // Create mock document and window
        mockDocument = {
            getElementById: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(),
            createElement: jest.fn((tag) => ({
                tagName: tag.toUpperCase(),
                className: '',
                id: '',
                textContent: '',
                innerHTML: '',
                style: {},
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    toggle: jest.fn(() => true),
                    contains: jest.fn(() => false)
                },
                setAttribute: jest.fn(),
                getAttribute: jest.fn(),
                removeAttribute: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                appendChild: jest.fn(),
                removeChild: jest.fn(),
                remove: jest.fn(),
                parentNode: null,
                firstChild: null
            })),
            createTextNode: jest.fn((text) => ({ nodeValue: text }))
        };
        
        mockWindow = {
            scrollTo: jest.fn(),
            scrollX: 0,
            scrollY: 0,
            pageXOffset: 0,
            pageYOffset: 0,
            getComputedStyle: jest.fn(() => ({}))
        };
        
        dom = createDOMHelpers({ document: mockDocument, window: mockWindow });
    });
    
    describe('createDOMHelpers', () => {
        test('requires document object', () => {
            expect(() => createDOMHelpers({ document: null })).toThrow('Document object is required');
        });
    });
    
    describe('Element Selection', () => {
        test('getElementById calls document.getElementById', () => {
            const mockElement = { id: 'test' };
            mockDocument.getElementById.mockReturnValue(mockElement);
            
            const result = dom.getElementById('test');
            
            expect(mockDocument.getElementById).toHaveBeenCalledWith('test');
            expect(result).toBe(mockElement);
        });
        
        test('querySelector calls document.querySelector', () => {
            const mockElement = { id: 'test' };
            mockDocument.querySelector.mockReturnValue(mockElement);
            
            const result = dom.querySelector('.test-class');
            
            expect(mockDocument.querySelector).toHaveBeenCalledWith('.test-class');
            expect(result).toBe(mockElement);
        });
        
        test('querySelectorAll calls document.querySelectorAll', () => {
            const mockElements = [{ id: '1' }, { id: '2' }];
            mockDocument.querySelectorAll.mockReturnValue(mockElements);
            
            const result = dom.querySelectorAll('.items');
            
            expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('.items');
            expect(result).toBe(mockElements);
        });
    });
    
    describe('Element Creation', () => {
        test('createElement creates element', () => {
            const element = dom.createElement('div');
            
            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
            expect(element.tagName).toBe('DIV');
        });
        
        test('createElement sets className', () => {
            const element = dom.createElement('div', { className: 'test-class' });
            
            expect(element.className).toBe('test-class');
        });
        
        test('createElement sets id', () => {
            const element = dom.createElement('div', { id: 'test-id' });
            
            expect(element.id).toBe('test-id');
        });
        
        test('createElement sets textContent', () => {
            const element = dom.createElement('span', { textContent: 'Hello' });
            
            expect(element.textContent).toBe('Hello');
        });
        
        test('createElement sets innerHTML', () => {
            const element = dom.createElement('div', { innerHTML: '<span>Test</span>' });
            
            expect(element.innerHTML).toBe('<span>Test</span>');
        });
        
        test('createElement sets styles', () => {
            const element = dom.createElement('div', {
                style: { color: 'red', fontSize: '14px' }
            });
            
            expect(element.style.color).toBe('red');
            expect(element.style.fontSize).toBe('14px');
        });
        
        test('createElement sets attributes', () => {
            const element = dom.createElement('input', {
                attributes: { type: 'text', placeholder: 'Enter name' }
            });
            
            expect(element.setAttribute).toHaveBeenCalledWith('type', 'text');
            expect(element.setAttribute).toHaveBeenCalledWith('placeholder', 'Enter name');
        });
        
        test('createTextNode creates text node', () => {
            const textNode = dom.createTextNode('Hello');
            
            expect(mockDocument.createTextNode).toHaveBeenCalledWith('Hello');
            expect(textNode.nodeValue).toBe('Hello');
        });
    });
    
    describe('Element Manipulation', () => {
        test('appendChild calls element.appendChild', () => {
            const parent = mockDocument.createElement('div');
            const child = mockDocument.createElement('span');
            
            dom.appendChild(parent, child);
            
            expect(parent.appendChild).toHaveBeenCalledWith(child);
        });
        
        test('removeChild calls element.removeChild', () => {
            const parent = mockDocument.createElement('div');
            const child = mockDocument.createElement('span');
            
            dom.removeChild(parent, child);
            
            expect(parent.removeChild).toHaveBeenCalledWith(child);
        });
        
        test('remove calls element.remove', () => {
            const element = mockDocument.createElement('div');
            
            dom.remove(element);
            
            expect(element.remove).toHaveBeenCalled();
        });
        
        test('clearChildren removes all children', () => {
            const parent = mockDocument.createElement('div');
            const child1 = mockDocument.createElement('span');
            const child2 = mockDocument.createElement('span');
            
            parent.firstChild = child1;
            child1.nextSibling = child2;
            
            let callCount = 0;
            parent.removeChild = jest.fn(() => {
                callCount++;
                if (callCount === 1) {
                    parent.firstChild = child2;
                } else {
                    parent.firstChild = null;
                }
            });
            
            dom.clearChildren(parent);
            
            expect(parent.removeChild).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Attributes & Properties', () => {
        test('setAttribute calls element.setAttribute', () => {
            const element = mockDocument.createElement('div');
            
            dom.setAttribute(element, 'data-id', '123');
            
            expect(element.setAttribute).toHaveBeenCalledWith('data-id', '123');
        });
        
        test('getAttribute calls element.getAttribute', () => {
            const element = mockDocument.createElement('div');
            element.getAttribute.mockReturnValue('123');
            
            const result = dom.getAttribute(element, 'data-id');
            
            expect(element.getAttribute).toHaveBeenCalledWith('data-id');
            expect(result).toBe('123');
        });
        
        test('setProperty sets element property', () => {
            const element = mockDocument.createElement('input');
            
            dom.setProperty(element, 'value', 'test');
            
            expect(element.value).toBe('test');
        });
        
        test('getProperty gets element property', () => {
            const element = mockDocument.createElement('input');
            element.value = 'test';
            
            const result = dom.getProperty(element, 'value');
            
            expect(result).toBe('test');
        });
    });
    
    describe('Event Handling', () => {
        test('addEventListener calls element.addEventListener', () => {
            const element = mockDocument.createElement('button');
            const handler = jest.fn();
            
            dom.addEventListener(element, 'click', handler);
            
            expect(element.addEventListener).toHaveBeenCalledWith('click', handler, undefined);
        });
        
        test('removeEventListener calls element.removeEventListener', () => {
            const element = mockDocument.createElement('button');
            const handler = jest.fn();
            
            dom.removeEventListener(element, 'click', handler);
            
            expect(element.removeEventListener).toHaveBeenCalledWith('click', handler, undefined);
        });
    });
    
    describe('Classes', () => {
        test('addClass calls classList.add', () => {
            const element = mockDocument.createElement('div');
            
            dom.addClass(element, 'active');
            
            expect(element.classList.add).toHaveBeenCalledWith('active');
        });
        
        test('removeClass calls classList.remove', () => {
            const element = mockDocument.createElement('div');
            
            dom.removeClass(element, 'active');
            
            expect(element.classList.remove).toHaveBeenCalledWith('active');
        });
        
        test('toggleClass calls classList.toggle', () => {
            const element = mockDocument.createElement('div');
            
            const result = dom.toggleClass(element, 'active');
            
            expect(element.classList.toggle).toHaveBeenCalledWith('active');
            expect(result).toBe(true);
        });
        
        test('hasClass calls classList.contains', () => {
            const element = mockDocument.createElement('div');
            element.classList.contains.mockReturnValue(true);
            
            const result = dom.hasClass(element, 'active');
            
            expect(element.classList.contains).toHaveBeenCalledWith('active');
            expect(result).toBe(true);
        });
    });
    
    describe('Styles', () => {
        test('setStyle sets style property', () => {
            const element = mockDocument.createElement('div');
            
            dom.setStyle(element, 'color', 'red');
            
            expect(element.style.color).toBe('red');
        });
        
        test('setStyles sets multiple styles', () => {
            const element = mockDocument.createElement('div');
            
            dom.setStyles(element, { color: 'red', fontSize: '14px' });
            
            expect(element.style.color).toBe('red');
            expect(element.style.fontSize).toBe('14px');
        });
        
        test('getComputedStyle calls window.getComputedStyle', () => {
            const element = mockDocument.createElement('div');
            mockWindow.getComputedStyle.mockReturnValue({ color: 'red' });
            
            const result = dom.getComputedStyle(element, 'color');
            
            expect(mockWindow.getComputedStyle).toHaveBeenCalledWith(element);
            expect(result).toBe('red');
        });
    });
    
    describe('Window/Document Operations', () => {
        test('scrollTo calls window.scrollTo', () => {
            dom.scrollTo(100, 200);
            
            expect(mockWindow.scrollTo).toHaveBeenCalledWith(100, 200);
        });
        
        test('getScrollPosition returns scroll values', () => {
            mockWindow.scrollX = 150;
            mockWindow.scrollY = 300;
            
            const result = dom.getScrollPosition();
            
            expect(result).toEqual({ x: 150, y: 300 });
        });
        
        test('focus calls element.focus', () => {
            const element = mockDocument.createElement('input');
            element.focus = jest.fn();
            
            dom.focus(element);
            
            expect(element.focus).toHaveBeenCalled();
        });
    });
    
    describe('Form Operations', () => {
        test('getValue returns text input value', () => {
            const element = mockDocument.createElement('input');
            element.type = 'text';
            element.value = 'test';
            
            const result = dom.getValue(element);
            
            expect(result).toBe('test');
        });
        
        test('getValue returns checkbox checked state', () => {
            const element = mockDocument.createElement('input');
            element.type = 'checkbox';
            element.checked = true;
            
            const result = dom.getValue(element);
            
            expect(result).toBe(true);
        });
        
        test('getValue returns number for number input', () => {
            const element = mockDocument.createElement('input');
            element.type = 'number';
            element.value = '42';
            
            const result = dom.getValue(element);
            
            expect(result).toBe(42);
        });
        
        test('setValue sets text input value', () => {
            const element = mockDocument.createElement('input');
            element.type = 'text';
            
            dom.setValue(element, 'new value');
            
            expect(element.value).toBe('new value');
        });
        
        test('setValue sets checkbox checked state', () => {
            const element = mockDocument.createElement('input');
            element.type = 'checkbox';
            
            dom.setValue(element, true);
            
            expect(element.checked).toBe(true);
        });
    });
    
    describe('createMockDOMHelpers', () => {
        test('creates mock with all methods', () => {
            const mock = createMockDOMHelpers();
            
            expect(mock.getElementById).toBeDefined();
            expect(mock.createElement).toBeDefined();
            expect(mock.addEventListener).toBeDefined();
            expect(typeof mock.getElementById).toBe('function');
        });
        
        test('mock methods return appropriate values', () => {
            const mock = createMockDOMHelpers();
            
            expect(mock.getElementById()).toBeNull();
            expect(mock.querySelectorAll()).toEqual([]);
            expect(mock.getScrollPosition()).toEqual({ x: 0, y: 0 });
        });
    });
});
