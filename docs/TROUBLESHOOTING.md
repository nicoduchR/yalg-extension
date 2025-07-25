# YALG Extension Troubleshooting Guide

## Problem: "Extension not installed" even though extension is loaded

### Quick Diagnosis Steps

1. **Check if the extension is properly loaded:**
   - Go to `chrome://extensions/`
   - Look for "YALG - LinkedIn Post Sync"
   - Make sure it's **enabled** (toggle switch is ON)
   - Note the Extension ID

2. **Test communication directly:**
   - Open the simplified test: `http://localhost:8080/test-simple.html`
   - Click "Test Basic Connection" - should show Chrome APIs are available
   - Click "Test Extension Check" - this is where the issue likely occurs

### Common Issues & Solutions

#### Issue 1: Extension not receiving messages
**Symptoms:** "Could not establish connection" error

**Solution:**
```bash
# 1. Reload the extension
Go to chrome://extensions/ → Click the reload button on YALG extension

# 2. Check extension background script
Go to chrome://extensions/ → Click "service worker" link under YALG extension → Check for errors in console
```

#### Issue 2: Wrong URL/Domain restrictions
**Symptoms:** Messages not reaching extension from your test page

**Solution:**
Make sure you're testing from `http://localhost:8080` not `file://`

```bash
# Start local server (if not already running)
cd yalg-extension
python -m http.server 8080

# Then visit: http://localhost:8080/test-simple.html
```

#### Issue 3: Manifest externally_connectable issues
**Symptoms:** Extension loads but doesn't respond to messages

**Check your manifest.json has:**
```json
{
  "externally_connectable": {
    "matches": [
      "http://localhost:*/*",
      "https://*.yalg.app/*",
      "file://*/*"
    ],
    "ids": ["*"]
  }
}
```

#### Issue 4: Background script not running
**Symptoms:** Extension appears loaded but unresponsive

**Solution:**
1. Go to `chrome://extensions/`
2. Find YALG extension
3. Click "service worker" (if it says "inactive", click it to activate)
4. Check console for errors

### Step-by-Step Debugging

1. **Test Chrome APIs availability:**
   ```javascript
   // In browser console
   console.log('Chrome available:', !!window.chrome);
   console.log('Runtime available:', !!window.chrome.runtime);
   ```

2. **Test direct message sending:**
   ```javascript
   // In browser console
   chrome.runtime.sendMessage({ type: 'CHECK_EXTENSION' }, (response) => {
     if (chrome.runtime.lastError) {
       console.error('Error:', chrome.runtime.lastError.message);
     } else {
       console.log('Response:', response);
     }
   });
   ```

3. **Check extension background script:**
   - Go to `chrome://extensions/`
   - Click "service worker" under YALG extension
   - Look for console messages when you send test messages

### Extension Loading Checklist

- [ ] Extension folder contains all required files
- [ ] manifest.json is valid JSON (no syntax errors)
- [ ] background.js loads without errors
- [ ] Extension is enabled in chrome://extensions/
- [ ] Testing from http://localhost (not file://)
- [ ] No blocking browser security settings

### Testing Environment Setup

1. **Ensure backend is running:**
   ```bash
   cd yalg-backend
   npm run start:dev
   # Should show: Application is running on port 3000
   ```

2. **Serve test files via HTTP:**
   ```bash
   cd yalg-extension
   python -m http.server 8080
   # Visit: http://localhost:8080/test-simple.html
   ```

3. **Extension development mode:**
   - Chrome → Settings → Extensions → Developer mode ON
   - Load unpacked → Select yalg-extension folder

### Expected Working Flow

1. ✅ Chrome APIs available
2. ✅ Extension loaded and enabled
3. ✅ Message sent to extension: `{ type: 'CHECK_EXTENSION' }`
4. ✅ Extension background.js receives message
5. ✅ Extension responds: `{ installed: true, version: "1.0.0" }`
6. ✅ Frontend receives response

### If Nothing Works

1. **Create minimal test extension:**
   ```json
   // minimal-manifest.json
   {
     "manifest_version": 3,
     "name": "Test Extension",
     "version": "1.0",
     "background": { "service_worker": "minimal-background.js" },
     "externally_connectable": { "matches": ["http://localhost:*/*"] }
   }
   ```

   ```javascript
   // minimal-background.js
   chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
     console.log('Received:', message);
     sendResponse({ success: true });
   });
   ```

2. **Test minimal extension first** to isolate the issue

### Get Help

If you're still stuck:
1. Check browser console for errors
2. Check extension service worker console for errors
3. Test with the minimal extension above
4. Compare what's different in your setup 