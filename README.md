# Insignia Auth SDK

Client-side SDK for the Insignia Auth Backend. Handles login, session storage, and access to **friends**, **games**, and **profile** (online status, current game, time online, and My Games Played list) from insignia.live. Use your session key to read cached data (e.g. poll every minute) or refresh to update the cache.

## NOTE THIS IS AN UNOFFICIAL LOGIN MOD NOT CREATED BY THE INSIGNIA TEAM.

**Production Auth Server**: `https://auth.insigniastats.live/api`

### Deprecated / no longer available

| Item | Status | Use instead |
|------|--------|-------------|
| **Mutes** | No longer available from Insignia. | Use `getProfile()` and `getFriends()` for online presence and last-seen data. |
| **Separate games page** | Insignia no longer has `/dashboard/games`. | Games list is only from profile **My Games Played**. `getGames()` and `refreshGames()` use profile data. |

### API summary

| Method | Description |
|--------|-------------|
| `login(email, password)` | Log in; returns `{ success, user, sessionKey }`. |
| `logout()` | Log out and clear session. |
| `verifySession()` | Returns `true` if session is still valid. |
| `getUser()` | Get current user (username, email). |
| `getFriends()` | Get cached friends (gamertag, status, isOnline, game?, duration?, lastSeen?). |
| `getGames()` | Get cached games (from profile “My Games Played”; same data as profile). |
| `getProfile()` | Get cached profile (isOnline, status, game?, timeOnline?, gamesPlayed with lastPlayed). |
| `refreshFriends()` | Refresh friends from Insignia. |
| `refreshGames()` | Refresh games from Insignia. |
| `refreshProfile()` | Refresh profile from Insignia. |
| `isLoggedIn()`, `getUsername()`, `getEmail()`, `getSessionKey()` | Session helpers. |
| `on(event, fn)` / `off(event, fn)` | Events: `login`, `logout`, `error`. |
| `startAutoVerify(intervalMs)` / `stopAutoVerify()` | Optional periodic session check. |

## Installation

### Browser (CDN)

<img width="659" height="622" alt="loginscreen" src="https://github.com/user-attachments/assets/365f8cf6-c650-49c6-8344-a4a96d4487b1" />

```html
<script src="https://your-cdn.com/insignia-auth.js"></script>
```

### Local

Copy `insignia-auth.js` to your project and include it:

```html
<script src="path/to/insignia-auth.js"></script>
```

<img width="453" height="1134" alt="loggedin" src="https://github.com/user-attachments/assets/02153425-0719-4dc3-bffa-19cd19f57441" />


## Quick Start

```javascript
// Initialize the SDK with the production auth server
const auth = new InsigniaAuth({
    apiUrl: 'https://auth.insigniastats.live/api'  // Production auth server
});

// Login
try {
    const result = await auth.login('user@example.com', 'password');
    console.log('Logged in as:', result.user.username);
    console.log('Email:', result.user.email);
} catch (error) {
    console.error('Login failed:', error.message);
}

// Check if logged in
if (auth.isLoggedIn()) {
    console.log('Current user:', auth.getUsername());
    console.log('Email:', auth.getEmail());
}

// Logout
await auth.logout();
```

## API Reference

### Constructor

```javascript
const auth = new InsigniaAuth(options);
```

**Options:**
- `apiUrl` (string): Base URL of your Insignia Login Server (required)
- `storageKey` (string): localStorage key for session storage (default: 'insignia_auth')

### Methods

#### `login(email, password)`

Login with email and password.

```javascript
const result = await auth.login('user@example.com', 'password');
// Returns: { success: true, user: { username, email }, sessionKey }
```

#### `logout()`

Logout current user and clear session.

```javascript
await auth.logout();
```

#### `verifySession()`

Verify if current session is still valid.

```javascript
const isValid = await auth.verifySession();
// Returns: boolean
```

#### `getUser()`

Get current user info (SSO endpoint). Automatically verifies session.

```javascript
const user = await auth.getUser();
// Returns: { username, email } or null
```

#### `isLoggedIn()`

Check if user is currently logged in.

```javascript
if (auth.isLoggedIn()) {
    // User is logged in
}
```

#### `getUsername()`

Get current username.

```javascript
const username = auth.getUsername();
```

#### `getEmail()`

Get current user email.

```javascript
const email = auth.getEmail();
```

#### `getSessionKey()`

Get current session key (for use with protected API endpoints).

```javascript
const sessionKey = auth.getSessionKey();
```

#### `getFriends()`

Get cached friends list (no Insignia login). Data is scraped from the Insignia dashboard **Friends** page (Filament table). Each friend has:

| Field | Description |
|-------|-------------|
| `gamertag` | Display name (e.g. "Jackie", "Colskee"). |
| `status` | Raw status text from the UI. |
| `isOnline` | `true` = green badge (online), `false` = gray badge (offline). |
| **When online** | |
| `game` | Parsed from "Online in [Game] for …" (e.g. "Project Gotham Racing 2"). |
| `duration` | Parsed from "… for [duration]" (e.g. "14 hours"). |
| **When offline** | |
| `lastSeen` | Full "Last seen …" string (e.g. "Last seen 2 months ago"). |

```javascript
const data = await auth.getFriends();
// Returns: { friends: [...], lastUpdated, count } or null
// friends[].gamertag, .status, .isOnline, .game?, .duration?, .lastSeen?
```

#### `getGames()`

Get cached games list. Games are sourced from the profile page **My Games Played** (Insignia no longer has a separate games page); the list is the same as `getProfile().gamesPlayed` (each item: `title`, `lastPlayed`, `iconUrl`).

```javascript
const data = await auth.getGames();
// Returns: { games: [{ title, lastPlayed, iconUrl }, ...], lastUpdated, count } or null
```

#### `getProfile()`

Get cached profile: your online status, current game (when online), and My Games Played list.

- **isOnline:** `true` or `false`.
- **status:** `"Online"` or `"Offline"`.
- **game:** When online, current game title (e.g. `"Xbox Live Dashboard"`); otherwise `null`.
- **timeOnline:** When online, how long you have been in that game (e.g. `"11 minutes"`); otherwise `null`. You can show "Playing [game] for [timeOnline]" in the UI.
- **gamesPlayed:** Full list from profile "My Games Played"; each entry has `title`, `lastPlayed` (e.g. `"10 minutes ago"`), `iconUrl`.

```javascript
const data = await auth.getProfile();
// Returns: { isOnline, status, game?, timeOnline?, gamesPlayed: [{ title, lastPlayed, iconUrl }], lastUpdated, count } or null
```

#### `refreshFriends()`

Refresh friends from Insignia (updates cache; backend reuses session when possible).

```javascript
const data = await auth.refreshFriends();
// Returns: { friends, lastUpdated, count } or null
```

#### `refreshGames()`

Refresh games from Insignia. The backend refreshes the profile page (My Games Played) and returns the games list (same as refreshing profile for games).

```javascript
const data = await auth.refreshGames();
// Returns: { success, games: [{ title, lastPlayed, iconUrl }, ...], count, lastUpdated } or null
```

#### `refreshProfile()`

Refresh profile (online status, current game, time online, and My Games Played) from Insignia.

```javascript
const data = await auth.refreshProfile();
// Returns: { success?, isOnline, status, game?, timeOnline?, gamesPlayed, lastUpdated, count } or null
```

#### `on(event, callback)`

Listen to authentication events.

```javascript
auth.on('login', (user) => {
    console.log('User logged in:', user);
});

auth.on('logout', (user) => {
    console.log('User logged out:', user);
});

auth.on('error', (error) => {
    console.error('Auth error:', error);
});
```

**Events:**
- `login` - Fired when user successfully logs in
- `logout` - Fired when user logs out
- `error` - Fired when an error occurs

#### `off(event, callback)`

Remove event listener.

```javascript
auth.off('login', myCallback);
```

#### `startAutoVerify(interval)`

Start automatically verifying session at specified interval.

```javascript
auth.startAutoVerify(5 * 60 * 1000); // Verify every 5 minutes
```

#### `stopAutoVerify()`

Stop automatic session verification.

```javascript
auth.stopAutoVerify();
```

## SSO (Single Sign-On) Usage

The SDK supports SSO by storing sessions in localStorage and automatically verifying them across pages. To use SSO with the production auth server at `auth.insigniastats.live`:

```javascript
// On any page, initialize the SDK with the production auth server
const auth = new InsigniaAuth({ 
    apiUrl: 'https://auth.insigniastats.live/api' 
});

// Check if user is already logged in (from another page/site)
if (auth.isLoggedIn()) {
    // User is logged in, get their info via SSO
    const user = await auth.getUser();
    if (user) {
        console.log('Welcome back,', user.username);
        console.log('Email:', user.email);
        // User is authenticated, show protected content
    } else {
        // Session invalid, show login form
        showLoginForm();
    }
} else {
    // No session found, show login form
    showLoginForm();
}

// Start auto-verification to keep session valid
auth.startAutoVerify();
```

### How SSO Works

1. **User logs in** on one site/page using `auth.login()`
2. **Session is stored** in localStorage with the session key
3. **On other pages/sites**, initialize the SDK with the same `apiUrl`
4. **Call `auth.getUser()`** to verify the session and get user info
5. **If valid**, the user is automatically authenticated across all pages using the same auth server

**Important**: For SSO to work across different domains, you'll need to use a shared storage mechanism or implement cross-domain session sharing. Within the same domain, SSO works automatically via localStorage.

## Backend API Endpoints

The SDK talks to an Insignia Auth Backend. All protected endpoints require the session key via header `X-Session-Key` or query `sessionKey`. Base path is your `apiUrl` (e.g. `https://auth.insigniastats.live/api`).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email/password; returns `{ success, username, email, sessionKey }`. Backend extracts friends and profile (including My Games Played) in the background after response. |
| POST | `/auth/logout` | Logout; body `{ sessionKey }`. |
| POST | `/auth/verify` | Verify session; body `{ sessionKey }`. Returns `{ valid: true }` or 401. |
| GET | `/auth/user` | Get current user (SSO); returns `{ username, email, sessionKey }`. |
| GET | `/auth/friends` | Cached friends list; returns `{ friends, lastUpdated, count }`. |
| GET | `/auth/games` | Cached games list (from profile My Games Played); returns `{ games, lastUpdated, count }`. Same data as profile.gamesPlayed. |
| GET | `/auth/profile` | Cached profile; returns `{ isOnline, status, game, timeOnline, gamesPlayed, lastUpdated, count }`. |
| POST | `/auth/refresh/friends` | Refresh friends from Insignia; returns `{ success, friends, count, lastUpdated }`. |
| POST | `/auth/refresh/games` | Refresh profile and return games; returns `{ success, games, count, lastUpdated }`. |
| POST | `/auth/refresh/profile` | Refresh profile from Insignia; returns `{ success, isOnline, status, game, timeOnline, gamesPlayed, count, lastUpdated }`. |

**After login:** Friends and profile (including games) are extracted in the background. Allow 20–40 seconds before cached data is full, or call a refresh endpoint.

## Using Session Key with Protected Endpoints

When making API calls to your own backend, include the session key:

```javascript
const sessionKey = auth.getSessionKey();

const response = await fetch('https://your-api.com/protected-endpoint', {
    headers: {
        'X-Session-Key': sessionKey
    }
});
```

## Data: Cached (GET) vs Refresh (POST)

- **Cached (no Insignia login):** `getFriends()`, `getGames()`, and `getProfile()` read from the server’s cache. Use these for frequent polling (e.g. every minute).
- **Refresh (updates cache):** `refreshFriends()`, `refreshGames()`, and `refreshProfile()` fetch fresh data from insignia.live. The backend reuses the Insignia session when possible, so refresh does not always require a full login. Note: `refreshGames()` refreshes the profile page and returns the games list (same source as `getProfile().gamesPlayed`).

```javascript
// Read cached data (fast, no login)
const friends = await auth.getFriends();
const profile = await auth.getProfile();
const games = await auth.getGames();

// Update the cache from Insignia (call less often, e.g. every 5–10 min)
await auth.refreshFriends();
await auth.refreshProfile();
await auth.refreshGames();
```

**Polling:** For live presence (who’s online, what game, last seen), poll `getFriends()` and `getProfile()` on a timer (e.g. every minute). Call `refreshFriends()` / `refreshProfile()` periodically or on user action to keep the cache up to date.

## Example: Complete Integration

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
</head>
<body>
    <div id="loginForm" style="display: none;">
        <input type="email" id="email" placeholder="Email">
        <input type="password" id="password" placeholder="Password">
        <button onclick="handleLogin()">Login</button>
    </div>
    
    <div id="userInfo" style="display: none;">
        <p>Welcome, <span id="username"></span>!</p>
        <p>Email: <span id="email"></span></p>
        <button onclick="handleLogout()">Logout</button>
    </div>

    <script src="insignia-auth.js"></script>
    <script>
        // Initialize SDK with production auth server
        const auth = new InsigniaAuth({
            apiUrl: 'https://auth.insigniastats.live/api'
        });

        // Check login status on page load
        document.addEventListener('DOMContentLoaded', async () => {
            if (auth.isLoggedIn()) {
                const user = await auth.getUser();
                if (user) {
                    showUserInfo(user);
                } else {
                    showLoginForm();
                }
            } else {
                showLoginForm();
            }
            
            // Start auto-verification
            auth.startAutoVerify();
        });

        // Listen for login events
        auth.on('login', (user) => {
            showUserInfo(user);
        });

        auth.on('logout', () => {
            showLoginForm();
        });

        async function handleLogin() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                await auth.login(email, password);
            } catch (error) {
                alert('Login failed: ' + error.message);
            }
        }

        async function handleLogout() {
            await auth.logout();
        }

        function showUserInfo(user) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('userInfo').style.display = 'block';
            document.getElementById('username').textContent = user.username;
            document.getElementById('email').textContent = user.email;
        }

        function showLoginForm() {
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('userInfo').style.display = 'none';
        }
    </script>
</body>
</html>
```

## Browser Events

The SDK also dispatches custom DOM events that you can listen to:

```javascript
window.addEventListener('insignia:login', (e) => {
    console.log('User logged in:', e.detail);
});

window.addEventListener('insignia:logout', (e) => {
    console.log('User logged out:', e.detail);
});

window.addEventListener('insignia:error', (e) => {
    console.error('Auth error:', e.detail);
});
```

## Error Handling

All methods that make API calls can throw errors. Always wrap them in try-catch:

```javascript
try {
    await auth.login(email, password);
} catch (error) {
    console.error('Login error:', error.message);
    // Handle error (show message to user, etc.)
}
```

## Session Storage

Sessions are stored in localStorage with the key specified in `storageKey` (default: 'insignia_auth'). The stored data includes:
- `sessionKey`: The session token
- `user`: User object with username and email
- `timestamp`: When the session was created

## Security Notes

1. **HTTPS**: Always use HTTPS in production to protect credentials
2. **Session Key**: Never expose session keys in client-side code that could be logged
3. **CORS**: The server should be configured with appropriate CORS settings
4. **Storage**: Consider using httpOnly cookies for session storage in production (requires server-side changes)

