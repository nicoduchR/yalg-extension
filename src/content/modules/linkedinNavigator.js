// LinkedIn Navigator for handling navigation to user profile and recent activity
import { Logger } from '../../shared/utils/logger.js';
import { SELECTORS, DELAYS } from '../../shared/constants.js';

export class LinkedInNavigator {
  constructor() {
    this.logger = new Logger('LinkedInNavigator');
  }
  
  async navigateToRecentActivity() {
    this.logger.info('Current URL:', window.location.href);
    
    // Check if we're already on the profile recent activity page
    if (this.isOnRecentActivityPage()) {
      this.logger.info('Already on recent activity page');
      return;
    }
    
    // If we're already on a profile page, just add the recent-activity path
    if (this.isOnProfilePage()) {
      this.logger.info('On profile page, navigating to recent activity...');
      const activityUrl = this.buildActivityUrlFromCurrent();
      this.logger.info('Navigating to:', activityUrl);
      window.location.href = activityUrl;
      return;
    }
    
    this.logger.info('Attempting to navigate to profile...');
    
    try {
      const profileUrl = await this.findProfileUrl();
      if (profileUrl) {
        const activityUrl = profileUrl + '/recent-activity/all/';
        this.logger.info('Navigating to:', activityUrl);
        window.location.href = activityUrl;
        return;
      }
      
      throw new Error('Could not find profile URL');
      
    } catch (error) {
      this.logger.error('Navigation error:', error);
      throw new Error('Could not find profile URL. Please navigate to your LinkedIn profile manually and try again.');
    }
  }
  
  isOnRecentActivityPage() {
    return window.location.href.includes('/recent-activity/');
  }
  
  isOnProfilePage() {
    return window.location.href.includes('/in/') && !this.isOnRecentActivityPage();
  }
  
  buildActivityUrlFromCurrent() {
    const baseUrl = window.location.href.split('/').slice(0, 5).join('/'); // Get base profile URL
    return baseUrl + '/recent-activity/all/';
  }
  
  async findProfileUrl() {
    // Method 1: Try to find the "Me" button in the top navigation
    const profileUrl = this.findProfileFromMeButton();
    if (profileUrl) {
      return profileUrl;
    }
    
    // Method 2: Try to find profile link in dropdown menu
    const dropdownUrl = await this.findProfileFromDropdown();
    if (dropdownUrl) {
      return dropdownUrl;
    }
    
    // Method 3: Try to construct URL from current user info
    const userElementUrl = this.findProfileFromUserElement();
    if (userElementUrl) {
      return userElementUrl;
    }
    
    return null;
  }
  
  findProfileFromMeButton() {
    const selectors = [
      'a[data-control-name="nav.settings_myprofile"]',
      'a[href*="/in/"][aria-label*="me"]',
      '.global-nav__me-photo'
    ];
    
    for (const selector of selectors) {
      const meButton = document.querySelector(selector);
      if (meButton) {
        this.logger.info('Found me button with selector:', selector);
        
        let profileUrl = meButton.href;
        
        // If it's an image, look for the parent link
        if (!profileUrl) {
          const parentLink = meButton.closest('a');
          profileUrl = parentLink?.href;
        }
        
        if (profileUrl && profileUrl.includes('/in/')) {
          this.logger.info('Extracted profile URL from me button:', profileUrl);
          return profileUrl;
        }
      }
    }
    
    return null;
  }
  
  async findProfileFromDropdown() {
    const profileDropdown = document.querySelector('[data-test-global-nav-me]');
    if (!profileDropdown) {
      return null;
    }
    
    this.logger.info('Found profile dropdown, clicking...');
    profileDropdown.click();
    await this.wait(DELAYS.DROPDOWN_OPEN);
    
    const profileLink = document.querySelector('a[href*="/in/"][data-control-name="nav.settings_myprofile"]');
    if (profileLink && profileLink.href) {
      this.logger.info('Found profile link in dropdown:', profileLink.href);
      return profileLink.href;
    }
    
    return null;
  }
  
  findProfileFromUserElement() {
    const selectors = [
      '.feed-identity-module__actor-meta a',
      '[data-anonymize="person-name"]'
    ];
    
    for (const selector of selectors) {
      const currentUserElement = document.querySelector(selector);
      if (currentUserElement && currentUserElement.href && currentUserElement.href.includes('/in/')) {
        this.logger.info('Found profile URL from user element:', currentUserElement.href);
        return currentUserElement.href;
      }
    }
    
    return null;
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getCurrentUrl() {
    return window.location.href;
  }
  
  isValidLinkedInUrl(url) {
    return url && (url.includes('linkedin.com') || url.includes('www.linkedin.com'));
  }
  
  extractProfileId(url) {
    const match = url.match(/\/in\/([^\/]+)/);
    return match ? match[1] : null;
  }
  
  buildRecentActivityUrl(profileUrl) {
    const baseUrl = profileUrl.replace(/\/$/, ''); // Remove trailing slash
    return `${baseUrl}/recent-activity/all/`;
  }
} 