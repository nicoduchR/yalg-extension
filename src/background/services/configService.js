/**
 * Configuration Service
 * Manages extension configuration and settings
 */

import { DEFAULT_CONFIG, STORAGE_KEYS } from '../../shared/constants.js';
import { StorageService } from '../../shared/utils/storage.js';
import { Logger } from '../../shared/utils/logger.js';

export class ConfigService {
  static logger = Logger.createScoped('CONFIG');

  /**
   * Get current configuration
   * @returns {Promise<Object>} Configuration object
   */
  static async getConfig() {
    try {
      const config = await StorageService.get(STORAGE_KEYS.CONFIG, {});
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      
      this.logger.debug('Configuration loaded', { config: mergedConfig });
      return mergedConfig;
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   * @returns {Promise<boolean>} Success status
   */
  static async updateConfig(updates) {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...updates };
      
      // Validate configuration
      const validatedConfig = this.validateConfig(newConfig);
      
      const success = await StorageService.set(STORAGE_KEYS.CONFIG, validatedConfig);
      
      if (success) {
        this.logger.info('Configuration updated', { updates });
      } else {
        this.logger.error('Failed to save configuration');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<boolean>} Success status
   */
  static async resetConfig() {
    try {
      const success = await StorageService.set(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      
      if (success) {
        this.logger.info('Configuration reset to defaults');
      }
      
      return success;
    } catch (error) {
      this.logger.error('Failed to reset configuration', error);
      return false;
    }
  }

  /**
   * Initialize default configuration on first install
   * @returns {Promise<boolean>} Success status
   */
  static async initializeDefaultConfig() {
    try {
      const existingConfig = await StorageService.get(STORAGE_KEYS.CONFIG);
      
      if (!existingConfig) {
        const success = await StorageService.set(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
        
        if (success) {
          this.logger.info('Default configuration initialized');
        }
        
        return success;
      }
      
      this.logger.debug('Configuration already exists, skipping initialization');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize default configuration', error);
      return false;
    }
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validated configuration
   */
  static validateConfig(config) {
    const validated = { ...config };

    // Validate API base URL
    if (validated.apiBaseUrl && typeof validated.apiBaseUrl === 'string') {
      validated.apiBaseUrl = validated.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
      
      try {
        new URL(validated.apiBaseUrl);
      } catch {
        this.logger.warn('Invalid API base URL, using default', { 
          invalid: validated.apiBaseUrl,
          default: DEFAULT_CONFIG.apiBaseUrl
        });
        validated.apiBaseUrl = DEFAULT_CONFIG.apiBaseUrl;
      }
    }

    // Validate numeric values
    const numericFields = ['maxScrollAttempts', 'scrollDelay', 'batchSize', 'retryAttempts', 'retryDelay'];
    numericFields.forEach(field => {
      if (validated[field] !== undefined) {
        const value = Number(validated[field]);
        if (isNaN(value) || value < 0) {
          this.logger.warn(`Invalid ${field}, using default`, {
            invalid: validated[field],
            default: DEFAULT_CONFIG[field]
          });
          validated[field] = DEFAULT_CONFIG[field];
        } else {
          validated[field] = value;
        }
      }
    });

    // Validate string fields
    const stringFields = ['authToken', 'userId'];
    stringFields.forEach(field => {
      if (validated[field] !== undefined && validated[field] !== null) {
        if (typeof validated[field] !== 'string') {
          validated[field] = String(validated[field]);
        }
      }
    });

    return validated;
  }

  /**
   * Get specific configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {Promise<*>} Configuration value
   */
  static async getConfigValue(key, defaultValue = null) {
    try {
      const config = await this.getConfig();
      return config[key] !== undefined ? config[key] : defaultValue;
    } catch (error) {
      this.logger.error(`Failed to get config value for key: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Set specific configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Value to set
   * @returns {Promise<boolean>} Success status
   */
  static async setConfigValue(key, value) {
    try {
      const updates = { [key]: value };
      return await this.updateConfig(updates);
    } catch (error) {
      this.logger.error(`Failed to set config value for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Check if configuration is complete
   * @returns {Promise<Object>} Configuration status
   */
  static async getConfigStatus() {
    try {
      const config = await this.getConfig();
      
      const status = {
        isComplete: true,
        missing: [],
        issues: []
      };

      // Check required fields
      const requiredFields = ['apiBaseUrl'];
      requiredFields.forEach(field => {
        if (!config[field]) {
          status.isComplete = false;
          status.missing.push(field);
        }
      });

      // Check for authentication
      if (!config.authToken || !config.userId) {
        status.isComplete = false;
        status.missing.push('authentication');
      }

      // Check API URL validity
      if (config.apiBaseUrl) {
        try {
          new URL(config.apiBaseUrl);
        } catch {
          status.isComplete = false;
          status.issues.push('invalid_api_url');
        }
      }

      return status;
    } catch (error) {
      this.logger.error('Failed to get configuration status', error);
      return {
        isComplete: false,
        missing: ['configuration'],
        issues: ['load_error']
      };
    }
  }

  /**
   * Export configuration for backup
   * @returns {Promise<Object>} Configuration export
   */
  static async exportConfig() {
    try {
      const config = await this.getConfig();
      
      return {
        version: chrome.runtime.getManifest().version,
        timestamp: new Date().toISOString(),
        config: {
          ...config,
          // Remove sensitive data from export
          authToken: config.authToken ? '[REDACTED]' : null
        }
      };
    } catch (error) {
      this.logger.error('Failed to export configuration', error);
      return null;
    }
  }

  /**
   * Import configuration from backup
   * @param {Object} importData - Configuration import data
   * @returns {Promise<boolean>} Success status
   */
  static async importConfig(importData) {
    try {
      if (!importData || !importData.config) {
        throw new Error('Invalid import data');
      }

      const config = importData.config;
      
      // Don't import redacted auth token
      if (config.authToken === '[REDACTED]') {
        delete config.authToken;
      }

      return await this.updateConfig(config);
    } catch (error) {
      this.logger.error('Failed to import configuration', error);
      return false;
    }
  }

  /**
   * Get configuration for API client
   * @returns {Promise<Object>} API client configuration
   */
  static async getApiConfig() {
    try {
      const config = await this.getConfig();
      
      return {
        baseUrl: config.apiBaseUrl,
        authToken: config.authToken,
        timeout: config.retryDelay * config.retryAttempts,
        retries: config.retryAttempts,
        retryDelay: config.retryDelay
      };
    } catch (error) {
      this.logger.error('Failed to get API configuration', error);
      return {
        baseUrl: DEFAULT_CONFIG.apiBaseUrl,
        authToken: null,
        timeout: 10000,
        retries: 3,
        retryDelay: 1000
      };
    }
  }
} 