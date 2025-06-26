// Content Scraper for collecting LinkedIn HTML elements
import { Logger } from '../../shared/utils/logger.js';
import { SELECTORS, DELAYS, SCRAPING_LIMITS } from '../../shared/constants.js';

export class ContentScraper {
  constructor() {
    this.logger = new Logger('ContentScraper');
    this.processedElementIds = new Set();
    this.currentScrollAttempt = 0;
  }
  
  async collectAllElements(progressCallback) {
    if (!this.isOnRecentActivityPage()) {
      throw new Error('Must be on profile recent activity page to collect HTML');
    }
    
    this.logger.info('Starting HTML element collection from profile activity page');
    
    const collectedElements = [];
    let noNewElementsCount = 0;
    this.currentScrollAttempt = 0;
    this.processedElementIds.clear();
    
    // Collection loop with scrolling
    while (this.shouldContinueCollecting(noNewElementsCount)) {
      const newElements = await this.collectElementsFromCurrentView();
      
      if (newElements.length === 0) {
        noNewElementsCount++;
        this.logger.info(`No new elements found (attempt ${noNewElementsCount})`);
      } else {
        noNewElementsCount = 0; // Reset counter when new elements are found
        collectedElements.push(...newElements);
        this.logger.info(`Collected ${newElements.length} new elements (total: ${collectedElements.length})`);
      }
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          phase: 'collecting',
          totalElements: collectedElements.length,
          scrollAttempt: this.currentScrollAttempt + 1,
          message: `Found ${collectedElements.length} posts...`
        });
      }
      
      // Scroll to load more content
      if (this.shouldContinueCollecting(noNewElementsCount)) {
        await this.scrollAndWait();
        this.currentScrollAttempt++;
      }
    }
    
    this.logger.info(`Collection complete. Total elements: ${collectedElements.length}`);
    return collectedElements;
  }
  
  shouldContinueCollecting(noNewElementsCount) {
    return this.currentScrollAttempt < SCRAPING_LIMITS.MAX_SCROLL_ATTEMPTS && 
           noNewElementsCount < SCRAPING_LIMITS.MAX_NO_NEW_ELEMENTS;
  }
  
  async collectElementsFromCurrentView() {
    const elements = document.querySelectorAll(SELECTORS.LINKEDIN.POST_CONTAINER);
    this.logger.info(`Found ${elements.length} potential elements on current view`);
    
    const newElements = [];
    
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const elementData = this.extractElementData(element, index);
      
      if (elementData && !this.processedElementIds.has(elementData.id)) {
        this.processedElementIds.add(elementData.id);
        newElements.push(elementData);
      }
    }
    
    return newElements;
  }
  
  extractElementData(element, index) {
    try {
      // Get the parent post container for more context
      const postContainer = element.closest('.feed-shared-update-v2') || 
                           element.closest('[data-urn]') || 
                           element;
      
      if (!postContainer) {
        return null;
      }
      
      const htmlContent = postContainer.outerHTML;
      const elementId = this.generateElementId(htmlContent, index);
      
      return {
        id: elementId,
        html: htmlContent, // Keep as 'html' for compatibility with background script
        url: window.location.href,
        timestamp: new Date().toISOString(),
        elementIndex: index,
        scrollAttempt: this.currentScrollAttempt + 1
      };
    } catch (error) {
      this.logger.error('Error extracting element data:', error);
      return null;
    }
  }
  
  generateElementId(htmlContent, index) {
    // Create a simple hash from the HTML content
    let hash = 0;
    const str = htmlContent.substring(0, 500) + index; // Use first 500 chars + index
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36).substring(0, 12);
  }
  
  async scrollAndWait() {
    // Scroll to bottom of page
    const scrollHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, scrollHeight);
    
    this.logger.info(`Scrolled to bottom (height: ${scrollHeight})`);
    
    // Wait for new content to load
    await this.wait(DELAYS.SCROLL_WAIT);
    
    // Check if new content was loaded
    const newScrollHeight = document.documentElement.scrollHeight;
    if (newScrollHeight > scrollHeight) {
      this.logger.info(`New content loaded (new height: ${newScrollHeight})`);
      // Wait a bit more for full content loading
      await this.wait(DELAYS.CONTENT_LOAD);
    }
  }
  
  isOnRecentActivityPage() {
    return window.location.href.includes('/recent-activity/');
  }
  
  getPostCount() {
    const elements = document.querySelectorAll(SELECTORS.LINKEDIN.POST_CONTAINER);
    return elements.length;
  }
  
  getProcessedCount() {
    return this.processedElementIds.size;
  }
  
  reset() {
    this.processedElementIds.clear();
    this.currentScrollAttempt = 0;
    this.logger.info('Content scraper reset');
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Utility methods for debugging and analysis
  analyzeCurrentPage() {
    const analysis = {
      url: window.location.href,
      isOnRecentActivity: this.isOnRecentActivityPage(),
      totalPostElements: this.getPostCount(),
      processedElements: this.getProcessedCount(),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight
    };
    
    this.logger.info('Page analysis:', analysis);
    return analysis;
  }
  
  findElementByText(text) {
    const elements = document.querySelectorAll(SELECTORS.LINKEDIN.POST_CONTAINER);
    for (const element of elements) {
      if (element.textContent.includes(text)) {
        return element;
      }
    }
    return null;
  }
  
  getElementStats() {
    const elements = document.querySelectorAll(SELECTORS.LINKEDIN.POST_CONTAINER);
    const stats = {
      total: elements.length,
      processed: this.processedElementIds.size,
      remaining: elements.length - this.processedElementIds.size,
      scrollAttempts: this.currentScrollAttempt
    };
    
    this.logger.info('Element stats:', stats);
    return stats;
  }
} 