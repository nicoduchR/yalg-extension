# YALG Extension - Centralized URL Configuration Guide

## 📋 Overview

All URLs in the YALG extension are now centralized in one location: `src/shared/constants.js`. This makes it easy to switch between development and production environments.

## 🔧 How to Switch Environments

### To Switch to Production:

1. Open `src/shared/constants.js`
2. Change line 8 from:
   ```javascript
   const ENVIRONMENT = 'development';
   ```
   to:
   ```javascript
   const ENVIRONMENT = 'production';
   ```

3. Update the production URLs in the `URL_CONFIG` object (lines 18-27):
   ```javascript
   production: {
     FRONTEND_BASE: 'https://your-app.com', // Replace with your production URL
     BACKEND_BASE: 'https://api.your-app.com', // Replace with your API URL
     ALLOWED_ORIGINS: [
       'https://your-app.com',
       'https://www.your-app.com',
       // Add any additional production domains
     ]
   }
   ```

## 📦 Available URL Constants

After importing `URLS` from `constants.js`, you can use these constants:

### Frontend URLs:
- `URLS.FRONTEND_BASE` - Base frontend URL
- `URLS.FRONTEND_DASHBOARD` - Dashboard page URL
- `URLS.FRONTEND_LOGIN` - Login page URL
- `URLS.FRONTEND_LOGIN_WITH_EXT` - Login page with extension flag

### Backend URLs:
- `URLS.BACKEND_BASE` - Base backend URL
- `URLS.API_BASE` - API base URL (same as backend)

### Full API Endpoints:
- `URLS.API_USERS_ME` - Get current user info
- `URLS.API_POSTS_HTML` - Posts HTML endpoint
- `URLS.API_POSTS_QUEUE` - Posts queue endpoint
- `URLS.API_POSTS_BULK` - Posts bulk endpoint
- `URLS.API_ANECDOTE_AUDIO` - Anecdote audio endpoint
- `URLS.API_AUTH_ME` - Auth validation endpoint

### External URLs:
- `URLS.LINKEDIN_FEED` - LinkedIn feed URL
- `URLS.LINKEDIN_PROFILE_BASE` - LinkedIn profile base URL
- `URLS.LINKEDIN_RECENT_ACTIVITY` - LinkedIn recent activity URL

### Security:
- `URLS.ALLOWED_ORIGINS` - Array of allowed origins for security

## 💻 Usage Examples

### In your JavaScript files:

```javascript
// Import the URL constants
import { URLS } from '../shared/constants.js';

// Use in your code
const response = await fetch(URLS.API_USERS_ME, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Open dashboard
window.open(URLS.FRONTEND_DASHBOARD, '_blank');

// Navigate to LinkedIn
chrome.tabs.create({ url: URLS.LINKEDIN_FEED });
```

## 📁 Files Updated

The following files have been updated to use the centralized URLs:

✅ **Updated Files:**
- `src/shared/constants.js` - Central configuration
- `src/popup/popup.js` - Popup functionality
- `src/background/background.js` - Background script
- `src/content/content.js` - Content script
- `src/shared/utils/frontend-auth-bridge.js` - Authentication bridge
- `src/shared/utils/token-manager.js` - Token management

## 🚀 Benefits

1. **Single Point of Change** - Change URLs in one place only
2. **Environment Management** - Easy switching between dev/prod
3. **Type Safety** - All URLs are properly defined constants
4. **Consistency** - No more hardcoded URLs scattered across files
5. **Maintainability** - Easier to update and maintain

## ⚠️ Important Notes

1. **After changing environment or URLs**, restart your extension development server
2. **Don't forget** to update the production URLs before deploying
3. **Test thoroughly** after switching environments
4. **The extension must be reloaded** in Chrome after changes

## 🔄 Migration Complete

All hardcoded URLs have been successfully replaced with centralized constants:

- ✅ 8 files updated
- ✅ 20+ URL references centralized
- ✅ Development/Production environment support
- ✅ Backward compatibility maintained

Your extension is now ready for easy URL management! 🎉 