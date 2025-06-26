/**
 * Shared constants for YALG Chrome Extension
 */

// ==============================================
// URL CONFIGURATION - CHANGE ONLY HERE
// ==============================================

// Environment Configuration
const ENVIRONMENT = 'development'; // Change to 'production' when deploying

// URL Configuration - All URLs managed from here
const URL_CONFIG = {
  development: {
    FRONTEND_BASE: 'http://localhost:3400',
    BACKEND_BASE: 'http://localhost:3000',
    ALLOWED_ORIGINS: [
      'http://localhost:3400',
      'https://localhost:3400'
    ]
  },
  production: {
    FRONTEND_BASE: 'https://yalg.app', // TODO: Replace with your actual production URL
    BACKEND_BASE: 'https://api.yalg.app', // TODO: Replace with your actual API URL
    ALLOWED_ORIGINS: [
      'https://yalg.app',
      'https://www.yalg.app',
      'https://yalg.dev',
      'https://www.yalg.dev'
    ]
  }
};

// Current environment URLs
const CURRENT_CONFIG = URL_CONFIG[ENVIRONMENT];

// URL constants - Available globally and via exports
const URLS = {
  // Frontend URLs
  FRONTEND_BASE: CURRENT_CONFIG.FRONTEND_BASE,
  FRONTEND_DASHBOARD: `${CURRENT_CONFIG.FRONTEND_BASE}/dashboard`,
  FRONTEND_LOGIN: `${CURRENT_CONFIG.FRONTEND_BASE}/login`,
  FRONTEND_LOGIN_WITH_EXT: `${CURRENT_CONFIG.FRONTEND_BASE}/login?ext=true`,
  
  // Backend URLs
  BACKEND_BASE: CURRENT_CONFIG.BACKEND_BASE,
  API_BASE: CURRENT_CONFIG.BACKEND_BASE,
  
  // API Endpoints (full URLs)
  API_USERS_ME: `${CURRENT_CONFIG.BACKEND_BASE}/users/me`,
  API_POSTS_HTML: `${CURRENT_CONFIG.BACKEND_BASE}/posts/html`,
  API_POSTS_QUEUE: `${CURRENT_CONFIG.BACKEND_BASE}/posts/queue`,
  API_POSTS_BULK: `${CURRENT_CONFIG.BACKEND_BASE}/posts/bulk`,
  API_ANECDOTE_AUDIO: `${CURRENT_CONFIG.BACKEND_BASE}/anecdote/audio`,
  API_AUTH_ME: `${CURRENT_CONFIG.BACKEND_BASE}/auth/me`,
  
  // External URLs
  LINKEDIN_FEED: 'https://www.linkedin.com/feed/',
  LINKEDIN_PROFILE_BASE: 'https://www.linkedin.com/in/',
  LINKEDIN_RECENT_ACTIVITY: 'https://www.linkedin.com/in/me/recent-activity/all/',
  
  // Allowed origins for security
  ALLOWED_ORIGINS: CURRENT_CONFIG.ALLOWED_ORIGINS
};

// Make URLs available globally for Chrome extension compatibility
if (typeof window !== 'undefined') {
  window.YALG_URLS = URLS;
}

// Legacy constants for backward compatibility
const FRONTEND_URL = URLS.FRONTEND_DASHBOARD;
const FRONTEND_LOGIN = URLS.FRONTEND_LOGIN;

// ==============================================
// END URL CONFIGURATION
// ==============================================

// YALG Extension Constants (Global variables for compatibility)
if (typeof window !== 'undefined') {
  window.YALG_CONSTANTS = {
  // Messages
  MESSAGES: {
    START_SCRAPING: 'START_SCRAPING',
    SCRAPING_PROGRESS: 'SCRAPING_PROGRESS',
    SCRAPING_COMPLETE: 'SCRAPING_COMPLETE',
    SCRAPING_ERROR: 'SCRAPING_ERROR',
    PROGRESS_UPDATE: 'PROGRESS_UPDATE',
    SYNC_COMPLETE: 'SYNC_COMPLETE',
    SYNC_ERROR: 'SYNC_ERROR',
    START_SYNC: 'START_SYNC',
    HTML_COLLECTED: 'HTML_COLLECTED',
    PROCESS_SINGLE_HTML_ELEMENT: 'PROCESS_SINGLE_HTML_ELEMENT'
  },

  // LinkedIn Selectors
  SELECTORS: {
    FEED_POST: '.feed-shared-update-v2',
    POST_CONTAINER: '.feed-shared-update-v2__control-menu-container.display-flex.flex-column.flex-grow-1',
    PROFILE_BUTTON: 'a[data-control-name="nav.settings_myprofile"], a[href*="/in/"][aria-label*="me"], .global-nav__me-photo',
    ACTIVITY_LINK: 'a[href*="/recent-activity/"]'
  },

  // Delays (in milliseconds)
  DELAYS: {
    PAGE_LOAD: 3000,
    NAVIGATION: 5000,
    SCROLL_WAIT: 2000,
    AUTO_START: 3000,
    ELEMENT_PROCESSING: 500
  },

  // Storage Keys
  STORAGE_KEYS: {
    CONFIG: 'config',
    SYNC_STATS: 'syncStats',
    USER_ANECDOTES: 'anecdotes',
    AUTO_START_SYNC: 'autoStartSync'
  },

  // API Endpoints (relative paths - use URLS for full URLs)
  API_ENDPOINTS: {
    POSTS_HTML: '/posts/html',
    POSTS_QUEUE: '/posts/queue',
    ANECDOTE_AUDIO: '/anecdote/audio',
    AUTH_ME: '/auth/me'
  },

  // Frontend URL (legacy - use URLS.FRONTEND_DASHBOARD instead)
  FRONTEND_URL: URLS.FRONTEND_DASHBOARD,
  FRONTEND_LOGIN: URLS.FRONTEND_LOGIN
};

  // For backward compatibility, also set as global variables
  window.MESSAGES = window.YALG_CONSTANTS.MESSAGES;
  window.SELECTORS = window.YALG_CONSTANTS.SELECTORS;
  window.DELAYS = window.YALG_CONSTANTS.DELAYS;
  window.STORAGE_KEYS = window.YALG_CONSTANTS.STORAGE_KEYS;
  window.API_ENDPOINTS = window.YALG_CONSTANTS.API_ENDPOINTS;
  window.FRONTEND_URL = window.YALG_CONSTANTS.FRONTEND_URL;
  window.FRONTEND_LOGIN = window.YALG_CONSTANTS.FRONTEND_LOGIN;
}

// Message types for communication between components
const MESSAGE_TYPES = {
  // External messages (from frontend website)
  CHECK_EXTENSION: 'CHECK_EXTENSION',
  CONFIGURE: 'CONFIGURE',
  SET_AUTO_START: 'SET_AUTO_START',

  // Internal messages (between extension components)
  START_SCRAPING: 'START_SCRAPING',
  PROCESS_SINGLE_HTML_ELEMENT: 'PROCESS_SINGLE_HTML_ELEMENT',
  HTML_COLLECTED: 'HTML_COLLECTED',
  SCRAPING_ERROR: 'SCRAPING_ERROR',
  SCRAPING_PROGRESS: 'SCRAPING_PROGRESS',
  SCRAPING_COMPLETE: 'SCRAPING_COMPLETE',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  SYNC_COMPLETE: 'SYNC_COMPLETE',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  PROGRESS_ERROR: 'PROGRESS_ERROR'
};

// Sync phases
const SYNC_PHASES = {
  INITIALIZING: 'initializing',
  COLLECTING: 'collecting',
  QUEUEING: 'queueing',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Status types
const STATUS_TYPES = {
  READY: 'ready',
  SYNCING: 'syncing',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// LinkedIn selectors (centralized to make updates easier)
const LINKEDIN_SELECTORS = {
  POST_CONTAINER: '.feed-shared-update-v2__control-menu-container.display-flex.flex-column.flex-grow-1',
  POST_CONTENT: '.feed-shared-update-v2__description',
  POST_AUTHOR: '.feed-shared-actor__name',
  POST_TIME: '.feed-shared-actor__sub-description time',
  POST_IMAGES: '.feed-shared-image img',
  POST_VIDEOS: 'video',
  PROFILE_ACTIVITY_TAB: 'a[href*="/recent-activity/"]',
  LOAD_MORE_BUTTON: '.scaffold-finite-scroll__load-button'
};

// API endpoints (relative paths - use URLS for full URLs)
const API_ENDPOINTS = {
  POSTS_BULK: '/posts/bulk',
  POSTS_QUEUE: '/posts/queue',
  POSTS_HTML: '/posts/html'
};

// Default configuration
const DEFAULT_CONFIG = {
  apiBaseUrl: URLS.BACKEND_BASE,
  authToken: null,
  userId: null,
  maxScrollAttempts: 10,
  scrollDelay: 2000,
  batchSize: 5,
  retryAttempts: 3,
  retryDelay: 1000
};

// Storage keys
const STORAGE_KEYS = {
  CONFIG: 'config',
  SYNC_STATS: 'syncStats',
  AUTO_START_SYNC: 'autoStartSync',
  LAST_SYNC: 'lastSync'
};

// Error codes
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  LINKEDIN_ERROR: 'LINKEDIN_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Logging levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// UI constants
const UI_CONSTANTS = {
  PROGRESS_UPDATE_INTERVAL: 100,
  TOAST_DURATION: 3000,
  OVERLAY_Z_INDEX: 999999,
  ANIMATION_DURATION: 300
};

// LinkedIn URLs (use URLS constants instead)
const LINKEDIN_URLS = {
  FEED: URLS.LINKEDIN_FEED,
  PROFILE_BASE: URLS.LINKEDIN_PROFILE_BASE,
  ACTIVITY_SUFFIX: '/recent-activity/'
};

// Timing delays (in milliseconds)
const DELAYS = {
  PAGE_LOAD: 3000,
  NAVIGATION: 5000,
  AUTO_START: 3000,
  DROPDOWN_OPEN: 1000,
  SCROLL_WAIT: 2000,
  CONTENT_LOAD: 1000,
  ELEMENT_PROCESSING_INTERVAL: 100,
  BATCH_PROCESSING: 500
};

// Scraping limits
const SCRAPING_LIMITS = {
  MAX_SCROLL_ATTEMPTS: 20,
  MAX_NO_NEW_ELEMENTS: 3,
  BATCH_SIZE: 5
};

// Make all constants available globally for Chrome extension compatibility
// Use try-catch to handle different environments (service worker vs content script)
try {
  if (typeof window !== 'undefined') {
    window.YALG_URLS = URLS;
    window.YALG_MESSAGE_TYPES = MESSAGE_TYPES;
    window.YALG_SYNC_PHASES = SYNC_PHASES;
    window.YALG_STATUS_TYPES = STATUS_TYPES;
    window.YALG_LINKEDIN_SELECTORS = LINKEDIN_SELECTORS;
    window.YALG_API_ENDPOINTS = API_ENDPOINTS;
    window.YALG_DEFAULT_CONFIG = DEFAULT_CONFIG;
    window.YALG_STORAGE_KEYS = STORAGE_KEYS;
    window.YALG_ERROR_CODES = ERROR_CODES;
    window.YALG_LOG_LEVELS = LOG_LEVELS;
    window.YALG_UI_CONSTANTS = UI_CONSTANTS;
    window.YALG_LINKEDIN_URLS = LINKEDIN_URLS;
    window.YALG_DELAYS = DELAYS;
    window.YALG_SCRAPING_LIMITS = SCRAPING_LIMITS;
  }
} catch (e) {
  // window not available (service worker context)
}

// Export for ES6 module compatibility (when loaded as module)
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = {
    URLS,
    URL_CONFIG,
    MESSAGE_TYPES,
    MESSAGES: MESSAGE_TYPES,
    SYNC_PHASES,
    STATUS_TYPES,
    LINKEDIN_SELECTORS,
    SELECTORS: { LINKEDIN: LINKEDIN_SELECTORS },
    API_ENDPOINTS,
    DEFAULT_CONFIG,
    STORAGE_KEYS,
    ERROR_CODES,
    LOG_LEVELS,
    UI_CONSTANTS,
    LINKEDIN_URLS,
    DELAYS,
    SCRAPING_LIMITS,
    FRONTEND_URL,
    FRONTEND_LOGIN
  };
}

// Make constants available globally for any environment
if (typeof globalThis !== 'undefined') {
  globalThis.YALG_URLS = URLS;
  globalThis.YALG_MESSAGE_TYPES = MESSAGE_TYPES;
  globalThis.YALG_SYNC_PHASES = SYNC_PHASES;
  globalThis.YALG_STATUS_TYPES = STATUS_TYPES;
  globalThis.YALG_LINKEDIN_SELECTORS = LINKEDIN_SELECTORS;
  globalThis.YALG_API_ENDPOINTS = API_ENDPOINTS;
  globalThis.YALG_DEFAULT_CONFIG = DEFAULT_CONFIG;
  globalThis.YALG_STORAGE_KEYS = STORAGE_KEYS;
  globalThis.YALG_ERROR_CODES = ERROR_CODES;
  globalThis.YALG_LOG_LEVELS = LOG_LEVELS;
  globalThis.YALG_UI_CONSTANTS = UI_CONSTANTS;
  globalThis.YALG_LINKEDIN_URLS = LINKEDIN_URLS;
  globalThis.YALG_DELAYS = DELAYS;
  globalThis.YALG_SCRAPING_LIMITS = SCRAPING_LIMITS;
}

// Make exports available globally for any environment that supports it
try {
  if (typeof globalThis !== 'undefined') {
    globalThis.YALG_EXPORTS = {
      URLS,
      URL_CONFIG,
      MESSAGE_TYPES,
      MESSAGES: MESSAGE_TYPES,
      SYNC_PHASES,
      STATUS_TYPES,
      LINKEDIN_SELECTORS,
      SELECTORS: { LINKEDIN: LINKEDIN_SELECTORS },
      API_ENDPOINTS,
      DEFAULT_CONFIG,
      STORAGE_KEYS,
      ERROR_CODES,
      LOG_LEVELS,
      UI_CONSTANTS,
      LINKEDIN_URLS,
      DELAYS,
      SCRAPING_LIMITS,
      FRONTEND_URL,
      FRONTEND_LOGIN
    };
  }
} catch (e) {
  // globalThis not available
} 