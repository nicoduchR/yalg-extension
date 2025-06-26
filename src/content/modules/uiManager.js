// UI Manager for content script UI elements
import { Logger } from '../../shared/utils/logger.js';
import { UI_CONSTANTS } from '../../shared/constants.js';

export class UIManager {
  constructor() {
    this.logger = new Logger('UIManager');
    this.progressOverlay = null;
    this.instructionOverlay = null;
  }
  
  showProgressOverlay() {
    this.removeProgressOverlay();
    
    this.progressOverlay = document.createElement('div');
    this.progressOverlay.id = 'yalg-progress-overlay';
    this.progressOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.progressOverlay.innerHTML = this.createProgressHTML();
    document.body.appendChild(this.progressOverlay);
    
    this.logger.info('Progress overlay created');
    return this.progressOverlay;
  }
  
  createProgressHTML() {
    return `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        text-align: center;
        position: relative;
      ">
        <!-- YALG Logo -->
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: hsl(349, 100%, 55.5%);
          border-radius: 12px;
          margin-bottom: 24px;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: 18px;
            font-family: Inter, sans-serif;
          ">Y</span>
        </div>

        <!-- Title -->
        <h2 id="yalg-progress-title" style="
          color: hsl(222.2, 84%, 4.9%);
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 8px 0;
          line-height: 1.2;
        ">Collecting Your LinkedIn Posts</h2>

        <!-- Subtitle -->
        <p id="yalg-progress-subtitle" style="
          color: hsl(215.4, 16.3%, 46.9%);
          font-size: 16px;
          margin: 0 0 32px 0;
          line-height: 1.5;
        ">Analyzing your profile activity...</p>

        <!-- Progress Bar Container -->
        <div style="
          background: hsl(210, 40%, 96.1%);
          border-radius: 8px;
          height: 8px;
          margin: 0 0 16px 0;
          overflow: hidden;
          position: relative;
        ">
          <div id="yalg-progress-bar" style="
            background: linear-gradient(90deg, hsl(349, 100%, 55.5%), hsl(349, 100%, 65%));
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 8px;
          "></div>
        </div>

        <!-- Progress Text -->
        <div id="yalg-progress-text" style="
          color: hsl(215.4, 16.3%, 46.9%);
          font-size: 14px;
          margin-bottom: 24px;
          min-height: 20px;
        ">Initializing...</div>

        <!-- Stats Grid -->
        <div id="yalg-stats-grid" style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        ">
          <div style="
            background: hsl(210, 40%, 98%);
            border-radius: 8px;
            padding: 16px 12px;
            border: 1px solid hsl(214.3, 31.8%, 91.4%);
          ">
            <div id="yalg-stat-collected" style="
              font-size: 20px;
              font-weight: bold;
              color: hsl(349, 100%, 55.5%);
              line-height: 1;
            ">0</div>
            <div style="
              font-size: 12px;
              color: hsl(215.4, 16.3%, 46.9%);
              margin-top: 4px;
            ">Collected</div>
          </div>
          <div style="
            background: hsl(210, 40%, 98%);
            border-radius: 8px;
            padding: 16px 12px;
            border: 1px solid hsl(214.3, 31.8%, 91.4%);
          ">
            <div id="yalg-stat-processed" style="
              font-size: 20px;
              font-weight: bold;
              color: hsl(142.1, 76.2%, 36.3%);
              line-height: 1;
            ">0</div>
            <div style="
              font-size: 12px;
              color: hsl(215.4, 16.3%, 46.9%);
              margin-top: 4px;
            ">Queued</div>
          </div>
          <div style="
            background: hsl(210, 40%, 98%);
            border-radius: 8px;
            padding: 16px 12px;
            border: 1px solid hsl(214.3, 31.8%, 91.4%);
          ">
            <div id="yalg-stat-failed" style="
              font-size: 20px;
              font-weight: bold;
              color: hsl(0, 84.2%, 60.2%);
              line-height: 1;
            ">0</div>
            <div style="
              font-size: 12px;
              color: hsl(215.4, 16.3%, 46.9%);
              margin-top: 4px;
            ">Failed</div>
          </div>
        </div>

        <!-- Loading Animation -->
        <div id="yalg-loading-spinner" style="
          display: inline-block;
          width: 24px;
          height: 24px;
          border: 2px solid hsl(210, 40%, 96.1%);
          border-top: 2px solid hsl(349, 100%, 55.5%);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
      </div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }
  
  updateProgress(data) {
    if (!this.progressOverlay) return;
    
    const {
      phase = '',
      totalProcessed = 0,
      totalElements = 0,
      totalSuccessful = 0,
      totalFailed = 0,
      currentPost = 0,
      message = ''
    } = data;
    
    // Update title and subtitle based on phase
    const titleElement = document.getElementById('yalg-progress-title');
    const subtitleElement = document.getElementById('yalg-progress-subtitle');
    
    if (titleElement && subtitleElement) {
      switch (phase) {
        case 'collecting':
          titleElement.textContent = 'Collecting Posts';
          subtitleElement.textContent = 'Scrolling through your activity feed...';
          break;
        case 'queueing':
          titleElement.textContent = 'Processing Posts';
          subtitleElement.textContent = 'Sending posts to background processor...';
          break;
        default:
          titleElement.textContent = 'Collecting Your LinkedIn Posts';
          subtitleElement.textContent = 'Analyzing your profile activity...';
      }
    }
    
    // Update progress bar
    const progressBar = document.getElementById('yalg-progress-bar');
    if (progressBar && totalElements > 0) {
      const percentage = Math.min(100, (totalProcessed / totalElements) * 100);
      progressBar.style.width = `${percentage}%`;
    }
    
    // Update progress text
    const progressText = document.getElementById('yalg-progress-text');
    if (progressText) {
      if (message) {
        progressText.textContent = message;
      } else if (totalElements > 0) {
        progressText.textContent = `Processing ${currentPost || totalProcessed} of ${totalElements} posts`;
      } else {
        progressText.textContent = phase === 'collecting' ? 'Collecting posts...' : 'Initializing...';
      }
    }
    
    // Update stats
    this.updateStat('yalg-stat-collected', totalElements);
    this.updateStat('yalg-stat-processed', totalSuccessful);
    this.updateStat('yalg-stat-failed', totalFailed);
  }
  
  updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value.toString();
    }
  }
  
  showCompletionPopup(data) {
    const {
      totalProcessed = 0,
      totalSuccessful = 0,
      totalFailed = 0,
      message = 'Sync completed!'
    } = data;
    
    this.removeProgressOverlay();
    
    const completionOverlay = document.createElement('div');
    completionOverlay.id = 'yalg-completion-overlay';
    completionOverlay.style.cssText = this.progressOverlay?.style.cssText || `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    completionOverlay.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); text-align: center;">
        <div style="color: hsl(142.1, 76.2%, 36.3%); font-size: 48px; margin-bottom: 16px;">✓</div>
        <h2 style="color: hsl(222.2, 84%, 4.9%); font-size: 24px; font-weight: bold; margin: 0 0 8px 0;">Sync Complete!</h2>
        <p style="color: hsl(215.4, 16.3%, 46.9%); margin: 0 0 24px 0;">${message}</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; font-size: 14px;">
          <div><strong>${totalProcessed}</strong><br/>Total Posts</div>
          <div><strong style="color: hsl(142.1, 76.2%, 36.3%);">${totalSuccessful}</strong><br/>Successful</div>
          <div><strong style="color: hsl(0, 84.2%, 60.2%);">${totalFailed}</strong><br/>Failed</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: hsl(349, 100%, 55.5%); 
          color: white; 
          border: none; 
          border-radius: 8px; 
          padding: 12px 24px; 
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(completionOverlay);
    
    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (document.getElementById('yalg-completion-overlay')) {
        completionOverlay.remove();
      }
    }, 30000);
    
    this.logger.info('Completion popup shown', data);
  }
  
  showError(errorMessage) {
    this.removeProgressOverlay();
    
    const errorOverlay = document.createElement('div');
    errorOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    errorOverlay.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); text-align: center;">
        <div style="color: hsl(0, 84.2%, 60.2%); font-size: 48px; margin-bottom: 16px;">⚠</div>
        <h2 style="color: hsl(222.2, 84%, 4.9%); font-size: 24px; font-weight: bold; margin: 0 0 8px 0;">Sync Failed</h2>
        <p style="color: hsl(215.4, 16.3%, 46.9%); margin: 0 0 24px 0; word-wrap: break-word;">${errorMessage}</p>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: hsl(349, 100%, 55.5%); 
          color: white; 
          border: none; 
          border-radius: 8px; 
          padding: 12px 24px; 
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(errorOverlay);
    this.logger.error('Error overlay shown:', errorMessage);
  }
  
  showNavigationInstructions() {
    this.removeInstructionOverlay();
    
    this.instructionOverlay = document.createElement('div');
    this.instructionOverlay.id = 'yalg-instruction-overlay';
    this.instructionOverlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #0073b1;
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 350px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: Arial, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
    
    this.instructionOverlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">🔄 YALG Extension - Manual Navigation Required</div>
      <div style="margin-bottom: 15px;">
        To collect your LinkedIn posts, please navigate manually:
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Click your <strong>profile photo</strong> (top right corner)</li>
          <li>Click <strong>"View Profile"</strong></li>
          <li>Scroll down and click <strong>"Show all activity"</strong></li>
          <li>Once on the activity page, click the YALG extension icon and try sync again</li>
        </ol>
        <strong>Important:</strong> We collect HTML elements from your profile activity page for AI processing.
      </div>
      <div style="text-align: center;">
        <button id="yalg-close-instructions" style="
          background: white; 
          color: #0073b1; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 4px; 
          cursor: pointer; 
          font-weight: bold;
          font-family: inherit;
        ">Got it!</button>
      </div>
    `;
    
    document.body.appendChild(this.instructionOverlay);
    
    // Add close functionality
    document.getElementById('yalg-close-instructions').onclick = () => {
      this.removeInstructionOverlay();
    };
    
    // Auto-hide after 45 seconds
    setTimeout(() => {
      this.removeInstructionOverlay();
    }, 45000);
    
    this.logger.info('Navigation instructions shown');
  }
  
  removeProgressOverlay() {
    if (this.progressOverlay) {
      this.progressOverlay.remove();
      this.progressOverlay = null;
    }
    
    // Also remove any existing overlays with the same ID
    const existing = document.getElementById('yalg-progress-overlay');
    if (existing) {
      existing.remove();
    }
  }
  
  removeInstructionOverlay() {
    if (this.instructionOverlay) {
      this.instructionOverlay.remove();
      this.instructionOverlay = null;
    }
    
    // Also remove any existing overlays with the same ID
    const existing = document.getElementById('yalg-instruction-overlay');
    if (existing) {
      existing.remove();
    }
  }
  
  cleanup() {
    this.removeProgressOverlay();
    this.removeInstructionOverlay();
  }
} 