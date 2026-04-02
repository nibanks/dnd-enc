/**
 * Tests for adventureService module
 */

import { createAdventureService } from '../../static/services/adventureService.js';

describe('adventureService', () => {
    let service;
    let mockDeps;
    let mockAPI;
    let mockDOM;
    
    beforeEach(() => {
        jest.useFakeTimers();
        
        // Mock API
        mockAPI = {
            getAdventures: jest.fn().mockResolvedValue(['Adventure 1', 'Adventure 2']),
            updateAdventure: jest.fn().mockResolvedValue({ success: true }),
            checkCookieStatus: jest.fn().mockResolvedValue(true)
        };
        
        // Mock DOM with real elements
        document.body.innerHTML = `
            <div id="adventureSelectionHeader"></div>
            <select id="adventureSelect"></select>
            <button id="newAdventureBtn"></button>
            <div id="cookieWarning"></div>
        `;
        
        mockDOM = {
            getElementById: (id) => document.getElementById(id)
        };
        
        mockDeps = {
            api: mockAPI,
            dom: mockDOM,
            getAdventure: jest.fn(() => ({
                name: 'Test Adventure',
                chapters: ['Chapter 1'],
                players: [],
                encounters: []
            })),
            getAdventureSelectValue: jest.fn(() => 'Test Adventure')
        };
        
        service = createAdventureService(mockDeps);
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });
    
    describe('createAdventureService', () => {
        test('creates service with all methods', () => {
            expect(service).toHaveProperty('loadAdventuresList');
            expect(service).toHaveProperty('autoSave');
            expect(service).toHaveProperty('checkCookieStatus');
        });
        
        test('handles missing dependencies', () => {
            const minimalService = createAdventureService({});
            expect(minimalService).toBeDefined();
        });
    });
    
    describe('loadAdventuresList', () => {
        test('fetches and populates adventure list', async () => {
            await service.loadAdventuresList();
            
            const select = document.getElementById('adventureSelect');
            const options = select.querySelectorAll('option');
            
            expect(mockAPI.getAdventures).toHaveBeenCalled();
            expect(options).toHaveLength(3); // 1 default + 2 adventures
            expect(options[0].value).toBe('');
            expect(options[0].textContent).toBe('-- Select Adventure --');
            expect(options[1].value).toBe('Adventure 1');
            expect(options[2].value).toBe('Adventure 2');
        });
        
        test('handles empty adventure list', async () => {
            mockAPI.getAdventures.mockResolvedValue([]);
            
            await service.loadAdventuresList();
            
            const select = document.getElementById('adventureSelect');
            const options = select.querySelectorAll('option');
            
            expect(options).toHaveLength(1); // Just the default option
        });
        
        test('handles API error gracefully', async () => {
            mockAPI.getAdventures.mockRejectedValue(new Error('Network error'));
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            
            await service.loadAdventuresList();
            
            expect(consoleError).toHaveBeenCalledWith(
                'Error loading adventures list:',
                expect.any(Error)
            );
            
            consoleError.mockRestore();
        });
        
        test('handles missing select element', async () => {
            document.getElementById('adventureSelect').remove();
            
            await expect(service.loadAdventuresList()).resolves.not.toThrow();
        });
    });
    
    describe('autoSave', () => {
        test('saves adventure after delay', async () => {
            service.autoSave();
            
            // Should not save immediately
            expect(mockAPI.updateAdventure).not.toHaveBeenCalled();
            
            // Fast-forward time
            jest.advanceTimersByTime(500);
            await Promise.resolve(); // Let promises resolve
            
            expect(mockAPI.updateAdventure).toHaveBeenCalledWith(
                'Test Adventure',
                expect.objectContaining({ name: 'Test Adventure' })
            );
        });
        
        test('debounces multiple save calls', async () => {
            service.autoSave();
            service.autoSave();
            service.autoSave();
            
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            
            // Should only save once
            expect(mockAPI.updateAdventure).toHaveBeenCalledTimes(1);
        });
        
        test('does not save when no adventure selected', async () => {
            mockDeps.getAdventureSelectValue.mockReturnValue('');
            
            service.autoSave();
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            
            expect(mockAPI.updateAdventure).not.toHaveBeenCalled();
        });
        
        test('does not save when adventure name mismatch', async () => {
            mockDeps.getAdventure.mockReturnValue({ name: 'Different Adventure' });
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            service.autoSave();
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            
            expect(consoleWarn).toHaveBeenCalledWith(
                'AutoSave blocked: currentAdventure does not match selected adventure'
            );
            expect(mockAPI.updateAdventure).not.toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });
        
        test('does not save when currentAdventure is null', async () => {
            mockDeps.getAdventure.mockReturnValue(null);
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            
            service.autoSave();
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            
            expect(consoleWarn).toHaveBeenCalled();
            expect(mockAPI.updateAdventure).not.toHaveBeenCalled();
            
            consoleWarn.mockRestore();
        });
        
        test('handles session expired error (403)', async () => {
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
            mockAPI.updateAdventure.mockRejectedValue({ status: 403 });
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            
            service.autoSave();
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve(); // Extra tick for error handling
            
            expect(alertSpy).toHaveBeenCalledWith(
                expect.stringContaining('session has expired')
            );
            
            alertSpy.mockRestore();
            consoleError.mockRestore();
        });
        
        test('handles other API errors', async () => {
            mockAPI.updateAdventure.mockRejectedValue(new Error('Network error'));
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            
            service.autoSave();
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
            
            expect(consoleError).toHaveBeenCalledWith(
                'Auto-save error:',
                expect.any(Error)
            );
            
            consoleError.mockRestore();
        });
    });
    
    describe('checkCookieStatus', () => {
        test('returns true when cookies present', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(true);
            
            const result = await service.checkCookieStatus();
            
            expect(result).toBe(true);
            expect(mockAPI.checkCookieStatus).toHaveBeenCalled();
        });
        
        test('returns false when no cookies', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(false);
            
            const result = await service.checkCookieStatus();
            
            expect(result).toBe(false);
        });
        
        test('updates window.hasCookies global', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(true);
            
            await service.checkCookieStatus();
            
            expect(window.hasCookies).toBe(true);
        });
        
        test('handles API error and defaults to false', async () => {
            mockAPI.checkCookieStatus.mockRejectedValue(new Error('API error'));
            const consoleError = jest.spyOn(console, 'error').mockImplementation();
            
            const result = await service.checkCookieStatus();
            
            expect(result).toBe(false);
            expect(window.hasCookies).toBe(false);
            expect(consoleError).toHaveBeenCalled();
            
            consoleError.mockRestore();
        });
        
        test('enables controls when cookies present', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(true);
            
            await service.checkCookieStatus();
            
            const select = document.getElementById('adventureSelect');
            const button = document.getElementById('newAdventureBtn');
            
            expect(select.disabled).toBeFalsy();
            expect(button.disabled).toBeFalsy();
        });
        
        test('disables controls when no cookies', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(false);
            
            await service.checkCookieStatus();
            
            const select = document.getElementById('adventureSelect');
            const button = document.getElementById('newAdventureBtn');
            
            expect(select.disabled).toBe(true);
            expect(button.disabled).toBe(true);
        });
        
        test('shows warning when no cookies', async () => {
            // Remove existing warning first
            const existingWarning = document.getElementById('cookieWarning');
            if (existingWarning) existingWarning.remove();
            
            mockAPI.checkCookieStatus.mockResolvedValue(false);
            
            await service.checkCookieStatus();
            
            const warning = document.getElementById('cookieWarning');
            expect(warning).toBeTruthy();
            expect(warning.textContent).toContain('Authentication Required');
        });
        
        test('does not duplicate warning', async () => {
            mockAPI.checkCookieStatus.mockResolvedValue(false);
            
            await service.checkCookieStatus();
            await service.checkCookieStatus();
            
            const warnings = document.querySelectorAll('#cookieWarning');
            expect(warnings).toHaveLength(1);
        });
        
        test('handles missing DOM elements gracefully', async () => {
            document.getElementById('adventureSelect').remove();
            document.getElementById('newAdventureBtn').remove();
            
            await expect(service.checkCookieStatus()).resolves.not.toThrow();
        });
    });
});
