/**
 * Adventure Renderer - Handles rendering of adventure header and chapter UI
 */

/**
 * Create adventure renderer with dependencies
 * @param {Object} deps - Dependencies
 * @param {Function} deps.getElementById - DOM element getter
 * @param {Function} deps.getAdventure - Get current adventure from state
 * @param {Function} deps.getChapter - Get current chapter from state
 * @param {Object} deps.otherRenderers - Other renderer functions to call
 * @returns {Object} Renderer functions
 */
export function createAdventureRenderer(deps = {}) {
    const { getElementById, getAdventure, getChapter, otherRenderers = {} } = deps;

    /**
     * Render the entire adventure UI (orchestrator)
     */
    function renderAdventure() {
        const adventure = getAdventure();
        if (!adventure) {
            console.warn('renderAdventure called but currentAdventure is null');
            return;
        }
        
        renderChapterSelector();
        updateChapterNotesDisplay();
        
        // Call other renderers
        if (otherRenderers.renderPlayers) {
            otherRenderers.renderPlayers();
        }
        if (otherRenderers.renderEncounters) {
            otherRenderers.renderEncounters();
        }
    }

    /**
     * Render chapter dropdown selector
     */
    function renderChapterSelector() {
        const adventure = getAdventure();
        const currentChapter = getChapter();
        
        if (!adventure || !adventure.chapters) {
            console.warn('renderChapterSelector called but currentAdventure or chapters is null');
            return;
        }
        
        const selector = getElementById('chapterSelect');
        if (!selector) {
            console.warn('chapterSelect element not found');
            return;
        }
        
        selector.innerHTML = adventure.chapters.map(chapter => 
            `<option value="${chapter}" ${chapter === currentChapter ? 'selected' : ''}>${chapter}</option>`
        ).join('');
    }

    /**
     * Update chapter notes textarea to show current chapter's notes
     */
    function updateChapterNotesDisplay() {
        const adventure = getAdventure();
        const currentChapter = getChapter();
        const notesTextarea = getElementById('chapterNotes');
        
        if (!notesTextarea) {
            return;
        }
        
        if (!adventure) {
            notesTextarea.value = '';
            return;
        }
        
        notesTextarea.value = (adventure.chapterNotes && adventure.chapterNotes[currentChapter]) || '';
    }

    return {
        renderAdventure,
        renderChapterSelector,
        updateChapterNotesDisplay
    };
}
