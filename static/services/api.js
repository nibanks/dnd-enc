/**
 * API Service Layer
 * Abstracts all HTTP requests for testability and reusability
 */

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, status, endpoint, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
        this.data = data;
    }
}

/**
 * Create API client with configurable options
 * @param {Object} config - Configuration options
 * @param {string} config.baseURL - Base URL for API calls
 * @param {Function} config.fetchImpl - Fetch implementation (injectable for testing)
 * @returns {Object} API client with all methods
 */
export function createAPIClient(config = {}) {
    const {
        baseURL = '',
        fetchImpl = typeof fetch !== 'undefined' ? fetch : null
    } = config;
    
    if (!fetchImpl) {
        throw new Error('Fetch implementation is required');
    }
    
    /**
     * Generic request helper with error handling
     */
    async function request(path, options = {}) {
        const url = `${baseURL}${path}`;
        
        try {
            const response = await fetchImpl(url, {
                credentials: 'same-origin', // Include cookies for session management
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            // Handle HTTP errors
            if (!response.ok) {
                throw new APIError(
                    data.error || `HTTP ${response.status}`,
                    response.status,
                    path,
                    data
                );
            }
            
            return { response, data };
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            // Network or parsing errors
            throw new APIError(
                error.message || 'Network request failed',
                0,
                path
            );
        }
    }
    
    return {
        // ==================== Adventures API ====================
        
        /**
         * Get list of all adventures
         * @returns {Promise<string[]>} Array of adventure names
         */
        async getAdventures() {
            const { data } = await request('/api/adventures');
            return data;
        },
        
        /**
         * Get adventure by name
         * @param {string} name - Adventure name
         * @returns {Promise<Object>} Adventure data
         * @throws {APIError} If adventure requires PIN (status 403)
         */
        async getAdventure(name) {
            const { data } = await request(`/api/adventure/${encodeURIComponent(name)}`);
            return data;
        },
        
        /**
         * Verify adventure PIN
         * @param {string} name - Adventure name
         * @param {string} pin - 4-digit PIN
         * @returns {Promise<Object>} Verification result with ok property
         */
        async verifyAdventurePin(name, pin) {
            try {
                const { data } = await request(`/api/adventure/${encodeURIComponent(name)}/verify-pin`, {
                    method: 'POST',
                    body: JSON.stringify({ pin })
                });
                return { ok: true, ...data };
            } catch (error) {
                // 401 is expected for incorrect PIN or protected adventures
                if (error.status === 401) {
                    return { ok: false, status: 401 };
                }
                // Re-throw other errors
                throw error;
            }
        },
        
        /**
         * Create new adventure
         * @param {Object} adventureData - Adventure data with name property
         * @returns {Promise<Object>} Creation result
         */
        async createAdventure(adventureData) {
            const { data } = await request('/api/adventure', {
                method: 'POST',
                body: JSON.stringify(adventureData)
            });
            return data;
        },
        
        /**
         * Update existing adventure
         * @param {string} name - Adventure name
         * @param {Object} adventureData - Complete adventure data
         * @returns {Promise<Object>} Update result
         * @throws {APIError} If session expired (status 403)
         */
        async updateAdventure(name, adventureData) {
            const { data } = await request(`/api/adventure/${encodeURIComponent(name)}`, {
                method: 'POST',
                body: JSON.stringify(adventureData)
            });
            return data;
        },
        
        /**
         * Delete adventure
         * @param {string} name - Adventure name
         * @returns {Promise<Object>} Deletion result
         */
        async deleteAdventure(name) {
            const { data } = await request(`/api/adventure/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            return data;
        },
        
        /**
         * Invalidate all adventure sessions (when PIN changes)
         * @param {string} name - Adventure name
         * @returns {Promise<Object>} Result
         */
        async invalidateAdventureSessions(name) {
            const { data } = await request(`/api/adventure/${encodeURIComponent(name)}/invalidate-sessions`, {
                method: 'POST'
            });
            return data;
        },
        
        // ==================== D&D Beyond API ====================
        
        /**
         * Load monster list from D&D Beyond
         * @returns {Promise<Object>} Monster dictionary keyed by name
         * @throws {APIError} If authentication failed or no monsters returned
         */
        async loadMonsters() {
            const { data } = await request('/api/dndbeyond/monsters');
            
            if (!data.success || !data.monsters || Object.keys(data.monsters).length === 0) {
                throw new APIError(
                    data.error || 'No monsters returned',
                    500,
                    '/api/dndbeyond/monsters',
                    data
                );
            }
            
            return data.monsters;
        },
        
        /**
         * Get detailed monster information
         * @param {string} monsterUrl - D&D Beyond monster URL or ID
         * @returns {Promise<Object>} Monster details
         * @throws {APIError} If monster not found or auth failed
         */
        async getMonsterDetails(monsterUrl) {
            const encodedUrl = encodeURIComponent(monsterUrl);
            const { data } = await request(`/api/dndbeyond/monster/${encodedUrl}`);
            
            if (!data.success) {
                throw new APIError(
                    data.error || 'Failed to fetch monster details',
                    data.auth_failed ? 401 : 500,
                    monsterUrl,
                    data
                );
            }
            
            return data.details;
        },
        
        /**
         * Get detailed character information
         * @param {string} characterUrl - D&D Beyond character URL
         * @returns {Promise<Object>} Character details
         * @throws {APIError} If character not found or auth failed
         */
        async getCharacterDetails(characterUrl) {
            const encodedUrl = encodeURIComponent(characterUrl);
            const { data } = await request(`/api/dndbeyond/character/${encodedUrl}`);
            
            if (!data.success) {
                throw new APIError(
                    data.error || 'Failed to fetch character details',
                    data.auth_failed ? 401 : 500,
                    characterUrl,
                    data
                );
            }
            
            return data.details;
        },
        
        // ==================== Cookie/Auth API ====================
        
        /**
         * Check if D&D Beyond cookies are configured
         * @returns {Promise<boolean>} True if cookies are present
         */
        async checkCookieStatus() {
            const { data } = await request('/api/dndbeyond/cookie-status');
            return data.hasCookies || false;
        },
        
        /**
         * Save D&D Beyond cookies
         * @param {Object|Array} cookies - Cookies in various formats
         * @returns {Promise<Object>} Result with count of saved cookies
         */
        async saveCookies(cookies) {
            const { data } = await request('/api/dndbeyond/set-cookies', {
                method: 'POST',
                body: JSON.stringify({ cookies })
            });
            
            if (!data.success) {
                throw new APIError(
                    data.error || 'Failed to save cookies',
                    500,
                    '/api/dndbeyond/set-cookies',
                    data
                );
            }
            
            return data;
        },
        
        /**
         * Clear all saved cookies
         * @returns {Promise<Object>} Result
         */
        async clearCookies() {
            const { data } = await request('/api/dndbeyond/clear-cookies', {
                method: 'POST'
            });
            return data;
        },
        
        // ==================== Server Info API ====================
        
        /**
         * Get server information (IP, port for spectator URL)
         * @returns {Promise<Object>} Server info with ip and port
         */
        async getServerInfo() {
            const { data } = await request('/api/server-info');
            return data;
        }
    };
}

/**
 * Create a mock API client for testing
 * @param {Object} mockResponses - Mock data for each method
 * @returns {Object} Mock API client
 */
export function createMockAPIClient(mockResponses = {}) {
    const defaultMock = () => Promise.resolve({});
    
    return {
        getAdventures: mockResponses.getAdventures || jest.fn(defaultMock),
        getAdventure: mockResponses.getAdventure || jest.fn(defaultMock),
        verifyAdventurePin: mockResponses.verifyAdventurePin || jest.fn(defaultMock),
        createAdventure: mockResponses.createAdventure || jest.fn(defaultMock),
        updateAdventure: mockResponses.updateAdventure || jest.fn(defaultMock),
        deleteAdventure: mockResponses.deleteAdventure || jest.fn(defaultMock),
        invalidateAdventureSessions: mockResponses.invalidateAdventureSessions || jest.fn(defaultMock),
        loadMonsters: mockResponses.loadMonsters || jest.fn(defaultMock),
        getMonsterDetails: mockResponses.getMonsterDetails || jest.fn(defaultMock),
        getCharacterDetails: mockResponses.getCharacterDetails || jest.fn(defaultMock),
        checkCookieStatus: mockResponses.checkCookieStatus || jest.fn(() => Promise.resolve(false)),
        saveCookies: mockResponses.saveCookies || jest.fn(defaultMock),
        clearCookies: mockResponses.clearCookies || jest.fn(defaultMock),
        getServerInfo: mockResponses.getServerInfo || jest.fn(defaultMock)
    };
}

/**
 * Global API client instance (can be replaced for testing)
 */
export const api = typeof window !== 'undefined' 
    ? createAPIClient({ fetchImpl: fetch })
    : null;
