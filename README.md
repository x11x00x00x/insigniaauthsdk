# Insignia Auth SDK

Client-side SDK for connecting to the Insignia Login Server. This SDK provides a simple interface for authentication, session management, and SSO capabilities.

## NOTE THIS IS AN UNOFFICIAL LOGIN MOD NOT CREATED BY THE INSIGNIA TEAM.

**Production Auth Server**: `https://auth.insigniastats.live/api`

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

<img width="453" height="1134" alt="loggedin" src="https://github.com/user-attachments/assets/50ced4bf-6e66-4088-9d1d-db72422f4356" />

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

## Data Refresh

The SDK supports refreshing data without requiring a new login. When you log in, your credentials are securely stored (encrypted) on the server. You can refresh any data type:

```javascript
// Refresh friends data
const friends = await auth.refreshFriends();

// Refresh games data
const games = await auth.refreshGames();

// Refresh mutes data
const mutes = await auth.refreshMutes();
```

**Note**: Refresh operations use stored encrypted credentials to extract fresh data from insignia.live.

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

