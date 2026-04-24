// products-page.js - Standalone version with Supabase Integration
const STORAGE = {
  PRODUCTS: 'shop_products_v3',
  CART: 'shop_cart_v1',
  WISHLIST: 'shop_wishlist',
  REVIEWS: 'shop_reviews',
  BUSINESS: 'business_info',
  CONTACT: 'contact_location_info',
  FEATURED: 'featured_product_ids',
  DEALS: 'deals_of_today',
  ORDERS: 'shop_orders_v1',
  SEARCH_ANALYTICS: 'shop_search_analytics',
  VIEW_ANALYTICS: 'shop_view_analytics',
  FAILED_SEARCHES: 'shop_failed_searches'
};
(function() {
  'use strict';
  
  // Use different variable names to avoid conflicts
  let _currentPage = 1;
  const _itemsPerPage = 12;
  let _currentSort = "name_asc";
  let _currentCategory = "all";
  let _currentSearch = "";
  
  // Wait for everything to load
  async function initialize() {
    if (typeof getProducts !== 'function') {
      console.error('Required functions not loaded yet');
      setTimeout(initialize, 100);
      return;
    }
    
    await renderAllProducts();
    await buildCategoryFilters();
    initSearch();
    initSort();
    await updateCartCount();
    await updateWishlistCount();
    initCartHover();
    handleUrlFilters();
    handleProductFromUrl();
    
    // Override renderCart to update counts after cart changes
    const originalRenderCart = window.renderCart;
    if (originalRenderCart) {
      window.renderCart = async function() {
        await originalRenderCart();
        await updateCartCount();
      };
    }
  }
  
  async function handleProductFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    
    if (productId) {
      setTimeout(async () => {
        if (typeof openProductDetail === 'function') {
          const product = (await getProducts()).find(p => p.id === productId);
          if (product) {
            openProductDetail(productId);
          } else {
            const allProducts = await getProducts();
            const matchedProduct = allProducts.find(p => 
              p.id.toLowerCase().includes(productId.toLowerCase()) ||
              (p.name && p.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === productId.toLowerCase())
            );
            
            if (matchedProduct) {
              openProductDetail(matchedProduct.id);
            } else {
              console.log('Product not found:', productId);
            }
          }
        }
      }, 500);
    }
  }
  
  // Update cart count in header
  async function updateCartCount() {
    if (typeof getCart !== 'function') return;
    const cart = await getCart();
    const countElements = document.querySelectorAll('#cartCount');
    const totalItems = cart.reduce((s, i) => s + (i.qty || 0), 0);
    countElements.forEach(el => {
      if (el) el.innerText = totalItems;
    });
  }
  
  // Update wishlist count in header
  async function updateWishlistCount() {
    if (typeof getWishlist !== 'function') return;
    const wishlist = await getWishlist();
    const countElements = document.querySelectorAll('#wishlistCount');
    countElements.forEach(el => {
      if (el) el.innerText = wishlist.length;
    });
  }
  
  // Handle URL filter parameters
  function handleUrlFilters() {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    
    if (filterParam === 'hot') {
      document.title = 'Hot Products · Sucess Technology';
      const titleEl = document.getElementById('pageTitle');
      if (titleEl) titleEl.textContent = '🔥 Hot Products';
    } else if (filterParam === 'new') {
      document.title = 'New Arrivals · Sucess Technology';
      const titleEl = document.getElementById('pageTitle');
      if (titleEl) titleEl.textContent = '✨ New Arrivals';
    } else {
      document.title = 'All Products · Sucess Technology';
    }
  }
  
  // Quick cart preview on hover
  function initCartHover() {
    const cartBtn = document.getElementById('cartBtn');
    const cartPreview = document.getElementById('cartPreview');
    
    if (!cartBtn || !cartPreview) return;
    
    let timeout;
    cartBtn.addEventListener('mouseenter', () => {
      clearTimeout(timeout);
      renderCartPreview();
      cartPreview.classList.remove('hidden');
    });
    
    cartBtn.addEventListener('mouseleave', () => {
      timeout = setTimeout(() => {
        cartPreview.classList.add('hidden');
      }, 300);
    });
    
    cartPreview.addEventListener('mouseenter', () => {
      clearTimeout(timeout);
    });
    
    cartPreview.addEventListener('mouseleave', () => {
      cartPreview.classList.add('hidden');
    });
  }
  
  // Render quick cart preview
  async function renderCartPreview() {
    if (typeof getCart !== 'function') return;
    const cart = await getCart();
    const preview = document.getElementById('cartPreview');
    if (!preview) return;
    
    if (cart.length === 0) {
      preview.innerHTML = '<p class="text-center text-gray-500 p-4">Your cart is empty</p>';
      return;
    }
    
    const total = cart.reduce((s, i) => s + ((i.price || 0) * (i.qty || 0)), 0);
    
    preview.innerHTML = `
      <div class="p-4">
        <h4 class="font-bold mb-3">Shopping Cart (${cart.length} items)</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${cart.slice(0, 3).map(item => `
            <div class="flex gap-3 border-b pb-2">
              <img src="${item.image || 'https://placehold.co/100x100'}" class="w-12 h-12 object-cover rounded">
              <div class="flex-1">
                <p class="text-sm font-medium truncate">${item.name || 'Product'}</p>
                <p class="text-xs text-gray-500">${item.qty || 0} x FCFA ${(item.price || 0).toFixed(2)}</p>
              </div>
            </div>
          `).join('')}
          ${cart.length > 3 ? `<p class="text-xs text-gray-500 text-center">+ ${cart.length - 3} more items</p>` : ''}
        </div>
        <div class="mt-3 pt-3 border-t">
          <p class="font-bold">Total: FCFA ${total.toFixed(2)}</p>
          <div class="flex gap-2 mt-2">
            <button onclick="document.getElementById('cartModal').classList.remove('hidden'); if(typeof renderCart==='function') renderCart();" class="flex-1 bg-primary text-white py-2 rounded-lg text-sm">View Cart</button>
            <button onclick="if(typeof openCheckout==='function') openCheckout();" class="flex-1 bg-dark text-white py-2 rounded-lg text-sm">Checkout</button>
          </div>
        </div>
      </div>
    `;
  }
  
  function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    
    input.addEventListener('input', async (e) => {
      _currentSearch = e.target.value;
      _currentPage = 1;
      
      // Track search silently
      if (_currentSearch.trim().length >= 2) {
        await trackProductSearch(_currentSearch);
        const products = await getProducts();
        const results = products.filter(p =>
          p.name.toLowerCase().includes(_currentSearch.toLowerCase())
        ).length;
        await trackSearchResults(_currentSearch, results);
      }
      
      await renderAllProducts();
    });
  }
  
  function initSort() {
    const select = document.getElementById('sortSelect');
    if (!select) return;
    
    select.addEventListener('change', (e) => {
      _currentSort = e.target.value;
      _currentPage = 1;
      renderAllProducts();
    });
  }
  
  async function buildCategoryFilters() {
    if (typeof getProducts !== 'function') return;
    let products = await getProducts();
    let categories = [...new Set(products.map(p => p.category))].sort();
    let container = document.getElementById('categoryFilters');
    if (!container) return;
  
    let html = `<button onclick="window.filterProductsByCategory('all')" class="filter-btn ${_currentCategory === 'all' ? 'active' : ''} px-4 py-2 rounded-full border hover:border-primary transition-all">All</button>`;
    categories.forEach(cat => {
      html += `<button onclick="window.filterProductsByCategory('${cat}')" class="filter-btn ${_currentCategory === cat ? 'active' : ''} px-4 py-2 rounded-full border hover:border-primary transition-all">${formatCategoryTitleSafe(cat)}</button>`;
    });
  
    container.innerHTML = html;
  }
  
  function formatCategoryTitleSafe(category) {
    if (!category) return 'Category';
    return category.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  
  window.filterProductsByCategory = function(category) {
    _currentCategory = category;
    _currentPage = 1;
    renderAllProducts();
    buildCategoryFilters();
  };
  
  function getSortedProductsSafe(products) {
    let sorted = [...products];
    if (_currentSort === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (_currentSort === "name_desc") {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (_currentSort === "price_asc") {
      sorted.sort((a, b) => a.price - b.price);
    } else if (_currentSort === "price_desc") {
      sorted.sort((a, b) => b.price - a.price);
    }
    return sorted;
  }
  
  async function renderAllProducts() {
    if (typeof getProducts !== 'function') return;
    let products = await getProducts();
  
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    
    if (filterParam === 'hot') {
      products = products.filter(p => p.isHot);
    } else if (filterParam === 'new') {
      products = products.filter(p => p.isNew);
    }
  
    if (_currentSearch) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(_currentSearch.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(_currentSearch.toLowerCase()))
      );
    }
  
    if (_currentCategory !== "all") {
      products = products.filter(p => p.category === _currentCategory);
    }
  
    let sorted = getSortedProductsSafe(products);
    let totalPages = Math.ceil(sorted.length / _itemsPerPage);
    
    if (totalPages <= 1 || _currentPage >= totalPages) {
      _currentPage = 1;
      totalPages = 1;
    }
    
    if (_currentPage > totalPages) _currentPage = Math.max(1, totalPages);
  
    let start = (_currentPage - 1) * _itemsPerPage;
    let paginated = totalPages <= 1 ? sorted : sorted.slice(start, start + _itemsPerPage);
  
    const container = document.getElementById('productsGrid');
    if (container) {
      if (paginated.length === 0 && !_currentSearch && _currentCategory === 'all') {
        products = await getProducts();
        sorted = getSortedProductsSafe(products);
        paginated = sorted;
        totalPages = 1;
      }
      
      const cardsHtml = await Promise.all(paginated.map(p => renderProductCardEnhanced(p)));
      container.innerHTML = cardsHtml.length
        ? cardsHtml.join('')
        : '<div class="col-span-full text-center py-10 text-gray-500">No products found.</div>';
    }
  
    attachCardEvents();
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    let paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
  
    if (totalPages <= 1) {
      paginationDiv.innerHTML = '';
      return;
    }
  
    let html = '<div class="flex flex-wrap gap-2 justify-center">';
    
    if (_currentPage > 1) {
      html += `<button onclick="window.goToProductsPage(${_currentPage - 1})" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">← Prev</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= _currentPage - 2 && i <= _currentPage + 2)) {
        html += `<button onclick="window.goToProductsPage(${i})" class="px-4 py-2 border rounded-lg transition-colors ${i === _currentPage ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'}">${i}</button>`;
      } else if (i === _currentPage - 3 || i === _currentPage + 3) {
        html += '<span class="px-2 text-gray-400 flex items-center">...</span>';
      }
    }
    
    if (_currentPage < totalPages) {
      html += `<button onclick="window.goToProductsPage(${_currentPage + 1})" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Next →</button>`;
    }
    
    html += '</div>';
    paginationDiv.innerHTML = html;
  }
  
  async function renderProductCardEnhanced(p) {
    let wishlist = typeof getWishlist === 'function' ? await getWishlist() : [];
    let isWished = wishlist.includes(p.id);
    let avgRating = typeof getAverageRating === 'function' ? await getAverageRating(p.id) : 0;
    let reviewCount = typeof getReviewCount === 'function' ? getReviewCount(p.id) : 0;
    
    const deals = typeof getDealsOfToday === 'function' ? await getDealsOfToday() : [];
    const dealInfo = deals.find(d => d.id === p.id);
    const hasDeal = !!dealInfo;
    const discount = hasDeal ? dealInfo.discount : 0;
    const originalPrice = p.price;
    const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;
  
    return `
      <article class="product-card group bg-white rounded-xl overflow-hidden border" data-product-id="${p.id}">
        <div class="relative">
          <div class="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button class="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors ${isWished ? 'text-red-500' : ''}" data-wish="${p.id}" onclick="event.stopPropagation(); window.quickToggleWishlistPage('${p.id}')">
              <i class="${isWished ? 'fas fa-heart' : 'far fa-heart'}"></i>
            </button>
            <button class="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100" onclick="event.stopPropagation(); if(typeof openProductDetail==='function') openProductDetail('${p.id}')">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          
          ${p.isNew ? '<div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">NEW</div>' : ''}
          ${p.isHot ? '<div class="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">HOT</div>' : ''}
          ${p.isNew && p.isHot ? '<div class="absolute top-10 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">NEW</div>' : ''}
          ${hasDeal ? `<div class="absolute top-${p.isNew || p.isHot ? '20' : '2'} left-2 bg-primary text-white px-2 py-1 rounded-full text-xs font-bold z-10">-${discount}%</div>` : ''}
          
          <img src="${p.image}" alt="${p.name}" loading="lazy" class="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300">
        </div>
        
        <div class="p-4">
          <p class="text-xs text-gray-500 mb-1">${p.brand || 'Premium'}</p>
          <h3 class="font-semibold text-gray-900 mb-2 truncate">${p.name}</h3>
          
          <div class="flex items-center gap-2 mb-2">
            <div class="star-rating text-yellow-400 text-sm">${renderStarsSafe(avgRating)}</div>
            <span class="text-xs text-gray-500">(${reviewCount})</span>
          </div>
          
          ${hasDeal ? `
            <div class="flex items-center gap-2 mb-3">
              <span class="text-gray-400 line-through text-sm">FCFA ${originalPrice.toFixed(2)}</span>
              <span class="text-primary font-bold text-xl">FCFA ${discountedPrice.toFixed(2)}</span>
            </div>
          ` : `
            <div class="mb-3">
              <span class="text-gray-900 font-bold text-xl">FCFA ${p.price.toFixed(2)}</span>
            </div>
          `}
          
          <button onclick="event.stopPropagation(); window.quickAddToCartPage('${p.id}')" 
                  class="w-full bg-dark hover:bg-primary text-white py-3 rounded-xl font-medium transition-all transform hover:scale-105">
            <i class="fas fa-shopping-cart mr-2"></i>Add to Cart
          </button>
        </div>
      </article>
    `;
  }
  
  function renderStarsSafe(rating) {
    let full = Math.floor(rating);
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    for (let i = stars.length; i < 5; i++) stars += '☆';
    return stars;
  }
  
  // Quick add to cart
  window.quickAddToCartPage = async function(id) {
    if (typeof getProducts !== 'function' || typeof window.addToCart !== 'function') return;
    
    const product = (await getProducts()).find(p => p.id === id);
    if (!product) return;
    
    if (product.variants && product.variants.length > 0) {
      if (typeof openProductDetail === 'function') {
        openProductDetail(id);
      }
      return;
    }
    
    await window.addToCart(id, 1, {});
    await updateCartCount();
    if (typeof showToast === 'function') {
      showToast(`${product.name} added to cart!`);
    }
  };
  
  // Quick toggle wishlist
  window.quickToggleWishlistPage = async function(id) {
    if (typeof toggleWishlist !== 'function') return;
    await toggleWishlist(id);
    await updateWishlistCount();
    await renderAllProducts();
  };
  
  window.goToProductsPage = function(page) {
    _currentPage = page;
    renderAllProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Attach card click events
  function attachCardEvents() {
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.dataset.productId;
        if (id && typeof openProductDetail === 'function') {
          openProductDetail(id);
        }
      });
    });
  }
  
  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();

// Handle product from URL when page loads
window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  
  if (productId && typeof openProductDetail === 'function') {
    setTimeout(async () => {
      const products = typeof getProducts === 'function' ? await getProducts() : [];
      const product = products.find(p => p.id === productId);
      
      if (product) {
        openProductDetail(productId);
      } else {
        console.warn('Product not found with ID:', productId);
        console.log('Available products:', products.map(p => p.id));
      }
    }, 600);
  }
});