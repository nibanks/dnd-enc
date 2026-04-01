/**
 * Tests for API service layer
 */

import { createAPIClient, APIError, createMockAPIClient } from '../../static/services/api.js';

describe('API Service', () => {
    let mockFetch;
    let api;
    
    beforeEach(() => {
        mockFetch = jest.fn();
        api = createAPIClient({ fetchImpl: mockFetch });
    });
    
    describe('createAPIClient', () => {
        test('requires fetch implementation', () => {
            expect(() => createAPIClient({ fetchImpl: null })).toThrow('Fetch implementation is required');
        });
        
        test('uses default baseURL when not provided', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => []
            });
            
            await api.getAdventures();
            
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/adventures',
                expect.any(Object)
            );
        });
        
        test('uses custom baseURL when provided', async () => {
            const customApi = createAPIClient({ 
                baseURL: 'http://localhost:5000',
                fetchImpl: mockFetch
            });
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => []
            });
            
            await customApi.getAdventures();
            
            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:5000/api/adventures',
                expect.any(Object)
            );
        });
    });
    
    describe('Adventures API', () => {
        describe('getAdventures', () => {
            test('fetches adventure list', async () => {
                const adventures = ['Adventure 1', 'Adventure 2'];
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => adventures
                });
                
                const result = await api.getAdventures();
                
                expect(result).toEqual(adventures);
                expect(mockFetch).toHaveBeenCalledWith('/api/adventures', expect.any(Object));
            });
        });
        
        describe('getAdventure', () => {
            test('fetches adventure by name', async () => {
                const adventure = { name: 'Test', chapters: [], players: [] };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => adventure
                });
                
                const result = await api.getAdventure('Test');
                
                expect(result).toEqual(adventure);
                expect(mockFetch).toHaveBeenCalledWith('/api/adventure/Test', expect.any(Object));
            });
            
            test('URL encodes adventure name', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({})
                });
                
                await api.getAdventure('Test Adventure Name');
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/adventure/Test%20Adventure%20Name',
                    expect.any(Object)
                );
            });
            
            test('throws APIError on 403 (PIN required)', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 403,
                    json: async () => ({ error: 'PIN required', requiresPin: true })
                });
                
                await expect(api.getAdventure('Protected')).rejects.toThrow(APIError);
                await expect(api.getAdventure('Protected')).rejects.toMatchObject({
                    status: 403,
                    endpoint: '/api/adventure/Protected'
                });
            });
        });
        
        describe('verifyAdventurePin', () => {
            test('sends PIN for verification', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true })
                });
                
                const result = await api.verifyAdventurePin('Test', '1234');
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/adventure/Test/verify-pin',
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify({ pin: '1234' })
                    })
                );
                expect(result.ok).toBe(true);
            });

            test('returns ok:false for 401 (incorrect PIN)', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 401,
                    json: async () => ({ error: 'Incorrect PIN' })
                });
                
                const result = await api.verifyAdventurePin('Test', 'wrong');
                
                expect(result.ok).toBe(false);
                expect(result.status).toBe(401);
            });

            test('returns ok:false for 401 (protected adventure with no PIN)', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 401,
                    json: async () => ({ error: 'PIN required' })
                });
                
                const result = await api.verifyAdventurePin('Protected', '');
                
                expect(result.ok).toBe(false);
                expect(result.status).toBe(401);
            });

            test('throws on other errors', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 500,
                    json: async () => ({ error: 'Server error' })
                });
                
                await expect(api.verifyAdventurePin('Test', '1234')).rejects.toThrow(APIError);
            });
        });
        
        describe('createAdventure', () => {
            test('creates new adventure', async () => {
                const newAdventure = { name: 'New Adventure' };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true })
                });
                
                await api.createAdventure(newAdventure);
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/adventure',
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify(newAdventure)
                    })
                );
            });
        });
        
        describe('updateAdventure', () => {
            test('updates adventure data', async () => {
                const updated = { name: 'Test', players: [] };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true })
                });
                
                await api.updateAdventure('Test', updated);
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/adventure/Test',
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify(updated)
                    })
                );
            });
            
            test('throws on session expired (403)', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 403,
                    json: async () => ({ error: 'Session expired' })
                });
                
                await expect(api.updateAdventure('Test', {})).rejects.toThrow(APIError);
            });
        });
        
        describe('deleteAdventure', () => {
            test('deletes adventure', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true })
                });
                
                await api.deleteAdventure('Test');
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/adventure/Test',
                    expect.objectContaining({ method: 'DELETE' })
                );
            });
        });
    });
    
    describe('D&D Beyond API', () => {
        describe('loadMonsters', () => {
            test('fetches monster list', async () => {
                const monsters = { 'Goblin': { cr: '1/4' } };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, monsters })
                });
                
                const result = await api.loadMonsters();
                
                expect(result).toEqual(monsters);
            });
            
            test('throws if success is false', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: false, error: 'Auth failed' })
                });
                
                await expect(api.loadMonsters()).rejects.toThrow(APIError);
                await expect(api.loadMonsters()).rejects.toMatchObject({
                    message: 'Auth failed'
                });
            });
            
            test('throws if no monsters returned', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, monsters: {} })
                });
                
                await expect(api.loadMonsters()).rejects.toThrow('No monsters returned');
            });
        });
        
        describe('getMonsterDetails', () => {
            test('fetches monster details', async () => {
                const details = { name: 'Goblin', ac: 15, hp: 7 };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, details })
                });
                
                const result = await api.getMonsterDetails('monsters/goblin');
                
                expect(result).toEqual(details);
            });
            
            test('URL encodes monster URL', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, details: {} })
                });
                
                await api.getMonsterDetails('https://www.dndbeyond.com/monsters/1234-test');
                
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining(encodeURIComponent('https://www.dndbeyond.com/monsters/1234-test')),
                    expect.any(Object)
                );
            });
            
            test('throws on auth failure', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: false, auth_failed: true, error: 'Cookies expired' })
                });
                
                await expect(api.getMonsterDetails('test')).rejects.toMatchObject({
                    status: 401,
                    message: 'Cookies expired'
                });
            });
        });
        
        describe('getCharacterDetails', () => {
            test('fetches character details', async () => {
                const details = { name: 'Gandalf', level: 20 };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, details })
                });
                
                const result = await api.getCharacterDetails('characters/12345');
                
                expect(result).toEqual(details);
            });
        });
    });
    
    describe('Cookie/Auth API', () => {
        describe('checkCookieStatus', () => {
            test('returns true when cookies present', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ hasCookies: true })
                });
                
                const result = await api.checkCookieStatus();
                
                expect(result).toBe(true);
            });
            
            test('returns false when cookies absent', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ hasCookies: false })
                });
                
                const result = await api.checkCookieStatus();
                
                expect(result).toBe(false);
            });
        });
        
        describe('saveCookies', () => {
            test('saves cookies', async () => {
                const cookies = { cookie1: 'value1' };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true, count: 1 })
                });
                
                const result = await api.saveCookies(cookies);
                
                expect(result.success).toBe(true);
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/dndbeyond/set-cookies',
                    expect.objectContaining({
                        body: JSON.stringify({ cookies })
                    })
                );
            });
            
            test('throws on failure', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: false, error: 'Invalid format' })
                });
                
                await expect(api.saveCookies({})).rejects.toThrow('Invalid format');
            });
        });
        
        describe('clearCookies', () => {
            test('clears cookies', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => ({ success: true })
                });
                
                await api.clearCookies();
                
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/dndbeyond/clear-cookies',
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });
    });
    
    describe('Server Info API', () => {
        describe('getServerInfo', () => {
            test('fetches server info', async () => {
                const info = { ip: '192.168.1.100', port: 5000 };
                mockFetch.mockResolvedValue({
                    ok: true,
                    json: async () => info
                });
                
                const result = await api.getServerInfo();
                
                expect(result).toEqual(info);
            });
        });
    });
    
    describe('Error Handling', () => {
        test('throws APIError on network failure', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            await expect(api.getAdventures()).rejects.toThrow(APIError);
            await expect(api.getAdventures()).rejects.toMatchObject({
                message: 'Network error',
                status: 0
            });
        });
        
        test('throws APIError on HTTP error', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' })
            });
            
            await expect(api.getAdventures()).rejects.toThrow(APIError);
            await expect(api.getAdventures()).rejects.toMatchObject({
                status: 500,
                message: 'Server error'
            });
        });
        
        test('includes endpoint in error', async () => {
            mockFetch.mockRejectedValue(new Error('Failed'));
            
            try {
                await api.getAdventure('Test');
            } catch (error) {
                expect(error.endpoint).toBe('/api/adventure/Test');
            }
        });
    });
    
    describe('createMockAPIClient', () => {
        test('creates mock with default implementations', () => {
            const mock = createMockAPIClient();
            
            expect(mock.getAdventures).toBeDefined();
            expect(mock.loadMonsters).toBeDefined();
            expect(mock.checkCookieStatus).toBeDefined();
        });
        
        test('uses custom mock implementations', async () => {
            const customMock = jest.fn().mockResolvedValue(['Custom']);
            const mock = createMockAPIClient({
                getAdventures: customMock
            });
            
            const result = await mock.getAdventures();
            
            expect(result).toEqual(['Custom']);
            expect(customMock).toHaveBeenCalled();
        });
    });
});
