/**
 * Tests for playerRenderer module
 */

import { renderPlayers } from '../../static/renderers/playerRenderer.js';

describe('playerRenderer', () => {
    let container;
    
    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = `
            <table>
                <tbody id="playersBody"></tbody>
            </table>
        `;
        container = document.getElementById('playersBody');
        
        // Mock constants
        window.DND_CLASSES = ['Fighter', 'Wizard', 'Rogue'];
        window.DND_RACES = ['Human', 'Elf', 'Dwarf'];
    });
    
    afterEach(() => {
        delete window.DND_CLASSES;
        delete window.DND_RACES;
    });
    
    describe('renderPlayers', () => {
        test('handles null adventure gracefully', () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderPlayers(null);
            
            expect(consoleWarn).toHaveBeenCalledWith('renderPlayers called but adventure is null');
            expect(container.innerHTML).toBe('');
            
            consoleWarn.mockRestore();
        });
        
        test('handles missing playersBody element', () => {
            document.body.innerHTML = '';
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            renderPlayers({ players: [] });
            
            expect(consoleWarn).toHaveBeenCalledWith('playersBody element not found');
            
            consoleWarn.mockRestore();
        });
        
        test('renders empty players list', () => {
            const adventure = { players: [] };
            
            renderPlayers(adventure);
            
            expect(container.querySelectorAll('tr').length).toBe(0);
        });
        
        test('initializes players array if missing', () => {
            const adventure = {};
            
            renderPlayers(adventure);
            
            expect(adventure.players).toEqual([]);
        });
        
        test('renders single player with default values', () => {
            const adventure = {
                players: [{
                    name: 'Aragorn',
                    playerName: 'John',
                    level: 5,
                    class: 'Fighter',
                    race: 'Human',
                    maxHp: 45,
                    ac: 18,
                    speed: 30,
                    initiativeBonus: 2
                }]
            };
            
            renderPlayers(adventure);
            
            // Should create 2 rows: main row + detail row
            const rows = container.querySelectorAll('tr');
            expect(rows.length).toBe(2);
            
            // Check main row content
            const mainRow = rows[0];
            expect(mainRow.textContent).toContain('Aragorn');
            expect(mainRow.textContent).toContain('John');
            expect(mainRow.textContent).toContain('Fighter');
            expect(mainRow.textContent).toContain('Human');
        });
        
        test('renders player in edit mode', () => {
            const adventure = {
                players: [{
                    name: 'Gandalf',
                    playerName: 'Jane',
                    level: 10,
                    class: 'Wizard'
                }]
            };
            
            renderPlayers(adventure, true);
            
            // Should have input fields
            const inputs = container.querySelectorAll('input');
            expect(inputs.length).toBeGreaterThan(0);
            
            // Check for player name input
            const nameInput = container.querySelector('input[data-field="name"]');
            expect(nameInput).toBeTruthy();
            expect(nameInput.value).toBe('Gandalf');
        });
        
        test('renders multiple players', () => {
            const adventure = {
                players: [
                    { name: 'Player1', level: 1 },
                    { name: 'Player2', level: 2 },
                    { name: 'Player3', level: 3 }
                ]
            };
            
            renderPlayers(adventure);
            
            // 3 players × 2 rows each = 6 rows
            const rows = container.querySelectorAll('tr');
            expect(rows.length).toBe(6);
        });
        
        test('initializes ability scores if missing', () => {
            const adventure = {
                players: [{ name: 'Test' }]
            };
            
            renderPlayers(adventure);
            
            const player = adventure.players[0];
            expect(player.abilityScores).toBeDefined();
            expect(player.abilityScores.str).toBe(10);
            expect(player.abilityScores.dex).toBe(10);
            expect(player.abilityScores.wis).toBe(10);
        });
        
        test('initializes skill proficiencies if missing', () => {
            const adventure = {
                players: [{ name: 'Test' }]
            };
            
            renderPlayers(adventure);
            
            const player = adventure.players[0];
            expect(player.skillProficiencies).toBeDefined();
            expect(player.skillProficiencies.perception).toBe(false);
            expect(player.skillProficiencies.insight).toBe(false);
            expect(player.skillProficiencies.investigation).toBe(false);
        });
        
        test('calculates passive perception correctly', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    level: 5,
                    abilityScores: { wis: 16 }, // +3 modifier
                    skillProficiencies: { perception: true } // +3 proficiency at level 5
                }]
            };
            
            renderPlayers(adventure);
            
            // Passive Perception = 10 + WIS mod (3) + Prof (3) = 16
            expect(container.textContent).toContain('16');
        });
        
        test('calculates passive investigation correctly', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    level: 1,
                    abilityScores: { int: 14 }, // +2 modifier
                    skillProficiencies: { investigation: false }
                }]
            };
            
            renderPlayers(adventure);
            
            // Passive Investigation = 10 + INT mod (2) + Prof (0) = 12
            expect(container.textContent).toContain('12');
        });
        
        test('renders detail row hidden by default', () => {
            const adventure = {
                players: [{ name: 'Test' }]
            };
            
            renderPlayers(adventure);
            
            const detailRow = container.querySelector('[id^="player-detail-"]');
            expect(detailRow.style.display).toBe('none');
        });
        
        test('renders detail row visible when expanded', () => {
            const adventure = {
                players: [{ name: 'Test', expanded: true }]
            };
            
            renderPlayers(adventure);
            
            const detailRow = container.querySelector('[id^="player-detail-"]');
            expect(detailRow.style.display).toBe('table-row');
        });
        
        test('renders D&D Beyond link when URL present', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    dndBeyondUrl: 'https://www.dndbeyond.com/characters/12345'
                }]
            };
            
            renderPlayers(adventure);
            
            const link = container.querySelector('a[href*="dndbeyond.com"]');
            expect(link).toBeTruthy();
            expect(link.href).toContain('12345');
        });
        
        test('renders placeholder when no D&D Beyond URL', () => {
            const adventure = {
                players: [{ name: 'Test', dndBeyondUrl: '' }]
            };
            
            renderPlayers(adventure);
            
            const link = container.querySelector('a[href*="dndbeyond.com"]');
            expect(link).toBeFalsy();
        });
        
        test('handles missing constants gracefully', () => {
            delete window.DND_CLASSES;
            delete window.DND_RACES;
            
            const adventure = {
                players: [{ name: 'Test' }]
            };
            
            // Should not throw
            expect(() => renderPlayers(adventure, true)).not.toThrow();
        });
        
        test('displays ability score modifiers in detail row', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    abilityScores: {
                        str: 18, // +4
                        dex: 14, // +2
                        con: 12, // +1
                        int: 10, // +0
                        wis: 8,  // -1
                        cha: 6   // -2
                    },
                    expanded: true
                }]
            };
            
            renderPlayers(adventure);
            
            const detailRow = container.querySelector('[id^="player-detail-"]');
            expect(detailRow.textContent).toContain('+4');
            expect(detailRow.textContent).toContain('+2');
            expect(detailRow.textContent).toContain('+1');
            expect(detailRow.textContent).toContain('+0');
            expect(detailRow.textContent).toContain('-1');
            expect(detailRow.textContent).toContain('-2');
        });
        
        test('displays proficiency bonus in detail row', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    level: 9, // +4 proficiency
                    expanded: true
                }]
            };
            
            renderPlayers(adventure);
            
            const detailRow = container.querySelector('[id^="player-detail-"]');
            expect(detailRow.textContent).toContain('Proficiency Bonus: +4');
        });
        
        test('renders skill proficiency checkboxes in edit mode', () => {
            const adventure = {
                players: [{
                    name: 'Test',
                    skillProficiencies: {
                        perception: true,
                        investigation: false,
                        insight: true
                    },
                    expanded: true
                }]
            };
            
            renderPlayers(adventure, true);
            
            const checkboxes = container.querySelectorAll('.player-skill');
            expect(checkboxes.length).toBe(3);
            
            // Check perception is checked
            const perceptionCheckbox = container.querySelector('.player-skill[data-skill="perception"]');
            expect(perceptionCheckbox.checked).toBe(true);
            
            // Check investigation is not checked
            const investigationCheckbox = container.querySelector('.player-skill[data-skill="investigation"]');
            expect(investigationCheckbox.checked).toBe(false);
        });
    });
});
