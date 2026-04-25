// ===============================================
//        ACTION PROGRESS BAR (Top Bar)
// ===============================================



const DEFAULT_PRODUCTS = [

]; // Define some default products if needed
const ActionProgressBar = {
  bar: null,
  fill: null,
  timeout: null,
  
  init() {
    if (!document.getElementById('actionProgressBar')) {
      const bar = document.createElement('div');
      bar.id = 'actionProgressBar';
      bar.innerHTML = '<div id="actionProgressFill"></div>';
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
      
      this.fill = bar.querySelector('#actionProgressFill');
      this.fill.style.cssText = `
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #e60012, #ff6b6b, #e60012);
        background-size: 200% 100%;
        animation: progressShimmer 1.5s linear infinite;
        transition: width 0.3s ease;
        border-radius: 0 2px 2px 0;
      `;
      
      document.body.appendChild(bar);
      
      if (!document.getElementById('progressShimmerStyle')) {
        const style = document.createElement('style');
        style.id = 'progressShimmerStyle';
        style.textContent = `
          @keyframes progressShimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    this.bar = document.getElementById('actionProgressBar');
    this.fill = document.getElementById('actionProgressFill');
  },
  
  start() {
    if (!this.bar) this.init();
    if (this.timeout) clearTimeout(this.timeout);
    
    this.bar.style.opacity = '1';
    this.fill.style.width = '0%';
    
    setTimeout(() => {
      this.fill.style.width = '30%';
    }, 50);
    
    this.timeout = setTimeout(() => {
      this.fill.style.width = '70%';
    }, 500);
  },
  
  complete() {
    if (!this.bar) return;
    if (this.timeout) clearTimeout(this.timeout);
    
    this.fill.style.width = '100%';
    
    this.timeout = setTimeout(() => {
      this.fill.style.width = '0%';
      this.bar.style.opacity = '0';
    }, 400);
  },
  
  error() {
    if (!this.bar) return;
    if (this.timeout) clearTimeout(this.timeout);
    
    this.fill.style.width = '100%';
    this.fill.style.background = '#ef4444';
    
    this.timeout = setTimeout(() => {
      this.fill.style.width = '0%';
      this.bar.style.opacity = '0';
      setTimeout(() => {
        this.fill.style.background = 'linear-gradient(90deg, #e60012, #ff6b6b, #e60012)';
        this.fill.style.backgroundSize = '200% 100%';
      }, 200);
    }, 600);
  }
};

// Initialize progress bar
document.addEventListener('DOMContentLoaded', () => {
  ActionProgressBar.init();
});