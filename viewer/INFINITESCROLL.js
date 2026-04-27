// INFINITESCROLL.js - Lazy loading products on scroll

// ===============================================
//        INFINITE SCROLL SYSTEM
// ===============================================

const InfiniteScroll = {
  observer: null,
  sentinel: null,
  isLoading: false,
  currentPage: 0,
  pageSize: 20,
  totalPages: 0,
  allProducts: [],
  
  init() {
    // Create the sentinel element that triggers loading
    this.createSentinel();
    this.setupObserver();
  },
  
  // Create a hidden element at the bottom of the product grid
  createSentinel() {
    // Remove old sentinel if exists
    if (this.sentinel) this.sentinel.remove();
    
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    this.sentinel = document.createElement('div');
    this.sentinel.id = 'scrollSentinel';
    this.sentinel.style.cssText = 'height: 1px; width: 100%;';
    grid.parentNode.insertBefore(this.sentinel, grid.nextSibling);
  },
  
  // Setup Intersection Observer
  setupObserver() {
    if (this.observer) this.observer.disconnect();
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoading && this.currentPage < this.totalPages) {
          this.loadMore();
        }
      });
    }, {
      rootMargin: '200px', // Start loading 200px before reaching sentinel
      threshold: 0.1
    });
    
    // Start observing after a short delay (wait for initial render)
    setTimeout(() => {
      if (this.sentinel) {
        this.observer.observe(this.sentinel);
      }
    }, 500);
  },
  
  // Reset pagination for new category/search
  reset() {
    this.currentPage = 0;
    this.allProducts = [];
    this.isLoading = false;
    document.getElementById('productsGrid').innerHTML = '';
    this.createSentinel();
    this.setupObserver();
  },
  
  // Load next batch of products
  async loadMore() {
    if (this.isLoading) return;
    this.isLoading = true;
    
    // Show loading indicator
    this.showLoadingIndicator();
    
    try {
      // Get ALL products (cached)
      const allProducts = await getProducts();
      
      // Apply filters
      let filtered = [...allProducts];
      
      if (currentSearch) {
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(currentSearch.toLowerCase())
        );
      }
      if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
      }
      
      // Sort products
      filtered = getSortedProducts(filtered);
      
      // Calculate pagination
      this.totalPages = Math.ceil(filtered.length / this.pageSize);
      this.currentPage++;
      
      // Get this page's products
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      const pageProducts = filtered.slice(start, end);
      
      // Render just these products
      if (pageProducts.length > 0) {
        const cardsHtml = await Promise.all(pageProducts.map(p => renderProductCard(p)));
        const grid = document.getElementById('productsGrid');
        grid.insertAdjacentHTML('beforeend', cardsHtml.join(''));
        attachCardEvents();
      }
      
      // Update sentinel position
      this.createSentinel();
      this.setupObserver();
      
      // Update "loaded" count display
      const loadedCount = document.getElementById('loadedProductsCount');
      if (loadedCount) {
        const totalDisplayed = this.currentPage * this.pageSize;
        loadedCount.textContent = `Showing ${Math.min(totalDisplayed, filtered.length)} of ${filtered.length} products`;
      }
      
      // Hide sentinel if no more products
      if (this.currentPage >= this.totalPages) {
        if (this.sentinel) this.sentinel.style.display = 'none';
        this.showEndMessage();
      }
      
    } catch (error) {
      console.error('Error loading more products:', error);
      showToast('Error loading more products');
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  },
  
  showLoadingIndicator() {
    let loader = document.getElementById('scrollLoader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'scrollLoader';
      loader.className = 'text-center py-6 col-span-full';
      loader.innerHTML = `
        <div class="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-sm border">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-gray-500">Loading more products...</span>
        </div>
      `;
      const grid = document.getElementById('productsGrid');
      grid.parentNode.insertBefore(loader, grid.nextSibling);
    }
    loader.style.display = 'block';
  },
  
  hideLoadingIndicator() {
    const loader = document.getElementById('scrollLoader');
    if (loader) loader.style.display = 'none';
  },
  
  showEndMessage() {
    let endMsg = document.getElementById('endOfProducts');
    if (!endMsg) {
      endMsg = document.createElement('div');
      endMsg.id = 'endOfProducts';
      endMsg.className = 'text-center py-8 col-span-full';
      endMsg.innerHTML = `
        <div class="inline-flex items-center gap-2 px-6 py-3 bg-gray-50 rounded-2xl border">
          <span class="text-lg">🎉</span>
          <span class="text-sm text-gray-500">You've seen all products!</span>
        </div>
      `;
      const grid = document.getElementById('productsGrid');
      grid.parentNode.insertBefore(endMsg, grid.nextSibling);
    }
    endMsg.style.display = 'block';
  }
};