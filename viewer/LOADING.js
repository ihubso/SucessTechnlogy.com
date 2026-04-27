// ===============================================
//        LOADING OVERLAY & PROGRESS TRACKER
// ===============================================
const LoadingManager = {
  overlay: null,
  progressBar: null,
  progressPercent: null,
  loadingStatus: null,
  totalSteps: 10,
  currentStep: 0,
  steps: [],
  
  init() {
    this.overlay = document.getElementById('loadingOverlay');
    this.progressBar = document.getElementById('progressBar');
    this.progressPercent = document.getElementById('progressPercent');
    this.loadingStatus = document.getElementById('loadingStatus');
    this.steps = [
      { id: 'step1', threshold: 0 },
      { id: 'step2', threshold: 2 },
      { id: 'step3', threshold: 5 },
      { id: 'step4', threshold: 7 },
      { id: 'step5', threshold: 9 }
    ];
  },
  
  updateProgress(increment = 1, message = '') {
    this.currentStep = Math.min(this.currentStep + increment, this.totalSteps);
    const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
    
    if (this.progressBar) {
      this.progressBar.style.width = percentage + '%';
    }
    
    if (this.progressPercent) {
      this.progressPercent.textContent = percentage + '%';
    }
    
    if (message && this.loadingStatus) {
      this.loadingStatus.textContent = message;
    }
    
    // Update step indicators
    this.steps.forEach(step => {
      const stepEl = document.getElementById(step.id);
      if (stepEl) {
        if (this.currentStep >= step.threshold + 1) {
          stepEl.classList.add('completed');
          stepEl.classList.remove('current');
        } else if (this.currentStep >= step.threshold) {
          stepEl.classList.add('current');
          stepEl.classList.remove('completed');
        } else {
          stepEl.classList.remove('completed', 'current');
        }
      }
    });
  },
  
  hide() {
    if (this.overlay) {
      this.updateProgress(1, '🎉 Everything is ready!');
      
      // Add final step animation
      setTimeout(() => {
        this.overlay.classList.add('fade-out');
        
        // Remove overlay from DOM after animation
        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
          }
        }, 500);
      }, 300);
    }
  }
};