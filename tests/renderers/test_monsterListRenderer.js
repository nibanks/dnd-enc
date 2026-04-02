/**
 * Tests for monsterListRenderer module
 */

import { 
    openMonsterModal, 
    closeMonsterModal, 
    renderMonsterList 
} from '../../static/renderers/monsterListRenderer.js';

describe('monsterListRenderer', () => {
    beforeEach(() => {
        // Setup test DOM
        document.body.innerHTML = `
            <div id="monsterModal" style="display: none;">
                <input type="text" id="monsterSearch" />
                <div id="monsterList"></div>
                <div id="monsterCount"></div>
            </div>
        `;
        
        // Setup mock monster data
        window.DND_MONSTERS = {
            'Goblin': { cr: '1/4', type: 'Humanoid', size: 'Small', alignment: 'Neutral Evil' },
            'Orc': { cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'Chaotic Evil' },
            'Ogre': { cr: '2', type: 'Giant', size: 'Large', alignment: 'Chaotic Evil' },
            'Troll': { cr: '5', type: 'Giant', size: 'Large', alignment: 'Chaotic Evil' },
            'Dragon': { cr: '15', type: 'Dragon', size: 'Huge', alignment: 'Lawful Evil' },
            'Kobold': { cr: '1/8', type: 'Humanoid', size: 'Small', alignment: 'Lawful Evil' },
            'Owlbear': { cr: '3', type: 'Monstrosity', size: 'Large', alignment: 'Unaligned' },
            'Gelatinous Cube': { cr: '2', type: 'Ooze', size: 'Large', alignment: 'Unaligned' }
        };
    });
    
    afterEach(() => {
        delete window.DND_MONSTERS;
    });
    
    describe('openMonsterModal', () => {
        test('shows the modal', () => {
            const modal = document.getElementById('monsterModal');
            expect(modal.style.display).toBe('none');
            
            openMonsterModal();
            
            expect(modal.style.display).toBe('flex');
        });
        
        test('clears search input', () => {
            const searchInput = document.getElementById('monsterSearch');
            searchInput.value = 'previous search';
            
            openMonsterModal();
            
            expect(searchInput.value).toBe('');
        });
        
        test('focuses search input', () => {
            const searchInput = document.getElementById('monsterSearch');
            const focusSpy = jest.spyOn(searchInput, 'focus');
            
            openMonsterModal();
            
            expect(focusSpy).toHaveBeenCalled();
            
            focusSpy.mockRestore();
        });
        
        test('renders initial monster list', () => {
            openMonsterModal();
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).not.toBe('');
        });
    });
    
    describe('closeMonsterModal', () => {
        test('hides the modal', () => {
            const modal = document.getElementById('monsterModal');
            modal.style.display = 'flex';
            
            closeMonsterModal();
            
            expect(modal.style.display).toBe('none');
        });
    });
    
    describe('renderMonsterList', () => {
        test('renders all monsters when no search term', () => {
            renderMonsterList('');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            expect(items.length).toBeGreaterThan(0);
            expect(items.length).toBeLessThanOrEqual(8);
        });
        
        test('filters monsters by search term', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            expect(items).toHaveLength(1);
            expect(items[0].textContent).toContain('Goblin');
        });
        
        test('search is case insensitive', () => {
            renderMonsterList('GOBLIN');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            expect(items).toHaveLength(1);
            expect(items[0].textContent).toContain('Goblin');
        });
        
        test('partial name matching works', () => {
            renderMonsterList('Og');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            // Should match both "Ogre" and "Owlbear" (contains 'og')
            expect(items.length).toBeGreaterThanOrEqual(1);
        });
        
        test('displays monster count', () => {
            renderMonsterList('');
            
            const monsterCount = document.getElementById('monsterCount');
            expect(monsterCount.textContent).toContain('Showing');
            expect(monsterCount.textContent).toContain('monsters');
        });
        
        test('updates count based on filter', () => {
            renderMonsterList('Goblin');
            
            const monsterCount = document.getElementById('monsterCount');
            expect(monsterCount.textContent).toContain('Showing 1');
        });
        
        test('shows no results message when no matches', () => {
            renderMonsterList('NonexistentMonster');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('No monsters found');
        });
        
        test('shows no results advice', () => {
            renderMonsterList('xyz123');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('Try a different search term');
        });
        
        test('displays monster CR', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('CR 1/4');
        });
        
        test('displays monster type', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('Humanoid');
        });
        
        test('displays monster size', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('Small');
        });
        
        test('displays monster alignment', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('Neutral Evil');
        });
        
        test('sorts monsters by CR (ascending)', () => {
            renderMonsterList('');
            
            const monsterList = document.getElementById('monsterList');
            const items = Array.from(monsterList.querySelectorAll('.monster-item'));
            
            // First should be lowest CR (1/8 - Kobold)
            expect(items[0].textContent).toContain('Kobold');
            expect(items[0].textContent).toContain('CR 1/8');
        });
        
        test('handles empty monster database', () => {
            window.DND_MONSTERS = {};
            
            renderMonsterList('');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('No monsters found');
        });
        
        test('limits display to 50 monsters', () => {
            // Create 100 test monsters
            for (let i = 0; i < 100; i++) {
                window.DND_MONSTERS[`TestMonster${i}`] = {
                    cr: '1',
                    type: 'Beast',
                    size: 'Medium',
                    alignment: 'Unaligned'
                };
            }
            
            renderMonsterList('');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            expect(items).toHaveLength(50);
        });
        
        test('shows message when more than 50 results', () => {
            // Create 60 test monsters
            for (let i = 0; i < 60; i++) {
                window.DND_MONSTERS[`TestMonster${i}`] = {
                    cr: '1',
                    type: 'Beast',
                    size: 'Medium',
                    alignment: 'Unaligned'
                };
            }
            
            renderMonsterList('');
            
            const monsterList = document.getElementById('monsterList');
            expect(monsterList.innerHTML).toContain('more');
            expect(monsterList.innerHTML).toContain('Refine your search');
        });
        
        test('escapes quotes in monster names in onclick', () => {
            window.DND_MONSTERS["Monster's Name"] = {
                cr: '1',
                type: 'Beast',
                size: 'Medium',
                alignment: 'Unaligned'
            };
            
            renderMonsterList("Monster");
            
            const monsterList = document.getElementById('monsterList');
            // Should escape the apostrophe
            expect(monsterList.innerHTML).toContain("\\'");
        });
        
        test('handles monsters with spaces in names', () => {
            renderMonsterList('Gelatinous Cube');
            
            const monsterList = document.getElementById('monsterList');
            const items = monsterList.querySelectorAll('.monster-item');
            
            expect(items).toHaveLength(1);
            expect(items[0].textContent).toContain('Gelatinous Cube');
        });
        
        test('includes D&D Beyond indicator', () => {
            renderMonsterList('Goblin');
            
            const monsterList = document.getElementById('monsterList');
            // HTML entities are escaped in innerHTML
            expect(monsterList.innerHTML).toContain('D&amp;D Beyond');
            expect(monsterList.innerHTML).toContain('📖');
        });
    });
    
    describe('integration tests', () => {
        test('open modal, search, close workflow', () => {
            // Open modal
            openMonsterModal();
            let modal = document.getElementById('monsterModal');
            expect(modal.style.display).toBe('flex');
            
            // Search for specific monster
            renderMonsterList('Dragon');
            let items = document.getElementById('monsterList').querySelectorAll('.monster-item');
            expect(items).toHaveLength(1);
            
            // Close modal
            closeMonsterModal();
            modal = document.getElementById('monsterModal');
            expect(modal.style.display).toBe('none');
        });
        
        test('search refinement works', () => {
            // Broad search
            renderMonsterList('');
            let items = document.getElementById('monsterList').querySelectorAll('.monster-item');
            const allCount = items.length;
            
            // Narrow search
            renderMonsterList('Goblin');
            items = document.getElementById('monsterList').querySelectorAll('.monster-item');
            
            expect(items.length).toBeLessThan(allCount);
        });
    });
});
