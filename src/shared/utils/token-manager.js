/**
 * Token Management Service for YALG Extension
 * Handles authentication, token validation, and refresh logic
 */

import { StorageService } from './storage.js';
import { Logger } from './logger.js';

// Helper function to get URLs with fallbacks
function getURL(urlKey, fallback) {
  return window.YALG_URLS?.[urlKey] || fallback;
}

export class TokenManager {
  static STORAGE_KEY = 'auth_config';
  static TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  static TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes before expiry

  /**
   * Initialize token manager
   */
  static async initialize() {
    Logger.info('TokenManager: Initializing token manager');
    
    // Set up periodic token validation
    this.startTokenValidation();
  }

  /**
   * Set authentication configuration
   * @param {Object} config - Auth config with token, userId, etc.
   */
  static async setAuthConfig(config) {
    try {
      const authConfig = {
        authToken: config.authToken,
        userId: config.userId,
        frontendUrl: config.frontendUrl || getURL('FRONTEND_BASE', 'http://localhost:3400'),
        backendUrl: config.backendUrl || getURL('BACKEND_BASE', 'http://localhost:3000'),
        tokenExpiry: config.tokenExpiry || null,
        lastValidated: Date.now()
      };

      await StorageService.set(this.STORAGE_KEY, authConfig);
      Logger.info('TokenManager: Auth config saved', { userId: authConfig.userId });
      return true;
    } catch (error) {
      Logger.error('TokenManager: Failed to save auth config', error);
      return false;
    }
  }

  /**
   * Get current authentication configuration
   * @returns {Promise<Object|null>} Auth config or null if not authenticated
   */
  static async getAuthConfig() {
    try {
      const config = await StorageService.get(this.STORAGE_KEY);
      return config;
    } catch (error) {
      Logger.error('TokenManager: Failed to get auth config', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} True if authenticated
   */
  static async isAuthenticated() {
    const config = await this.getAuthConfig();
    return !!(config && config.authToken && config.userId);
  }

  /**
   * Validate current token with backend
   * @param {boolean} silent - If true, don't log errors for failed validation
   * @returns {Promise<Object>} Validation result with success status and user data
   */
  static async validateToken(silent = false) {
    try {
      const config = await this.getAuthConfig();
      
      if (!config || !config.authToken) {
        return { success: false, error: 'No token available', needsLogin: true };
      }

      // Make API call to validate token
      const apiUrl = getURL('API_USERS_ME', `${config.backendUrl}/users/me`);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Update last validated timestamp
        await this.updateLastValidated();
        
        if (!silent) {
          Logger.info('TokenManager: Token validated successfully', { userId: userData.id });
        }
        
        return { 
          success: true, 
          userData,
          needsLogin: false 
        };
      } else if (response.status === 401 || response.status === 403) {
        // Token is invalid/expired
        if (!silent) {
          Logger.warn('TokenManager: Token validation failed - unauthorized', { status: response.status });
        }
        
        // Clear invalid token
        await this.clearAuthConfig();
        
        return { 
          success: false, 
          error: 'Token expired or invalid', 
          needsLogin: true,
          status: response.status 
        };
      } else {
        // Other API error
        const error = `API error: ${response.status}`;
        if (!silent) {
          Logger.error('TokenManager: Token validation failed', { status: response.status });
        }
        
        return { 
          success: false, 
          error,
          needsLogin: false // Don't force login for API errors
        };
      }
    } catch (error) {
      if (!silent) {
        Logger.error('TokenManager: Token validation error', error);
      }
      
      return { 
        success: false, 
        error: error.message || 'Network error',
        needsLogin: false // Don't assume login needed for network errors
      };
    }
  }

  /**
   * Try to get authentication config from frontend (cookies + bridge)
   * @returns {Promise<Object|null>} Auth config from frontend or null
   */
  static async tryGetConfigFromFrontend() {
    try {
      // First try the new bridge system
      const { FrontendAuthBridge } = await import('./frontend-auth-bridge.js');
      await FrontendAuthBridge.requestAuthFromFrontend();
      
      // Give frontend a moment to respond
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we got auth data
      const authStatus = await this.getAuthStatus();
      if (authStatus.isAuthenticated) {
        Logger.info('TokenManager: Successfully retrieved auth via bridge');
        return authStatus.config;
      }
      
      // Fallback to cookies with correct cookie names
      const config = await this.getAuthConfig();
      const frontendUrl = config?.frontendUrl || getURL('FRONTEND_BASE', 'http://localhost:3400');
      
      // Try to get cookies from the frontend domain
      const cookies = await chrome.cookies.getAll({ 
        domain: new URL(frontendUrl).hostname 
      });
      
      Logger.info('TokenManager: Checking cookies', { 
        domain: new URL(frontendUrl).hostname,
        cookieCount: cookies.length,
        cookieNames: cookies.map(c => c.name)
      });
      
      // Look for your specific cookie names (accessToken instead of auth-token)
      const accessTokenCookie = cookies.find(c => c.name === 'accessToken');
      const userIdCookie = cookies.find(c => c.name === 'userId' || c.name === 'user_id');
      
      if (accessTokenCookie) {
        Logger.info('TokenManager: Found accessToken cookie');
        
        const cookieConfig = {
          authToken: accessTokenCookie.value,
          userId: userIdCookie?.value || 'unknown',
          frontendUrl,
          backendUrl: config?.backendUrl || getURL('BACKEND_BASE', 'http://localhost:3000')
        };
        
        // Validate the cookies by testing API connection
        const validation = await this.testConfigConnection(cookieConfig);
        if (validation.success) {
          Logger.info('TokenManager: Successfully retrieved auth from cookies');
          return cookieConfig;
        } else {
          Logger.warn('TokenManager: Cookie auth validation failed', validation);
        }
      } else {
        Logger.info('TokenManager: No accessToken cookie found');
      }
    } catch (error) {
      Logger.warn('TokenManager: Could not retrieve auth from frontend', error);
    }
    
    return null;
  }

  /**
   * Test API connection with given config
   * @param {Object} config - Auth config to test
   * @returns {Promise<Object>} Test result
   */
  static async testConfigConnection(config) {
    try {
      const apiUrl = getURL('API_USERS_ME', `${config.backendUrl}/users/me`);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return { success: true, userData };
      } else {
        return { success: false, status: response.status };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear authentication configuration
   */
  static async clearAuthConfig() {
    try {
      await StorageService.remove(this.STORAGE_KEY);
      Logger.info('TokenManager: Auth config cleared');
      return true;
    } catch (error) {
      Logger.error('TokenManager: Failed to clear auth config', error);
      return false;
    }
  }

  /**
   * Update last validated timestamp
   */
  static async updateLastValidated() {
    try {
      const config = await this.getAuthConfig();
      if (config) {
        config.lastValidated = Date.now();
        await StorageService.set(this.STORAGE_KEY, config);
      }
    } catch (error) {
      Logger.warn('TokenManager: Failed to update last validated timestamp', error);
    }
  }

  /**
   * Get authentication status with detailed information
   * @returns {Promise<Object>} Detailed auth status
   */
  static async getAuthStatus() {
    try {
      const config = await this.getAuthConfig();
      
      if (!config || !config.authToken) {
        return {
          isAuthenticated: false,
          status: 'no_token',
          message: 'Not connected to YALG',
          needsLogin: true
        };
      }

      // Check if token was recently validated (within last 5 minutes)
      const lastValidated = config.lastValidated || 0;
      const timeSinceValidation = Date.now() - lastValidated;
      
      if (timeSinceValidation < this.TOKEN_CHECK_INTERVAL) {
        return {
          isAuthenticated: true,
          status: 'valid',
          message: 'Connected to YALG',
          needsLogin: false,
          config
        };
      }

      // Need to validate token
      const validation = await this.validateToken(true);
      
      if (validation.success) {
        return {
          isAuthenticated: true,
          status: 'valid',
          message: 'Connected to YALG',
          needsLogin: false,
          config,
          userData: validation.userData
        };
      } else {
        return {
          isAuthenticated: false,
          status: 'invalid',
          message: validation.error || 'Authentication expired',
          needsLogin: validation.needsLogin,
          error: validation.error
        };
      }
    } catch (error) {
      Logger.error('TokenManager: Failed to get auth status', error);
      return {
        isAuthenticated: false,
        status: 'error',
        message: 'Failed to check authentication',
        needsLogin: false,
        error: error.message
      };
    }
  }

  /**
   * Open login page in new tab
   * @returns {Promise<void>}
   */
  static async openLoginPage() {
    try {
      const config = await this.getAuthConfig();
      const frontendUrl = config?.frontendUrl || getURL('FRONTEND_BASE', 'http://localhost:3400');
      const loginUrl = getURL('FRONTEND_LOGIN_WITH_EXT', `${frontendUrl}/login?ext=true`);
      
      await chrome.tabs.create({ url: loginUrl, active: true });
      Logger.info('TokenManager: Opened login page', { loginUrl });
    } catch (error) {
      Logger.error('TokenManager: Failed to open login page', error);
    }
  }

  /**
   * Start periodic token validation
   */
  static startTokenValidation() {
    // Clear any existing interval
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    // Start new validation interval
    this.validationInterval = setInterval(async () => {
      const isAuth = await this.isAuthenticated();
      if (isAuth) {
        await this.validateToken(true); // Silent validation
      }
    }, this.TOKEN_CHECK_INTERVAL);

    Logger.info('TokenManager: Started periodic token validation');
  }

  /**
   * Stop periodic token validation
   */
  static stopTokenValidation() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
      Logger.info('TokenManager: Stopped periodic token validation');
    }
  }
} 