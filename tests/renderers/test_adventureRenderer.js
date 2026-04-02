/**
 * Tests for adventureRenderer module
 */

import { createAdventureRenderer } from '../../static/renderers/adventureRenderer.js';

describe('adventureRenderer', () => {
    let renderer;
    let mockDeps;
    let mockAdventure;
    
    beforeEach(() => {
        // Setup test DOM
        document.body.innerHTML = `
            <select id="chapterSelect"></select>
            <textarea id="chapterNotes"></textarea>
        `;
        
        mockAdventure = {
            name: 'Test Adventure',
            chapters: ['Chapter 1', 'Chapter 2', 'Chapter 3'],
            chapterNotes: {
                'Chapter 1': 'Notes for chapter 1',
                'Chapter 2': 'Notes for chapter 2'
            },
            encounters: [],
            players: []
        };
        
        mockDeps = {
            getElementById: (id) => document.getElementById(id),
            getAdventure: jest.fn(() => mockAdventure),
            getChapter: jest.fn(() => 'Chapter 1'),
            otherRenderers: {
                renderPlayers: jest.fn(),
                renderEncounters: jest.fn()
            }
        };
        
        renderer = createAdventureRenderer(mockDeps);
    });
    
    describe('createAdventureRenderer', () => {
        test('creates renderer with required methods', () => {
            expect(renderer).toHaveProperty('renderAdventure');
            expect(renderer).toHaveProperty('renderChapterSelector');
            expect(renderer).toHaveProperty('updateChapterNotesDisplay');
        });
        
        test('handles missing dependencies gracefully', () => {
            const minimalRenderer = createAdventureRenderer({});
            expect(minimalRenderer).toBeDefined();
        });
    });
    
    describe('renderAdventure', () => {
        test('calls all sub-renderers when adventure exists', () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderer.renderAdventure();
            
            expect(mockDeps.otherRenderers.renderPlayers).toHaveBeenCalled();
            expect(mockDeps.otherRenderers.renderEncounters).toHaveBeenCalled();
            expect(consoleWarn).not.toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });
        
        test('warns when no adventure loaded', () => {
            mockDeps.getAdventure.mockReturnValue(null);
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderer.renderAdventure();
            
            expect(consoleWarn).toHaveBeenCalledWith('renderAdventure called but currentAdventure is null');
            expect(mockDeps.otherRenderers.renderPlayers).not.toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });
        
        test('handles missing other renderers gracefully', () => {
            const rendererNoOthers = createAdventureRenderer({
                getElementById: mockDeps.getElementById,
                getAdventure: mockDeps.getAdventure,
                getChapter: mockDeps.getChapter,
                otherRenderers: {}
            });
            
            expect(() => rendererNoOthers.renderAdventure()).not.toThrow();
        });
    });
    
    describe('renderChapterSelector', () => {
        test('renders all chapters as options', () => {
            renderer.renderChapterSelector();
            
            const select = document.getElementById('chapterSelect');
            const options = select.querySelectorAll('option');
            
            expect(options).toHaveLength(3);
            expect(options[0].textContent).toBe('Chapter 1');
            expect(options[1].textContent).toBe('Chapter 2');
            expect(options[2].textContent).toBe('Chapter 3');
        });
        
        test('marks current chapter as selected', () => {
            mockDeps.getChapter.mockReturnValue('Chapter 2');
            
            renderer.renderChapterSelector();
            
            const select = document.getElementById('chapterSelect');
            expect(select.value).toBe('Chapter 2');
            
            const selectedOption = select.querySelector('option[selected]');
            expect(selectedOption.value).toBe('Chapter 2');
        });
        
        test('handles adventure with no chapters array', () => {
            mockDeps.getAdventure.mockReturnValue({ name: 'Test' });
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderer.renderChapterSelector();
            
            expect(consoleWarn).toHaveBeenCalledWith(
                'renderChapterSelector called but currentAdventure or chapters is null'
            );
            
            consoleWarn.mockRestore();
        });
        
        test('handles null adventure', () => {
            mockDeps.getAdventure.mockReturnValue(null);
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderer.renderChapterSelector();
            
            expect(consoleWarn).toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });
        
        test('handles missing selector element', () => {
            document.getElementById('chapterSelect').remove();
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderer.renderChapterSelector();
            
            expect(consoleWarn).toHaveBeenCalledWith('chapterSelect element not found');
            
            consoleWarn.mockRestore();
        });
        
        test('handles empty chapters array', () => {
            mockDeps.getAdventure.mockReturnValue({
                name: 'Test',
                chapters: []
            });
            
            renderer.renderChapterSelector();
            
            const select = document.getElementById('chapterSelect');
            expect(select.querySelectorAll('option')).toHaveLength(0);
        });
        
        test('sets correct value attributes', () => {
            renderer.renderChapterSelector();
            
            const select = document.getElementById('chapterSelect');
            const options = Array.from(select.querySelectorAll('option'));
            
            expect(options[0].value).toBe('Chapter 1');
            expect(options[1].value).toBe('Chapter 2');
            expect(options[2].value).toBe('Chapter 3');
        });
    });
    
    describe('updateChapterNotesDisplay', () => {
        test('displays notes for current chapter', () => {
            mockDeps.getChapter.mockReturnValue('Chapter 1');
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('Notes for chapter 1');
        });
        
        test('displays notes for different chapter', () => {
            mockDeps.getChapter.mockReturnValue('Chapter 2');
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('Notes for chapter 2');
        });
        
        test('displays empty string when chapter has no notes', () => {
            mockDeps.getChapter.mockReturnValue('Chapter 3');
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('');
        });
        
        test('handles missing chapterNotes object', () => {
            mockDeps.getAdventure.mockReturnValue({
                name: 'Test',
                chapters: ['Chapter 1']
            });
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('');
        });
        
        test('handles null adventure', () => {
            mockDeps.getAdventure.mockReturnValue(null);
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('');
        });
        
        test('handles missing textarea element', () => {
            document.getElementById('chapterNotes').remove();
            
            expect(() => renderer.updateChapterNotesDisplay()).not.toThrow();
        });
        
        test('handles undefined chapter', () => {
            mockDeps.getChapter.mockReturnValue(undefined);
            
            renderer.updateChapterNotesDisplay();
            
            const textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('');
        });
    });
    
    describe('integration', () => {
        test('renderAdventure updates both selector and notes', () => {
            mockDeps.getChapter.mockReturnValue('Chapter 2');
            
            renderer.renderAdventure();
            
            const select = document.getElementById('chapterSelect');
            const textarea = document.getElementById('chapterNotes');
            
            expect(select.value).toBe('Chapter 2');
            expect(textarea.value).toBe('Notes for chapter 2');
        });
        
        test('switching chapters updates notes correctly', () => {
            // First render with Chapter 1
            mockDeps.getChapter.mockReturnValue('Chapter 1');
            renderer.updateChapterNotesDisplay();
            
            let textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('Notes for chapter 1');
            
            // Switch to Chapter 2
            mockDeps.getChapter.mockReturnValue('Chapter 2');
            renderer.updateChapterNotesDisplay();
            
            textarea = document.getElementById('chapterNotes');
            expect(textarea.value).toBe('Notes for chapter 2');
        });
    });
});
