// Progress Tracker for managing sync progress and UI updates
import { Logger } from '../../shared/utils/logger.js';
import { MessageHandler } from '../../shared/utils/messaging.js';
import { MESSAGES } from '../../shared/constants.js';

export class ProgressTracker {
  constructor(uiManager) {
    this.logger = new Logger('ProgressTracker');
    this.messageHandler = new MessageHandler('content');
    this.uiManager = uiManager;
    
    this.state = {
      phase: 'initializing',
      totalElements: 0,
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      currentPost: 0,
      scrollAttempt: 0,
      message: '',
      startTime: null,
      endTime: null
    };
  }
  
  reset() {
    this.state = {
      phase: 'initializing',
      totalElements: 0,
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      currentPost: 0,
      scrollAttempt: 0,
      message: '',
      startTime: Date.now(),
      endTime: null
    };
    
    this.logger.info('Progress tracker reset');
  }
  
  updateCollection(data) {
    this.state = {
      ...this.state,
      phase: 'collecting',
      totalElements: data.totalElements || this.state.totalElements,
      scrollAttempt: data.scrollAttempt || this.state.scrollAttempt,
      message: data.message || this.state.message
    };
    
    this.updateUI();
    this.logger.info('Collection progress updated:', this.getProgressSummary());
  }
  
  updateProcessing(data) {
    this.state = {
      ...this.state,
      phase: 'queueing',
      totalElements: data.totalElements || this.state.totalElements,
      totalProcessed: data.totalProcessed || this.state.totalProcessed,
      totalSuccessful: data.totalSuccessful || this.state.totalSuccessful,
      totalFailed: data.totalFailed || this.state.totalFailed,
      currentPost: data.currentPost || this.state.currentPost,
      message: data.message || this.state.message
    };
    
    this.updateUI();
    
    // Check if processing is complete
    if (this.isProcessingComplete()) {
      this.handleCompletion();
    }
  }
  
  updateUI() {
    if (this.uiManager) {
      this.uiManager.updateProgress(this.state);
    }
  }
  
  isProcessingComplete() {
    return this.state.totalProcessed === this.state.totalElements && 
           this.state.totalElements > 0;
  }
  
  handleCompletion() {
    this.state.endTime = Date.now();
    this.state.phase = 'completed';
    
    const completionData = {
      totalProcessed: this.state.totalElements,
      totalSuccessful: this.state.totalSuccessful,
      totalFailed: this.state.totalFailed,
      message: this.getCompletionMessage(),
      duration: this.getDuration(),
      successRate: this.getSuccessRate()
    };
    
    this.logger.info('Sync completed:', completionData);
    
    // Show completion UI
    if (this.uiManager) {
      this.uiManager.showCompletionPopup(completionData);
    }
    
    // Send completion message to background
    this.messageHandler.sendToBackground({
      type: MESSAGES.SYNC_COMPLETED,
      data: completionData
    });
  }
  
  getCompletionMessage() {
    const { totalSuccessful, totalFailed, totalElements } = this.state;
    
    if (totalFailed === 0) {
      return `Successfully processed all ${totalElements} posts!`;
    } else if (totalSuccessful === 0) {
      return `Failed to process ${totalFailed} posts. Please check your connection and try again.`;
    } else {
      return `Processed ${totalSuccessful} posts successfully, ${totalFailed} failed.`;
    }
  }
  
  getDuration() {
    if (!this.state.startTime) return 0;
    const endTime = this.state.endTime || Date.now();
    return Math.round((endTime - this.state.startTime) / 1000); // in seconds
  }
  
  getSuccessRate() {
    const total = this.state.totalSuccessful + this.state.totalFailed;
    if (total === 0) return 0;
    return Math.round((this.state.totalSuccessful / total) * 100);
  }
  
  getProgressPercentage() {
    if (this.state.totalElements === 0) return 0;
    return Math.min(100, (this.state.totalProcessed / this.state.totalElements) * 100);
  }
  
  getProgressSummary() {
    return {
      phase: this.state.phase,
      progress: `${this.state.totalProcessed}/${this.state.totalElements}`,
      percentage: Math.round(this.getProgressPercentage()),
      successful: this.state.totalSuccessful,
      failed: this.state.totalFailed,
      duration: this.getDuration()
    };
  }
  
  getCurrentState() {
    return {
      ...this.state,
      progressPercentage: this.getProgressPercentage(),
      duration: this.getDuration(),
      successRate: this.getSuccessRate()
    };
  }
  
  // Manual progress updates
  setPhase(phase, message = '') {
    this.state.phase = phase;
    this.state.message = message;
    this.updateUI();
    this.logger.info(`Phase changed to: ${phase}`, message);
  }
  
  incrementProcessed() {
    this.state.totalProcessed++;
    this.updateUI();
  }
  
  incrementSuccessful() {
    this.state.totalSuccessful++;
    this.updateUI();
  }
  
  incrementFailed() {
    this.state.totalFailed++;
    this.updateUI();
  }
  
  setTotalElements(count) {
    this.state.totalElements = count;
    this.updateUI();
    this.logger.info(`Total elements set to: ${count}`);
  }
  
  setMessage(message) {
    this.state.message = message;
    this.updateUI();
  }
  
  // Statistics and reporting
  getStatistics() {
    const duration = this.getDuration();
    const elementsPerSecond = duration > 0 ? this.state.totalProcessed / duration : 0;
    
    return {
      totalElements: this.state.totalElements,
      totalProcessed: this.state.totalProcessed,
      totalSuccessful: this.state.totalSuccessful,
      totalFailed: this.state.totalFailed,
      successRate: this.getSuccessRate(),
      duration: duration,
      elementsPerSecond: Math.round(elementsPerSecond * 100) / 100,
      phase: this.state.phase,
      scrollAttempts: this.state.scrollAttempt,
      startTime: this.state.startTime,
      endTime: this.state.endTime
    };
  }
  
  exportProgressData() {
    return {
      timestamp: new Date().toISOString(),
      state: this.getCurrentState(),
      statistics: this.getStatistics(),
      summary: this.getProgressSummary()
    };
  }
  
  // Error handling
  handleError(error, context = '') {
    this.logger.error('Progress tracker error:', error, context);
    this.state.phase = 'error';
    this.state.message = error.message || 'An error occurred';
    
    if (this.uiManager) {
      this.uiManager.showError(this.state.message);
    }
    
    // Send error to background
    this.messageHandler.sendToBackground({
      type: MESSAGES.PROGRESS_ERROR,
      data: {
        error: error.message,
        context,
        state: this.getCurrentState()
      }
    });
  }
  
  // Utility methods
  isActive() {
    return this.state.phase !== 'initializing' && 
           this.state.phase !== 'completed' && 
           this.state.phase !== 'error';
  }
  
  isCompleted() {
    return this.state.phase === 'completed';
  }
  
  hasErrors() {
    return this.state.totalFailed > 0;
  }
  
  getTimeRemaining() {
    if (!this.isActive() || this.state.totalProcessed === 0) return 0;
    
    const duration = this.getDuration();
    const rate = this.state.totalProcessed / duration;
    const remaining = this.state.totalElements - this.state.totalProcessed;
    
    return Math.round(remaining / rate);
  }
} 