# YALG Extension Testing Guide (No Authentication)

## Quick Start Testing

Since your API doesn't require authentication yet, testing is much simpler! Here's how to test the extension:

### 1. Setup Your Backend
Make sure your NestJS backend is running:
```bash
cd yalg-backend
npm run start:dev
```

Your API should be accessible at `http://localhost:3000`

### 2. Load the Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `yalg-extension` folder
6. Note the extension ID that appears

### 3. Test the Extension

#### Option A: Use the Test Page
1. Open `yalg-extension/index.html` in Chrome
2. Click the test buttons:
   - **Check Extension**: Verifies the extension is loaded
   - **Start Sync (No Auth)**: Starts the LinkedIn sync process
   - **Test Full Workflow**: Tests the complete user flow

#### Option B: Test in Your Frontend
Add this to any page in your application:

```html
<script src="path/to/frontend-integration.js"></script>
<script>
const yalg = new YALGExtensionIntegration({ debug: true });

// Test button
document.getElementById('sync-btn').onclick = async () => {
  const result = await yalg.initiateSyncWorkflowNoAuth('test-user-123', {
    apiBaseUrl: 'http://localhost:3000/api',
    onExtensionNotInstalled: () => {
      alert('Please install the YALG Chrome extension');
    },
    onSyncStarted: (result) => {
      console.log('Sync started:', result);
    }
  });
};
</script>
```

### 4. What Happens During Testing

1. **Extension Check**: Verifies the extension is installed
2. **LinkedIn Navigation**: Opens/navigates to LinkedIn feed
3. **Profile Detection**: Finds your LinkedIn profile automatically
4. **Post Extraction**: Scrapes your original posts (not likes/shares)
5. **API Upload**: Sends posts to your backend via POST `/api/posts/bulk`

### 5. Expected Test Data

The extension will create posts with this structure:
```json
{
  "userId": "test-user-123",
  "posts": [
    {
      "content": "Your LinkedIn post content...",
      "timestamp": "2024-01-15T10:30:00Z",
      "linkedInUrl": "https://linkedin.com/posts/...",
      "images": ["image_url"],
      "videos": ["video_url"]
    }
  ]
}
```

### 6. Testing Checklist

- [ ] Extension loads without errors
- [ ] `checkExtensionInstalled()` returns `true`
- [ ] Extension can navigate to LinkedIn
- [ ] Posts are extracted correctly
- [ ] API receives post data
- [ ] Backend creates posts in database
- [ ] Duplicate posts are skipped

### 7. Debugging

Enable debug mode:
```javascript
const yalg = new YALGExtensionIntegration({ debug: true });
```

Check browser console for:
- Extension communication messages
- API request/response logs
- Scraping progress updates

### 8. Common Issues

**Extension not detected:**
- Make sure it's loaded in Chrome extensions
- Check the extension ID matches in manifest.json

**LinkedIn navigation fails:**
- Make sure you're logged into LinkedIn
- Check if LinkedIn is blocking automated navigation

**API errors:**
- Verify backend is running on port 3000
- Check CORS settings if testing from different domain
- Look at Network tab for failed requests

**No posts found:**
- Make sure you have original posts on your LinkedIn profile
- Extension only scrapes posts you authored, not likes/shares

### 9. Production Readiness

When ready for production:
1. Add authentication tokens to the API calls
2. Update the extension manifest for production domains
3. Package and submit to Chrome Web Store
4. Update frontend integration to use auth tokens 