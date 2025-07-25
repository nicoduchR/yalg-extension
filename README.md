# YALG - LinkedIn Post Sync Chrome Extension

A modern Chrome extension that seamlessly syncs your LinkedIn posts with the YALG platform. Built with a clean, modular architecture following Chrome Manifest V3 standards.

## 🚀 Features

- **🔄 One-Click Sync**: Automatically extracts and imports your LinkedIn posts
- **🎯 Smart Filtering**: Only imports original posts (filters out likes, shares, comments)
- **🎤 Voice Anecdotes**: Record and upload voice anecdotes directly from the extension
- **📊 Real-time Progress**: Live progress tracking with detailed statistics
- **🔐 Secure Authentication**: Automatic token detection from YALG frontend
- **🎨 Modern UI**: YALG-branded interface with professional design
- **⚡ High Performance**: Modular architecture with optimized resource usage

## 📁 Architecture Overview

The extension follows a modern, modular architecture:

```
yalg-extension/
├── manifest.json                 # Chrome Extension Manifest V3
├── src/
│   ├── shared/
│   │   ├── constants.js          # Centralized configuration
│   │   └── utils/                # Shared utilities
│   ├── background/               # Service Worker
│   │   ├── background.js         # Main service worker
│   │   ├── api/apiClient.js      # HTTP API client
│   │   └── services/             # Background services
│   ├── content/                  # Content Scripts
│   │   ├── content.js            # Main orchestrator
│   │   └── modules/              # Specialized modules
│   └── popup/                    # Extension UI
│       ├── popup.html            # Modern popup interface
│       └── popup.js              # Popup logic
├── icons/                        # Extension icons
└── docs/                         # Documentation
```

## 🛠️ Installation & Setup

### 1. Development Setup

1. **Clone the repository**:
   ```bash
   git clone [repository-url]
   cd yalg-extension
   ```

2. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `yalg-extension` folder

3. **Configure environment**:
   - Edit `src/shared/constants.js`
   - Set `ENVIRONMENT` to `'development'` or `'production'`
   - Update URLs for your YALG frontend and backend

### 2. Production Deployment

For production deployment to Chrome Web Store:

1. **Update configuration**:
   ```javascript
   // In src/shared/constants.js
   const ENVIRONMENT = 'production';
   ```

2. **Update URLs**:
   ```javascript
   production: {
     FRONTEND_BASE: 'https://your-yalg-domain.com',
     BACKEND_BASE: 'https://your-api-domain.com'
   }
   ```

3. **Create extension package**:
   - Zip the entire `yalg-extension` folder
   - Upload to Chrome Web Store Developer Console

## 🔧 Configuration

### Environment Variables

The extension uses environment-based configuration in `src/shared/constants.js`:

```javascript
const URL_CONFIG = {
  development: {
    FRONTEND_BASE: 'http://localhost:3400',
    BACKEND_BASE: 'http://localhost:3000'
  },
  production: {
    FRONTEND_BASE: 'https://yalg.app',
    BACKEND_BASE: 'https://api.yalg.app'
  }
};
```

### Required API Endpoints

Your YALG backend must implement these endpoints:

- `GET /users/me` - User authentication validation
- `POST /posts/html` - Single post processing
- `POST /posts/queue` - Batch post queuing
- `POST /anecdote/audio` - Voice anecdote upload

## 🔄 How It Works

### 1. Authentication Flow
1. User logs into YALG frontend
2. Extension automatically detects authentication tokens
3. Tokens are validated against YALG backend
4. Extension shows "Connected" status

### 2. Sync Process
1. User clicks "Sync Posts" in extension popup
2. Extension navigates to LinkedIn profile activity page
3. Content scraper collects post HTML elements
4. Posts are processed and sent to YALG API in batches
5. Real-time progress updates shown in overlay
6. Completion notification with statistics

### 3. Voice Anecdotes
1. User clicks "Record Anecdote" button
2. Browser requests microphone permission
3. Audio recorded and processed locally
4. Uploaded to YALG backend with auto-fill enabled

## 🎨 User Interface

### Extension Popup
- **Connection Status**: Real-time API connectivity indicator
- **Quick Actions**: One-click sync and anecdote recording
- **Progress Tracking**: Live updates during sync process
- **Dashboard Link**: Direct access to YALG web application

### LinkedIn Overlay
- **Progress Bar**: Visual sync progress with statistics
- **Statistics Grid**: Collected/Queued/Failed post counts
- **Error Handling**: User-friendly error messages
- **Completion Notification**: Success confirmation with results

## 🔐 Security & Privacy

### Data Protection
- **No Credential Storage**: Extension doesn't store LinkedIn passwords
- **Secure Token Management**: Uses Chrome's secure storage API
- **HTTPS Only**: All API communications use HTTPS
- **Minimal Permissions**: Only requests necessary Chrome permissions

### Chrome Permissions
- `activeTab`: Access LinkedIn when sync is active
- `scripting`: Inject content scripts for post collection
- `storage`: Store configuration securely
- `tabs`: Navigate to LinkedIn for sync process
- `cookies`: Read authentication cookies from YALG frontend

## 🔗 Frontend Integration

### Automatic Token Detection

The extension automatically detects authentication from your YALG frontend. No additional integration required if you store tokens in cookies.

### Manual Integration (Optional)

For advanced integration, send authentication data directly:

```javascript
// In your YALG frontend
window.postMessage({
  type: 'YALG_AUTH_SUCCESS',
  data: {
    accessToken: 'user-token',
    userId: 'user-id',
    email: 'user@example.com'
  }
}, window.location.origin);
```

## 🐛 Troubleshooting

### Common Issues

1. **"Not connected to YALG" Error**:
   - Ensure you're logged into YALG frontend
   - Check that backend API is accessible
   - Verify extension permissions are granted

2. **LinkedIn Sync Fails**:
   - Ensure you're logged into LinkedIn
   - Check that LinkedIn profile is accessible
   - Try refreshing the LinkedIn page

3. **Voice Recording Not Working**:
   - Grant microphone permissions when prompted
   - Ensure HTTPS is used for security requirements
   - Check browser compatibility (Chrome/Edge recommended)

### Debug Information

Enable debug logging by setting:
```javascript
// In browser console
localStorage.setItem('YALG_DEBUG', 'true');
```

## 📊 Performance

### Metrics
- **Fast Loading**: Modular architecture with code splitting
- **Memory Efficient**: Proper cleanup and lifecycle management
- **Network Optimized**: Batch processing and retry logic
- **CPU Friendly**: Non-blocking async operations

### Resource Usage
- **Content Script**: ~2MB total (loaded as needed)
- **Service Worker**: ~1MB (persistent but lightweight) 
- **Popup Interface**: ~500KB (loaded on demand)

## 🔄 API Integration

### Expected Response Formats

#### POST /posts/html
```json
{
  "success": true,
  "message": "Post processed successfully"
}
```

#### POST /posts/queue
```json
{
  "success": true,
  "queued": 5,
  "message": "Posts queued for processing"
}
```

#### POST /anecdote/audio
```json
{
  "success": true,
  "anecdoteId": "uuid",
  "message": "Anecdote uploaded successfully"
}
```

## 📖 Documentation

For detailed documentation, see the `docs/` directory:

- `ARCHITECTURE_ANALYSIS.md` - Detailed architecture overview
- `TOKEN_MANAGEMENT.md` - Authentication system documentation
- `FRONTEND_INTEGRATION.md` - Frontend integration guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the modular architecture patterns
4. Test thoroughly in both development and production environments
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues or questions:
- Create a GitHub issue for bugs or feature requests
- Check the documentation in the `docs/` directory
- Email: support@yalg.app

---

**🚀 Built with modern web technologies and Chrome extension best practices for a seamless LinkedIn integration experience.**