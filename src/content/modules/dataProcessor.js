// Data Processor for handling collected HTML elements
import { Logger } from '../../shared/utils/logger.js';
import { MessageHandler } from '../../shared/utils/messaging.js';
import { MESSAGES, DELAYS } from '../../shared/constants.js';

export class DataProcessor {
  constructor() {
    this.logger = new Logger('DataProcessor');
    this.messageHandler = new MessageHandler('content');
    this.processingStats = {
      totalSuccessful: 0,
      totalFailed: 0,
      processed: 0
    };
  }
  
  async processElementsAsync(collectedElements, progressCallback) {
    if (!collectedElements || collectedElements.length === 0) {
      this.logger.info('No elements to process');
      return;
    }
    
    this.logger.info(`Starting async processing of ${collectedElements.length} posts`);
    this.resetStats();
    
    // Process posts individually with fire-and-forget approach
    return new Promise((resolve) => {
      this.processAllElements(collectedElements, progressCallback, resolve);
    });
  }
  
  processAllElements(collectedElements, progressCallback, onComplete) {
    const totalElements = collectedElements.length;
    
    // Fire all posts immediately with small delays (super fast, non-blocking)
    this.logger.info(`🚀 Firing all ${totalElements} posts with 100ms intervals...`);
    
    collectedElements.forEach((element, index) => {
      // Small delay between each fire to avoid overwhelming server
      setTimeout(() => {
        this.processPost(element, index, totalElements, progressCallback, onComplete);
      }, index * DELAYS.ELEMENT_PROCESSING_INTERVAL);
    });
    
    this.logger.info(`🚀 All ${totalElements} posts fired! Processing in background...`);
  }
  
  async processPost(element, index, totalElements, progressCallback, onComplete) {
    const postNumber = index + 1;
    this.logger.info(`🚀 Queueing post ${postNumber}/${totalElements} (ID: ${element.id})`);
    
    try {
      const success = await this.sendSingleElementToBackend(element);
      
      if (success) {
        this.processingStats.totalSuccessful++;
        this.logger.info(`✓ Post ${postNumber} queued successfully`);
      } else {
        this.processingStats.totalFailed++;
        this.logger.info(`✗ Post ${postNumber} failed to queue`);
      }
    } catch (error) {
      this.processingStats.totalFailed++;
      this.logger.error(`✗ Error queueing post ${postNumber}:`, error);
    }
    
    // Update stats
    this.processingStats.processed++;
    const completedCount = this.processingStats.processed;
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        phase: 'queueing',
        totalProcessed: completedCount,
        totalElements: totalElements,
        totalSuccessful: this.processingStats.totalSuccessful,
        totalFailed: this.processingStats.totalFailed,
        currentPost: postNumber
      });
    }
    
    // Send progress update to background
    this.messageHandler.sendToBackground({
      type: MESSAGES.SCRAPING_PROGRESS,
      data: {
        phase: 'queueing',
        totalProcessed: completedCount,
        totalElements: totalElements,
        totalSuccessful: this.processingStats.totalSuccessful,
        totalFailed: this.processingStats.totalFailed,
        currentPost: postNumber
      }
    });
    
    // Check if all posts are done
    if (completedCount === totalElements) {
      this.logger.info(`🎉 All posts queued! Total: ${totalElements}, Successful: ${this.processingStats.totalSuccessful}, Failed: ${this.processingStats.totalFailed}`);
      
      const completionData = {
        totalProcessed: totalElements,
        totalSuccessful: this.processingStats.totalSuccessful,
        totalFailed: this.processingStats.totalFailed,
        message: 'All posts queued for background processing!'
      };
      
      // Notify completion
      if (onComplete) {
        onComplete(completionData);
      }
      
      // Send final summary to background
      this.messageHandler.sendToBackground({
        type: MESSAGES.SCRAPING_COMPLETE,
        data: completionData
      });
    }
  }
  
  async sendSingleElementToBackend(elementData) {
    try {
      const response = await this.messageHandler.sendToBackground({
        type: MESSAGES.PROCESS_SINGLE_HTML_ELEMENT,
        data: elementData
      });
      
      if (response && response.success) {
        return true;
      } else {
        this.logger.error('Backend processing failed for element:', elementData.id, response?.error);
        return false;
      }
    } catch (error) {
      this.logger.error('Error sending element to background:', error);
      return false;
    }
  }
  
  resetStats() {
    this.processingStats = {
      totalSuccessful: 0,
      totalFailed: 0,
      processed: 0
    };
  }
  
  getStats() {
    return { ...this.processingStats };
  }
  
  getSuccessRate() {
    const total = this.processingStats.totalSuccessful + this.processingStats.totalFailed;
    if (total === 0) return 0;
    return (this.processingStats.totalSuccessful / total) * 100;
  }
  
  // Batch processing alternative (for future use)
  async processBatch(elements, batchSize = 5) {
    this.logger.info(`Processing ${elements.length} elements in batches of ${batchSize}`);
    
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      this.logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(elements.length / batchSize)}`);
      
      // Process batch concurrently
      const promises = batch.map(element => this.sendSingleElementToBackend(element));
      const results = await Promise.allSettled(promises);
      
      // Update stats
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          this.processingStats.totalSuccessful++;
        } else {
          this.processingStats.totalFailed++;
          this.logger.error(`Batch element failed:`, batch[index].id, result.reason);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < elements.length) {
        await this.wait(DELAYS.BATCH_PROCESSING);
      }
    }
    
    this.logger.info('Batch processing complete:', this.getStats());
  }
  
  // Utility methods
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  validateElement(element) {
    return element && 
           element.id && 
           element.html && 
           element.url && 
           element.timestamp;
  }
  
  sanitizeElement(element) {
    return {
      id: element.id,
      html: element.html,
      url: element.url,
      timestamp: element.timestamp,
      elementIndex: element.elementIndex,
      scrollAttempt: element.scrollAttempt
    };
  }
  
  getProcessingReport() {
    const stats = this.getStats();
    const successRate = this.getSuccessRate();
    
    return {
      ...stats,
      successRate: Math.round(successRate * 100) / 100,
      total: stats.totalSuccessful + stats.totalFailed,
      status: stats.processed > 0 ? 'completed' : 'not_started'
    };
  }
} 