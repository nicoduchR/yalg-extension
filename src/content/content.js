// Content script for LinkedIn HTML collection (No ES6 imports)
console.log('YALG Extension: Content script loaded on', window.location.href);

// Global state
let isScrapingActive = false;
let config = {};
let progressOverlay = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('YALG Extension: Content script received message', message);
  
  if (message.type === 'START_SCRAPING') {
    config = message.config;
    startHTMLCollection();
    sendResponse({ success: true });
  }
});

// Wait for page to load and check auto-start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('YALG Extension: Content script ready');
    checkAutoStart();
  });
} else {
  console.log('YALG Extension: Content script ready');
  checkAutoStart();
}

async function checkAutoStart() {
  try {
    const stored = await chrome.storage.local.get(['config', 'autoStartSync']);
    if (stored.autoStartSync && stored.config) {
      console.log('YALG Extension: Auto-starting sync from stored configuration');
      config = stored.config;
      
      // Clear the auto-start flag
      await chrome.storage.local.remove(['autoStartSync']);
      
      // Wait for page to fully load
      setTimeout(() => {
        startHTMLCollection();
      }, 3000);
    }
  } catch (error) {
    console.error('YALG Extension: Error checking auto-start:', error);
  }
}

async function startHTMLCollection() {
  if (isScrapingActive) {
    console.log('YALG Extension: HTML collection already in progress');
    return;
  }
  
  isScrapingActive = true;
  
  // Create and show progress overlay
  createProgressOverlay();
  
  try {
    console.log('YALG Extension: Starting LinkedIn HTML collection');
    
    // Navigate to user's recent activity page if not already there
    if (!window.location.href.includes('/recent-activity/')) {
      console.log('YALG Extension: Not on recent activity page, attempting navigation...');
      
      try {
        await navigateToOwnProfile();
        // Wait for navigation to complete
        console.log('YALG Extension: Waiting for navigation to complete...');
        await wait(5000);
        
        if (!window.location.href.includes('/recent-activity/')) {
          throw new Error('Navigation to profile page failed');
        }
      } catch (navError) {
        console.log('YALG Extension: Auto-navigation failed, showing instructions to user');
        showNavigationInstructions();
        throw new Error('Auto-navigation failed. Please navigate to your LinkedIn profile > Show all activity manually and try again.');
      }
    }
    
    console.log('YALG Extension: On profile activity page, starting HTML collection...');
    
    // Wait for profile to load completely
    await wait(3000);
    
    // Start collecting and processing HTML elements from profile
    await collectHTMLElements();
    
    console.log('YALG Extension: HTML collection and processing complete');
    
  } catch (error) {
    console.error('YALG Extension: HTML collection error', error);
    
    // Show error in overlay if it exists
    if (progressOverlay) {
      showError(error.message);
    }
    
    chrome.runtime.sendMessage({
      type: 'SCRAPING_ERROR',
      error: error.message
    });
  } finally {
    isScrapingActive = false;
  }
}

async function navigateToOwnProfile() {
  console.log('YALG Extension: Current URL:', window.location.href);
  
  // Check if we're already on the profile recent activity page
  if (window.location.href.includes('/recent-activity/')) {
    console.log('YALG Extension: Already on recent activity page');
    return;
  }
  
  // If we're already on a profile page, just add the recent-activity path
  if (window.location.href.includes('/in/') && !window.location.href.includes('/recent-activity/')) {
    console.log('YALG Extension: On profile page, navigating to recent activity...');
    const baseUrl = window.location.href.split('/').slice(0, 5).join('/'); // Get base profile URL
    const activityUrl = baseUrl + '/recent-activity/all/';
    console.log('YALG Extension: Navigating to:', activityUrl);
    window.location.href = activityUrl;
    return;
  }
  
  console.log('YALG Extension: Attempting to navigate to profile...');
  
  try {
    // Method 1: Try to find the "Me" button in the top navigation
    const meButton = document.querySelector('a[data-control-name="nav.settings_myprofile"], a[href*="/in/"][aria-label*="me"], .global-nav__me-photo');
    if (meButton) {
      console.log('YALG Extension: Found me button, extracting profile URL');
      let profileUrl = meButton.href;
      
      // If it's an image, look for the parent link
      if (!profileUrl) {
        const parentLink = meButton.closest('a');
        profileUrl = parentLink?.href;
      }
      
      if (profileUrl) {
        console.log('YALG Extension: Navigating to:', profileUrl + '/recent-activity/all/');
        window.location.href = profileUrl + '/recent-activity/all/';
        return;
      }
    }
    
    throw new Error('Could not find profile URL. Please navigate to your LinkedIn profile manually and try again.');
    
  } catch (error) {
    console.error('YALG Extension: Navigation error:', error);
    throw error;
  }
}

async function collectHTMLElements() {
  let collectedElements = [];
  let processedElementIds = new Set();
  let noNewElementsCount = 0;
  const maxScrollAttempts = 20;
  let scrollAttempts = 0;
  
  // Ensure we're on the profile activity page
  if (!window.location.href.includes('/recent-activity/')) {
    throw new Error('Must be on profile recent activity page to collect HTML');
  }
  
  console.log('YALG Extension: Collecting HTML elements from user profile activity page');
  
  // First phase: Collect all HTML elements
  while (scrollAttempts < maxScrollAttempts && noNewElementsCount < 3 && isScrapingActive) {
    // Find all elements with the specific classes
    const targetSelector = '.feed-shared-update-v2__control-menu-container.display-flex.flex-column.flex-grow-1';
    const elements = document.querySelectorAll(targetSelector);
    
    console.log(`YALG Extension: Found ${elements.length} elements with target classes`);
    
    let newElementsFound = 0;
    
    // Collect elements without processing them yet
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      
      // Get the parent post container for more context
      const postContainer = element.closest('.feed-shared-update-v2') || element.closest('[data-urn]') || element;
      
      if (postContainer) {
        const htmlContent = postContainer.outerHTML;
        const elementId = generateElementId(htmlContent, index);
        
        // Check if we already collected this element
        if (!processedElementIds.has(elementId)) {
          processedElementIds.add(elementId);
          newElementsFound++;
          
          const elementData = {
            id: elementId,
            html: htmlContent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            elementIndex: index,
            scrollAttempt: scrollAttempts + 1
          };
          
          collectedElements.push(elementData);
          console.log(`YALG Extension: Collected element ${collectedElements.length} (ID: ${elementId})`);
        }
      }
    }
    
    console.log(`YALG Extension: Collected ${newElementsFound} new elements in this scroll. Total: ${collectedElements.length}`);
    
    // Update progress during collection
    updateProgressOverlay({
      phase: 'collecting',
      totalCollected: collectedElements.length,
      scrollAttempt: scrollAttempts + 1,
      maxAttempts: maxScrollAttempts
    });
    
    chrome.runtime.sendMessage({
      type: 'SCRAPING_PROGRESS',
      data: {
        phase: 'collecting',
        totalCollected: collectedElements.length,
        scrollAttempt: scrollAttempts + 1,
        maxAttempts: maxScrollAttempts
      }
    });
    
    // Check if we found new elements
    if (newElementsFound === 0) {
      noNewElementsCount++;
    } else {
      noNewElementsCount = 0;
    }
    
    // Scroll down to load more elements
    window.scrollTo(0, document.body.scrollHeight);
    await wait(2000);
    
    scrollAttempts++;
  }
  
  console.log(`YALG Extension: HTML collection completed. Total collected: ${collectedElements.length}`);
  
  // Second phase: Start async processing
  await processElementsAsync(collectedElements);
}

async function processElementsAsync(collectedElements) {
  console.log(`YALG Extension: Starting async processing of ${collectedElements.length} posts`);
  
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  // Process posts individually
  const processPost = (element, index) => {
    console.log(`YALG Extension: 🚀 Queueing post ${index + 1}/${collectedElements.length} (ID: ${element.id})`);
    
    // Send to background script for processing
    chrome.runtime.sendMessage({
      type: 'PROCESS_SINGLE_HTML_ELEMENT',
      data: element
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('YALG Extension: Error sending element to background:', chrome.runtime.lastError);
        totalFailed++;
      } else if (response && response.success) {
        totalSuccessful++;
        console.log(`YALG Extension: ✓ Post ${index + 1} queued successfully`);
      } else {
        totalFailed++;
        console.error(`YALG Extension: ✗ Post ${index + 1} failed to queue:`, response?.error);
      }
      
      const completedCount = totalSuccessful + totalFailed;
      
      // Update progress overlay
      updateProgressOverlay({
        phase: 'queueing',
        totalProcessed: completedCount,
        totalElements: collectedElements.length,
        totalSuccessful,
        totalFailed
      });
      
      // Update progress after each post completes
      chrome.runtime.sendMessage({
        type: 'SCRAPING_PROGRESS',
        data: {
          phase: 'queueing',
          totalProcessed: completedCount,
          totalElements: collectedElements.length,
          totalSuccessful,
          totalFailed
        }
      });
      
      // Check if all posts are done
      if (completedCount === collectedElements.length) {
        console.log(`YALG Extension: 🎉 All posts queued! Total: ${collectedElements.length}, Successful: ${totalSuccessful}, Failed: ${totalFailed}`);
        
        // Show completion popup
        createCompletionPopup({
          totalProcessed: collectedElements.length,
          totalSuccessful,
          totalFailed
        });
        
        // Send final summary
        chrome.runtime.sendMessage({
          type: 'SCRAPING_COMPLETE',
          data: {
            totalProcessed: collectedElements.length,
            totalSuccessful,
            totalFailed
          }
        });
      }
    });
  };
  
  // Fire all posts with small delays
  collectedElements.forEach((element, index) => {
    setTimeout(() => {
      processPost(element, index);
    }, index * 100); // 100ms delay between each post
  });
}

function generateElementId(htmlContent, index) {
  // Create a simple hash from the HTML content
  let hash = 0;
  const str = htmlContent.substring(0, 500) + index;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 12);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// UI Functions (simplified versions)
function createProgressOverlay() {
  if (progressOverlay) {
    progressOverlay.remove();
  }

  progressOverlay = document.createElement('div');
  progressOverlay.id = 'yalg-progress-overlay';
  progressOverlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: Inter, sans-serif;">
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 520px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
          <div style="width: 48px; height: 48px; margin-right: 12px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(255, 51, 102, 0.2);">
            <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="YALG Logo" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div>
            <div style="color: #ff3366; font-size: 24px; font-weight: bold;">YALG Extension</div>
            <div style="color: #666; font-size: 14px;">LinkedIn Post Collector</div>
          </div>
        </div>

        <!-- Status -->
        <div id="yalg-progress-status" style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #1f2937;">Initializing...</div>
        <div id="yalg-progress-substatus" style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">Preparing to collect your LinkedIn posts</div>

        <!-- Progress Bar -->
        <div style="background: #f3f4f6; border-radius: 8px; height: 12px; overflow: hidden; margin-bottom: 20px;">
          <div id="yalg-progress-bar" style="background: linear-gradient(90deg, #ff3366, #ff6b9d); height: 100%; width: 0%; transition: width 0.3s ease-in-out; border-radius: 8px;"></div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div id="yalg-stat-collected" style="font-size: 24px; font-weight: bold; color: #ff3366;">0</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 500;">Posts Found</div>
          </div>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; border: 1px solid #bbf7d0;">
            <div id="yalg-stat-success" style="font-size: 24px; font-weight: bold; color: #22c55e;">0</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 500;">Processed</div>
          </div>
          <div style="background: #fef2f2; padding: 16px; border-radius: 12px; border: 1px solid #fecaca;">
            <div id="yalg-stat-errors" style="font-size: 24px; font-weight: bold; color: #ef4444;">0</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 500;">Errors</div>
          </div>
        </div>

        <!-- Current Activity -->
        <div id="yalg-current-activity" style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px; color: #475569; border-left: 4px solid #ff3366;">
          <div style="font-weight: 600; margin-bottom: 4px;">Current Activity</div>
          <div id="yalg-activity-text">Starting collection process...</div>
        </div>

        <!-- Cancel Button -->
        <button id="yalg-cancel-btn" style="margin-top: 20px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
          Cancel Collection
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(progressOverlay);

  // Add cancel functionality with proper event listener
  setTimeout(() => {
    const cancelBtn = document.getElementById('yalg-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel the collection process?')) {
          console.log('YALG Extension: User cancelled scraping process');
          isScrapingActive = false;
          
          // Send cancellation message to background
          chrome.runtime.sendMessage({
            type: 'SCRAPING_ERROR',
            error: 'Collection cancelled by user'
          });
          
          if (progressOverlay) {
            progressOverlay.remove();
            progressOverlay = null;
          }
        }
      });
    }
  }, 100);
}

function updateProgressOverlay(data) {
  if (!progressOverlay) return;

  const statusEl = document.getElementById('yalg-progress-status');
  const substatusEl = document.getElementById('yalg-progress-substatus');
  const progressEl = document.getElementById('yalg-progress-bar');
  const collectedEl = document.getElementById('yalg-stat-collected');
  const successEl = document.getElementById('yalg-stat-success');
  const errorsEl = document.getElementById('yalg-stat-errors');
  const activityEl = document.getElementById('yalg-activity-text');

  if (data.phase === 'collecting') {
    statusEl.textContent = 'Collecting Your LinkedIn Posts';
    substatusEl.textContent = `Scrolling through your activity feed to find posts...`;
    
    const progress = Math.min((data.scrollAttempt / data.maxAttempts) * 50, 50);
    progressEl.style.width = `${progress}%`;
    
    collectedEl.textContent = data.totalCollected || 0;
    successEl.textContent = '0';
    errorsEl.textContent = '0';
    
    activityEl.textContent = `Scroll attempt ${data.scrollAttempt}/${data.maxAttempts} - Found ${data.totalCollected} posts so far`;
    
  } else if (data.phase === 'queueing') {
    statusEl.textContent = 'Processing Your Posts';
    substatusEl.textContent = `Sending posts to YALG AI for analysis and processing...`;
    
    const progress = 50 + ((data.totalProcessed / data.totalElements) * 50);
    progressEl.style.width = `${progress}%`;
    
    collectedEl.textContent = data.totalElements || 0;
    successEl.textContent = data.totalSuccessful || 0;
    errorsEl.textContent = data.totalFailed || 0;
    
    const remaining = data.totalElements - data.totalProcessed;
    activityEl.textContent = remaining > 0 
      ? `Processing posts... ${remaining} remaining`
      : 'Finalizing processing...';
  }
}

function createCompletionPopup(data) {
  if (progressOverlay) {
    progressOverlay.remove();
    progressOverlay = null;
  }

  const completionOverlay = document.createElement('div');
  completionOverlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: Inter, sans-serif;">
      <div style="background: white; border-radius: 16px; padding: 24px; max-width: 520px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
        
        <!-- Success Header -->
        <div style="margin-bottom: 20px;">
          <div style="background: linear-gradient(135deg, #22c55e, #16a34a); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </div>
          <div style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 6px;">Collection Complete!</div>
          <div style="color: #6b7280; font-size: 14px; line-height: 1.4;">Your LinkedIn posts have been successfully collected and sent to YALG AI for processing.</div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: linear-gradient(135deg, #fef3f2, #fff5f5); padding: 16px; border-radius: 10px; border: 1px solid #fecaca;">
            <div style="font-size: 28px; font-weight: bold; color: #ff3366; margin-bottom: 2px;">${data.totalProcessed}</div>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600;">Total Posts</div>
            <div style="font-size: 11px; color: #9ca3af;">Collected from LinkedIn</div>
          </div>
          <div style="background: linear-gradient(135deg, #f0fdf4, #f7fee7); padding: 16px; border-radius: 10px; border: 1px solid #bbf7d0;">
            <div style="font-size: 28px; font-weight: bold; color: #22c55e; margin-bottom: 2px;">${data.totalSuccessful}</div>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600;">Successfully Queued</div>
            <div style="font-size: 11px; color: #9ca3af;">Sent to YALG AI</div>
          </div>
          <div style="background: linear-gradient(135deg, #fef2f2, #fef7f7); padding: 16px; border-radius: 10px; border: 1px solid #fecaca;">
            <div style="font-size: 28px; font-weight: bold; color: #ef4444; margin-bottom: 2px;">${data.totalFailed}</div>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600;">Failed</div>
            <div style="font-size: 11px; color: #9ca3af;">Processing errors</div>
          </div>
        </div>

        <!-- Processing Status -->
        <div style="background: #f8fafc; padding: 12px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #ff3366;">
          <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
            <div style="width: 14px; height: 14px; border: 2px solid #ff3366; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 6px;"></div>
            <div style="font-weight: 600; color: #374151; font-size: 14px;">YALG AI is now processing your posts</div>
          </div>
          <div style="font-size: 13px; color: #6b7280;">This may take a few minutes. You can check your progress in the YALG dashboard.</div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px;">
          <button id="yalg-dashboard-btn" style="background: linear-gradient(135deg, #ff3366, #ff6b9d); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(255, 51, 102, 0.3);">
            <span style="background: rgba(255,255,255,0.2); width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">Y</span>
            View in YALG Dashboard
          </button>
          
          <button id="yalg-stay-btn" style="background: #0077b5; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
              <rect x="2" y="9" width="4" height="12"></rect>
              <circle cx="4" cy="4" r="2"></circle>
            </svg>
            Stay on LinkedIn
          </button>
        </div>

        <!-- Close Button & Timer -->
        <div style="text-align: center;">
          <button id="yalg-close-btn" style="background: transparent; color: #6b7280; border: none; padding: 4px; cursor: pointer; font-size: 13px; text-decoration: underline; margin-bottom: 8px;">
            Close this popup
          </button>
          <div style="font-size: 11px; color: #9ca3af;">
            Auto-close in <span id="yalg-countdown">60</span>s
          </div>
        </div>
      </div>
    </div>

    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(completionOverlay);

  // Add event listeners
  const dashboardBtn = document.getElementById('yalg-dashboard-btn');
  const stayBtn = document.getElementById('yalg-stay-btn');
  const closeBtn = document.getElementById('yalg-close-btn');

  dashboardBtn.addEventListener('click', async () => {
    try {
      // Use centralized URL configuration
      const dashboardUrl = window.YALG_URLS?.FRONTEND_DASHBOARD || 'http://localhost:3400/dashboard';
      window.open(dashboardUrl, '_blank');
      completionOverlay.remove();
    } catch (error) {
      console.error('Error opening dashboard:', error);
      // Fallback to default URL
      window.open('http://localhost:3400/dashboard', '_blank');
      completionOverlay.remove();
    }
  });

  stayBtn.addEventListener('click', () => {
    completionOverlay.remove();
  });

  closeBtn.addEventListener('click', () => {
    completionOverlay.remove();
  });

  // Countdown timer
  let countdown = 60;
  const countdownEl = document.getElementById('yalg-countdown');
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownEl) {
      countdownEl.textContent = countdown;
    }
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      if (document.body.contains(completionOverlay)) {
        completionOverlay.remove();
      }
    }
  }, 1000);
}

function showError(message) {
  if (progressOverlay) {
    progressOverlay.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: Inter, sans-serif;">
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 520px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          
          <!-- Error Header -->
          <div style="margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Collection Failed</div>
            <div style="color: #6b7280; font-size: 16px; line-height: 1.5;">There was an issue collecting your LinkedIn posts.</div>
          </div>

          <!-- Error Message -->
          <div style="background: #fef2f2; padding: 16px; border-radius: 12px; margin-bottom: 32px; border-left: 4px solid #ef4444;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Error Details:</div>
            <div style="font-size: 14px; color: #6b7280; text-align: left;">${message}</div>
          </div>

          <!-- Troubleshooting Tips -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: left;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 12px;">💡 Troubleshooting Tips:</div>
            <ul style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Make sure you're logged into LinkedIn</li>
              <li>Navigate to your LinkedIn profile manually</li>
              <li>Check your internet connection</li>
              <li>Try refreshing the page and running sync again</li>
              <li>Ensure the YALG backend is running</li>
            </ul>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button id="yalg-error-refresh-btn" style="background: #ff3366; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600;">
              Refresh & Try Again
            </button>
            <button id="yalg-error-close-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners for error buttons
    setTimeout(() => {
      const refreshBtn = document.getElementById('yalg-error-refresh-btn');
      const closeBtn = document.getElementById('yalg-error-close-btn');
      
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (progressOverlay && document.body.contains(progressOverlay)) {
            progressOverlay.remove();
          }
        });
      }
    }, 100);
  }
}

function showNavigationInstructions() {
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <div style="position: fixed; top: 20px; right: 20px; background: #0073b1; color: white; padding: 20px; border-radius: 8px; z-index: 10000; max-width: 350px; font-family: Arial, sans-serif;">
      <div style="font-weight: bold; margin-bottom: 10px;">🔄 YALG Extension - Manual Navigation Required</div>
      <div style="margin-bottom: 15px;">
        To collect your LinkedIn posts, please navigate manually:
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Click your profile photo (top right corner)</li>
          <li>Click "View Profile"</li>
          <li>Scroll down and click "Show all activity"</li>
          <li>Once on the activity page, click the YALG extension icon and try sync again</li>
        </ol>
      </div>
      <button id="yalg-nav-close-btn" style="background: white; color: #0073b1; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Got it!
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listener for navigation close button
  setTimeout(() => {
    const closeBtn = document.getElementById('yalg-nav-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (overlay && document.body.contains(overlay)) {
          overlay.remove();
        }
      });
    }
  }, 100);
  
  // Auto-hide after 45 seconds
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
  }, 45000);
} 