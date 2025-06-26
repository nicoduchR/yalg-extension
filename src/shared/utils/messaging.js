/**
 * Messaging Utility
 * Provides a clean interface for Chrome extension message passing
 */

import { MESSAGE_TYPES } from '../constants.js';
import { Logger } from './logger.js';

export class MessageService {
  static logger = Logger.createScoped('MESSAGE');

  /**
   * Send message to background script
   * @param {string} type - Message type
   * @param {*} data - Message data
   * @param {Object} options - Additional options
   * @returns {Promise<*>} Response from background script
   */
  static async sendToBackground(type, data = null, options = {}) {
    return this._sendMessage({ type, data }, 'background', options);
  }

  /**
   * Send message to content script
   * @param {number} tabId - Tab ID
   * @param {string} type - Message type
   * @param {*} data - Message data
   * @param {Object} options - Additional options
   * @returns {Promise<*>} Response from content script
   */
  static async sendToContent(tabId, type, data = null, options = {}) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type, data });
      this.logger.debug(`Message sent to content script in tab ${tabId}`, { type, data, response });
      return response;
    } catch (error) {
      this.logger.error(`Failed to send message to content script in tab ${tabId}`, { type, data, error });
      throw error;
    }
  }

  /**
   * Send message to all content scripts
   * @param {string} type - Message type
   * @param {*} data - Message data
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Responses from all content scripts
   */
  static async sendToAllContent(type, data = null, options = {}) {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
      const promises = tabs.map(tab => this.sendToContent(tab.id, type, data, options));
      const responses = await Promise.allSettled(promises);
      
      this.logger.debug(`Message sent to ${tabs.length} content scripts`, { type, data, responses });
      return responses;
    } catch (error) {
      this.logger.error('Failed to send message to all content scripts', { type, data, error });
      throw error;
    }
  }

  /**
   * Send external message (to/from website)
   * @param {string} extensionId - Extension ID
   * @param {string} type - Message type
   * @param {*} data - Message data
   * @param {Object} options - Additional options
   * @returns {Promise<*>} Response
   */
  static async sendExternal(extensionId, type, data = null, options = {}) {
    return this._sendMessage({ type, data }, 'external', { ...options, extensionId });
  }

  /**
   * Internal message sending method
   * @param {Object} message - Message object
   * @param {string} target - Target type (background, external)
   * @param {Object} options - Additional options
   * @returns {Promise<*>} Response
   */
  static async _sendMessage(message, target, options = {}) {
    const { timeout = 5000, retries = 1, extensionId } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await Promise.race([
          this._performSend(message, target, extensionId),
          this._createTimeout(timeout)
        ]);
        
        this.logger.debug(`Message sent successfully`, { message, target, attempt, response });
        return response;
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`Message send attempt ${attempt + 1} failed`, { message, target, error });
        
        if (attempt < retries - 1) {
          await this._wait(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }
    
    this.logger.error(`Message send failed after ${retries} attempts`, { message, target, error: lastError });
    throw lastError;
  }

  /**
   * Perform the actual message sending
   * @param {Object} message - Message object
   * @param {string} target - Target type
   * @param {string} extensionId - Extension ID for external messages
   * @returns {Promise<*>} Response
   */
  static _performSend(message, target, extensionId) {
    return new Promise((resolve, reject) => {
      const callback = (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      };

      if (target === 'external') {
        chrome.runtime.sendMessage(extensionId, message, callback);
      } else {
        chrome.runtime.sendMessage(message, callback);
      }
    });
  }

  /**
   * Create timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  static _createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Message timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Wait for specified time
   * @param {number} ms - Time to wait in milliseconds
   * @returns {Promise} Wait promise
   */
  static _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set up message listener with error handling
   * @param {Function} handler - Message handler function
   * @param {Object} options - Listener options
   */
  static addListener(handler, options = {}) {
    const { filter = null, context = 'UNKNOWN' } = options;
    
    const wrappedHandler = (message, sender, sendResponse) => {
      try {
        // Filter messages if specified
        if (filter && !filter(message, sender)) {
          return;
        }
        
        this.logger.debug(`Message received`, { message, sender, context });
        
        // Handle async responses
        const result = handler(message, sender, sendResponse);
        
        if (result instanceof Promise) {
          result
            .then(response => {
              if (response !== undefined) {
                sendResponse(response);
              }
            })
            .catch(error => {
              this.logger.error(`Message handler error`, { message, error, context });
              sendResponse({ error: error.message });
            });
          
          return true; // Keep message channel open
        }
        
        return result;
        
      } catch (error) {
        this.logger.error(`Message handler error`, { message, error, context });
        sendResponse({ error: error.message });
      }
    };
    
    chrome.runtime.onMessage.addListener(wrappedHandler);
    return wrappedHandler; // Return for potential removal
  }

  /**
   * Set up external message listener
   * @param {Function} handler - Message handler function
   * @param {Object} options - Listener options
   */
  static addExternalListener(handler, options = {}) {
    const { filter = null, context = 'EXTERNAL' } = options;
    
    const wrappedHandler = (message, sender, sendResponse) => {
      try {
        if (filter && !filter(message, sender)) {
          return;
        }
        
        this.logger.debug(`External message received`, { message, sender, context });
        
        const result = handler(message, sender, sendResponse);
        
        if (result instanceof Promise) {
          result
            .then(response => {
              if (response !== undefined) {
                sendResponse(response);
              }
            })
            .catch(error => {
              this.logger.error(`External message handler error`, { message, error, context });
              sendResponse({ error: error.message });
            });
          
          return true;
        }
        
        return result;
        
      } catch (error) {
        this.logger.error(`External message handler error`, { message, error, context });
        sendResponse({ error: error.message });
      }
    };
    
    chrome.runtime.onMessageExternal.addListener(wrappedHandler);
    return wrappedHandler;
  }

  /**
   * Remove message listener
   * @param {Function} handler - Handler function to remove
   * @param {boolean} external - Whether it's an external listener
   */
  static removeListener(handler, external = false) {
    if (external) {
      chrome.runtime.onMessageExternal.removeListener(handler);
    } else {
      chrome.runtime.onMessage.removeListener(handler);
    }
  }

  /**
   * Broadcast message to multiple targets
   * @param {string} type - Message type
   * @param {*} data - Message data
   * @param {Array} targets - Array of target specifications
   * @returns {Promise<Array>} Array of responses
   */
  static async broadcast(type, data, targets) {
    const promises = targets.map(target => {
      switch (target.type) {
        case 'background':
          return this.sendToBackground(type, data);
        case 'content':
          return this.sendToContent(target.tabId, type, data);
        case 'external':
          return this.sendExternal(target.extensionId, type, data);
        default:
          return Promise.reject(new Error(`Unknown target type: ${target.type}`));
      }
    });
    
    return Promise.allSettled(promises);
  }

  /**
   * Create a typed message sender for specific message types
   * @param {string} messageType - Message type
   * @returns {Object} Typed sender object
   */
  static createTypedSender(messageType) {
    return {
      toBackground: (data, options) => this.sendToBackground(messageType, data, options),
      toContent: (tabId, data, options) => this.sendToContent(tabId, messageType, data, options),
      toAllContent: (data, options) => this.sendToAllContent(messageType, data, options),
      toExternal: (extensionId, data, options) => this.sendExternal(extensionId, messageType, data, options)
    };
  }

  /**
   * Validate message structure
   * @param {Object} message - Message to validate
   * @returns {boolean} Whether message is valid
   */
  static validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    if (!message.type || typeof message.type !== 'string') {
      return false;
    }
    
    // Check if message type is known
    const knownTypes = Object.values(MESSAGE_TYPES);
    if (!knownTypes.includes(message.type)) {
      this.logger.warn(`Unknown message type: ${message.type}`);
    }
    
    return true;
  }
} 