/**
 * Insignia Auth SDK
 * Client-side SDK for connecting to Insignia Login Server
 * 
 * Usage:
 *   const auth = new InsigniaAuth({ apiUrl: 'https://your-server.com/api' });
 *   await auth.login(email, password);
 */

class InsigniaAuth {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || options.API_URL || 'https://auth.insigniastats.live/api';
        this.storageKey = options.storageKey || 'insignia_auth';
        this.sessionKey = null;
        this.user = null;
        
        // Load existing session from storage
        this.loadSession();
    }

    /**
     * Load session from localStorage
     */
    loadSession() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.sessionKey = data.sessionKey;
                this.user = data.user;
            }
        } catch (err) {
            console.error('Error loading session:', err);
        }
    }

    /**
     * Save session to localStorage
     */
    saveSession(sessionKey, user) {
        try {
            this.sessionKey = sessionKey;
            this.user = user;
            localStorage.setItem(this.storageKey, JSON.stringify({
                sessionKey: sessionKey,
                user: user,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error('Error saving session:', err);
        }
    }

    /**
     * Clear session from localStorage
     */
    clearSession() {
        this.sessionKey = null;
        this.user = null;
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Login with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} User data and session key
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.success && data.sessionKey) {
                const user = {
                    username: data.username,
                    email: data.email || email
                };
                
                this.saveSession(data.sessionKey, user);
                
                // Trigger login event
                this.emit('login', user);
                
                return {
                    success: true,
                    user: user,
                    sessionKey: data.sessionKey
                };
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (err) {
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Logout current user
     * @returns {Promise<boolean>}
     */
    async logout() {
        try {
            if (this.sessionKey) {
                await fetch(`${this.apiUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ sessionKey: this.sessionKey })
                });
            }
            
            const user = this.user;
            this.clearSession();
            
            // Trigger logout event
            this.emit('logout', user);
            
            return true;
        } catch (err) {
            console.error('Error logging out:', err);
            this.clearSession();
            return false;
        }
    }

    /**
     * Verify current session
     * @returns {Promise<boolean>}
     */
    async verifySession() {
        if (!this.sessionKey) {
            return false;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionKey: this.sessionKey })
            });

            const data = await response.json();

            if (data.valid) {
                // Update user data if email was missing
                if (data.email && (!this.user || !this.user.email)) {
                    this.user = {
                        ...this.user,
                        username: data.username,
                        email: data.email
                    };
                    this.saveSession(this.sessionKey, this.user);
                }
                return true;
            } else {
                this.clearSession();
                return false;
            }
        } catch (err) {
            console.error('Error verifying session:', err);
            this.clearSession();
            return false;
        }
    }

    /**
     * Get current user info (SSO)
     * @returns {Promise<Object|null>} User object or null if not logged in
     */
    async getUser() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/user`, {
                method: 'GET',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                this.clearSession();
                return null;
            }

            const data = await response.json();
            
            // Update stored user data
            this.user = {
                username: data.username,
                email: data.email
            };
            this.saveSession(this.sessionKey, this.user);
            
            return this.user;
        } catch (err) {
            console.error('Error getting user:', err);
            return null;
        }
    }

    /**
     * Get user's friends list
     * @returns {Promise<Object|null>} Friends data or null if not logged in
     */
    async getFriends() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/friends`, {
                method: 'GET',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                return null;
            }

            const data = await response.json();
            return {
                friends: data.friends || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error getting friends:', err);
            return null;
        }
    }

    /**
     * Get user's games list
     * @returns {Promise<Object|null>} Games data or null if not logged in
     */
    async getGames() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/games`, {
                method: 'GET',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                return null;
            }

            const data = await response.json();
            return {
                games: data.games || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error getting games:', err);
            return null;
        }
    }

    /**
     * Get user's mutes list
     * @returns {Promise<Object|null>} Mutes data or null if not logged in
     */
    async getMutes() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/mutes`, {
                method: 'GET',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                return null;
            }

            const data = await response.json();
            return {
                mutes: data.mutes || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error getting mutes:', err);
            return null;
        }
    }

    /**
     * Refresh friends data
     * @returns {Promise<Object|null>} Updated friends data or null if not logged in
     */
    async refreshFriends() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh/friends`, {
                method: 'POST',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                const error = await response.json();
                throw new Error(error.error || 'Failed to refresh friends');
            }

            const data = await response.json();
            return {
                friends: data.friends || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error refreshing friends:', err);
            throw err;
        }
    }

    /**
     * Refresh games data
     * @returns {Promise<Object|null>} Updated games data or null if not logged in
     */
    async refreshGames() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh/games`, {
                method: 'POST',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                const error = await response.json();
                throw new Error(error.error || 'Failed to refresh games');
            }

            const data = await response.json();
            return {
                games: data.games || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error refreshing games:', err);
            throw err;
        }
    }

    /**
     * Refresh mutes data
     * @returns {Promise<Object|null>} Updated mutes data or null if not logged in
     */
    async refreshMutes() {
        if (!this.sessionKey) {
            return null;
        }

        // Verify session first
        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh/mutes`, {
                method: 'POST',
                headers: {
                    'X-Session-Key': this.sessionKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearSession();
                }
                const error = await response.json();
                throw new Error(error.error || 'Failed to refresh mutes');
            }

            const data = await response.json();
            return {
                mutes: data.mutes || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error refreshing mutes:', err);
            throw err;
        }
    }

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.sessionKey !== null && this.user !== null;
    }

    /**
     * Get current username
     * @returns {string|null}
     */
    getUsername() {
        return this.user ? this.user.username : null;
    }

    /**
     * Get current user email
     * @returns {string|null}
     */
    getEmail() {
        return this.user ? this.user.email : null;
    }

    /**
     * Get session key
     * @returns {string|null}
     */
    getSessionKey() {
        return this.sessionKey;
    }

    /**
     * Event emitter functionality
     */
    _listeners = {};

    /**
     * Listen to events
     * @param {string} event - Event name ('login', 'logout', 'error')
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event
     * @private
     */
    emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error('Error in event listener:', err);
                }
            });
        }
        
        // Also dispatch custom DOM events for browser integration
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`insignia:${event}`, { detail: data }));
        }
    }

    /**
     * Auto-verify session periodically
     * @param {number} interval - Interval in milliseconds (default: 5 minutes)
     */
    startAutoVerify(interval = 5 * 60 * 1000) {
        if (this._verifyInterval) {
            clearInterval(this._verifyInterval);
        }
        
        this._verifyInterval = setInterval(async () => {
            if (this.isLoggedIn()) {
                const isValid = await this.verifySession();
                if (!isValid) {
                    this.emit('logout', this.user);
                }
            }
        }, interval);
    }

    /**
     * Stop auto-verification
     */
    stopAutoVerify() {
        if (this._verifyInterval) {
            clearInterval(this._verifyInterval);
            this._verifyInterval = null;
        }
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InsigniaAuth;
}

// Also make available globally
if (typeof window !== 'undefined') {
    window.InsigniaAuth = InsigniaAuth;
}

