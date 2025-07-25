// Background service worker for YALG extension (No ES6 imports)
console.log('YALG Extension: Background script loaded');

// Import constants by loading the script
importScripts('../shared/constants.js');

// Store configuration using centralized constants
let config = {
  apiBaseUrl: globalThis.YALG_URLS?.BACKEND_BASE || 'http://localhost:3000',
  authToken: null,
  userId: null
};

console.log('YALG Extension: Config initialized with centralized URLs:', config.apiBaseUrl);

// Initialize token management on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('YALG Extension: Extension startup detected');
  initializeBridge();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('YALG Extension: Extension installed/updated');
  initializeBridge();
});

// Initialize the frontend authentication bridge
async function initializeBridge() {
  try {
    // Import and initialize the bridge
    const { FrontendAuthBridge } = await import('../shared/utils/frontend-auth-bridge.js');
    FrontendAuthBridge.initialize();
    console.log('YALG Extension: Frontend auth bridge initialized');
  } catch (error) {
    console.warn('YALG Extension: Could not initialize auth bridge', error);
  }
}

// Background script for YALG extension

// Listen for messages from the frontend website
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('YALG Extension: Received external message', message);
  
  if (message.type === 'CHECK_EXTENSION') {
    // Respond that extension is installed
    sendResponse({ installed: true, version: chrome.runtime.getManifest().version });
    return true;
  }
  
  if (message.type === 'START_SYNC') {
    handleStartSync(message.data, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'CONFIGURE') {
    // Update configuration from frontend
    config = { ...config, ...message.data };
    
    // Also save to new auth_config format for TokenManager
    const authConfig = {
      authToken: message.data.authToken,
      userId: message.data.userId,
      frontendUrl: message.data.frontendUrl || globalThis.YALG_URLS?.FRONTEND_BASE || 'http://localhost:3400',
      backendUrl: message.data.backendUrl || message.data.apiBaseUrl || globalThis.YALG_URLS?.BACKEND_BASE || 'http://localhost:3000',
      lastValidated: Date.now()
    };
    
    chrome.storage.local.set({ 
      config: config,
      auth_config: authConfig
    });
    
    console.log('YALG Extension: Configuration updated', { userId: authConfig.userId });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'SET_AUTO_START') {
    // Set auto-start flag for content script
    chrome.storage.local.set({ autoStartSync: message.data.autoStart });
    sendResponse({ success: true });
    return true;
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('YALG Extension: Received internal message', message);
  
  if (message.type === 'START_SYNC') {
    handleStartSync(message.data, sendResponse);
    return true; // Keep message channel open for async response
  }
  console.log(message);
  if (message.type === 'PROCESS_SINGLE_HTML_ELEMENT') {
    // Handle individual HTML element processing
    handleSingleHTMLElement(message.data, sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'SCRAPING_ERROR') {
    handleScrapingError(message.error, sendResponse);
    return true;
  }
  
  if (message.type === 'SCRAPING_PROGRESS') {
    // Forward progress to popup if it's open
    chrome.runtime.sendMessage({ type: 'PROGRESS_UPDATE', data: message.data });
    return true;
  }
  
  if (message.type === 'SCRAPING_COMPLETE') {
    // Forward completion status to popup if it's open
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETE', data: message.data });
    return true;
  }
  

});

async function handleSingleHTMLElement(elementData, sendResponse) {
  try {
    console.log(`YALG Extension: Processing single HTML element ${elementData.id}`);
    
    // Get accessToken from cookie
  
    const frontendUrl = globalThis.YALG_URLS?.FRONTEND_BASE || 'http://localhost:3400';
    console.log(frontendUrl);
    const cookies = await chrome.cookies.getAll({ 
      domain: new URL(frontendUrl).hostname,
      name: 'accessToken'
    });
    console.log(cookies);
    if (cookies.length === 0 || !cookies[0].value) {
      throw new Error('No authentication token available - please log in to YALG');
    }
    
    const authToken = cookies[0].value;
    
    // First, get user info from the backend
    const apiUrl = globalThis.YALG_URLS?.API_USERS_ME || `${config.apiBaseUrl}/users/me`;
    const userResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get user info: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    console.log(`YALG Extension: Retrieved user data for element ${elementData.id}`);
    
    // Prepare headers for post queue request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    
    // Send individual HTML element to queue for background processing
    const queueApiUrl = globalThis.YALG_URLS?.API_POSTS_QUEUE || `${config.apiBaseUrl}/posts/queue`;
    const requestBody = {
      userId: userData.id, // Use the UUID from /users/me
      htmlContent: elementData.html
    };
    
    console.log(`YALG Extension: Making API request to ${queueApiUrl} for element ${elementData.id} with user ${userData.id}`);
    
    const response = await fetch(queueApiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`YALG Extension: API request failed for element ${elementData.id}:`, {
        status: response.status,
        statusText: response.statusText,
        errorResponse: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`YALG Extension: Element ${elementData.id} successfully processed by API`);
    
    // Send success response back to content script
    sendResponse({ 
      success: true, 
      elementId: elementData.id, 
      result: result 
    });
    
  } catch (error) {
    console.error(`YALG Extension: Error processing HTML element ${elementData.id}:`, error);
    
    // Send error response back to content script
    sendResponse({ 
      success: false, 
      elementId: elementData.id, 
      error: error.message 
    });
  }
}

async function handleStartSync(data, sendResponse) {
  try {
    console.log('YALG Extension: Starting sync process', data);
    
    // Store the configuration in both formats for compatibility
    config = { ...config, ...data };
    
    // Save to both storage formats
    const authConfig = {
      authToken: data.authToken,
      userId: data.userId,
      frontendUrl: data.frontendUrl || 'http://localhost:3400',
      backendUrl: data.backendUrl || data.apiBaseUrl || 'http://localhost:3000',
      lastValidated: Date.now()
    };
    
    await chrome.storage.local.set({ 
      config: config,
      auth_config: authConfig
    });
    
    // Check if we're already on the LinkedIn recent activity page
    const tabs = await chrome.tabs.query({ 
      url: '*://www.linkedin.com/in/me/recent-activity/all/*',
      active: true,
      currentWindow: true
    });
    
    if (tabs.length > 0) {
      // We're on the LinkedIn recent activity page, start scraping
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'START_SCRAPING',
        config: config
      });
      sendResponse({ success: true, message: 'Started scraping on current LinkedIn recent activity tab' });
    } else {
              // Navigate to LinkedIn recent activity page
        const newTab = await chrome.tabs.create({ 
          url: globalThis.YALG_URLS?.LINKEDIN_RECENT_ACTIVITY || 'https://www.linkedin.com/in/me/recent-activity/all/',
          active: true 
        });
      
      // Wait for tab to load and start scraping
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.sendMessage(newTab.id, {
              type: 'START_SCRAPING',
              config: config
            });
          }, 3000); // Wait a bit longer for LinkedIn recent activity page to fully load
        }
      });
      
      sendResponse({ success: true, message: 'Opened LinkedIn recent activity page and will start scraping' });
    }
  } catch (error) {
    console.error('YALG Extension: Error in handleStartSync', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleScrapingError(error, sendResponse) {
  console.error('YALG Extension: Scraping error', error);
  
  // Notify popup of error
  chrome.runtime.sendMessage({
    type: 'SYNC_COMPLETE',
    data: { success: false, error: error }
  });
  
  sendResponse({ success: false, error: error });
}



// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  console.log('YALG Extension: Installed/Updated', details);
});

chrome.runtime.onStartup.addListener(() => {
  console.log('YALG Extension: Started');
}); 