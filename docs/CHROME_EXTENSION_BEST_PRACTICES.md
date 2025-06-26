# Chrome Extension Best Practices Guide

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**
- **Content Scripts**: Only handle DOM manipulation and page interaction
- **Background Scripts**: Handle cross-tab communication, API calls, and data persistence
- **Popup Scripts**: Manage UI state and user interactions
- **Utility Modules**: Reusable functions and constants

### 2. **Modular Structure**
```
extension/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── background.js              # Main service worker
│   │   ├── api/
│   │   │   ├── apiClient.js          # API communication
│   │   │   └── endpoints.js          # API endpoints
│   │   ├── services/
│   │   │   ├── configService.js      # Configuration management
│   │   │   ├── messageService.js     # Message routing
│   │   │   └── syncService.js        # Sync logic
│   │   └── utils/
│   │       └── logger.js             # Logging utility
│   ├── content/
│   │   ├── content.js                # Main content script
│   │   ├── scrapers/
│   │   │   ├── linkedinScraper.js    # LinkedIn-specific scraping
│   │   │   └── baseScraper.js        # Base scraper class
│   │   ├── ui/
│   │   │   ├── progressOverlay.js    # Progress UI
│   │   │   └── uiComponents.js       # Reusable UI components
│   │   └── utils/
│   │       ├── domUtils.js           # DOM manipulation helpers
│   │       └── dataExtractor.js      # Data extraction utilities
│   ├── popup/
│   │   ├── popup.js                  # Main popup script
│   │   ├── components/
│   │   │   ├── statusCard.js         # Status display component
│   │   │   ├── progressBar.js        # Progress bar component
│   │   │   └── syncButton.js         # Sync button component
│   │   ├── services/
│   │   │   └── popupService.js       # Popup-specific services
│   │   └── utils/
│   │       └── formatters.js         # Data formatting utilities
│   ├── shared/
│   │   ├── constants.js              # Shared constants
│   │   ├── types.js                  # Type definitions/interfaces
│   │   ├── utils/
│   │   │   ├── storage.js            # Chrome storage wrapper
│   │   │   ├── messaging.js          # Message passing utilities
│   │   │   └── validator.js          # Input validation
│   │   └── config/
│   │       └── defaultConfig.js      # Default configuration
│   └── assets/
│       ├── css/
│       ├── icons/
│       └── html/
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

## 📋 Development Best Practices

### 1. **Manifest V3 Guidelines**
- Use service workers instead of background pages
- Implement proper permission scoping
- Use declarative net request for network modifications
- Handle service worker lifecycle properly

### 2. **Code Organization**
```javascript
// ✅ Good: Modular with clear responsibilities
class ApiClient {
  constructor(baseUrl, logger) {
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async makeRequest(endpoint, options) {
    // Implementation
  }
}

// ❌ Bad: Everything in one function
function handleEverything() {
  // API calls, DOM manipulation, error handling all mixed
}
```

### 3. **Error Handling**
```javascript
// ✅ Good: Centralized error handling
class ErrorHandler {
  static handle(error, context) {
    console.error(`[${context}]`, error);
    // Send to monitoring service
    // Show user-friendly message
  }
}

// ❌ Bad: Scattered try-catch blocks without proper handling
try {
  // Some operation
} catch (e) {
  console.log(e); // No context, no proper handling
}
```

### 4. **Message Passing**
```javascript
// ✅ Good: Typed message system
const MessageTypes = {
  START_SYNC: 'START_SYNC',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  SYNC_COMPLETE: 'SYNC_COMPLETE'
};

class MessageService {
  static send(type, data, target = 'background') {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
}

// ❌ Bad: Magic strings and no error handling
chrome.runtime.sendMessage({ type: 'some-action', data: {} });
```

### 5. **Storage Management**
```javascript
// ✅ Good: Abstracted storage with validation
class StorageService {
  static async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] ?? defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  }
}
```

## 🔒 Security Best Practices

### 1. **Content Security Policy**
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

### 2. **Permission Minimization**
```json
{
  "permissions": [
    "activeTab",        // Only when needed
    "storage"           // For configuration
  ],
  "host_permissions": [
    "*://*.linkedin.com/*"  // Specific domains only
  ]
}
```

### 3. **Input Validation**
```javascript
class Validator {
  static validateUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  static sanitizeHtml(html) {
    // Implement proper HTML sanitization
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}
```

## 📦 Build and Deployment

### 1. **Build System**
```javascript
// webpack.config.js
module.exports = {
  entry: {
    background: './src/background/background.js',
    content: './src/content/content.js',
    popup: './src/popup/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production'
  }
};
```

### 2. **Environment Configuration**
```javascript
// config/environment.js
const environments = {
  development: {
    apiBaseUrl: 'http://localhost:3000',
    debug: true
  },
  production: {
    apiBaseUrl: 'https://api.yalg.app',
    debug: false
  }
};

export default environments[process.env.NODE_ENV || 'development'];
```

## 🧪 Testing Strategies

### 1. **Unit Testing**
```javascript
// test/services/apiClient.test.js
describe('ApiClient', () => {
  it('should handle API errors gracefully', async () => {
    const client = new ApiClient('https://api.test.com');
    const result = await client.makeRequest('/invalid-endpoint');
    expect(result.error).toBeDefined();
  });
});
```

### 2. **Integration Testing**
```javascript
// test/integration/sync.test.js
describe('Sync Process', () => {
  it('should complete full sync workflow', async () => {
    // Mock LinkedIn page
    // Trigger sync
    // Verify API calls
    // Check final state
  });
});
```

## 📊 Performance Guidelines

### 1. **Memory Management**
- Clean up event listeners
- Remove DOM elements when done
- Avoid memory leaks in service workers

### 2. **Network Optimization**
- Batch API requests
- Implement retry logic with exponential backoff
- Use request debouncing

### 3. **DOM Performance**
- Minimize DOM queries
- Use DocumentFragment for bulk operations
- Implement virtual scrolling for large lists

## 🔍 Debugging and Monitoring

### 1. **Logging System**
```javascript
class Logger {
  static levels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  static log(level, message, data = {}) {
    if (level <= this.currentLevel) {
      console[level.toLowerCase()](`[YALG] ${message}`, data);
    }
  }
}
```

### 2. **Error Tracking**
```javascript
class ErrorTracker {
  static track(error, context) {
    // Send to external monitoring service
    // Store locally for debugging
    this.logError(error, context);
  }
}
```

## 📚 Documentation Standards

### 1. **Code Documentation**
```javascript
/**
 * Scrapes LinkedIn posts from the current page
 * @param {Object} options - Scraping configuration
 * @param {number} options.maxPosts - Maximum posts to scrape
 * @param {boolean} options.includeImages - Whether to include images
 * @returns {Promise<Array>} Array of scraped post objects
 */
async function scrapePosts(options = {}) {
  // Implementation
}
```

### 2. **API Documentation**
- Document all message types
- Specify data formats
- Include error codes and handling

## 🚀 Deployment Checklist

- [ ] All permissions justified and minimal
- [ ] CSP properly configured
- [ ] Icons in all required sizes (16, 48, 128)
- [ ] Privacy policy linked
- [ ] Error handling comprehensive
- [ ] Performance tested
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Store listing prepared

## 🔄 Maintenance Guidelines

### 1. **Regular Updates**
- Monitor Chrome extension API changes
- Update dependencies regularly
- Test across Chrome versions

### 2. **User Feedback Integration**
- Monitor Chrome Web Store reviews
- Implement analytics for feature usage
- Regular UX improvements

### 3. **Code Quality**
- Regular code reviews
- Automated testing in CI/CD
- Performance monitoring
- Security audits

---

**Remember**: Chrome extensions have unique constraints and capabilities. Always refer to the latest Chrome Extension documentation and test thoroughly across different scenarios. 