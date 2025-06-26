/**
 * Centralized Logging Utility
 * Provides consistent logging across the extension with levels and context
 */

import { LOG_LEVELS } from '../constants.js';

export class Logger {
  static currentLevel = LOG_LEVELS.INFO; // Default log level
  static prefix = '[YALG]';

  /**
   * Set the logging level
   * @param {number} level - Log level from LOG_LEVELS
   */
  static setLevel(level) {
    this.currentLevel = level;
  }

  /**
   * Set custom prefix for logs
   * @param {string} prefix - Custom prefix
   */
  static setPrefix(prefix) {
    this.prefix = prefix;
  }

  /**
   * Internal logging method
   * @param {number} level - Log level
   * @param {string} levelName - Level name for console
   * @param {string} message - Log message
   * @param {*} data - Additional data to log
   * @param {string} context - Context information
   */
  static _log(level, levelName, message, data = null, context = null) {
    if (level > this.currentLevel) {
      return; // Skip if below current log level
    }

    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const fullMessage = `${this.prefix} ${contextStr} ${message}`;

    // Choose appropriate console method
    const consoleMethod = console[levelName.toLowerCase()] || console.log;

    if (data !== null && data !== undefined) {
      consoleMethod(`${timestamp} ${fullMessage}`, data);
    } else {
      consoleMethod(`${timestamp} ${fullMessage}`);
    }

    // Store critical errors for later analysis
    if (level === LOG_LEVELS.ERROR) {
      this._storeError(message, data, context);
    }
  }

  /**
   * Store error for debugging
   * @param {string} message - Error message
   * @param {*} data - Error data
   * @param {string} context - Error context
   */
  static _storeError(message, data, context) {
    try {
      const errorEntry = {
        timestamp: Date.now(),
        message,
        data: typeof data === 'object' ? JSON.stringify(data) : data,
        context,
        stack: new Error().stack
      };

      // Store in chrome.storage for debugging
      chrome.storage.local.get(['errorLog'], (result) => {
        const errorLog = result.errorLog || [];
        errorLog.push(errorEntry);
        
        // Keep only last 50 errors
        const trimmedLog = errorLog.slice(-50);
        
        chrome.storage.local.set({ errorLog: trimmedLog });
      });
    } catch (e) {
      // Ignore storage errors in error logging
    }
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {*} data - Additional data
   * @param {string} context - Context information
   */
  static error(message, data = null, context = null) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', message, data, context);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {*} data - Additional data
   * @param {string} context - Context information
   */
  static warn(message, data = null, context = null) {
    this._log(LOG_LEVELS.WARN, 'WARN', message, data, context);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {*} data - Additional data
   * @param {string} context - Context information
   */
  static info(message, data = null, context = null) {
    this._log(LOG_LEVELS.INFO, 'INFO', message, data, context);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {*} data - Additional data
   * @param {string} context - Context information
   */
  static debug(message, data = null, context = null) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, data, context);
  }

  /**
   * Create a scoped logger for specific context
   * @param {string} context - Context name
   * @returns {Object} Scoped logger object
   */
  static createScoped(context) {
    return {
      error: (message, data) => this.error(message, data, context),
      warn: (message, data) => this.warn(message, data, context),
      info: (message, data) => this.info(message, data, context),
      debug: (message, data) => this.debug(message, data, context)
    };
  }

  /**
   * Log performance timing
   * @param {string} operation - Operation name
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @param {string} context - Context information
   */
  static timing(operation, startTime, endTime, context = null) {
    const duration = endTime - startTime;
    this.info(`Performance: ${operation} took ${duration}ms`, null, context);
  }

  /**
   * Create a performance timer
   * @param {string} operation - Operation name
   * @param {string} context - Context information
   * @returns {Function} Timer end function
   */
  static startTimer(operation, context = null) {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      this.timing(operation, startTime, endTime, context);
    };
  }

  /**
   * Log API request/response
   * @param {string} method - HTTP method
   * @param {string} url - API URL
   * @param {number} status - Response status
   * @param {number} duration - Request duration
   * @param {*} data - Request/response data
   */
  static apiCall(method, url, status, duration, data = null) {
    const level = status >= 400 ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;
    const levelName = status >= 400 ? 'ERROR' : 'DEBUG';
    
    this._log(
      level,
      levelName,
      `API ${method} ${url} - ${status} (${duration}ms)`,
      data,
      'API'
    );
  }

  /**
   * Log user action
   * @param {string} action - Action name
   * @param {*} data - Action data
   */
  static userAction(action, data = null) {
    this.info(`User action: ${action}`, data, 'USER');
  }

  /**
   * Get stored error log
   * @returns {Promise<Array>} Array of stored errors
   */
  static async getErrorLog() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['errorLog'], (result) => {
        resolve(result.errorLog || []);
      });
    });
  }

  /**
   * Clear stored error log
   * @returns {Promise<boolean>} Success status
   */
  static async clearErrorLog() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['errorLog'], () => {
        resolve(!chrome.runtime.lastError);
      });
    });
  }

  /**
   * Export logs for debugging
   * @returns {Promise<Object>} Log export data
   */
  static async exportLogs() {
    const errorLog = await this.getErrorLog();
    
    return {
      timestamp: Date.now(),
      version: chrome.runtime.getManifest().version,
      logLevel: this.currentLevel,
      errors: errorLog,
      userAgent: navigator.userAgent
    };
  }
} 