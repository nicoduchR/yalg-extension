/**
 * Chrome Storage Utility Wrapper
 * Provides a clean interface for Chrome storage operations with error handling
 */

import { STORAGE_KEYS } from '../constants.js';
import { Logger } from './logger.js';

export class StorageService {
  /**
   * Get value from Chrome storage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {Promise<*>} Stored value or default
   */
  static async get(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get([key]);
      const value = result[key];
      
      Logger.debug(`Storage get: ${key}`, { value, hasValue: value !== undefined });
      
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      Logger.error(`Storage get error for key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set value in Chrome storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<boolean>} Success status
   */
  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      Logger.debug(`Storage set: ${key}`, { value });
      return true;
    } catch (error) {
      Logger.error(`Storage set error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove key from Chrome storage
   * @param {string} key - Storage key to remove
   * @returns {Promise<boolean>} Success status
   */
  static async remove(key) {
    try {
      await chrome.storage.local.remove([key]);
      Logger.debug(`Storage removed: ${key}`);
      return true;
    } catch (error) {
      Logger.error(`Storage remove error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<boolean>} Success status
   */
  static async clear() {
    try {
      await chrome.storage.local.clear();
      Logger.info('Storage cleared');
      return true;
    } catch (error) {
      Logger.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * Get multiple values at once
   * @param {string[]} keys - Array of storage keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  static async getMultiple(keys) {
    try {
      const result = await chrome.storage.local.get(keys);
      Logger.debug('Storage getMultiple:', { keys, result });
      return result;
    } catch (error) {
      Logger.error('Storage getMultiple error:', error);
      return {};
    }
  }

  /**
   * Set multiple values at once
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<boolean>} Success status
   */
  static async setMultiple(items) {
    try {
      await chrome.storage.local.set(items);
      Logger.debug('Storage setMultiple:', { items });
      return true;
    } catch (error) {
      Logger.error('Storage setMultiple error:', error);
      return false;
    }
  }

  // Convenience methods for common storage operations

  /**
   * Get extension configuration
   * @returns {Promise<Object>} Configuration object
   */
  static async getConfig() {
    return this.get(STORAGE_KEYS.CONFIG, {});
  }

  /**
   * Set extension configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<boolean>} Success status
   */
  static async setConfig(config) {
    return this.set(STORAGE_KEYS.CONFIG, config);
  }

  /**
   * Update configuration (merge with existing)
   * @param {Object} updates - Configuration updates
   * @returns {Promise<boolean>} Success status
   */
  static async updateConfig(updates) {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...updates };
      return this.setConfig(newConfig);
    } catch (error) {
      Logger.error('Config update error:', error);
      return false;
    }
  }

  /**
   * Get sync statistics
   * @returns {Promise<Object>} Sync stats object
   */
  static async getSyncStats() {
    return this.get(STORAGE_KEYS.SYNC_STATS, {
      totalPosts: 0,
      lastSync: null,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0
    });
  }

  /**
   * Update sync statistics
   * @param {Object} stats - Stats to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateSyncStats(stats) {
    try {
      const currentStats = await this.getSyncStats();
      const newStats = { ...currentStats, ...stats };
      return this.set(STORAGE_KEYS.SYNC_STATS, newStats);
    } catch (error) {
      Logger.error('Sync stats update error:', error);
      return false;
    }
  }

  /**
   * Get auto-start sync setting
   * @returns {Promise<boolean>} Auto-start setting
   */
  static async getAutoStartSync() {
    return this.get(STORAGE_KEYS.AUTO_START_SYNC, false);
  }

  /**
   * Set auto-start sync setting
   * @param {boolean} autoStart - Auto-start setting
   * @returns {Promise<boolean>} Success status
   */
  static async setAutoStartSync(autoStart) {
    return this.set(STORAGE_KEYS.AUTO_START_SYNC, autoStart);
  }

  /**
   * Check if storage quota is exceeded
   * @returns {Promise<Object>} Storage usage info
   */
  static async getStorageUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        used: usage,
        quota: quota,
        available: quota - usage,
        percentUsed: (usage / quota) * 100
      };
    } catch (error) {
      Logger.error('Storage usage check error:', error);
      return null;
    }
  }

  /**
   * Export all stored data
   * @returns {Promise<Object>} All stored data
   */
  static async exportData() {
    try {
      const data = await chrome.storage.local.get(null);
      Logger.info('Data exported successfully');
      return data;
    } catch (error) {
      Logger.error('Data export error:', error);
      return {};
    }
  }

  /**
   * Import data into storage
   * @param {Object} data - Data to import
   * @param {boolean} merge - Whether to merge with existing data
   * @returns {Promise<boolean>} Success status
   */
  static async importData(data, merge = true) {
    try {
      if (merge) {
        const existingData = await this.exportData();
        data = { ...existingData, ...data };
      }
      
      await chrome.storage.local.set(data);
      Logger.info('Data imported successfully');
      return true;
    } catch (error) {
      Logger.error('Data import error:', error);
      return false;
    }
  }
} 