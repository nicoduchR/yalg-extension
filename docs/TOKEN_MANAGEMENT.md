# YALG Extension Token Management

This document explains the new token management system implemented for the YALG Chrome extension.

## Features

### 🔄 Automatic Token Validation
- **Periodic Checks**: Tokens are validated every 5 minutes automatically
- **On-Demand Validation**: Token is checked every time the popup is opened
- **Smart Caching**: Recently validated tokens (within 5 minutes) skip re-validation for performance

### 🔐 Authentication Flow
1. **Initial Check**: When popup opens, extension checks for stored authentication
2. **Cookie Fallback**: If no stored auth, tries to extract tokens from frontend cookies
3. **API Validation**: Tests tokens against the backend `/users/me` endpoint
4. **Status Display**: Shows appropriate UI based on authentication state

### 🔧 Connection States

#### ✅ Connected
- Green status indicator
- "Connected to YALG" message
- Dashboard link visible
- All features enabled

#### ❌ Not Connected (Needs Login)
- Red status indicator
- "Connect to YALG" button displayed
- Clear error message about expired authentication
- Features disabled until authentication

#### ⚠️ Network Issues
- Red status indicator
- "Refresh Connection" button displayed
- Features may work if auth cache is valid
- Allows manual retry without forcing new login

### 🚀 User Actions

#### Connect to YALG Button
- Opens YALG frontend login page in new tab
- Automatically monitors for successful authentication
- Updates popup UI when login is detected
- Provides clear feedback during the process

#### Refresh Connection Button
- Manually re-checks authentication status
- Useful when network issues are resolved
- Shows loading state during check
- Automatically updates UI based on results

#### Auto-Detection
- Popup automatically rechecks auth when it gains focus
- Useful when user logs in and returns to extension
- No manual action needed for seamless experience

## Technical Implementation

### TokenManagerWrapper Class
- **Centralized Authentication**: Single source of truth for auth state
- **API Integration**: Direct validation with backend
- **Cookie Management**: Automatic extraction from frontend
- **Storage Management**: Unified auth config storage

### Authentication Storage
- **Primary Storage**: `auth_config` key with full authentication data
- **Legacy Support**: Maintains compatibility with old `config` format
- **Automatic Migration**: Seamlessly upgrades old configurations

### Security Features
- **Token Expiry Handling**: Automatic cleanup of invalid tokens
- **Secure Storage**: Tokens stored in Chrome's secure storage
- **Domain Isolation**: Cookie access limited to YALG domains
- **Silent Validation**: Background checks don't interrupt user flow

## Developer Usage

### Checking Authentication
```javascript
const authStatus = await TokenManagerWrapper.getAuthStatus();
if (authStatus.isAuthenticated) {
  // User is authenticated
  const config = authStatus.config;
  // Use config.authToken, config.userId, etc.
} else {
  // Handle unauthenticated state
  if (authStatus.needsLogin) {
    // Show login button
  } else {
    // Show refresh button (network error)
  }
}
```

### Opening Login Page
```javascript
await TokenManagerWrapper.openLoginPage();
```

### Manual Token Validation
```javascript
const validation = await TokenManagerWrapper.validateToken();
if (validation.success) {
  // Token is valid
} else {
  // Handle invalid token
}
```

## Configuration

### Frontend URLs
- **Development**: `http://localhost:3400`
- **Production**: Configurable via extension settings
- **Login Path**: `/login?ext=true` (extension flag for tracking)

### Backend URLs
- **Development**: `http://localhost:3000`
- **Production**: Configurable via extension settings
- **Validation Endpoint**: `/users/me`

### Timings
- **Validation Interval**: 5 minutes
- **Cache Duration**: 5 minutes
- **Login Check Frequency**: Every 10 seconds (for 2 minutes)
- **Max Login Checks**: 12 attempts

## Troubleshooting

### Common Issues

#### "Not connected to YALG"
- **Cause**: No authentication token found
- **Solution**: Click "Connect to YALG" button and log in

#### "Authentication expired"
- **Cause**: Token is invalid or expired
- **Solution**: Click "Connect to YALG" button to re-authenticate

#### "Connection issue"
- **Cause**: Network error or backend unavailable
- **Solution**: Click "Refresh Connection" or check network connectivity

#### Features not working after login
- **Cause**: Popup hasn't detected authentication yet
- **Solution**: Close and reopen popup, or click "Refresh Connection"

### Debug Information
- All authentication events are logged to browser console
- Look for "TokenManager:" prefixed log messages
- Storage can be inspected in Chrome DevTools > Extension > Storage

## Migration Notes

### From Previous Version
- Old `config` storage format is automatically migrated
- No user action required for existing installations
- Both storage formats maintained during transition period

### Future Compatibility
- New `auth_config` format designed for extensibility
- Additional authentication methods can be easily added
- Token refresh and other advanced features ready for implementation 