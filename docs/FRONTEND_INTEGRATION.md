# Frontend Integration Guide

This guide shows how to integrate your YALG frontend with the Chrome extension's new authentication system.

## Integration Methods

The extension supports **two methods** for authentication:

1. **🔗 Direct Messaging (Recommended)** - Real-time communication
2. **🍪 Cookie Access (Fallback)** - Automatic detection

## Method 1: Direct Messaging (Recommended)

Add this JavaScript code to your frontend to send authentication data directly to the extension:

### Frontend Code

```javascript
// Add this to your frontend's authentication logic

/**
 * YALG Extension Communication Helper
 * Add this to your frontend application
 */
class YALGExtensionBridge {
  static EXTENSION_ID = 'your-extension-id'; // Replace with actual extension ID
  
  /**
   * Send authentication success to extension
   * Call this after successful login
   */
  static sendAuthSuccess(authData) {
    const messageData = {
      type: 'YALG_AUTH_SUCCESS',
      data: {
        accessToken: authData.accessToken,
        userId: authData.userId,
        email: authData.email,
        name: authData.name,
        expiresAt: authData.expiresAt,
        frontendUrl: window.location.origin,
        backendUrl: 'http://localhost:3000' // Your backend URL
      }
    };

    // Method 1: Try extension messaging (if extension ID is known)
    if (this.EXTENSION_ID && chrome?.runtime) {
      try {
        chrome.runtime.sendMessage(this.EXTENSION_ID, messageData);
        console.log('YALG: Sent auth data to extension via messaging');
      } catch (error) {
        console.warn('YALG: Could not send via messaging', error);
      }
    }

    // Method 2: PostMessage (fallback)
    try {
      window.postMessage(messageData, window.location.origin);
      console.log('YALG: Sent auth data to extension via postMessage');
    } catch (error) {
      console.warn('YALG: Could not send via postMessage', error);
    }
  }

  /**
   * Send logout notification to extension
   * Call this when user logs out
   */
  static sendLogout() {
    const messageData = {
      type: 'YALG_AUTH_LOGOUT'
    };

    // Method 1: Extension messaging
    if (this.EXTENSION_ID && chrome?.runtime) {
      try {
        chrome.runtime.sendMessage(this.EXTENSION_ID, messageData);
      } catch (error) {
        console.warn('YALG: Could not send logout via messaging', error);
      }
    }

    // Method 2: PostMessage
    try {
      window.postMessage(messageData, window.location.origin);
    } catch (error) {
      console.warn('YALG: Could not send logout via postMessage', error);
    }
  }

  /**
   * Check if YALG extension is installed
   */
  static async checkExtensionInstalled() {
    if (!this.EXTENSION_ID || !chrome?.runtime) {
      return false;
    }

    try {
      const response = await chrome.runtime.sendMessage(this.EXTENSION_ID, {
        type: 'CHECK_EXTENSION'
      });
      return response?.installed || false;
    } catch (error) {
      return false;
    }
  }
}

// Usage Examples:

// 1. After successful login
async function handleSuccessfulLogin(loginResponse) {
  // Your existing login logic here...
  
  // Send to extension
  YALGExtensionBridge.sendAuthSuccess({
    accessToken: loginResponse.accessToken,
    userId: loginResponse.user.id,
    email: loginResponse.user.email,
    name: loginResponse.user.name,
    expiresAt: loginResponse.expiresAt // Optional
  });
}

// 2. On logout
async function handleLogout() {
  // Your existing logout logic here...
  
  // Notify extension
  YALGExtensionBridge.sendLogout();
}

// 3. Check if extension is installed (optional)
async function checkExtensionStatus() {
  const isInstalled = await YALGExtensionBridge.checkExtensionInstalled();
  if (isInstalled) {
    console.log('YALG Extension is installed');
    // Maybe show a message to user about extension features
  }
}
```

### Integration Points

Add these calls to your existing authentication code:

#### Login Success Handler
```javascript
// In your login success handler
const handleLogin = async (credentials) => {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    const authData = await response.json();
    
    // Store in your app (localStorage, state, etc.)
    localStorage.setItem('accessToken', authData.accessToken);
    
    // 🚀 Send to extension
    YALGExtensionBridge.sendAuthSuccess(authData);
    
    // Redirect to dashboard
    router.push('/dashboard');
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

#### Logout Handler
```javascript
// In your logout handler
const handleLogout = async () => {
  try {
    // Clear your app state
    localStorage.removeItem('accessToken');
    
    // 🚀 Notify extension
    YALGExtensionBridge.sendLogout();
    
    // Redirect to login
    router.push('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

## Method 2: Cookie Access (Automatic Fallback)

The extension can also automatically detect authentication via cookies. Ensure your frontend stores the authentication token in a cookie named `accessToken`.

### Cookie Setup

```javascript
// When setting authentication cookies, use this format:
document.cookie = `accessToken=${authData.accessToken}; path=/; domain=localhost; SameSite=Lax`;
document.cookie = `userId=${authData.userId}; path=/; domain=localhost; SameSite=Lax`;
```

### Important Cookie Notes

- ✅ **Cookie Name**: Must be `accessToken` (the extension looks for this specific name)
- ✅ **Domain**: Set to your frontend domain (e.g., `localhost` for development)
- ✅ **SameSite**: Use `Lax` or `None` (not `Strict`)
- ❌ **HttpOnly**: Do NOT set HttpOnly flag (extension can't access HttpOnly cookies)

## Extension URL Parameters

When the extension opens your login page, it adds `?ext=true` to the URL. You can detect this to show extension-specific messaging:

```javascript
// Detect if user came from extension
const urlParams = new URLSearchParams(window.location.search);
const fromExtension = urlParams.get('ext') === 'true';

if (fromExtension) {
  // Show extension-specific message
  showNotification('Please log in to connect your YALG extension');
}
```

## Testing the Integration

### 1. Test Direct Messaging
```javascript
// Add this to your browser console on your frontend
YALGExtensionBridge.sendAuthSuccess({
  accessToken: 'test-token-123',
  userId: 'user-123',
  email: 'test@example.com',
  name: 'Test User'
});
```

### 2. Check Extension Console
- Open Chrome DevTools
- Go to Extensions tab
- Find your YALG extension
- Check the console for logs like:
  ```
  FrontendAuthBridge: Received auth success
  TokenManager: Auth config saved successfully
  ```

### 3. Test Cookie Method
```javascript
// Set test cookies in browser console
document.cookie = 'accessToken=test-token-123; path=/';
document.cookie = 'userId=user-123; path=/';
```

## Troubleshooting

### Common Issues

#### "Extension not receiving auth data"
- **Check console**: Look for CORS errors or messaging failures
- **Verify origin**: Make sure your frontend domain is in the extension's allowed origins
- **Test cookies**: Try the cookie method as fallback

#### "Authentication not persisting"
- **Check token format**: Ensure `accessToken` and `userId` are provided
- **Verify API**: Extension validates tokens with `/users/me` endpoint
- **Check backend**: Make sure your backend accepts the token format

#### "Extension shows 'Not Connected'"
- **Reopen popup**: Close and reopen the extension popup
- **Check network**: Ensure backend is accessible
- **Manual refresh**: Click the "Refresh Connection" button

### Debug Information

#### Frontend Console
```javascript
// Check if messages are being sent
console.log('Sending auth to extension:', authData);
```

#### Extension Console
Look for these log messages:
```
FrontendAuthBridge: Received auth success
TokenManager: Auth config saved successfully
YALG Extension: User authenticated, updating UI
```

## Production Considerations

### 1. Extension ID
```javascript
// Development
static EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyz123456';

// Production - get from Chrome Web Store
static EXTENSION_ID = 'your-published-extension-id';
```

### 2. Domain Configuration
```javascript
// Update allowed origins in frontend-auth-bridge.js
static FRONTEND_ORIGINS = [
  'http://localhost:3400',      // Development
  'https://your-domain.com',    // Production
  'https://www.your-domain.com' // Production with www
];
```

### 3. Security
- Use HTTPS in production
- Validate token format before sending
- Don't log sensitive data in production
- Set appropriate cookie security flags

## Next.js Integration Example

```typescript
// hooks/useYALGExtension.ts
import { useEffect } from 'react';
import { useAuth } from './useAuth'; // Your auth hook

export function useYALGExtension() {
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Send auth success to extension
      YALGExtensionBridge.sendAuthSuccess({
        accessToken: token,
        userId: user.id,
        email: user.email,
        name: user.name
      });
    }
  }, [user, token]);

  useEffect(() => {
    if (!user) {
      // Send logout to extension
      YALGExtensionBridge.sendLogout();
    }
  }, [user]);
}

// app/layout.tsx
export default function RootLayout({ children }) {
  useYALGExtension(); // Initialize extension communication
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

That's it! Your frontend will now communicate seamlessly with the YALG extension for authentication. 