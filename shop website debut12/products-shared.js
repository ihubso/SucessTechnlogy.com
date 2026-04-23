// products-shared.js - Essential functions for products page
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

const RECENTLY_VIEWED_KEY = 'shop_recently_viewed';
const MAX_RECENT = 8;

// ===============================================
//               STORAGE FUNCTIONS
// ===============================================

function getStorage(key, def = null) {
  const raw = localStorage.getItem(key);
  if (!raw) return def;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return def;
  }
}

function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
// ===============================================
//           ANALYTICS TRACKING (Silent)
// ===============================================

function trackProductSearch(query) {
  if (!query || query.trim().length < 2) return;
  
  const analytics = getStorage(STORAGE.SEARCH_ANALYTICS, {});
  const normalizedQuery = query.trim().toLowerCase();
  
  if (!analytics[normalizedQuery]) {
    analytics[normalizedQuery] = {
      query: query.trim(),
      count: 0,
      lastSearched: new Date().toISOString(),
      results: 0
    };
  }
  
  analytics[normalizedQuery].count++;
  analytics[normalizedQuery].lastSearched = new Date().toISOString();
  
  setStorage(STORAGE.SEARCH_ANALYTICS, analytics);
}

function trackSearchResults(query, resultCount) {
  if (!query || query.trim().length < 2) return;
  
  const analytics = getStorage(STORAGE.SEARCH_ANALYTICS, {});
  const normalizedQuery = query.trim().toLowerCase();
  
  if (analytics[normalizedQuery]) {
    analytics[normalizedQuery].results = resultCount;
    setStorage(STORAGE.SEARCH_ANALYTICS, analytics);
  }
  
  if (resultCount === 0) {
    const failedSearches = getStorage(STORAGE.FAILED_SEARCHES, []);
    const existingIndex = failedSearches.findIndex(fs => 
      fs.query.toLowerCase() === normalizedQuery
    );
    
    if (existingIndex !== -1) {
      failedSearches[existingIndex].count++;
      failedSearches[existingIndex].lastSearched = new Date().toISOString();
    } else {
      failedSearches.push({
        query: query.trim(),
        count: 1,
        lastSearched: new Date().toISOString()
      });
    }
    
    setStorage(STORAGE.FAILED_SEARCHES, failedSearches);
  }
}

function trackProductView(productId) {
  if (!productId) return;
  
  const analytics = getStorage(STORAGE.VIEW_ANALYTICS, {});
  
  if (!analytics[productId]) {
    analytics[productId] = {
      count: 0,
      firstViewed: new Date().toISOString(),
      lastViewed: new Date().toISOString()
    };
  }
  
  analytics[productId].count++;
  analytics[productId].lastViewed = new Date().toISOString();
  
  setStorage(STORAGE.VIEW_ANALYTICS, analytics);
}
// ===============================================
//               PRODUCT FUNCTIONS
// ===============================================

function getProducts() {
  let p = getStorage(STORAGE.PRODUCTS);
  if (!p || p.length === 0) {
    setStorage(STORAGE.PRODUCTS, DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }
  return p;
}

function saveProducts(prods) {
  setStorage(STORAGE.PRODUCTS, prods);
}

// ===============================================
//               CART FUNCTIONS
// ===============================================

function getCart() {
  return getStorage(STORAGE.CART, []);
}

function saveCart(cart) {
  setStorage(STORAGE.CART, cart);
  renderCart();
}

// ===============================================
//               WISHLIST FUNCTIONS
// ===============================================

function getWishlist() {
  return getStorage(STORAGE.WISHLIST, []);
}

function saveWishlist(wish) {
  setStorage(STORAGE.WISHLIST, wish);
}

function toggleWishlist(productId) {
  let wish = getWishlist();
  if (wish.includes(productId)) {
    wish = wish.filter(id => id !== productId);
  } else {
    wish.push(productId);
  }
  saveWishlist(wish);
  showToast(wish.includes(productId) ? "Added to wishlist" : "Removed from wishlist");
  renderWishlistModal();
}

// ===============================================
//               DEALS FUNCTIONS
// ===============================================

function getDealsOfToday() {
  return getStorage(STORAGE.DEALS, []);
}

// ===============================================
//               REVIEW FUNCTIONS
// ===============================================

function getReviews() {
  return getStorage(STORAGE.REVIEWS, {});
}

function saveReviews(reviews) {
  setStorage(STORAGE.REVIEWS, reviews);
}

function getProductReviews(productId) {
  let revs = getReviews();
  return revs[productId] || [];
}

function getAverageRating(productId) {
  let revs = getProductReviews(productId);
  if (revs.length === 0) return 0;
  let sum = revs.reduce((s, r) => s + r.rating, 0);
  return sum / revs.length;
}

function getReviewCount(productId) {
  return getProductReviews(productId).length;
}

function renderStars(rating) {
  let full = Math.floor(rating);
  let half = (rating % 1) >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  for (let i = stars.length; i < 5; i++) stars += '☆';
  return stars;
}

function addReview(productId, userName, rating, comment) {
  if (!userName || !comment) {
    showToast("Please fill all review fields");
    return;
  }
  let reviews = getReviews();
  if (!reviews[productId]) reviews[productId] = [];
  reviews[productId].push({
    id: Date.now(),
    user: userName,
    rating: parseInt(rating),
    comment,
    date: new Date().toLocaleDateString()
  });
  saveReviews(reviews);

  if (!document.getElementById('productModal').classList.contains('hidden') &&
      window.currentModalProductId === productId) {
    renderProductDetailModal(productId);
  }
  showToast("Review added!");
}

// ===============================================
//               RECENTLY VIEWED
// ===============================================

function addToRecentlyViewed(productId) {
  let recent = getStorage(RECENTLY_VIEWED_KEY, []);
  recent = recent.filter(id => id !== productId);
  recent.unshift(productId);
  if (recent.length > MAX_RECENT) recent.pop();
  setStorage(RECENTLY_VIEWED_KEY, recent);
}

// ===============================================
//               TOAST & MODAL
// ===============================================

function showToast(msg) {
  let t = document.getElementById('toastMsg');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2400);
}

window.openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

// ===============================================
//               WISHLIST MODAL
// ===============================================

function renderWishlistModal() {
  let wishIds = getWishlist();
  let products = getProducts();
  let items = products.filter(p => wishIds.includes(p.id));
  const container = document.getElementById('wishlistItems');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500">Your wishlist is empty.</p>';
    return;
  }

  container.innerHTML = `
    <div class="grid gap-4">
      ${items.map(p => `
        <div class="flex gap-4 border-b pb-3">
          <img src="${p.image}" class="w-20 h-20 object-cover rounded">
          <div>
            <h3 class="font-bold">${p.name}</h3>
            <p>FCFA ${p.price}</p>
            <button onclick="openProductDetail('${p.id}');closeModal('wishlistModal')" class="text-primary text-sm">View</button>
            <button onclick="toggleWishlist('${p.id}');renderWishlistModal()" class="text-red-500 text-sm">Remove</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===============================================
//               PRODUCT DETAIL MODAL
// ===============================================

window.currentModalProductId = null;

function openProductDetail(id) {
  window.currentModalProductId = id;
  addToRecentlyViewed(id);
  trackProductView(id);
  renderProductDetailModal(id);
  openModal('productModal');
  
  // ✅ Scroll modal to top when opening a new product
  setTimeout(() => {
    scrollModalToTop();
  }, 100);
}

function renderProductDetailModal(id) {
  const p = getProducts().find(pr => pr.id === id);
  if (!p) return;

  const avgRating = getAverageRating(id);
  const reviews = getProductReviews(id);
  const isWished = getWishlist().includes(id);
  // In renderProductDetailModal function, update the shareUrl line:
const shareUrl = `${window.location.origin}${window.location.pathname}?product=${p.id}`;

  const deals = getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  const hasDeal = !!dealInfo;
  const discount = hasDeal ? dealInfo.discount : 0;
  const originalPrice = p.price;
  const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;

  const related = getProducts()
    .filter(prod => prod.id !== id && (prod.category === p.category || prod.brand === p.brand))
    .slice(0, 4);

  let allImages = [p.image]; 
  
  if (p.images && Array.isArray(p.images)) {
    const extraImages = p.images.filter(img => img !== p.image);
    allImages = [...allImages, ...extraImages];
  }

  let galleryHtml = '';
  if (allImages.length > 1) {
    galleryHtml = `
      <div class="flex gap-3 mt-6 overflow-x-auto pb-4 no-scrollbar">
        ${allImages.map((img, index) => `
          <div class="w-20 h-20 flex-shrink-0 rounded-2xl border-2 border-gray-100 overflow-hidden cursor-pointer hover:border-black transition-all bg-white shadow-sm">
            <img src="${img}" alt="View ${index + 1}"
                 onclick="const main = document.getElementById('mainImageDisplay'); main.style.opacity='0.5'; setTimeout(()=>{main.src='${img}'; main.style.opacity='1'}, 100)" 
                 class="w-full h-full object-contain p-2"
                 onerror="this.src='https://placehold.co/100x100?text=No+Image'">
          </div>
        `).join('')}
      </div>
    `;
  }

  const modalInner = document.getElementById('productDetailInner');
  
  modalInner.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-10 p-2">
      <div class="lg:w-1/2">
        <div class="sticky top-10">
          <div class="modal-image-container bg-white rounded-[2.5rem] overflow-hidden aspect-square flex items-center justify-center border border-gray-100 shadow-sm relative">
            ${hasDeal ? `<div class="absolute top-4 left-4 z-10 bg-primary text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg">-${discount}% OFF</div>` : ''}
            <img id="mainImageDisplay" src="${p.image}" alt="${p.name}" class="object-contain w-full h-full p-8" />
          </div>
          ${galleryHtml}
        </div>
      </div>

      <div class="lg:w-1/2 flex flex-col">
        <div class="flex justify-between items-start mb-2">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-primary mb-1 block">${p.brand || 'Premium Collection'}</span>
            <h2 class="text-4xl font-extrabold text-gray-900 leading-tight">${p.name}</h2>
          </div>
          <button onclick="toggleWishlist('${id}'); renderProductDetailModal('${id}');" 
                  class="p-3 rounded-full bg-white shadow-md hover:shadow-lg transition-all border border-gray-100">
            ${isWished ? '❤️' : '🤍'}
          </button>
        </div>

        <div class="flex items-center gap-3 mb-6">
          <div class="flex text-yellow-400">${renderStars(avgRating)}</div>
          <span class="text-sm text-gray-500 font-medium">${reviews.length} Verified Reviews</span>
        </div>

        <div class="mb-6">
          ${hasDeal ? `
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl text-gray-400 line-through">FCFA ${originalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <span class="bg-primary text-white px-3 py-1 rounded-full text-sm font-bold">SAVE ${discount}%</span>
            </div>
            <div class="text-5xl font-bold text-primary">FCFA ${discountedPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <p class="text-sm text-green-600 mt-2">🔥 Deal of the Day - Limited Time Offer!</p>
          ` : `
            <div class="text-4xl font-light text-gray-900">FCFA ${originalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          `}
        </div>

        <div class="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100">
          <h4 class="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">Specifications</h4>
          <div class="grid grid-cols-2 gap-y-4 gap-x-6">
            ${p.cpu ? `<div><p class="text-xs text-gray-500">Processor</p><p class="font-semibold text-sm">${p.cpu}</p></div>` : ''}
            ${p.os ? `<div><p class="text-xs text-gray-500">Operating System</p><p class="font-semibold text-sm">${p.os}</p></div>` : ''}
            ${p.stock !== undefined ? `<div><p class="text-xs text-gray-500">Stock Status</p><p class="font-semibold text-sm ${p.stock > 0 ? 'text-green-600' : 'text-red-600'}">${p.stock > 0 ? 'In Stock ('+p.stock+')' : 'Out of Stock'}</p></div>` : ''}
            <div class="col-span-2"><p class="text-xs text-gray-500">Details</p><p class="text-sm">${p.specs || 'No specific details provided.'}</p></div>
          </div>
        </div>

        ${p.variants && p.variants.length ? `
        <div class="mb-6 space-y-4">
          ${p.variants.map(v => `
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-2">${v.type}:</label>
              <div class="flex flex-wrap gap-2">
                ${v.values.map(val => `
                  <button type="button" class="variant-option px-4 py-2 border border-gray-300 rounded-full text-sm hover:border-primary" data-variant-type="${v.type}" data-variant-value="${val}">${val}</button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="flex flex-col sm:flex-row gap-4 mb-8">
          <button onclick="addToCartWithVariants('${p.id}')" class="flex-[2] ${hasDeal ? 'bg-primary' : 'bg-black'} text-white py-4 rounded-xl font-bold hover:bg-opacity-90 transition-all">
            ${hasDeal ? '🔥 Add Deal to Bag' : 'Add to Bag'}
          </button>
          <button onclick="shareProduct('${shareUrl}', '${p.name}')" class="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            <span>📤</span> Share
          </button>
        </div>
      </div>
    </div>

    <div class="mt-8 border-t border-gray-200 pt-6">
      <h4 class="text-lg font-bold mb-4">⭐ Customer Reviews (${reviews.length})</h4>
      <div class="space-y-4 max-h-64 overflow-y-auto pr-2 mb-6">
        ${reviews.length ? reviews.map(r => `
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex justify-between items-start">
              <div>
                <p class="font-semibold">${r.user}</p>
                <div class="star-rating text-yellow-500 text-sm">${renderStars(r.rating)}</div>
              </div>
              <span class="text-xs text-gray-400">${r.date}</span>
            </div>
            <p class="text-sm text-gray-700 mt-2">${r.comment}</p>
          </div>
        `).join('') : '<p class="text-gray-400 text-sm">No reviews yet. Be the first to review!</p>'}
      </div>
      ${!getCurrentUser() ? `
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
        <i class="fas fa-info-circle"></i>
        <span>Please enter your name or <button onclick="closeModal('productModal'); openModal('accountModal'); showLoginForm()" class="text-primary font-semibold hover:underline">login</button> to auto-fill</span>
      </div>
    ` : `
      <div class="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 flex items-center gap-2">
        <i class="fas fa-check-circle"></i>
        <span>Reviewing as <strong>${getReviewerName()}</strong></span>
      </div>
    `}

      <div class="bg-gray-50 rounded-xl p-5">
        <h5 class="font-bold mb-3">✏️ Write a Review</h5>
        <div class="space-y-3">
          <<input type="text" id="reviewUserName-${id}" placeholder="Your name" value="${getReviewerName()}" class="w-full border border-gray-200 rounded-lg p-2 text-sm" ${getCurrentUser() ? 'readonly style="background:#f0fdf4; border-color:#86efac;"' : ''} />
          <select id="reviewRating-${id}" class="w-full border border-gray-200 rounded-lg p-2 text-sm">
            <option value="5">★★★★★ (5)</option>
            <option value="4">★★★★☆ (4)</option>
            <option value="3">★★★☆☆ (3)</option>
            <option value="2">★★☆☆☆ (2)</option>
            <option value="1">★☆☆☆☆ (1)</option>
          </select>
          <textarea id="reviewComment-${id}" placeholder="Your review..." rows="3" class="w-full border border-gray-200 rounded-lg p-2 text-sm"></textarea>
          <button onclick="submitReview('${id}')" class="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primaryHover transition">
            Submit Review
          </button>
        </div>
      </div>
    </div>

<!-- Related Products Section -->
<div class="mt-16 pt-10 border-t border-gray-100">
  <div class="flex items-center justify-between mb-8">
    <h3 class="text-2xl font-bold">Complete the Look</h3>
    <button onclick="toggleRelatedPanel()" 
            class="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary transition-colors bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
      <span id="relatedPanelBtnText">Show More</span>
      <i id="relatedPanelBtnIcon" class="fas fa-chevron-down transition-transform duration-300"></i>
    </button>
  </div>
  
  <!-- Collapsible Panel -->
  <div id="relatedProductsPanel" class="related-panel overflow-hidden transition-all duration-500 ease-in-out" style="max-height: 300px;">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      ${related.map((rp, index) => `
        <div class="related-product-card group cursor-pointer opacity-0 transform translate-y-4" 
             onclick="openProductDetail('${rp.id}')"
             style="animation: fadeInUp 0.5s ease forwards ${index * 0.1}s;">
          <div class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 mb-3 overflow-hidden border-2 border-transparent group-hover:border-primary/20 group-hover:shadow-lg transition-all duration-300 relative">
            <!-- Quick action buttons -->
            <div class="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
              <button onclick="event.stopPropagation(); quickAddToCart('${rp.id}')" 
                      class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-primary hover:text-white transition-all text-sm"
                      title="Add to cart">
                <i class="fas fa-shopping-cart"></i>
              </button>
              <button onclick="event.stopPropagation(); window.quickToggleWishlistPage ? quickToggleWishlistPage('${rp.id}') : toggleWishlist('${rp.id}')" 
                      class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all text-sm"
                      title="Add to wishlist">
                <i class="far fa-heart"></i>
              </button>
            </div>
            
            <!-- Product image with zoom effect -->
            <div class="relative overflow-hidden rounded-xl">
              <img src="${rp.image}" 
                   class="w-full aspect-square object-contain group-hover:scale-110 transition-transform duration-500">
              ${rp.isNew ? '<div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">NEW</div>' : ''}
              ${rp.isHot ? '<div class="absolute top-2 left-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">HOT</div>' : ''}
            </div>
          </div>
          
          <!-- Product info -->
          <div class="px-2">
            <p class="text-xs text-gray-400 mb-1">${rp.brand || 'Premium'}</p>
            <h4 class="font-bold text-sm truncate group-hover:text-primary transition-colors">${rp.name}</h4>
            <div class="flex items-center gap-2 mt-1">
              <p class="text-primary font-bold text-sm">FCFA ${rp.price.toFixed(2)}</p>
              ${rp.stock <= 5 ? '<span class="text-xs text-red-500 font-medium">Low stock</span>' : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- Show More/Less toggle -->
    ${related.length > 4 ? `
      <div class="text-center mt-6">
        <button onclick="toggleRelatedPanel()" 
                class="inline-flex items-center gap-2 text-primary font-medium hover:underline">
          <span id="relatedPanelToggleText">View All ${related.length} Products</span>
          <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    ` : ''}
  </div>
</div>
  `;
  
  window.currentModalDealPrice = hasDeal ? discountedPrice : null;
  window.currentModalVariants = {};
  
  document.querySelectorAll('.variant-option').forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.dataset.variantType;
      this.parentElement.querySelectorAll('.variant-option').forEach(b => 
        b.classList.remove('bg-primary', 'text-white', 'border-primary')
      );
      this.classList.add('bg-primary', 'text-white', 'border-primary');
      window.currentModalVariants = window.currentModalVariants || {};
      window.currentModalVariants[type] = this.dataset.variantValue;
    });
  });
}
// Toggle related products panel
window.toggleRelatedPanel = function() {
  const panel = document.getElementById('relatedProductsPanel');
  const btnText = document.getElementById('relatedPanelBtnText');
  const btnIcon = document.getElementById('relatedPanelBtnIcon');
  
  if (!panel || !btnText || !btnIcon) return;
  
  const isCollapsed = panel.style.maxHeight === '0px' || panel.style.maxHeight === '';
  
  if (panel.style.maxHeight === '300px' || panel.style.maxHeight === '') {
    // Collapse
    panel.style.maxHeight = '0px';
    panel.style.opacity = '0';
    btnText.textContent = 'Show More';
    btnIcon.style.transform = 'rotate(0deg)';
  } else {
    // Expand
    panel.style.maxHeight = '2000px';
    panel.style.opacity = '1';
    btnText.textContent = 'Show Less';
    btnIcon.style.transform = 'rotate(180deg)';
  }
};
// Scroll modal to top when new product is loaded
function scrollModalToTop() {
  const modalContent = document.querySelector('.modalcontent');
  if (modalContent) {
    modalContent.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
// ===============================================
//               CART RENDERING
// ===============================================

function renderCart() {
  let cart = getCart();
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.innerText = cart.reduce((s, i) => s + i.qty, 0);

  let container = document.getElementById('cartItems');
  if (!container) return;
  
  if (!cart.length) {
    container.innerHTML = '<div class="text-center py-8">Cart empty</div>';
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.innerText = '0.00';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map((item, index) => {
    total += item.price * item.qty;
    let variantsText = '';
    if (item.variants && Object.keys(item.variants).length) {
      variantsText = Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return `
      <div class="cart-item flex justify-between items-center mb-4 border-b pb-2" data-cart-index="${index}">
        <div>
          <strong>${item.name}</strong><br>
          ${item.isDeal ? `
            <div>
              <small class="text-gray-400 line-through">FCFA ${item.originalPrice.toFixed(2)}</small>
              <small class="text-primary font-bold ml-2">FCFA ${item.price.toFixed(2)}</small>
              <span class="text-xs bg-primary text-white px-2 py-0.5 rounded-full ml-2">-${item.discount}%</span>
            </div>
          ` : `
            <small>FCFA ${item.price.toFixed(2)}</small>
          `}
          ${variantsText ? `<div class="text-xs text-gray-500 mt-1">${variantsText}</div>` : ''}
        </div>
        <div>
          <button class="cart-qty-dec px-2 bg-gray-200 rounded" data-index="${index}">-</button>
          <span class="mx-2">${item.qty}</span>
          <button class="cart-qty-inc px-2 bg-gray-200 rounded" data-index="${index}">+</button>
        </div>
      </div>
    `;
  }).join('');

  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.innerText = total.toFixed(2);

  container.querySelectorAll('.cart-qty-dec').forEach(btn => {
    btn.addEventListener('click', () => updateQtyByIndex(parseInt(btn.dataset.index), -1));
  });
  container.querySelectorAll('.cart-qty-inc').forEach(btn => {
    btn.addEventListener('click', () => updateQtyByIndex(parseInt(btn.dataset.index), 1));
  });
}

function updateQtyByIndex(index, delta) {
  let cart = getCart();
  if (index < 0 || index >= cart.length) return;
  let item = cart[index];
  let prod = getProducts().find(p => p.id === item.id);
  let newQ = item.qty + delta;
  if (newQ <= 0) {
    cart.splice(index, 1);
  } else if (prod && newQ > prod.stock) {
    showToast(`Only ${prod.stock} left`);
    return;
  } else {
    item.qty = newQ;
  }
  saveCart(cart);
}

// ===============================================
//               ADD TO CART FUNCTIONS
// ===============================================

window.addToCart = function (id, qty = 1, variants = {}) {
  let products = getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) {
    showToast("Out of stock");
    return;
  }
  let cart = getCart();
  let existing = cart.find(i => i.id === id && JSON.stringify(i.variants) === JSON.stringify(variants));
  if (existing) {
    if (existing.qty + qty > product.stock) {
      showToast(`Only ${product.stock} left`);
      return;
    }
    existing.qty += qty;
  } else {
    if (qty > product.stock) {
      showToast(`Only ${product.stock} left`);
      return;
    }
    cart.push({
      id,
      name: product.name,
      price: product.price,
      qty,
      image: product.image,
      variants: variants || {}
    });
  }
  saveCart(cart);
  showToast(`${product.name} added`);
};

window.addToCartWithDealPrice = function(id, qty = 1, variants = {}, dealPrice, discount) {
  let products = getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) {
    showToast("Out of stock");
    return;
  }
  let cart = getCart();
  let existing = cart.find(i => i.id === id && JSON.stringify(i.variants) === JSON.stringify(variants));
  if (existing) {
    if (existing.qty + qty > product.stock) {
      showToast(`Only ${product.stock} left`);
      return;
    }
    existing.qty += qty;
  } else {
    if (qty > product.stock) {
      showToast(`Only ${product.stock} left`);
      return;
    }
    cart.push({
      id,
      name: product.name,
      price: dealPrice,
      originalPrice: product.price,
      discount: discount,
      qty,
      image: product.image,
      variants: variants || {},
      isDeal: true
    });
  }
  saveCart(cart);
  showToast(`${product.name} added at deal price!`);
};

window.addToCartWithVariants = function(id) {
  const qty = parseInt(document.getElementById('modalQtyInput')?.value || 1);
  const variants = window.currentModalVariants || {};
  const deals = getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  if (dealInfo) {
    const product = getProducts().find(p => p.id === id);
    const discountedPrice = product.price * (1 - dealInfo.discount / 100);
    window.addToCartWithDealPrice(id, qty, variants, discountedPrice, dealInfo.discount);
  } else {
    window.addToCart(id, qty, variants);
  }
  closeModal('productModal');
  showToast("Added to cart!");
};
window.quickAddToCart = function(id) {
  const qty = parseInt(document.getElementById('modalQtyInput')?.value || 1);
  const variants = window.currentModalVariants || {};
  const deals = getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  if (dealInfo) {
    const product = getProducts().find(p => p.id === id);
    const discountedPrice = product.price * (1 - dealInfo.discount / 100);
    window.addToCartWithDealPrice(id, qty, variants, discountedPrice, dealInfo.discount);
  } else {
    window.addToCart(id, qty, variants);
  }

  showToast("Added to cart!");
};

// ===============================================
//               OTHER FUNCTIONS
// ===============================================

window.submitReview = function(productId) {
  // Auto-use logged-in user's name if available
  const user = getCurrentUser();
  let userName;
  
  if (user) {
    userName = user.name; // Use logged-in user's name automatically
  } else {
    userName = document.getElementById(`reviewUserName-${productId}`).value.trim();
    if (!userName) {
      showToast("Please enter your name or login first");
      return;
    }
  }
  
  const rating = document.getElementById(`reviewRating-${productId}`).value;
  const comment = document.getElementById(`reviewComment-${productId}`).value.trim();

  if (!comment) {
    showToast("Please write a review");
    return;
  }

  addReview(productId, userName, rating, comment);
  renderProductDetailModal(productId);
  showToast("Thank you for your review!");
};
// Auto-fill review name from account
function getReviewerName() {
  const user = getCurrentUser();
  return user ? user.name : '';
}

function getCurrentUser() {
  const raw = localStorage.getItem('shop_current_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}
window.shareProduct = async function (url, name) {
  if (navigator.share) {
    try {
      await navigator.share({ title: name, url: url });
    } catch (e) {
      copyToClipboard(url);
    }
  } else {
    copyToClipboard(url);
  }
};

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast("Link copied!");
}

window.clearCart = function () {
  saveCart([]);
  showToast("Cart cleared");
};

window.openCheckout = function () {
  if (getCart().length === 0) {
    showToast("Cart empty");
    return;
  }
  closeModal('cartModal');
  openModal('checkoutModal');
};

// Close modal when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
});

// Close product modal button
document.addEventListener('DOMContentLoaded', () => {
  const closeProductModalBtn = document.getElementById('closeProductModal');
  if (closeProductModalBtn) {
    closeProductModalBtn.onclick = () => closeModal('productModal');
  }
});

// Add this function to products-shared.js
function normalizeProductIdForUrl(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}