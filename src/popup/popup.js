// Modern YALG Extension Popup (No ES6 imports)
console.log('YALG Extension: Modern popup script loaded');

// Wait for constants to be loaded, then initialize
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure constants are loaded
  setTimeout(initializePopup, 100);
});

function initializePopup() {
  // Check if constants are available
  if (!window.YALG_URLS) {
    console.error('YALG constants not loaded, retrying...');
    setTimeout(initializePopup, 500);
    return;
  }
  
  console.log('YALG constants loaded successfully');
  
  // Initialize popup with loaded constants
  new YALGPopup();
}

// Simplified TokenManager that just checks accessToken cookie
class TokenManagerWrapper {
  static get FRONTEND_URL() {
    return window.YALG_URLS?.FRONTEND_BASE || 'http://localhost:3400';
  }
  
  static get BACKEND_URL() {
    return window.YALG_URLS?.BACKEND_BASE || 'http://localhost:3000';
  }

  static async getAuthStatus() {
    try {
      console.log('TokenManager: Checking accessToken cookie...');
      
      // Get the accessToken cookie from the YALG frontend domain
      const cookies = await chrome.cookies.getAll({ 
        domain: new URL(this.FRONTEND_URL).hostname,
        name: 'accessToken'
      });
      
      if (cookies.length === 0) {
        console.log('TokenManager: No accessToken cookie found');
        return {
          isAuthenticated: false,
          status: 'no_token',
          message: 'Not connected to YALG',
          needsLogin: true
        };
      }

      const accessTokenCookie = cookies[0];
      console.log('TokenManager: Found accessToken cookie');

      // Simply return authenticated if cookie exists and is not empty
      if (accessTokenCookie.value && accessTokenCookie.value.trim() !== '') {
        return {
          isAuthenticated: true,
          status: 'valid',
          message: 'Connected to YALG',
          needsLogin: false,
          token: accessTokenCookie.value
        };
      } else {
        console.log('TokenManager: accessToken cookie is empty');
        return {
          isAuthenticated: false,
          status: 'empty_token',
          message: 'Not connected to YALG',
          needsLogin: true
        };
      }
    } catch (error) {
      console.error('TokenManager: Failed to check auth status', error);
      return {
        isAuthenticated: false,
        status: 'error',
        message: 'Failed to check authentication',
        needsLogin: true,
        error: error.message
      };
    }
  }

      static async openLoginPage() {
    try {
      const loginUrl = window.YALG_URLS?.FRONTEND_LOGIN_WITH_EXT || `${this.FRONTEND_URL}/login?ext=true`;
      await chrome.tabs.create({ url: loginUrl, active: true });
      console.log('TokenManager: Opened login page', { loginUrl });
    } catch (error) {
      console.error('TokenManager: Failed to open login page', error);
    }
  }

  // Keep this method for compatibility with existing code
  static async getAuthConfig() {
    const authStatus = await this.getAuthStatus();
    if (authStatus.isAuthenticated) {
      return {
        authToken: authStatus.token,
        frontendUrl: this.FRONTEND_URL,
        backendUrl: this.BACKEND_URL
      };
    }
    return null;
  }
}

class YALGPopup {
  constructor() {
    // Recording state
    this.isRecording = false;
    this.recordingStartTime = null;
    this.timerInterval = null;
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Sync state
    this.isSyncing = false;

    // Authentication state
    this.authStatus = null;

    // DOM elements
    this.elements = {};
    
    this.init();
  }

  async init() {
    console.log('Initializing YALG popup');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
    } else {
      this.onDOMReady();
    }
  }

  async onDOMReady() {
    console.log('DOM ready, setting up popup');
    
    // Cache DOM elements
    this.cacheElements();
  
    // Set up event listeners
    this.setupEventListeners();
    
    // Load initial data
    await this.loadInitialData();
    
    // Check connection status
    await this.checkConnectionStatus();
    
    // Set up message listeners
    this.setupMessageListeners();
    
    // Set up window focus listener to recheck authentication
    this.setupWindowFocusListener();
  }

  cacheElements() {
    const elementIds = [
      'statusIndicator', 'statusText', 'lastSync',
      'progressContainer', 'progressFill', 'progressText',
      'postsCollected', 'anecdotesCount',
      'errorMessage', 'successMessage',
      'recordButton', 'syncButton', 'dashboardLink', 
      'loginButton', 'refreshButton',
      'recordingUI', 'recordingTimer', 'stopRecording', 'cancelRecording'
    ];
    
    this.elements = {};
    
    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn(`YALG Extension: Element with ID '${id}' not found in popup HTML`);
      }
      this.elements[id] = element;
    });
    
    console.log('YALG Extension: Cached elements:', Object.keys(this.elements).filter(key => this.elements[key]));
  }

  setupEventListeners() {
    // Record button
    this.elements.recordButton.addEventListener('click', () => this.handleRecordClick());
    
    // Sync button
    this.elements.syncButton.addEventListener('click', () => this.handleSyncClick());
    
    // Recording controls
    this.elements.stopRecording.addEventListener('click', () => this.stopRecording());
    this.elements.cancelRecording.addEventListener('click', () => this.cancelRecording());
    
    // Dashboard link
    this.elements.dashboardLink.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default link behavior
      this.openDashboard();
    });

    // Login button
    this.elements.loginButton.addEventListener('click', () => this.handleLoginClick());
    
    // Refresh button
    this.elements.refreshButton.addEventListener('click', () => this.handleRefreshClick());
  }

  setupMessageListeners() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message:', message);
      
      switch (message.type) {
        case 'PROGRESS_UPDATE':
          this.updateProgress(message.data);
          break;
        case 'SYNC_COMPLETE':
          this.handleSyncComplete(message.data);
          break;
        case 'SYNC_ERROR':
          this.handleSyncError(message.data);
          break;
        case 'AUTH_EVENT':
          this.handleAuthEvent(message);
          break;

      }
    });
  }

  setupWindowFocusListener() {
    // Check authentication when popup gets focus (user might have logged in)
    window.addEventListener('focus', async () => {
      console.log('YALG Extension: Popup focused, rechecking authentication');
      
      // Only recheck if we're currently not authenticated
      if (!this.authStatus || !this.authStatus.isAuthenticated) {
        await this.checkConnectionStatus();
      }
    });
    
    // Also check on visibility change
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        console.log('YALG Extension: Popup visible, rechecking authentication');
        
        // Only recheck if we're currently not authenticated
        if (!this.authStatus || !this.authStatus.isAuthenticated) {
          await this.checkConnectionStatus();
        }
      }
    });
  }

  handleAuthEvent(message) {
    console.log('YALG Extension: Received auth event', message);
    
    switch (message.eventType) {
      case 'AUTH_SUCCESS':
        // User has successfully authenticated
        this.showMessage('Successfully connected to YALG!', 'success');
        // Recheck connection status to update UI
        setTimeout(() => this.checkConnectionStatus(), 500);
        break;
      case 'AUTH_LOGOUT':
        // User has logged out
        this.showMessage('Disconnected from YALG', 'info');
        // Recheck connection status to update UI
        setTimeout(() => this.checkConnectionStatus(), 500);
        break;
    }
  }

  async loadInitialData() {
    try {
      // Load stats from storage
      const result = await chrome.storage.local.get(['syncStats', 'config']);
      if (result.syncStats) {
        const stats = result.syncStats;
        if (this.elements.postsCollected) {
          this.elements.postsCollected.textContent = stats.totalPosts || '0';
        }
        if (stats.lastSync && this.elements.lastSync) {
          const date = new Date(stats.lastSync);
          this.elements.lastSync.textContent = `Last sync: ${this.formatDate(date)}`;
        }
      }

      // Load anecdotes count (placeholder - could be loaded from storage if stored)
      const anecdotesResult = await chrome.storage.local.get(['anecdotes']);
      if (anecdotesResult.anecdotes && Array.isArray(anecdotesResult.anecdotes) && this.elements.anecdotesCount) {
        this.elements.anecdotesCount.textContent = anecdotesResult.anecdotes.length.toString();
      }

      // Set dashboard link
      this.elements.dashboardLink.href = `${TokenManagerWrapper.FRONTEND_URL}/dashboard`;
      console.log('Dashboard link set to:', this.elements.dashboardLink.href);
      
    } catch (error) {
      console.warn('Could not load initial data:', error);
    }
  }

  async checkConnectionStatus() {
    try {
      console.log('YALG Extension: Checking connection status...');
      
      // Use simplified TokenManager to check accessToken cookie
      this.authStatus = await TokenManagerWrapper.getAuthStatus();
      
      console.log('YALG Extension: Auth status:', this.authStatus);
      
      if (this.authStatus.isAuthenticated) {
        // User is authenticated (has valid accessToken cookie)
        this.updateStatus('connected', this.authStatus.message);
        this.showDashboardLink();
        this.hideMessages();
        
        // Update dashboard link 
        this.elements.dashboardLink.href = `${TokenManagerWrapper.FRONTEND_URL}/dashboard`;
      } else {
        // User is not authenticated (no accessToken cookie)
        this.updateStatus('error', this.authStatus.message);
        this.showLoginButton();
        this.showMessage('Please log in to your YALG account to connect the extension.', 'error');
      }
    } catch (error) {
      console.error('YALG Extension: Connection check failed:', error);
      this.updateStatus('error', 'Connection check failed');
      this.showLoginButton();
      this.showMessage('Failed to check connection status. Please try connecting again.', 'error');
    }
  }

  // Legacy methods removed - now using TokenManagerWrapper

  updateStatus(type, text) {
    this.elements.statusText.textContent = text;
    this.elements.statusIndicator.className = `status-indicator ${type}`;
  }

  // Voice Recording Functions
  async handleRecordClick() {
    if (this.isRecording) {
      return;
    }
    
    try {
      // Check authentication status using simplified cookie check
      const authStatus = await TokenManagerWrapper.getAuthStatus();
      if (!authStatus.isAuthenticated) {
        this.showError('Please log in to YALG first');
        this.showLoginButton();
        return;
      }

      console.log('Starting recording in popup...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Create blob and upload
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        this.uploadRecording(audioBlob);
      };

      // Start recording
      this.mediaRecorder.start();
      
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.showRecordingUI();
      this.startTimer();

      console.log('Recording started successfully in popup');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError(`Recording error: ${error.message || 'Unknown error'}`);
    }
  }



  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    console.log('Stopping recording in popup...');
    
    try {
      // Stop the media recorder - this will trigger the onstop event
      this.mediaRecorder.stop();
      
      // Update UI immediately
      this.isRecording = false;
      this.stopTimer();
      this.hideRecordingUI();
      this.resetRecordButton();
      this.showMessage('Processing anecdote...', 'success');
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.showError('Failed to stop recording: ' + error.message);
    }
  }

  cancelRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    console.log('Cancelling recording in popup...');
    
    try {
      // Stop the media recorder without processing
      this.mediaRecorder.stop();
      
      // Clear audio chunks to prevent upload
      this.audioChunks = [];
      
      // Update UI immediately
      this.isRecording = false;
      this.stopTimer();
      this.hideRecordingUI();
      this.resetRecordButton();
      this.showMessage('Recording cancelled', 'success');
      
    } catch (error) {
      console.error('Error cancelling recording:', error);
      this.showError('Failed to cancel recording: ' + error.message);
    }
  }

  async uploadRecording(audioBlob) {
    try {
      // Check if recording was cancelled (no audio chunks)
      if (this.audioChunks.length === 0) {
        console.log('Recording was cancelled, not uploading');
        return;
      }

      console.log('Uploading recording...', audioBlob.size, 'bytes');
      
      // Get authentication token from cookie
      const authStatus = await TokenManagerWrapper.getAuthStatus();
      if (!authStatus.isAuthenticated) {
        this.showError('Authentication required to upload recording');
        this.showLoginButton();
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Upload to backend with autoFill enabled
      const response = await fetch(`${TokenManagerWrapper.BACKEND_URL}/anecdotes/audio?autoFill=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStatus.token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Recording uploaded successfully:', data);
      
      this.showMessage('Anecdote created successfully!', 'success');
      
      // Update anecdotes count (if element exists)
      if (this.elements.anecdotesCount) {
        const currentCount = parseInt(this.elements.anecdotesCount.textContent) || 0;
        this.elements.anecdotesCount.textContent = (currentCount + 1).toString();
      }
      
    } catch (error) {
      console.error('Error uploading recording:', error);
      this.showError('Failed to upload recording: ' + error.message);
    }
  }



  showRecordingUI() {
    this.elements.recordingUI.classList.add('show');
    this.elements.recordButton.classList.add('recording');
    this.elements.recordButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
      Recording...
    `;
    this.elements.recordButton.disabled = true;
  }

  hideRecordingUI() {
    this.elements.recordingUI.classList.remove('show');
  }

  resetRecordButton() {
    this.elements.recordButton.classList.remove('recording');
    this.elements.recordButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m12 1-3 3v8l3 3 3-3V4l-3-3z"/>
        <path d="M8 9v3a4 4 0 0 0 8 0V9"/>
        <path d="M8 21h8"/>
      </svg>
      Record Anecdote
    `;
    this.elements.recordButton.disabled = false;
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.recordingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.elements.recordingTimer.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.elements.recordingTimer.textContent = '00:00';
  }

  // Sync Functions
  async handleSyncClick() {
    if (this.isSyncing) {
      return;
    }

    try {
      // Check authentication status using simplified cookie check
      const authStatus = await TokenManagerWrapper.getAuthStatus();
      if (!authStatus.isAuthenticated) {
        this.showError('Please log in to YALG first');
        this.showLoginButton();
        return;
      }

      this.isSyncing = true;
      this.updateStatus('syncing', 'Starting sync...');
      this.elements.syncButton.disabled = true;
      this.elements.syncButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
        </svg>
        Syncing...
      `;

      // Check if LinkedIn tab is open
      const linkedinTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
      
      if (linkedinTabs.length === 0) {
        this.updateStatus('syncing', 'Opening LinkedIn...');
        await chrome.tabs.create({ url: window.YALG_URLS?.LINKEDIN_FEED || 'https://www.linkedin.com/feed/' });
      }

      // Start sync via background script
      chrome.runtime.sendMessage({
        type: 'START_SYNC',
        data: {
          authToken: authStatus.token,
          backendUrl: TokenManagerWrapper.BACKEND_URL
        }
      }, (response) => {
        if (response && response.success) {
          this.updateStatus('syncing', 'Syncing posts...');
          this.showProgress();
        } else {
          this.handleSyncError({ error: response?.error || 'Failed to start sync' });
        }
      });

    } catch (error) {
      this.handleSyncError({ error: error.message });
    }
  }

  showProgress() {
    this.elements.progressContainer.classList.remove('hidden');
  }

  hideProgress() {
    this.elements.progressContainer.classList.add('hidden');
    this.elements.progressFill.style.width = '0%';
  }

  updateProgress(data) {
    if (data.phase === 'collecting') {
      if (this.elements.postsCollected) {
        this.elements.postsCollected.textContent = data.totalCollected || 0;
      }
    
      if (data.scrollAttempt && data.maxAttempts) {
        const progress = (data.scrollAttempt / data.maxAttempts) * 100;
        if (this.elements.progressFill) {
          this.elements.progressFill.style.width = `${progress}%`;
        }
        if (this.elements.progressText) {
          this.elements.progressText.textContent = 
            `Collecting posts... (${data.totalCollected || 0} found)`;
        }
      }
    } else if (data.phase === 'processing') {
      if (data.totalElements && data.totalProcessed !== undefined) {
        const progress = (data.totalProcessed / data.totalElements) * 100;
        if (this.elements.progressFill) {
          this.elements.progressFill.style.width = `${progress}%`;
        }
        
        const successCount = data.totalSuccessful || 0;
        const failedCount = data.totalFailed || 0;
        
        if (this.elements.progressText) {
          this.elements.progressText.textContent = 
            `Processing posts... (✓${successCount} ✗${failedCount}/${data.totalProcessed}/${data.totalElements})`;
        }
      }
    }
  }

  handleSyncComplete(data) {
    this.isSyncing = false;
    this.hideProgress();
    this.resetSyncButton();
    
    this.updateStatus('connected', 'Sync completed');
    this.showMessage(`Sync completed! Processed ${data.totalProcessed || 0} posts`, 'success');
    
    // Update stats
    if (data.totalProcessed && this.elements.postsCollected) {
      this.elements.postsCollected.textContent = data.totalProcessed;
    }
    
    // Update last sync time
    if (this.elements.lastSync) {
      this.elements.lastSync.textContent = `Last sync: ${this.formatDate(new Date())}`;
    }
    
    // Save stats
    chrome.storage.local.set({
      syncStats: {
        totalPosts: data.totalProcessed || 0,
        lastSync: new Date().toISOString()
      }
    });
  }

  handleSyncError(data) {
    this.isSyncing = false;
    this.hideProgress();
    this.resetSyncButton();
    
    this.updateStatus('error', 'Sync failed');
    this.showError(data.error || 'Sync failed');
  }

  resetSyncButton() {
    this.elements.syncButton.disabled = false;
    this.elements.syncButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
      </svg>
      Sync Posts
    `;
  }

  // UI Helper Functions
  showMessage(message, type) {
    this.hideMessages();
    const element = type === 'error' ? this.elements.errorMessage : this.elements.successMessage;
    element.textContent = message;
    element.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      element.classList.remove('show');
    }, 5000);
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  hideMessages() {
    this.elements.errorMessage.classList.remove('show');
    this.elements.successMessage.classList.remove('show');
  }

  async handleLoginClick() {
    console.log('YALG Extension: Login button clicked');
    
    try {
      // Show a helpful message
      this.showMessage('Opening YALG login page. After logging in, come back to this extension and it should connect automatically.', 'success');
      
      // Use TokenManager to open login page
      await TokenManagerWrapper.openLoginPage();
      
      // Set up a periodic check for authentication after login
      let checkCount = 0;
      const maxChecks = 12; // Check for 2 minutes (12 * 10 seconds)
      
      const checkInterval = setInterval(async () => {
        checkCount++;
        console.log(`YALG Extension: Checking for authentication (attempt ${checkCount}/${maxChecks})`);
        
        const authStatus = await TokenManagerWrapper.getAuthStatus();
        
        if (authStatus.isAuthenticated) {
          // User has successfully logged in
          console.log('YALG Extension: User authenticated, updating UI');
          clearInterval(checkInterval);
          
          // Update the popup UI
          this.authStatus = authStatus;
          this.updateStatus('connected', authStatus.message);
          this.showDashboardLink();
          this.hideMessages();
          this.showMessage('Successfully connected to YALG!', 'success');
          
          // Update dashboard link
          this.elements.dashboardLink.href = window.YALG_URLS?.FRONTEND_DASHBOARD || `${TokenManagerWrapper.FRONTEND_URL}/dashboard`;
        } else if (checkCount >= maxChecks) {
          // Stop checking after max attempts
          console.log('YALG Extension: Stopped checking for authentication');
          clearInterval(checkInterval);
          this.showMessage('If you\'ve completed login, try refreshing this popup.', 'info');
        }
      }, 10000); // Check every 10 seconds
      
    } catch (error) {
      console.error('YALG Extension: Error in login process:', error);
      this.showError('Failed to open login page. Please try again.');
    }
  }

  async handleRefreshClick() {
    console.log('YALG Extension: Refresh button clicked');
    
    try {
      // Show loading state
      this.elements.refreshButton.disabled = true;
      this.elements.refreshButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
        </svg>
        Checking...
      `;
      
      // Recheck connection status
      await this.checkConnectionStatus();
      
    } catch (error) {
      console.error('YALG Extension: Error refreshing connection:', error);
      this.showError('Failed to refresh connection status');
    } finally {
      // Reset refresh button
      this.elements.refreshButton.disabled = false;
      this.elements.refreshButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
        </svg>
        Refresh Connection
      `;
    }
  }

  showLoginButton() {
    this.elements.loginButton.classList.remove('hidden');
    this.elements.refreshButton.classList.add('hidden');
    this.elements.dashboardLink.classList.add('hidden');
  }

  showRefreshButton() {
    this.elements.refreshButton.classList.remove('hidden');
    this.elements.loginButton.classList.add('hidden');
    this.elements.dashboardLink.classList.add('hidden');
  }

  showDashboardLink() {
    this.elements.dashboardLink.classList.remove('hidden');
    this.elements.loginButton.classList.add('hidden');
    this.elements.refreshButton.classList.add('hidden');
  }

  openDashboard() {
    // Get the dashboard URL and open it
    const dashboardUrl = this.elements.dashboardLink.href || window.YALG_URLS?.FRONTEND_DASHBOARD || `${TokenManagerWrapper.FRONTEND_URL}/dashboard`;
    console.log('Opening dashboard URL:', dashboardUrl);
    
    // Ensure it's a valid URL
    if (dashboardUrl && (dashboardUrl.startsWith('http://') || dashboardUrl.startsWith('https://'))) {
      chrome.tabs.create({ url: dashboardUrl });
    } else {
      console.error('Invalid dashboard URL:', dashboardUrl);
      chrome.tabs.create({ url: window.YALG_URLS?.FRONTEND_DASHBOARD || `${TokenManagerWrapper.FRONTEND_URL}/dashboard` });
    }
  }

  formatDate(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    } 
  }
}

// Don't auto-initialize anymore - initialization is handled by the constants loading system above 