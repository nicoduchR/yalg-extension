/**
 * Frontend Authentication Bridge
 * Handles communication between YALG frontend and extension for authentication
 */

// Helper function to get URLs with fallbacks
function getURL(urlKey, fallback) {
  return window.YALG_URLS?.[urlKey] || fallback;
}

export class FrontendAuthBridge {
  static MESSAGE_TYPES = {
    AUTH_REQUEST: 'YALG_AUTH_REQUEST',
    AUTH_RESPONSE: 'YALG_AUTH_RESPONSE',
    AUTH_SUCCESS: 'YALG_AUTH_SUCCESS',
    AUTH_LOGOUT: 'YALG_AUTH_LOGOUT'
  };

  static get FRONTEND_ORIGINS() {
    return getURL('ALLOWED_ORIGINS', ['http://localhost:3400', 'https://localhost:3400']);
  }

  /**
   * Initialize the bridge - sets up listeners
   */
  static initialize() {
    // Listen for messages from frontend
    window.addEventListener('message', this.handleFrontendMessage.bind(this));
    
    // Listen for extension messages (for background script)
    if (chrome?.runtime?.onMessageExternal) {
      chrome.runtime.onMessageExternal.addListener(this.handleExternalMessage.bind(this));
    }
  }

  /**
   * Handle messages from frontend via PostMessage
   */
  static async handleFrontendMessage(event) {
    // Verify origin
    if (!this.FRONTEND_ORIGINS.includes(event.origin)) {
      return;
    }

    const { type, data } = event.data || {};
    
    switch (type) {
      case this.MESSAGE_TYPES.AUTH_SUCCESS:
        await this.handleAuthSuccess(data);
        break;
      case this.MESSAGE_TYPES.AUTH_LOGOUT:
        await this.handleAuthLogout();
        break;
    }
  }

  /**
   * Handle external messages from frontend (for background script)
   */
  static async handleExternalMessage(message, sender, sendResponse) {
    const { type, data } = message || {};
    
    switch (type) {
      case this.MESSAGE_TYPES.AUTH_SUCCESS:
        await this.handleAuthSuccess(data);
        sendResponse({ success: true });
        break;
      case this.MESSAGE_TYPES.AUTH_LOGOUT:
        await this.handleAuthLogout();
        sendResponse({ success: true });
        break;
      case this.MESSAGE_TYPES.AUTH_REQUEST:
        const authStatus = await this.getAuthStatus();
        sendResponse(authStatus);
        break;
    }
    
    return true; // Keep message channel open
  }

  /**
   * Handle successful authentication from frontend
   */
  static async handleAuthSuccess(authData) {
    try {
      console.log('FrontendAuthBridge: Received auth success', { userId: authData?.userId });
      
      if (!authData || !authData.accessToken || !authData.userId) {
        console.error('FrontendAuthBridge: Invalid auth data received', authData);
        return;
      }

      // Import TokenManager dynamically to avoid circular dependencies
      const { TokenManager } = await import('./token-manager.js');
      
      // Convert frontend auth data to extension format
      const authConfig = {
        authToken: authData.accessToken,
        userId: authData.userId,
        frontendUrl: authData.frontendUrl || getURL('FRONTEND_BASE', 'http://localhost:3400'),
        backendUrl: authData.backendUrl || getURL('BACKEND_BASE', 'http://localhost:3000'),
        tokenExpiry: authData.expiresAt || null,
        userEmail: authData.email || null,
        userName: authData.name || null
      };

      // Save authentication configuration
      await TokenManager.setAuthConfig(authConfig);
      
      console.log('FrontendAuthBridge: Auth config saved successfully');
      
      // Notify popup if it's open
      this.notifyPopup('AUTH_SUCCESS', authConfig);
      
    } catch (error) {
      console.error('FrontendAuthBridge: Error handling auth success', error);
    }
  }

  /**
   * Handle logout from frontend
   */
  static async handleAuthLogout() {
    try {
      console.log('FrontendAuthBridge: Received logout signal');
      
      // Import TokenManager dynamically
      const { TokenManager } = await import('./token-manager.js');
      
      // Clear authentication
      await TokenManager.clearAuthConfig();
      
      console.log('FrontendAuthBridge: Auth cleared successfully');
      
      // Notify popup if it's open
      this.notifyPopup('AUTH_LOGOUT');
      
    } catch (error) {
      console.error('FrontendAuthBridge: Error handling logout', error);
    }
  }

  /**
   * Request authentication status from frontend
   */
  static async requestAuthFromFrontend() {
    try {
      // Try each frontend origin
      for (const origin of this.FRONTEND_ORIGINS) {
        try {
          // Get all tabs that match this origin
          const tabs = await chrome.tabs.query({ url: `${origin}/*` });
          
          for (const tab of tabs) {
            // Send auth request to the tab
            await chrome.tabs.sendMessage(tab.id, {
              type: this.MESSAGE_TYPES.AUTH_REQUEST,
              source: 'YALG_EXTENSION'
            });
          }
        } catch (error) {
          // Tab might not have content script, continue
          console.debug(`FrontendAuthBridge: Could not reach ${origin}`, error);
        }
      }
    } catch (error) {
      console.warn('FrontendAuthBridge: Error requesting auth from frontend', error);
    }
  }

  /**
   * Get current auth status
   */
  static async getAuthStatus() {
    try {
      // Import TokenManager dynamically
      const { TokenManager } = await import('./token-manager.js');
      return await TokenManager.getAuthStatus();
    } catch (error) {
      console.error('FrontendAuthBridge: Error getting auth status', error);
      return {
        isAuthenticated: false,
        status: 'error',
        message: 'Failed to check authentication',
        needsLogin: true
      };
    }
  }

  /**
   * Notify popup of authentication changes
   */
  static notifyPopup(eventType, data = null) {
    try {
      chrome.runtime.sendMessage({
        type: 'AUTH_EVENT',
        eventType,
        data
      });
    } catch (error) {
      // Popup might not be open, that's OK
      console.debug('FrontendAuthBridge: Could not notify popup', error);
    }
  }

  /**
   * Updated cookie method with correct cookie name
   */
  static async tryGetConfigFromCookies() {
    try {
      const frontendUrl = getURL('FRONTEND_BASE', 'http://localhost:3400'); // Your frontend URL
      const domain = new URL(frontendUrl).hostname;
      
      console.log('FrontendAuthBridge: Checking cookies for domain:', domain);
      
      // Get all cookies from the frontend domain
      const cookies = await chrome.cookies.getAll({ domain });
      
      console.log('FrontendAuthBridge: Found cookies:', cookies.map(c => c.name));
      
      // Look for your specific cookie names
      const accessTokenCookie = cookies.find(c => c.name === 'accessToken');
      const userIdCookie = cookies.find(c => c.name === 'userId' || c.name === 'user_id');
      
      if (accessTokenCookie) {
        console.log('FrontendAuthBridge: Found accessToken cookie');
        
        // Create auth config from cookies
        const authConfig = {
          authToken: accessTokenCookie.value,
          userId: userIdCookie?.value || 'unknown',
          frontendUrl,
          backendUrl: getURL('BACKEND_BASE', 'http://localhost:3000')
        };
        
        // Import TokenManager and test the configuration
        const { TokenManager } = await import('./token-manager.js');
        const validation = await TokenManager.testConfigConnection(authConfig);
        
        if (validation.success) {
          console.log('FrontendAuthBridge: Cookie auth config is valid');
          return authConfig;
        } else {
          console.log('FrontendAuthBridge: Cookie auth config is invalid');
        }
      } else {
        console.log('FrontendAuthBridge: No accessToken cookie found');
      }
    } catch (error) {
      console.warn('FrontendAuthBridge: Could not retrieve auth from cookies', error);
    }
    
    return null;
  }
} 