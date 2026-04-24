
console.log('✅ authu.js loaded successfully!');    
const AdminProgressBar = {
  bar: null,
  timeout: null,
  
  // Initialize the progress bar element
  init() {
    // Create progress bar if it doesn't exist
    if (!document.getElementById('adminActionProgress')) {
      const bar = document.createElement('div');
      bar.id = 'adminActionProgress';
      bar.innerHTML = '<div id="adminActionProgressFill"></div>';
      bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        z-index: 100000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      
      const fill = bar.querySelector('#adminActionProgressFill');
      fill.style.cssText = `
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #e60012, #ff6b6b, #e60012);
        background-size: 200% 100%;
        animation: adminProgressShimmer 1.5s linear infinite;
        transition: width 0.3s ease;
        border-radius: 0 2px 2px 0;
      `;
      
      document.body.appendChild(bar);
      
      // Add shimmer animation style
      if (!document.getElementById('adminProgressStyle')) {
        const style = document.createElement('style');
        style.id = 'adminProgressStyle';
        style.textContent = `
          @keyframes adminProgressShimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    this.bar = document.getElementById('adminActionProgress');
    this.fill = document.getElementById('adminActionProgressFill');
  },
  
  // Start showing progress
  start(message = '') {
    if (!this.bar) this.init();
    
    // Clear any existing timeout
    if (this.timeout) clearTimeout(this.timeout);
    
    // Show bar
    this.bar.style.opacity = '1';
    this.fill.style.width = '0%';
    
    // Animate to 30% quickly
    setTimeout(() => {
      this.fill.style.width = '30%';
    }, 50);
    
    // Animate to 70% slowly
    this.timeout = setTimeout(() => {
      this.fill.style.width = '70%';
    }, 500);
  },
  
  // Complete the progress
  complete() {
    if (!this.bar) return;
    
    if (this.timeout) clearTimeout(this.timeout);
    
    // Fill to 100%
    this.fill.style.width = '100%';
    
    // Hide after short delay
    this.timeout = setTimeout(() => {
      this.fill.style.width = '0%';
      this.bar.style.opacity = '0';
    }, 400);
  },
  
  // Show error state
  error() {
    if (!this.bar) return;
    
    if (this.timeout) clearTimeout(this.timeout);
    
    // Flash red
    this.fill.style.width = '100%';
    this.fill.style.background = '#ef4444';
    
    this.timeout = setTimeout(() => {
      this.fill.style.width = '0%';
      this.bar.style.opacity = '0';
      // Reset color
      setTimeout(() => {
        this.fill.style.background = 'linear-gradient(90deg, #e60012, #ff6b6b, #e60012)';
        this.fill.style.backgroundSize = '200% 100%';
      }, 200);
    }, 600);
  }
};

// Initialize progress bar immediately
document.addEventListener('DOMContentLoaded', () => {
  AdminProgressBar.init();
});
