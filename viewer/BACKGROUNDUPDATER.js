// ===============================================
//        SILENT BACKGROUND UPDATER
// ===============================================
const BackgroundUpdater = {
  updateInterval: null,
  isUpdating: false,
  lastUpdate: null,
  
  // Start background updates every 5 minutes
  start(intervalMs = 300000) { // 5 minutes default
    console.log('🔄 Background updater started');
    
    // Run first update after 10 seconds (page fully loaded)
    setTimeout(() => {
      this.silentUpdate();
    }, 10000);
    
    // Then run periodically
    this.updateInterval = setInterval(() => {
      this.silentUpdate();
    }, intervalMs);
    
    // Also update when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.lastUpdate) {
        const timeSinceUpdate = Date.now() - this.lastUpdate;
        if (timeSinceUpdate > 60000) { // If more than 1 minute
          this.silentUpdate();
        }
      }
    });
  },
  
  // Stop background updates
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  },
  
  // Silent update - no UI disruption
  async silentUpdate() {
    if (this.isUpdating) return;
    this.isUpdating = true;
    
    try {
      // Update products silently
      const freshProducts = await fetchProductsFromDB();
      if (freshProducts && freshProducts.length > 0) {
        // Only update if we got valid data
        GLOBAL_PRODUCTS = normalizeProductImages(freshProducts);
        localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(GLOBAL_PRODUCTS));
        console.log('🔄 Products synced silently');
      }
      
      // Update reviews silently
      const freshReviews = await fetchReviewsFromDB();
      if (freshReviews && Object.keys(freshReviews).length > 0) {
        _cachedReviews = freshReviews;
        console.log('🔄 Reviews synced silently');
      }
      
      // Update deals silently
      const freshDeals = await fetchDealsFromDB();
      if (freshDeals !== null) {
        localStorage.setItem(STORAGE.DEALS, JSON.stringify(freshDeals));
        console.log('🔄 Deals synced silently');
      }
      
      // Update featured silently
      const freshFeatured = await fetchFeaturedIdsFromDB();
      if (freshFeatured && freshFeatured.length > 0) {
        localStorage.setItem(STORAGE.FEATURED, JSON.stringify(freshFeatured));
      }
      
      // Update business info silently
      const freshBusiness = await fetchBusinessInfoFromDB();
      if (freshBusiness) {
        localStorage.setItem(STORAGE.BUSINESS, JSON.stringify(freshBusiness));
      }
      
      this.lastUpdate = Date.now();
      console.log('✅ Silent background update completed');
      
    } catch (error) {
      console.warn('⚠️ Background update failed:', error.message);
    } finally {
      this.isUpdating = false;
    }
  },
  
  // Quick update - just products and cart
  async quickUpdate() {
    try {
      const freshProducts = await fetchProductsFromDB();
      if (freshProducts && freshProducts.length > 0) {
        GLOBAL_PRODUCTS = normalizeProductImages(freshProducts);
        localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(GLOBAL_PRODUCTS));
      }
      this.lastUpdate = Date.now();
    } catch (error) {
      console.warn('Quick update failed:', error.message);
    }
  }
};

