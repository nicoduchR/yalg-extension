/**
 * Sync Service
 * Manages the synchronization process between LinkedIn and YALG backend
 */

import { MESSAGE_TYPES, LINKEDIN_URLS, SYNC_PHASES } from '../../shared/constants.js';
import { Logger } from '../../shared/utils/logger.js';
import { MessageService } from '../../shared/utils/messaging.js';
import { StorageService } from '../../shared/utils/storage.js';

export class SyncService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.logger = Logger.createScoped('SYNC');
    this.currentSync = null;
    this.syncHistory = [];
  }

  /**
   * Start synchronization process
   * @param {Object} config - Sync configuration
   * @returns {Promise<Object>} Sync result
   */
  async startSync(config) {
    try {
      this.logger.info('Starting sync process', config);

      // Check if sync is already in progress
      if (this.currentSync && !this.currentSync.completed) {
        throw new Error('Sync already in progress');
      }

      // Initialize sync session
      const syncSession = this.createSyncSession(config);
      this.currentSync = syncSession;

      // Find or create LinkedIn tab
      const tabId = await this.ensureLinkedInTab();
      
      // Start scraping process
      const result = await this.initiateScraping(tabId, config);
      
      // Update sync session
      syncSession.result = result;
      syncSession.completed = true;
      syncSession.endTime = Date.now();

      // Add to history
      this.syncHistory.push(syncSession);

      this.logger.info('Sync process completed', { sessionId: syncSession.id, result });
      return result;

    } catch (error) {
      this.logger.error('Sync process failed', error);
      
      if (this.currentSync) {
        this.currentSync.error = error.message;
        this.currentSync.completed = true;
        this.currentSync.endTime = Date.now();
      }
      
      throw error;
    }
  }

  /**
   * Create sync session
   * @param {Object} config - Sync configuration
   * @returns {Object} Sync session
   */
  createSyncSession(config) {
    const sessionId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: sessionId,
      startTime: Date.now(),
      endTime: null,
      config,
      phase: SYNC_PHASES.INITIALIZING,
      completed: false,
      error: null,
      result: null,
      stats: {
        postsCollected: 0,
        postsProcessed: 0,
        postsSuccessful: 0,
        postsFailed: 0
      }
    };
  }

  /**
   * Ensure LinkedIn tab is available
   * @returns {Promise<number>} Tab ID
   */
  async ensureLinkedInTab() {
    try {
      // Check for existing LinkedIn tabs
      const linkedinTabs = await chrome.tabs.query({ 
        url: '*://*.linkedin.com/*',
        active: true,
        currentWindow: true
      });

      if (linkedinTabs.length > 0) {
        this.logger.debug('Using existing LinkedIn tab', { tabId: linkedinTabs[0].id });
        return linkedinTabs[0].id;
      }

      // Create new LinkedIn tab
      this.logger.info('Creating new LinkedIn tab');
      const newTab = await chrome.tabs.create({
        url: LINKEDIN_URLS.FEED,
        active: true
      });

      // Wait for tab to load
      await this.waitForTabLoad(newTab.id);
      
      return newTab.id;

    } catch (error) {
      this.logger.error('Failed to ensure LinkedIn tab', error);
      throw new Error('Could not access LinkedIn. Please ensure you are logged in.');
    }
  }

  /**
   * Wait for tab to load completely
   * @param {number} tabId - Tab ID
   * @returns {Promise<void>}
   */
  async waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 30000);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Additional delay to ensure LinkedIn has fully loaded
          setTimeout(resolve, 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Initiate scraping process
   * @param {number} tabId - LinkedIn tab ID
   * @param {Object} config - Sync configuration
   * @returns {Promise<Object>} Scraping result
   */
  async initiateScraping(tabId, config) {
    try {
      this.logger.info('Initiating scraping process', { tabId, config });

      // Send scraping command to content script
      const response = await MessageService.sendToContent(
        tabId,
        MESSAGE_TYPES.START_SCRAPING,
        { config },
        { timeout: 10000, retries: 2 }
      );

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to start scraping');
      }

      this.logger.info('Scraping initiated successfully', { tabId, response });
      return response;

    } catch (error) {
      this.logger.error('Failed to initiate scraping', { tabId, error });
      throw new Error(`Scraping initiation failed: ${error.message}`);
    }
  }

  /**
   * Handle sync progress updates
   * @param {Object} progressData - Progress data
   */
  async handleSyncProgress(progressData) {
    if (!this.currentSync) {
      this.logger.warn('Received progress update but no active sync session');
      return;
    }

    // Update current sync session
    this.currentSync.phase = progressData.phase || this.currentSync.phase;
    Object.assign(this.currentSync.stats, progressData.stats || {});

    // Update storage with latest stats
    await this.updateStorageStats(progressData);

    this.logger.debug('Sync progress updated', { 
      sessionId: this.currentSync.id,
      progress: progressData 
    });
  }

  /**
   * Handle sync completion
   * @param {Object} completionData - Completion data
   */
  async handleSyncCompletion(completionData) {
    if (!this.currentSync) {
      this.logger.warn('Received completion update but no active sync session');
      return;
    }

    // Update sync session
    this.currentSync.completed = true;
    this.currentSync.endTime = Date.now();
    this.currentSync.result = completionData;
    this.currentSync.phase = SYNC_PHASES.COMPLETED;

    // Update final statistics
    await this.updateStorageStats(completionData, true);

    this.logger.info('Sync completed', { 
      sessionId: this.currentSync.id,
      duration: this.currentSync.endTime - this.currentSync.startTime,
      result: completionData
    });
  }

  /**
   * Handle sync error
   * @param {string|Error} error - Error information
   */
  async handleSyncError(error) {
    if (!this.currentSync) {
      this.logger.warn('Received error update but no active sync session');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : error;

    // Update sync session
    this.currentSync.completed = true;
    this.currentSync.endTime = Date.now();
    this.currentSync.error = errorMessage;
    this.currentSync.phase = SYNC_PHASES.ERROR;

    // Update error statistics
    const currentStats = await StorageService.getSyncStats();
    await StorageService.updateSyncStats({
      failedSyncs: currentStats.failedSyncs + 1,
      lastSync: new Date().toISOString()
    });

    this.logger.error('Sync failed', { 
      sessionId: this.currentSync.id,
      duration: this.currentSync.endTime - this.currentSync.startTime,
      error: errorMessage
    });
  }

  /**
   * Update storage statistics
   * @param {Object} data - Statistics data
   * @param {boolean} isFinal - Whether this is the final update
   */
  async updateStorageStats(data, isFinal = false) {
    try {
      const updates = {
        lastSync: new Date().toISOString()
      };

      if (data.stats) {
        if (data.stats.totalPosts !== undefined) {
          updates.totalPosts = data.stats.totalPosts;
        }
      }

      if (isFinal) {
        const currentStats = await StorageService.getSyncStats();
        updates.totalSyncs = currentStats.totalSyncs + 1;
        
        if (!this.currentSync.error) {
          updates.successfulSyncs = currentStats.successfulSyncs + 1;
        } else {
          updates.failedSyncs = currentStats.failedSyncs + 1;
        }
      }

      await StorageService.updateSyncStats(updates);
      
    } catch (error) {
      this.logger.error('Failed to update storage stats', error);
    }
  }

  /**
   * Get current sync status
   * @returns {Object|null} Current sync status
   */
  getCurrentSyncStatus() {
    if (!this.currentSync) {
      return null;
    }

    return {
      id: this.currentSync.id,
      phase: this.currentSync.phase,
      startTime: this.currentSync.startTime,
      completed: this.currentSync.completed,
      error: this.currentSync.error,
      stats: { ...this.currentSync.stats }
    };
  }

  /**
   * Get sync history
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Sync history
   */
  getSyncHistory(limit = 10) {
    return this.syncHistory
      .slice(-limit)
      .map(session => ({
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.endTime ? session.endTime - session.startTime : null,
        phase: session.phase,
        completed: session.completed,
        error: session.error,
        stats: { ...session.stats }
      }));
  }

  /**
   * Cancel current sync
   * @returns {Promise<boolean>} Success status
   */
  async cancelSync() {
    if (!this.currentSync || this.currentSync.completed) {
      this.logger.warn('No active sync to cancel');
      return false;
    }

    try {
      // Try to stop content script scraping
      const linkedinTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
      
      for (const tab of linkedinTabs) {
        try {
          await MessageService.sendToContent(tab.id, 'STOP_SCRAPING', {}, { timeout: 2000 });
        } catch (e) {
          // Ignore errors when canceling
        }
      }

      // Mark sync as completed with cancellation
      this.currentSync.completed = true;
      this.currentSync.endTime = Date.now();
      this.currentSync.error = 'Cancelled by user';
      this.currentSync.phase = SYNC_PHASES.ERROR;

      this.logger.info('Sync cancelled', { sessionId: this.currentSync.id });
      return true;

    } catch (error) {
      this.logger.error('Failed to cancel sync', error);
      return false;
    }
  }

  /**
   * Get sync statistics summary
   * @returns {Promise<Object>} Statistics summary
   */
  async getStatsSummary() {
    try {
      const storageStats = await StorageService.getSyncStats();
      const currentStatus = this.getCurrentSyncStatus();
      
      return {
        current: currentStatus,
        total: {
          syncs: storageStats.totalSyncs || 0,
          successful: storageStats.successfulSyncs || 0,
          failed: storageStats.failedSyncs || 0,
          posts: storageStats.totalPosts || 0,
          lastSync: storageStats.lastSync
        },
        history: this.getSyncHistory(5)
      };
    } catch (error) {
      this.logger.error('Failed to get stats summary', error);
      return {
        current: null,
        total: { syncs: 0, successful: 0, failed: 0, posts: 0, lastSync: null },
        history: []
      };
    }
  }
} 