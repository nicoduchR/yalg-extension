/**
 * API Client for YALG Backend Communication
 * Handles all HTTP requests to the YALG API with proper error handling and retry logic
 */

import { API_ENDPOINTS, ERROR_CODES, DEFAULT_CONFIG } from '../../shared/constants.js';
import { Logger } from '../../shared/utils/logger.js';

export class ApiClient {
  constructor(baseUrl = DEFAULT_CONFIG.apiBaseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.logger = Logger.createScoped('API');
    this.options = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...options
    };
  }

  /**
   * Make HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout = this.options.timeout,
      retries = this.options.retries
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const requestId = this._generateRequestId();

    this.logger.info(`Making ${method} request to ${endpoint}`, { requestId, body });

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...(body && { body: JSON.stringify(body) })
    };

    let lastError;
    const startTime = performance.now();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await Promise.race([
          fetch(url, requestOptions),
          this._createTimeoutPromise(timeout)
        ]);

        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!response.ok) {
          const errorData = await this._parseErrorResponse(response);
          const error = new ApiError(
            errorData.message || `HTTP ${response.status}`,
            response.status,
            errorData,
            endpoint
          );
          
          this.logger.apiCall(method, url, response.status, duration, errorData);
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          
          throw error;
        }

        const result = await response.json();
        this.logger.apiCall(method, url, response.status, duration);
        
        return result;

      } catch (error) {
        lastError = error;
        
        if (attempt < retries - 1 && this._shouldRetry(error)) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          this.logger.warn(`Request attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            requestId,
            error: error.message
          });
          
          await this._wait(delay);
        } else {
          break;
        }
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.logger.error(`Request failed after ${retries} attempts`, {
      requestId,
      endpoint,
      duration,
      error: lastError
    });

    throw lastError;
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Get default headers including auth
   * @returns {Object} Headers object
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // API Methods

  /**
   * Queue posts for processing
   * @param {string} userId - User ID
   * @param {string} htmlContent - HTML content to process
   * @returns {Promise<Object>} API response
   */
  async queuePost(userId, htmlContent) {
    return this.makeRequest(API_ENDPOINTS.POSTS_QUEUE, {
      method: 'POST',
      headers: this._getHeaders(),
      body: { userId, htmlContent }
    });
  }

  /**
   * Send posts in bulk
   * @param {string} userId - User ID
   * @param {Array} posts - Array of post objects
   * @returns {Promise<Object>} API response
   */
  async sendBulkPosts(userId, posts) {
    return this.makeRequest(API_ENDPOINTS.POSTS_BULK, {
      method: 'POST',
      headers: this._getHeaders(),
      body: { userId, posts }
    });
  }

  /**
   * Send HTML content for processing
   * @param {string} userId - User ID
   * @param {Array} htmlElements - Array of HTML elements
   * @returns {Promise<Object>} API response
   */
  async sendHtmlContent(userId, htmlElements) {
    return this.makeRequest(API_ENDPOINTS.POSTS_HTML, {
      method: 'POST',
      headers: this._getHeaders(),
      body: { userId, htmlElements }
    });
  }

  /**
   * Health check endpoint
   * @returns {Promise<Object>} API response
   */
  async healthCheck() {
    return this.makeRequest('/health', {
      method: 'GET',
      retries: 1,
      timeout: 5000
    });
  }

  // Utility Methods

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  _createTimeoutPromise(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ApiError('Request timeout', 0, null, null, ERROR_CODES.TIMEOUT_ERROR));
      }, ms);
    });
  }

  /**
   * Parse error response
   * @param {Response} response - Fetch response
   * @returns {Promise<Object>} Error data
   */
  async _parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return {
        message: response.statusText || 'Unknown error',
        status: response.status
      };
    }
  }

  /**
   * Check if error should be retried
   * @param {Error} error - Error object
   * @returns {boolean} Whether to retry
   */
  _shouldRetry(error) {
    // Don't retry client errors or auth errors
    if (error instanceof ApiError) {
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
    }

    // Retry network errors and server errors
    return true;
  }

  /**
   * Wait for specified time
   * @param {number} ms - Time to wait
   * @returns {Promise} Wait promise
   */
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update base URL
   * @param {string} baseUrl - New base URL
   */
  updateBaseUrl(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.logger.info(`Base URL updated to: ${this.baseUrl}`);
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      timeout: this.options.timeout,
      retries: this.options.retries,
      retryDelay: this.options.retryDelay
    };
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, status, data = null, endpoint = null, code = ERROR_CODES.NETWORK_ERROR) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.endpoint = endpoint;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert error to JSON
   * @returns {Object} Error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      data: this.data,
      endpoint: this.endpoint,
      code: this.code,
      timestamp: this.timestamp
    };
  }

  /**
   * Check if error is retryable
   * @returns {boolean} Whether error is retryable
   */
  isRetryable() {
    // Retry server errors but not client errors
    return this.status >= 500 || this.status === 0;
  }

  /**
   * Check if error is authentication related
   * @returns {boolean} Whether error is auth related
   */
  isAuthError() {
    return this.status === 401 || this.status === 403;
  }
} 