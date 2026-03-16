/**
 * Insignia Auth SDK
 * Client-side SDK for the Insignia Auth Backend (session, friends, games, profile, messages).
 *
 * Endpoints used:
 *   POST /auth/login, POST /auth/logout, POST /auth/verify
 *   GET  /auth/user, GET /auth/friends, GET /auth/games, GET /auth/profile, GET /auth/messages
 *   POST /auth/refresh/friends, POST /auth/refresh/games, POST /auth/refresh/profile, POST /auth/refresh/messages
 *   POST /auth/messages/view (message detail; cached after first fetch), POST /auth/messages/delete
 *
 * Deprecated (no longer available): mutes — use profile and friends for presence instead.
 *
 * @example
 *   const auth = new InsigniaAuth({ apiUrl: 'https://your-server.com/api' });
 *   await auth.login(email, password);
 *   const friends = await auth.getFriends();
 *   const messages = await auth.getMessages();
 *   const detail = await auth.viewMessage('1');
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

            const data = await response.json().catch(() => null);

            if (data && data.valid) {
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
            }
            // Only clear session when server explicitly said invalid (e.g. 401 + JSON)
            if (response.status === 401 && data && typeof data.valid === 'boolean') {
                this.clearSession();
            }
            return false;
        } catch (err) {
            console.error('Error verifying session:', err);
            // Don't clear session on network/parse errors (could be wrong URL or old server)
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
     * Get user's friends list (cached). Use refreshFriends() to update from Insignia.
     * Each friend has: gamertag, status, isOnline, game (if online), duration (if online), lastSeen (if offline).
     * @returns {Promise<{ friends: Array<{gamertag, status, isOnline, game?, duration?, lastSeen?}>, lastUpdated: number|null, count: number }|null>}
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
     * Get user's messages (cached): From, Type (e.g. Friend Request), Game, Sent.
     * Use refreshMessages() to update from Insignia. More message types may be added later.
     * @returns {Promise<{ messages: Array<{id?, from, type, game?, sentAt?}>, lastUpdated: number|null, count: number }|null>}
     */
    async getMessages() {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/messages`, {
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
                messages: data.messages || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error getting messages:', err);
            return null;
        }
    }

    /**
     * Get current user's profile (cached): online status and last games played.
     * Use refreshProfile() to update from Insignia.
     * @returns {Promise<{ isOnline: boolean, gamesPlayed: Array<{title, lastPlayed, iconUrl}>, lastUpdated: number|null, count: number }|null>}
     */
    async getProfile() {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/profile`, {
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
                isOnline: data.isOnline || false,
                status: data.status ?? (data.isOnline ? 'Online' : 'Offline'),
                game: data.game ?? null,
                timeOnline: data.timeOnline ?? null,
                psoServer: data.psoServer ?? null,
                nameplate: data.nameplate ?? null,
                gamesPlayed: data.gamesPlayed || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error getting profile:', err);
            return null;
        }
    }

    /**
     * Refresh friends data from Insignia (reuses session when possible).
     * @returns {Promise<{ friends, lastUpdated, count }|null>} Updated friends or null if not logged in
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
     * Refresh messages data from Insignia (reuses session when possible).
     * @returns {Promise<{ messages, lastUpdated, count }|null>} Updated messages or null if not logged in
     */
    async refreshMessages() {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh/messages`, {
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
                throw new Error(error.error || 'Failed to refresh messages');
            }

            const data = await response.json();
            return {
                messages: data.messages || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error refreshing messages:', err);
            throw err;
        }
    }

    /**
     * Clear all messages data and message detail cache for the current user. Call refreshMessages() after this to load messages fresh from Insignia.
     * @returns {Promise<{ success: true, message: string }|null>} Success or null if not logged in; throws on 5xx.
     */
    async clearMessageCache() {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        const response = await fetch(`${this.apiUrl}/auth/messages/clear-cache`, {
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
            throw new Error(error.error || 'Failed to clear message cache');
        }

        return response.json();
    }

    /**
     * Get more information about a message by opening its "View" panel (clicks View, scrapes modal content).
     * @param {string} messageId - Message row id (e.g. "1" from getMessages().messages[].id).
     * @param {{ refresh?: boolean, skipCache?: boolean }} [options] - Pass { refresh: true } to bypass cache and force a fresh scrape (use when details are empty on deployed server).
     * @returns {Promise<{ success, id, title?, subject?, sender?, sentAt?, messageText?, hasVoiceMessage?, type?, raw? }|null>} Detail content or null if not logged in; throws on 404/5xx. When list type is "Unknown", viewMessage may return hasVoiceMessage: true and type: "Voice Message".
     */
    async viewMessage(messageId, options) {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        const opts = options && typeof options === 'object' ? options : {};
        const refresh = opts.refresh === true || opts.skipCache === true;
        const response = await fetch(`${this.apiUrl}/auth/messages/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Key': this.sessionKey
            },
            body: JSON.stringify({ messageId: String(messageId), refresh: refresh || undefined })
        });

        if (response.status === 404) {
            const data = await response.json();
            throw new Error(data.error || 'Message not found');
        }

        if (!response.ok) {
            if (response.status === 401) {
                this.clearSession();
            }
            const error = await response.json();
            throw new Error(error.error || 'Failed to get message detail');
        }

        const data = await response.json();
        return {
            success: data.success,
            id: data.id,
            title: data.title ?? null,
            subject: data.subject ?? null,
            sender: data.sender ?? null,
            sentAt: data.sentAt ?? null,
            messageText: data.messageText ?? null,
            hasVoiceMessage: data.hasVoiceMessage === true,
            type: data.type ?? null,
            raw: data.raw ?? null
        };
    }

    /**
     * Delete a message (clicks Delete in the dashboard, confirms modal if present). Available for message types that show Delete (e.g. Game Invite).
     * @param {string} messageId - Message row id (e.g. "1" from getMessages().messages[].id).
     * @returns {Promise<{ success: true, message: string }|null>} Success or null if not logged in; throws on 404/5xx.
     */
    async deleteMessage(messageId) {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        const response = await fetch(`${this.apiUrl}/auth/messages/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Key': this.sessionKey
            },
            body: JSON.stringify({ messageId: String(messageId) })
        });

        if (response.status === 404) {
            const data = await response.json();
            throw new Error(data.error || 'Message not found or cannot be deleted');
        }

        if (!response.ok) {
            if (response.status === 401) {
                this.clearSession();
            }
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete message');
        }

        const data = await response.json();
        return { success: data.success, message: data.message || 'Message deleted' };
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
     * Refresh profile from Insignia (reuses session when possible).
     * @returns {Promise<{ isOnline, gamesPlayed, lastUpdated, count }|null>} Updated profile or null if not logged in
     */
    async refreshProfile() {
        if (!this.sessionKey) {
            return null;
        }

        const isValid = await this.verifySession();
        if (!isValid) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh/profile`, {
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
                throw new Error(error.error || 'Failed to refresh profile');
            }

            const data = await response.json();
            return {
                isOnline: data.isOnline || false,
                status: data.status ?? (data.isOnline ? 'Online' : 'Offline'),
                game: data.game ?? null,
                timeOnline: data.timeOnline ?? null,
                psoServer: data.psoServer ?? null,
                nameplate: data.nameplate ?? null,
                gamesPlayed: data.gamesPlayed || [],
                lastUpdated: data.lastUpdated || null,
                count: data.count || 0
            };
        } catch (err) {
            console.error('Error refreshing profile:', err);
            throw err;
        }
    }

    /**
     * Set PSO Server on Insignia profile. Opens the Set PSO Server modal and submits.
     * @param {string|number} serverId - '1' (Schthack), '2' (Sylverant), or '4' (Ragol.org)
     * @returns {Promise<{ success, serverId }|null>}
     */
    async setProfilePsoServer(serverId) {
        if (!this.sessionKey) return null;
        const isValid = await this.verifySession();
        if (!isValid) return null;
        const id = serverId != null ? String(serverId) : '';
        if (!['1', '2', '4'].includes(id)) {
            throw new Error('Invalid serverId. Use 1 (Schthack), 2 (Sylverant), or 4 (Ragol.org).');
        }
        try {
            const response = await fetch(`${this.apiUrl}/auth/profile/pso-server`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Key': this.sessionKey
                },
                body: JSON.stringify({ serverId: id })
            });
            if (!response.ok) {
                if (response.status === 401) this.clearSession();
                const err = await response.json();
                throw new Error(err.error || 'Failed to set PSO server');
            }
            const data = await response.json();
            return { success: data.success, serverId: data.serverId };
        } catch (err) {
            console.error('Error setting PSO server:', err);
            throw err;
        }
    }

    /**
     * Set Halo 2 nameplate on Insignia profile (no_nameplate | bungienet).
     * @param {string} nameplate - 'no_nameplate' or 'bungienet'
     * @returns {Promise<{ success, nameplate }|null>}
     */
    async setProfileNameplate(nameplate) {
        if (!this.sessionKey) return null;
        const isValid = await this.verifySession();
        if (!isValid) return null;
        if (!nameplate || !['no_nameplate', 'bungienet'].includes(nameplate)) {
            throw new Error('Invalid nameplate. Use no_nameplate or bungienet.');
        }
        try {
            const response = await fetch(`${this.apiUrl}/auth/profile/nameplate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Key': this.sessionKey
                },
                body: JSON.stringify({ nameplate })
            });
            if (!response.ok) {
                if (response.status === 401) this.clearSession();
                const err = await response.json();
                throw new Error(err.error || 'Failed to set nameplate');
            }
            const data = await response.json();
            return { success: data.success, nameplate: data.nameplate };
        } catch (err) {
            console.error('Error setting nameplate:', err);
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

