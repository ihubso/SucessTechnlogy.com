// ===============================================
//        SESSION ID (only localStorage kept)
// ===============================================
const SESSION_KEY = 'shop_session_id';
function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

const RECENTLY_VIEWED_KEY = 'shop_recently_viewed';
const MAX_RECENT = 8;
const CURRENT_USER_KEY = 'shop_current_user';

// ===============================================
//        SUPABASE WRAPPERS (async replacements)
// ===============================================
let GLOBAL_PRODUCTS = null;
let _cachedReviews = null;

async function getProducts() {
  if (GLOBAL_PRODUCTS) return GLOBAL_PRODUCTS;
  const data = await fetchProductsFromDB();
  if (data && data.length > 0) {
    GLOBAL_PRODUCTS = normalizeProductImages(data);
    return GLOBAL_PRODUCTS;
  }
  GLOBAL_PRODUCTS = normalizeProductImages(DEFAULT_PRODUCTS);
  return GLOBAL_PRODUCTS;
}

async function saveProducts(prods) {
  GLOBAL_PRODUCTS = prods;
  try {
    const client = getSupabase();
    if (client) {
      for (const p of prods) {
        await client.from('products').upsert([p], { onConflict: 'id' });
      }
      const { data: allIds } = await client.from('products').select('id');
      const toDelete = (allIds || []).filter(id => !prods.some(pp => pp.id === id)).map(p => p.id);
      if (toDelete.length) await client.from('products').delete().in('id', toDelete);
    }
  } catch (e) {
    console.warn('Supabase save failed, products not persisted.');
  }
}

async function getCart() { 
  return await fetchCartFromDB(getSessionId()) || []; 
}
async function saveCart(cart) { 
  await saveCartToDB(getSessionId(), cart); 
  renderCart(); 
}

async function getWishlist() { 
  return await fetchWishlistFromDB(getSessionId()) || []; 
}
async function saveWishlist(wish) {
  await saveWishlistToDB(getSessionId(), wish);
  renderWishlistCount();
  updateAllWishlistIcons();
  renderWishlistModal();
}

async function getReviews() {
  if (_cachedReviews) return _cachedReviews;
  _cachedReviews = await fetchReviewsFromDB() || {};
  return _cachedReviews;
}
async function saveReviews(rev) { 
  await saveReviewsToDB(rev); 
  _cachedReviews = rev;
}

async function getOrders() { 
  return await getOrdersFromDB() || []; 
}
async function saveOrder(order) {
  await createOrderInDB(order);
}

async function getBusinessInfo() {
  const data = await fetchBusinessInfoFromDB();
  return data || { 
    shop_name: "ShopBoss", 
    email: "hello@shopboss.com", 
    phone: "+1 800 555 1234", 
    address: "123 Commerce Street", 
    facebook: "", 
    instagram: "", 
    tiktok: "" 
  };
}
async function setBusinessInfo(info) {
  await saveBusinessInfoToDB(info);
}

async function getContactInfo() {
  return await fetchContactInfoFromDB() || { 
    latitude: 40.7128, 
    longitude: -74.0060, 
    hours: "", 
    description: "", 
    shop_photo: "" 
  };
}

async function getFeaturedIds() { 
  return await fetchFeaturedIdsFromDB() || []; 
}
async function setFeaturedIds(ids) { 
  await saveFeaturedIdsToDB(ids); 
}

async function getDealsOfToday() {
  const deals = await fetchDealsFromDB();
  return (deals || []).map(d => ({ id: d.product_id, discount: d.discount }));
}

async function getSearchAnalytics() { 
  return await fetchSearchAnalyticsFromDB() || {}; 
}
async function setSearchAnalytics(a) { 
  await saveSearchAnalyticsToDB(a); 
}

async function getViewAnalytics() { 
  return await fetchViewAnalyticsFromDB() || {}; 
}
async function setViewAnalytics(a) { 
  await saveViewAnalyticsToDB(a); 
}

async function getFailedSearches() { 
  return await fetchFailedSearchesFromDB() || []; 
}
async function setFailedSearches(f) { 
  await saveFailedSearchesToDB(f); 
}

async function getAccounts() { 
  return await fetchCustomersFromDB() || []; 
}
async function saveAccounts(accounts) { 
  await saveCustomersToDB(accounts); 
}

// Recently viewed kept in localStorage (session-like, ephemeral)
function addToRecentlyViewed(productId) {
  let recent = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
  recent = recent.filter(id => id !== productId);
  recent.unshift(productId);
  if (recent.length > MAX_RECENT) recent.pop();
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  renderRecentlyViewed();
}
function getRecentlyViewed() { 
  return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]'); 
}

// Current user kept in localStorage (session identity)
function getCurrentUser() {
  return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
}
function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  updateAccountUI();
}

// Helper functions
function normalizeProductImages(products) {
  return products.map(p => ({
    ...p,
    images: p.images && p.images.length ? p.images : [p.image]
  }));
}
function generateId() { 
  return Date.now() + '-' + Math.random().toString(36).substr(2, 8); 
}

// ===============================================
//               UTILITIES
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
//         STATE & SORTING
// ===============================================
let currentPage = 1;
let itemsPerPage = 6;
let currentSort = "name_asc";
let currentCategory = "all";
let currentSearch = "";
let currentSidebarCategory = null;

function getSortedProducts(products) {
  let sorted = [...products];
  if (currentSort === "name_asc") sorted.sort((a,b) => a.name.localeCompare(b.name));
  else if (currentSort === "name_desc") sorted.sort((a,b) => b.name.localeCompare(a.name));
  else if (currentSort === "price_asc") sorted.sort((a,b) => a.price - b.price);
  else if (currentSort === "price_desc") sorted.sort((a,b) => b.price - a.price);
  return sorted;
}

// ===============================================
//               PRODUCT RENDERING (async)
// ===============================================
async function renderProductCard(p) {
  const wishlist = await getWishlist();
  const isWished = wishlist.includes(p.id);
  const avgRating = getAverageRating(p.id);
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === p.id);
  const hasDeal = !!dealInfo;
  const discount = hasDeal ? dealInfo.discount : 0;
  const originalPrice = p.price;
  const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;

  return `
    <article class="product-card" data-product-id="${p.id}">
      <div class="wishlist-icon ${isWished ? 'active' : ''}" data-wish="${p.id}">
        ${isWished ? '❤️' : '🤍'}
      </div>
      ${p.isNew ? '<div class="new-badge">NEW</div>' : ''}
      ${p.isHot ? '<div class="hot-badge">HOT</div>' : ''}
      ${hasDeal ? `<div class="deal-badge">-${discount}%</div>` : ''}
      <img src="${p.image}" alt="${p.name}" loading="lazy">
      <h3>${p.name}</h3>
      <div class="star-rating">${renderStars(avgRating)} (${getReviewCount(p.id)})</div>
      ${hasDeal ? `
        <p class="deal-old-price">FCFA ${originalPrice.toFixed(2)}</p>
        <div class="price-row">
          <strong class="deal-new-price">FCFA ${discountedPrice.toFixed(2)}</strong>
          <button data-add="${p.id}">Add</button>
        </div>
      ` : `
        <div class="price-row">
          <strong>FCFA ${p.price.toFixed(2)}</strong>
          <button data-add="${p.id}">Add to cart</button>
        </div>
      `}
    </article>
  `;
}

async function renderAllProducts() {
  const container = document.getElementById('productsGrid');
  if (!container) return;
  
  let products = await getProducts();
  if (currentSearch) {
    products = products.filter(p => p.name.toLowerCase().includes(currentSearch.toLowerCase()));
  }
  if (currentCategory !== "all") {
    products = products.filter(p => p.category === currentCategory);
  }
  
  let sorted = getSortedProducts(products);
  let totalPages = Math.ceil(sorted.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
  
  let start = (currentPage - 1) * itemsPerPage;
  let paginated = sorted.slice(start, start + itemsPerPage);
  
  const cards = await Promise.all(paginated.map(p => renderProductCard(p)));
  container.innerHTML = cards.length ? cards.join('') : '<div class="text-center py-10">No products found.</div>';
  
  attachCardEvents();
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  let paginationDiv = document.getElementById('paginationControls');
  if (!paginationDiv) return;
  if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
  }
  paginationDiv.innerHTML = html;
  
  document.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderAllProducts();
    });
  });
}

async function renderHotProducts() {
  let prods = (await getProducts()).filter(p => p.isHot);
  const grid = document.getElementById('hotProductsGrid');
  if (!grid) return;
  const cards = await Promise.all(prods.map(p => renderProductCard(p)));
  grid.innerHTML = cards.join('');
  attachCardEvents();
}

async function renderNewProducts() {
  let prods = (await getProducts()).filter(p => p.isNew);
  const grid = document.getElementById('newProductsGrid');
  if (!grid) return;
  const cards = await Promise.all(prods.map(p => renderProductCard(p)));
  grid.innerHTML = cards.join('');
  attachCardEvents();
}

function renderRecentlyViewed() {
  const container = document.getElementById('recentlyViewedGrid');
  if (!container) return;
  
  const recentIds = getRecentlyViewed();
  if (!recentIds.length) {
    container.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No recently viewed products yet.</p>';
    return;
  }
  
  const products = GLOBAL_PRODUCTS || [];
  const recentProducts = recentIds.map(id => products.find(p => p.id === id)).filter(Boolean);
  
  if (recentProducts.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No recently viewed products.</p>';
    return;
  }
  
  const displayProducts = recentProducts.slice(0, 4);
  Promise.all(displayProducts.map(p => renderProductCard(p))).then(cards => {
    container.innerHTML = cards.join('');
    attachCardEvents();
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'text-sm text-gray-400 hover:text-red-500 transition-colors mt-2 clear-recent-btn';
    clearBtn.innerHTML = 'Clear History';
    clearBtn.onclick = () => {
      localStorage.removeItem(RECENTLY_VIEWED_KEY);
      renderRecentlyViewed();
    };
    const parent = container.parentElement;
    const existingClearBtn = parent.querySelector('.clear-recent-btn');
    if (existingClearBtn) existingClearBtn.remove();
    parent.appendChild(clearBtn);
  });
}

// ===============================================
//         DEALS HORIZONTAL SCROLL
// ===============================================
function initDealsScroll() {
  const dealsGrid = document.getElementById('dealsGrid');
  const prevBtn = document.getElementById('dealsPrevBtn');
  const nextBtn = document.getElementById('dealsNextBtn');
  const progressFill = document.getElementById('dealsProgressFill');
  if (!dealsGrid) return;
  
  function updateNavButtons() {
    if (!dealsGrid) return;
    const scrollLeft = dealsGrid.scrollLeft;
    const maxScroll = dealsGrid.scrollWidth - dealsGrid.clientWidth;
    if (prevBtn) prevBtn.classList.toggle('hidden', scrollLeft <= 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', scrollLeft >= maxScroll - 1);
    if (progressFill) progressFill.style.width = `${(scrollLeft / maxScroll) * 100}%`;
  }
  
  function scrollLeft() {
    const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
    dealsGrid.scrollBy({ left: -(cardWidth + 24), behavior: 'smooth' });
  }
  function scrollRight() {
    const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
    dealsGrid.scrollBy({ left: cardWidth + 24, behavior: 'smooth' });
  }
  
  if (prevBtn) prevBtn.addEventListener('click', scrollLeft);
  if (nextBtn) nextBtn.addEventListener('click', scrollRight);
  dealsGrid.addEventListener('scroll', updateNavButtons);
  dealsGrid.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      dealsGrid.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  
  setTimeout(updateNavButtons, 100);
  window.addEventListener('resize', updateNavButtons);
  new MutationObserver(updateNavButtons).observe(dealsGrid, { childList: true, subtree: true });
}

async function renderDealsOfToday() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  
  const products = await getProducts();
  const dealItems = (await getDealsOfToday())
    .map(deal => {
      const product = products.find(p => p.id === deal.id);
      if (!product) return null;
      const discount = Math.max(1, Math.min(95, Number(deal.discount) || 0));
      const oldPrice = Number(product.price) || 0;
      const newPrice = oldPrice * (1 - discount / 100);
      return { product, discount, oldPrice, newPrice };
    })
    .filter(Boolean);
  
  if (!dealItems.length) {
    dealsGrid.innerHTML = '<p class="text-slate-500 text-center w-full py-8">No deals of today yet.</p>';
    return;
  }
  
  dealsGrid.style.opacity = '0';
  dealsGrid.innerHTML = dealItems.map(({ product, discount, oldPrice, newPrice }, index) => `
    <article class="product-card deal-card" data-product-id="${product.id}" style="animation-delay: ${index * 0.1}s">
      <div class="deal-badge">-${discount}%</div>
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <h3>${product.name}</h3>
      <div class="star-rating">${renderStars(getAverageRating(product.id))} (${getReviewCount(product.id)})</div>
      <p class="deal-old-price">FCFA ${oldPrice.toFixed(2)}</p>
      <div class="price-row">
        <strong class="deal-new-price">FCFA ${newPrice.toFixed(2)}</strong>
        <button data-add="${product.id}">Add to cart</button>
      </div>
    </article>
  `).join('');
  
  setTimeout(() => {
    dealsGrid.style.opacity = '1';
    dealsGrid.style.transition = 'opacity 0.5s ease';
  }, 50);
  
  attachCardEvents();
  setTimeout(() => initDealsScroll(), 100);
}

let autoScrollInterval;
function startAutoScroll() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  stopAutoScroll();
  autoScrollInterval = setInterval(() => {
    const maxScroll = dealsGrid.scrollWidth - dealsGrid.clientWidth;
    if (dealsGrid.scrollLeft >= maxScroll - 1) {
      dealsGrid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
      dealsGrid.scrollBy({ left: cardWidth + 24, behavior: 'smooth' });
    }
  }, 4000);
}
function stopAutoScroll() { 
  if (autoScrollInterval) { clearInterval(autoScrollInterval); autoScrollInterval = null; } 
}
function initAutoScrollPause() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  dealsGrid.addEventListener('mouseenter', stopAutoScroll);
  dealsGrid.addEventListener('mouseleave', startAutoScroll);
}

// ===============================================
//               EVENT HANDLING
// ===============================================
function attachCardEvents() {
  document.querySelectorAll('.product-card').forEach(card => {
    card.removeEventListener('click', productClick);
    card.addEventListener('click', productClick);
  });
  document.querySelectorAll('button[data-add]').forEach(btn => {
    btn.removeEventListener('click', addClick);
    btn.addEventListener('click', addClick);
  });
  document.querySelectorAll('.wishlist-icon').forEach(icon => {
    icon.removeEventListener('click', wishClick);
    icon.addEventListener('click', wishClick);
  });
}

async function productClick(e) {
  if (e.target.closest('button[data-add]') || e.target.closest('.wishlist-icon')) return;
  const id = this.dataset.productId;
  if (id) {
    addToRecentlyViewed(id);
    await trackProductView(id);
    await openProductDetail(id);
  }
}

async function addClick(e) {
  e.stopPropagation();
  const id = this.dataset.add;
  if (id) await window.addToCart(id, 1, {});
}

async function wishClick(e) {
  e.stopPropagation();
  const id = this.dataset.wish;
  if (id) {
    await toggleWishlist(id);
    await renderAllProducts();
    await renderWishlistModal();
  }
}

// ===============================================
//        OPEN PRODUCT DETAIL (async)
// ===============================================
window.currentModalProductId = null;

async function openProductDetail(id) {
  window.currentModalProductId = id;
  addToRecentlyViewed(id);
  await trackProductView(id);
  await renderProductDetailModal(id);
  openModal('productModal');
  setTimeout(() => scrollModalToTop(), 100);
}

async function renderProductDetailModal(id) {
  const p = (await getProducts()).find(pr => pr.id === id);
  if (!p) return;
  
  const avgRating = getAverageRating(id);
  const reviews = getProductReviews(id);
  const isWished = (await getWishlist()).includes(id);
  const shareUrl = `${window.location.origin}${window.location.pathname}?product=${id}`;
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  const hasDeal = !!dealInfo;
  const discount = hasDeal ? dealInfo.discount : 0;
  const originalPrice = p.price;
  const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;
  
  const products = await getProducts();
  const related = products.filter(prod => prod.id !== id && (prod.category === p.category || prod.brand === p.brand)).slice(0, 4);
  
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
          <div class="w-20 h-20 flex-shrink-0 rounded-2xl border-2 border-gray-100 overflow-hidden cursor-pointer hover:border-black transition-all bg-white shadow-sm focus-within:border-black">
            <img src="${img}" alt="View ${index + 1}"
                 onclick="const main = document.getElementById('mainImageDisplay'); main.style.opacity='0.5'; setTimeout(()=>{main.src='${img}'; main.style.opacity='1'}, 100)"
                 class="w-full h-full object-contain p-2"
                 onerror="this.src='https://placehold.co/100x100?text=No+Image'">
          </div>
        `).join('')}
      </div>`;
  }
  
  const modalInner = document.getElementById('productDetailInner');
  modalInner.innerHTML = `
    <div class="flex flex-col lg:flex-row gap-10 p-2">
      <div class="lg:w-1/2">
        <div class="sticky top-10">
          <div class="modal-image-container bg-white rounded-[2.5rem] overflow-hidden aspect-square flex items-center justify-center border border-gray-100 shadow-sm relative">
            ${hasDeal ? `<div class="absolute top-4 left-4 z-10 bg-primary text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg">-${discount}% OFF</div>` : ''}
            <img id="mainImageDisplay" src="${p.image}" alt="${p.name}" style="transition: transform 0.3s ease;" class="object-contain w-full h-full p-8" />
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
          <button onclick="toggleWishlist('${id}'); renderProductDetailModal('${id}');" class="p-3 rounded-full bg-white shadow-md hover:shadow-lg transition-all border border-gray-100">
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
        </div>` : ''}
        <div class="flex items-center gap-4 mb-4">
          <span class="text-sm font-medium text-gray-600">Quantity:</span>
          <div class="flex items-center border border-gray-200 rounded-full">
            <button onclick="decrementModalQty()" class="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 rounded-l-full">−</button>
            <input type="number" id="modalQtyInput" value="1" min="1" max="${p.stock}" class="w-14 text-center border-none focus:ring-0 text-lg font-semibold" readonly />
            <button onclick="incrementModalQty(${p.stock})" class="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 rounded-r-full">+</button>
          </div>
          <span class="text-xs text-gray-400">${p.stock} available</span>
        </div>
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
      <div class="space-y-4 max-h-64 overflow-y-auto pr-2 mb-6" id="reviewsList-${id}">
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
      <div class="bg-gray-50 rounded-xl p-5">
        <h5 class="font-bold mb-3">✏️ Write a Review</h5>
        <div class="space-y-3">
          <input type="text" id="reviewUserName-${id}" placeholder="Your name" value="${getReviewerName()}" class="w-full border border-gray-200 rounded-lg p-2 text-sm" ${getCurrentUser() ? 'readonly style="background:#f0fdf4; border-color:#86efac;"' : ''} />
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
    <div class="mt-16 pt-10 border-t border-gray-100">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-2xl font-bold">Complete the Look</h3>
        <button onclick="toggleRelatedPanel()" class="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary transition-colors bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
          <span id="relatedPanelBtnText">Show More</span>
          <i id="relatedPanelBtnIcon" class="fas fa-chevron-down transition-transform duration-300"></i>
        </button>
      </div>
      <div id="relatedProductsPanel" class="related-panel overflow-hidden transition-all duration-500 ease-in-out" style="max-height: 300px;">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          ${related.map((rp, index) => `
            <div class="related-product-card group cursor-pointer opacity-0 transform translate-y-4" 
                 onclick="openProductDetail('${rp.id}')"
                 style="animation: fadeInUp 0.5s ease forwards ${index * 0.1}s;">
              <div class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 mb-3 overflow-hidden border-2 border-transparent group-hover:border-primary/20 group-hover:shadow-lg transition-all duration-300 relative">
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
                <div class="relative overflow-hidden rounded-xl">
                  <img src="${rp.image}" class="w-full aspect-square object-contain group-hover:scale-110 transition-transform duration-500">
                  ${rp.isNew ? '<div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">NEW</div>' : ''}
                  ${rp.isHot ? '<div class="absolute top-2 left-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">HOT</div>' : ''}
                </div>
              </div>
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
        ${related.length > 4 ? `
          <div class="text-center mt-6">
            <button onclick="toggleRelatedPanel()" class="inline-flex items-center gap-2 text-primary font-medium hover:underline">
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
      this.parentElement.querySelectorAll('.variant-option').forEach(b => b.classList.remove('bg-primary', 'text-white', 'border-primary'));
      this.classList.add('bg-primary', 'text-white', 'border-primary');
      window.currentModalVariants = window.currentModalVariants || {};
      window.currentModalVariants[type] = this.dataset.variantValue;
      window.selectedVariants = window.selectedVariants || {};
      window.selectedVariants[type] = this.dataset.variantValue;
    });
  });
}

window.toggleRelatedPanel = function() {
  const panel = document.getElementById('relatedProductsPanel');
  const btnText = document.getElementById('relatedPanelBtnText');
  const btnIcon = document.getElementById('relatedPanelBtnIcon');
  if (!panel || !btnText || !btnIcon) return;
  
  if (panel.style.maxHeight === '300px' || panel.style.maxHeight === '') {
    panel.style.maxHeight = '0px';
    panel.style.opacity = '0';
    btnText.textContent = 'Show More';
    btnIcon.style.transform = 'rotate(0deg)';
  } else {
    panel.style.maxHeight = '2000px';
    panel.style.opacity = '1';
    btnText.textContent = 'Show Less';
    btnIcon.style.transform = 'rotate(180deg)';
  }
};

function scrollModalToTop() {
  const modalContent = document.querySelector('.modalcontent');
  if (modalContent) {
    modalContent.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.buyNow = function (id) {
  addToCart(id);
  openCheckout();
};

window.submitReview = async function(productId) {
  const user = getCurrentUser();
  let userName;
  if (user) {
    userName = user.name;
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
  
  await addReview(productId, userName, rating, comment);
  await renderProductDetailModal(productId);
  showToast("Thank you for your review!");
};

window.shareProduct = async function (url, name) {
  if (navigator.share) {
    try { await navigator.share({ title: name, url: url }); } catch (e) { copyToClipboard(url); }
  } else { copyToClipboard(url); }
};

window.incrementModalQty = function(max) {
  const input = document.getElementById('modalQtyInput');
  let val = parseInt(input.value) || 1;
  if (val < max) input.value = val + 1;
};

window.decrementModalQty = function() {
  const input = document.getElementById('modalQtyInput');
  let val = parseInt(input.value) || 1;
  if (val > 1) input.value = val - 1;
};

window.addToCartWithVariants = async function(id) {
  const qty = parseInt(document.getElementById('modalQtyInput')?.value || 1);
  const variants = window.currentModalVariants || {};
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  
  if (dealInfo) {
    const product = (await getProducts()).find(p => p.id === id);
    const discountedPrice = product.price * (1 - dealInfo.discount / 100);
    await window.addToCartWithDealPrice(id, qty, variants, discountedPrice, dealInfo.discount);
  } else {
    await window.addToCart(id, qty, variants);
  }
  
  closeModal('productModal');
  showToast("Added to cart!");
};

window.quickAddToCart = async function(id) {
  const qty = parseInt(document.getElementById('modalQtyInput')?.value || 1);
  const variants = window.currentModalVariants || {};
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  
  if (dealInfo) {
    const product = (await getProducts()).find(p => p.id === id);
    const discountedPrice = product.price * (1 - dealInfo.discount / 100);
    await window.addToCartWithDealPrice(id, qty, variants, discountedPrice, dealInfo.discount);
  } else {
    await window.addToCart(id, qty, variants);
  }
  showToast("Added to cart!");
};

window.addToCartWithDealPrice = async function(id, qty = 1, variants = {}, dealPrice, discount) {
  let products = await getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) { showToast("Out of stock"); return; }
  
  let cart = await getCart();
  let existing = cart.find(i => i.id === id && JSON.stringify(i.variants) === JSON.stringify(variants));
  
  if (existing) {
    if (existing.qty + qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    existing.qty += qty;
  } else {
    if (qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    cart.push({ id, name: product.name, price: dealPrice, originalPrice: product.price, discount, qty, image: product.image, variants: variants || {}, isDeal: true });
  }
  await saveCart(cart);
  showToast(`${product.name} added at deal price!`);
};

window.addToCart = async function (id, qty = 1, variants = {}) {
  let products = await getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) { showToast("Out of stock"); return; }
  
  let cart = await getCart();
  let existing = cart.find(i => i.id === id && JSON.stringify(i.variants) === JSON.stringify(variants));
  
  if (existing) {
    if (existing.qty + qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    existing.qty += qty;
  } else {
    if (qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    cart.push({ id, name: product.name, price: product.price, qty, image: product.image, variants: variants || {} });
  }
  await saveCart(cart);
  showToast(`${product.name} added`);
};

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast("Link copied!");
}

// ===============================================
//                 CART LOGIC (async)
// ===============================================
async function renderCart() {
  let cart = await getCart();
  document.getElementById('cartCount').innerText = cart.reduce((s, i) => s + i.qty, 0);
  
  let container = document.getElementById('cartItems');
  if (!cart.length) {
    container.innerHTML = '<div class="text-center py-8">Cart empty</div>';
    document.getElementById('cartTotal').innerText = '0.00';
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
  
  document.getElementById('cartTotal').innerText = total.toFixed(2);
  
  container.querySelectorAll('.cart-qty-dec').forEach(btn => {
    btn.addEventListener('click', () => updateQtyByIndex(parseInt(btn.dataset.index), -1));
  });
  container.querySelectorAll('.cart-qty-inc').forEach(btn => {
    btn.addEventListener('click', () => updateQtyByIndex(parseInt(btn.dataset.index), 1));
  });
}

async function updateQtyByIndex(index, delta) {
  let cart = await getCart();
  if (index < 0 || index >= cart.length) return;
  
  let item = cart[index];
  let products = await getProducts();
  let prod = products.find(p => p.id === item.id);
  let newQ = item.qty + delta;
  
  if (newQ <= 0) {
    cart.splice(index, 1);
  } else if (prod && newQ > prod.stock) {
    showToast(`Only ${prod.stock} left`);
    return;
  } else {
    item.qty = newQ;
  }
  await saveCart(cart);
}

window.clearCart = async function () {
  await saveCart([]);
  showToast("Cart cleared");
};

window.openCheckout = async function () {
  if ((await getCart()).length === 0) {
    showToast("Cart empty");
    return;
  }
  closeModal('cartModal');
  openModal('checkoutModal');
};

// ===============================================
//               CHECKOUT LOGIC (async)
// ===============================================
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  let name = document.getElementById('custName').value.trim();
  let phone = document.getElementById('custPhone').value.trim();
  let addr = document.getElementById('custAddr').value.trim();
  
  if (!name || !phone || !addr) {
    showToast("Please fill all fields");
    return;
  }
  
  let cart = await getCart();
  if (cart.length === 0) {
    showToast("Cart is empty");
    return;
  }
  
  let products = await getProducts();
  for (let item of cart) {
    let p = products.find(pr => pr.id === item.id);
    if (!p || p.stock < item.qty) {
      showToast(`Stock issue: ${item.name}`);
      return;
    }
  }
  
  for (let item of cart) {
    let idx = products.findIndex(p => p.id === item.id);
    if (idx !== -1) products[idx].stock -= item.qty;
  }
  await saveProducts(products);
  
  let total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  let order = {
    id: "ORD-" + Date.now(),
    date: new Date().toISOString(),
    customer: name,
    phone,
    address: addr,
    email: getCurrentUser()?.email || '',
    items: cart.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      variants: i.variants || {}
    })),
    total,
    status: 'pending'
  };
  
  await saveOrder(order);
  
  const trackingLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}track.html?order=${order.id}`;
  await saveCart([]);
  closeModal('checkoutModal');
  showOrderSuccess(name, order, trackingLink);
  sendOrderToWhatsApp(order, trackingLink);
  await renderAllProducts();
});

function showOrderSuccess(customerName, order, trackingLink) {
  const successHTML = `
    <div id="orderSuccessModal" class="modal" style="display: flex; align-items: center; justify-content: center;">
      <div class="bg-white rounded-3xl max-w-md w-full p-8 mx-4 shadow-2xl animate-slide-in">
        <div class="text-center mb-6">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check-circle text-4xl text-green-500"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-900">Order Placed! 🎉</h2>
          <p class="text-gray-500 mt-2">Thank you, ${customerName}!</p>
        </div>
        <div class="bg-gray-50 rounded-2xl p-4 mb-4">
          <p class="text-sm text-gray-500 mb-1">Order ID</p>
          <p class="font-mono font-bold text-lg">${order.id}</p>
          <p class="text-sm text-gray-500 mt-3 mb-1">Total Amount</p>
          <p class="text-2xl font-bold text-primary">FCFA ${order.total.toFixed(2)}</p>
        </div>
        <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-6">
          <p class="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <i class="fas fa-link"></i> Your Order Tracking Link
          </p>
          <p class="text-xs text-blue-600 mb-2">Save this link to check your order status anytime:</p>
          <div class="bg-white rounded-xl p-3 border border-blue-100 break-all">
            <a href="${trackingLink}" target="_blank" class="text-blue-600 text-sm hover:underline font-mono">${trackingLink}</a>
          </div>
          <button onclick="copyTracking('${trackingLink}', this)" class="mt-3 w-full bg-blue-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors">
            <i class="fas fa-copy mr-2"></i> Copy Tracking Link
          </button>
        </div>
        <p class="text-sm text-gray-500 text-center mb-6">We'll contact you on WhatsApp to confirm your order.</p>
        <div class="flex gap-3">
          <button onclick="document.getElementById('orderSuccessModal').remove()" class="flex-1 bg-dark text-white py-3 rounded-xl font-medium hover:bg-black transition-colors">
            Continue Shopping
          </button>
          <button onclick="window.open('${trackingLink}', '_blank'); document.getElementById('orderSuccessModal').remove();" class="flex-1 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primaryHover transition-colors">
            <i class="fas fa-external-link-alt mr-2"></i> Track Order
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', successHTML);
  document.getElementById('orderSuccessModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderSuccessModal') e.target.remove();
  });
}

window.copyTracking = function(link, btn) {
  navigator.clipboard.writeText(link).then(() => {
    btn.innerHTML = '<i class="fas fa-check mr-2"></i> Link Copied!';
    btn.classList.add('bg-green-500', 'hover:bg-green-600');
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy mr-2"></i> Copy Tracking Link';
      btn.classList.remove('bg-green-500', 'hover:bg-green-600');
    }, 2000);
  });
  showToast("Tracking link copied!");
};

async function sendOrderToWhatsApp(order, trackingLink) {
  const business = await getBusinessInfo();
  const phone = business.phone.replace(/\D/g, '') || "1234567890";
  let msg = "🛍️ *New Order Received!*%0A%0A";
  msg += `*Order ID:* ${order.id}%0A`;
  msg += `*Date:* ${new Date(order.date).toLocaleString()}%0A%0A`;
  msg += "*Customer Details:*%0A";
  msg += `Name: ${order.customer}%0A`;
  msg += `Phone: ${order.phone}%0A`;
  msg += `Address: ${order.address}%0A%0A`;
  msg += "*Items:*%0A";
  order.items.forEach(i => {
    msg += `- ${i.name} x${i.qty} = FCFA ${(i.price * i.qty).toFixed(2)}%0A`;
  });
  msg += `%0A*Total: FCFA ${order.total.toFixed(2)}*%0A%0A`;
  msg += `Track: ${trackingLink}`;
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

// ===============================================
//           ANALYTICS TRACKING (async)
// ===============================================
async function trackProductSearch(query) {
  if (!query || query.trim().length < 2) return;
  const analytics = await getSearchAnalytics();
  const normalizedQuery = query.trim().toLowerCase();
  if (!analytics[normalizedQuery]) {
    analytics[normalizedQuery] = { query: query.trim(), count: 0, lastSearched: new Date().toISOString(), results: 0 };
  }
  analytics[normalizedQuery].count++;
  analytics[normalizedQuery].lastSearched = new Date().toISOString();
  await setSearchAnalytics(analytics);
}

async function trackSearchResults(query, resultCount) {
  if (!query || query.trim().length < 2) return;
  const analytics = await getSearchAnalytics();
  const normalizedQuery = query.trim().toLowerCase();
  if (analytics[normalizedQuery]) {
    analytics[normalizedQuery].results = resultCount;
    await setSearchAnalytics(analytics);
  }
  if (resultCount === 0) {
    const failedSearches = await getFailedSearches();
    const existingIndex = failedSearches.findIndex(fs => fs.query.toLowerCase() === normalizedQuery);
    if (existingIndex !== -1) {
      failedSearches[existingIndex].count++;
      failedSearches[existingIndex].lastSearched = new Date().toISOString();
    } else {
      failedSearches.push({ query: query.trim(), count: 1, lastSearched: new Date().toISOString() });
    }
    await setFailedSearches(failedSearches);
  }
}

async function trackProductView(productId) {
  if (!productId) return;
  const analytics = await getViewAnalytics();
  if (!analytics[productId]) {
    analytics[productId] = { count: 0, firstViewed: new Date().toISOString(), lastViewed: new Date().toISOString() };
  }
  analytics[productId].count++;
  analytics[productId].lastViewed = new Date().toISOString();
  await setViewAnalytics(analytics);
}

// ===============================================
//           SEARCH & CATEGORY FILTERS
// ===============================================
async function initSearch() {
  const input = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  
  input.addEventListener('input', async () => {
    let q = input.value.trim().toLowerCase();
    if (!q) {
      dropdown.style.display = 'none';
      currentSearch = '';
      await renderAllProducts();
      return;
    }
    currentSearch = q;
    await renderAllProducts();
    
    const products = await getProducts();
    let matches = products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 6);
    await trackProductSearch(q);
    await trackSearchResults(q, matches.length);
    
    dropdown.innerHTML = matches.map(p => `
      <div class="search-dropdown-item" onclick="openProductDetail('${p.id}')">
        <img src="${p.image}" class="w-8 h-8 rounded"> ${p.name}
      </div>
    `).join('');
    dropdown.style.display = matches.length ? 'block' : 'none';
  });
}

async function buildCategoryFilters() {
  let products = await getProducts();
  let categories = [...new Set(products.map(p => p.category))].sort();
  let container = document.getElementById('categoryFilterContainer');
  if (!container) return;
  
  let html = `<button onclick="currentCategory='all'; renderAllProducts();" class="filter-btn active">All</button>`;
  categories.forEach(cat => {
    html += `<button onclick="currentCategory='${cat}'; renderAllProducts();" class="filter-btn">${cat}</button>`;
  });
  container.innerHTML = html;
}

function getCategoryIcon(category) {
  const iconMap = {
    phone: '📱', tablet: '📟', laptop: '💻', desktop: '🖥️', audio: '🎧', wearable: '⌚',
    power: '🔋', accessory: '🧩', smarthome: '🏠', monitor: '🖼️', storage: '💾', gaming: '🎮', camera: '📷'
  };
  return iconMap[(category || '').toLowerCase()] || '📦';
}

function formatCategoryTitle(category) {
  if (!category) return 'Category';
  return category.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function renderCatalogSidebar(selectedCategory = null) {
  const listEl = document.getElementById('catalogCategoryList');
  const titleEl = document.getElementById('catalogSidebarTitle');
  const subListEl = document.getElementById('catalogSubList');
  if (!listEl || !titleEl || !subListEl) return;
  
  const products = await getProducts();
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  if (!categories.length) {
    listEl.innerHTML = '<p class="text-slate-400 px-3 py-2">No categories</p>';
    subListEl.innerHTML = '';
    titleEl.textContent = 'Category';
    return;
  }
  
  const activeCategory = selectedCategory || currentSidebarCategory || categories[0];
  currentSidebarCategory = activeCategory;
  
  listEl.innerHTML = categories.map(cat => `
    <button class="catalog-category-item ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
      <span class="catalog-category-label"><span>${getCategoryIcon(cat)}</span><span>${formatCategoryTitle(cat)}</span></span>
      <span>›</span>
    </button>
  `).join('');
  
  const productNames = products.filter(p => p.category === activeCategory).map(p => ({ id: p.id, name: p.name })).slice(0, 18);
  titleEl.textContent = formatCategoryTitle(activeCategory);
  subListEl.innerHTML = productNames.length
    ? productNames.map(item => `<li><button type="button" data-product-id="${item.id}">${item.name}</button></li>`).join('')
    : '<li class="text-slate-400">No items</li>';
  
  listEl.querySelectorAll('.catalog-category-item').forEach(btn => {
    btn.addEventListener('click', () => renderCatalogSidebar(btn.dataset.cat));
  });
  subListEl.querySelectorAll('button[data-product-id]').forEach(btn => {
    btn.addEventListener('click', () => openProductDetail(btn.dataset.productId));
  });
}

async function buildBrandFilters() {
  let products = await getProducts();
  let brands = [...new Set(products.map(p => p.brand).filter(b => b))].sort();
  let container = document.getElementById('brandCategoryContainer');
  if (!container) return;
  
  let html = `<div class="brand-category-item active" onclick="window.currentBrand='all'; window.renderBrandProducts();">All Brands</div>`;
  brands.forEach(brand => {
    html += `<div class="brand-category-item" onclick="window.currentBrand='${brand}'; window.renderBrandProducts();">${brand}</div>`;
  });
  container.innerHTML = html;
}

window.currentBrand = 'all';
window.renderBrandProducts = async function() {
  let products = await getProducts();
  let filtered = window.currentBrand === 'all' ? products : products.filter(p => p.brand === window.currentBrand);
  let grid = document.getElementById('brandProductsGrid');
  if (!grid) return;
  
  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="openProductDetail('${p.id}')">
      ${p.isNew ? '<div class="new-badge">NEW</div>' : ''}
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <div class="price-row">
        <strong>FCFA ${p.price.toFixed(2)}</strong>
        <button onclick="event.stopPropagation(); addToCart('${p.id}')" class="add-btn-small">🛒</button>
      </div>
    </div>
  `).join('');
};

// ===============================================
//         FEATURED SLIDER (async)
// ===============================================
let currentFeaturedIndex = 0;
let autoSlideInterval = null;
const AUTO_SLIDE_DELAY = 3000;

function startAutoSlide() {
  stopAutoSlide();
  autoSlideInterval = setInterval(() => nextFeaturedSlide(), AUTO_SLIDE_DELAY);
}
function stopAutoSlide() {
  if (autoSlideInterval) { clearInterval(autoSlideInterval); autoSlideInterval = null; }
}

async function goToSlide(index) {
  let featuredIds = await getFeaturedIds();
  if (!featuredIds.length) {
    let products = await getProducts();
    featuredIds = products.map(p => p.id);
  }
  if (index < 0) index = featuredIds.length - 1;
  if (index >= featuredIds.length) index = 0;
  currentFeaturedIndex = index;
  await renderFeaturedProduct();
  await renderSliderDots();
  stopAutoSlide();
  startAutoSlide();
}

async function prevFeaturedSlide() {
  let featuredIds = await getFeaturedIds();
  if (!featuredIds.length) {
    let products = await getProducts();
    featuredIds = products.map(p => p.id);
  }
  currentFeaturedIndex = (currentFeaturedIndex - 1 + featuredIds.length) % featuredIds.length;
  await renderFeaturedProduct();
  await renderSliderDots();
  stopAutoSlide();
  startAutoSlide();
}

window.nextFeaturedSlide = async function () {
  let featuredIds = await getFeaturedIds();
  if (!featuredIds.length) {
    let products = await getProducts();
    featuredIds = products.map(p => p.id);
  }
  currentFeaturedIndex = (currentFeaturedIndex + 1) % featuredIds.length;
  await renderFeaturedProduct();
  await renderSliderDots();
  stopAutoSlide();
  startAutoSlide();
};

async function renderSliderDots() {
  const dotsContainer = document.getElementById('sliderDots');
  if (!dotsContainer) return;
  
  let featuredIds = await getFeaturedIds();
  let products = await getProducts();
  const validFeaturedIds = featuredIds.filter(id => products.some(p => p.id === id));
  
  if (validFeaturedIds.length === 0) {
    dotsContainer.innerHTML = '';
    return;
  }
  
  let dotsHtml = '';
  validFeaturedIds.forEach((id, idx) => {
    dotsHtml += `<button class="slider-dot ${idx === currentFeaturedIndex ? 'active' : ''}" onclick="goToSlide(${idx})" aria-label="Go to slide ${idx + 1}"></button>`;
  });
  dotsContainer.innerHTML = dotsHtml;
}

async function initSliderControls() {
  const prevBtn = document.getElementById('prevSlide');
  const nextBtn = document.getElementById('nextSlide');
  const sliderWrapper = document.getElementById('featuredSliderWrapper');
  
  if (prevBtn) prevBtn.addEventListener('click', prevFeaturedSlide);
  if (nextBtn) nextBtn.addEventListener('click', window.nextFeaturedSlide);
  if (sliderWrapper) {
    sliderWrapper.addEventListener('mouseenter', stopAutoSlide);
    sliderWrapper.addEventListener('mouseleave', startAutoSlide);
  }
  await renderSliderDots();
  startAutoSlide();
}

async function renderFeaturedProduct() {
  const container = document.getElementById('featuredProductContainer');
  if (!container) return;
  
  let featuredIds = await getFeaturedIds();
  let products = await getProducts();
  
  if (!featuredIds.length) {
    if (products.length) {
      featuredIds = [products[0].id];
    } else {
      container.innerHTML = '<p class="text-center py-8">No products available</p>';
      await renderSliderDots();
      return;
    }
  }
  
  if (currentFeaturedIndex >= featuredIds.length) currentFeaturedIndex = 0;
  const currentId = featuredIds[currentFeaturedIndex];
  const product = products.find(p => p.id === currentId);
  
  if (!product) {
    const validIds = featuredIds.filter(id => products.some(p => p.id === id));
    await setFeaturedIds(validIds);
    currentFeaturedIndex = 0;
    await renderFeaturedProduct();
    return;
  }
  
  container.innerHTML = `
    <div class="featured-card flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden shadow-lg w-full">
      <img src="${product.image}" class="md:w-1/2 h-64 md:h-96 object-cover" alt="${product.name}">
      <div class="p-8 flex flex-col justify-center">
        <h2 class="text-3xl font-bold">${product.name}</h2>
        <p class="text-gray-600 my-4">${product.description}</p>
        <button onclick="openProductDetail('${product.id}')" class="bg-primary text-white px-8 py-3 rounded-full w-max">
          View Product
        </button>
      </div>
    </div>
  `;
  await renderSliderDots();
}

window.goToSlide = goToSlide;

// ===============================================
//           NAVIGATION & DROPDOWNS
// ===============================================
function initCatalogDropdown() {
  const trigger = document.getElementById('catalogTrigger');
  const triggerWrap = document.getElementById('catalogTriggerWrap');
  const panel = document.getElementById('catalogDropdownPanel');
  if (!trigger || !triggerWrap || !panel) return;
  
  const openPanel = () => { panel.classList.add('open'); trigger.classList.add('active-catalog'); };
  const closePanel = () => { panel.classList.remove('open'); trigger.classList.remove('active-catalog'); };
  
  trigger.addEventListener('click', (e) => { e.preventDefault(); openPanel(); });
  triggerWrap.addEventListener('mouseenter', openPanel);
  document.addEventListener('click', (e) => {
    if (!triggerWrap.contains(e.target) && !panel.contains(e.target)) closePanel();
  });
}

function initializeDropdowns() {
  const productsDropdown = document.getElementById('productsDropdown');
  const productsTrigger = document.getElementById('dropdownTrigger');
  const brandDropdown = document.getElementById('brandDropdown');
  const brandTrigger = document.getElementById('brandTrigger');
  
  if (productsTrigger && productsDropdown) {
    productsTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      productsDropdown.classList.toggle('dropdown-open');
      brandDropdown.classList.remove('dropdown-open');
    });
  }
  if (brandTrigger && brandDropdown) {
    brandTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      brandDropdown.classList.toggle('dropdown-open');
      productsDropdown.classList.remove('dropdown-open');
    });
  }
  document.addEventListener('click', (e) => {
    if (productsDropdown && !productsDropdown.contains(e.target) && !productsTrigger.contains(e.target)) {
      productsDropdown.classList.remove('dropdown-open');
    }
    if (brandDropdown && !brandDropdown.contains(e.target) && !brandTrigger.contains(e.target)) {
      brandDropdown.classList.remove('dropdown-open');
    }
  });
}

async function renderMobileMenu() {
  const container = document.getElementById('mobileNavContent');
  if (!container) return;
  
  const products = await getProducts();
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  
  let html = '<div class="mobile-nav-section"><div class="mobile-nav-section-title">📂 Categories</div>';
  categories.forEach(cat => {
    const catProducts = products.filter(p => p.category === cat).slice(0, 5);
    const catIcon = getCategoryIcon(cat);
    const catTitle = formatCategoryTitle(cat);
    html += `<button class="mobile-category-toggle" data-category="${cat}"><span>${catIcon} ${catTitle}</span><i class="fas fa-chevron-right"></i></button>`;
    html += `<div class="mobile-subcategory-list" id="mobileSubcat-${cat}">`;
    catProducts.forEach(prod => html += `<a href="#" class="mobile-nav-sublink" data-product-id="${prod.id}">${prod.name}</a>`);
    if (products.filter(p => p.category === cat).length > 5) html += `<a href="#" class="mobile-nav-sublink" data-view-category="${cat}">View all ${catTitle} →</a>`;
    html += '</div>';
  });
  html += '</div><div class="mobile-nav-section"><a href="#" class="mobile-nav-link" data-view-all-products>🛍️ All Products</a></div>';
  html += '<div class="mobile-nav-section"><div class="mobile-nav-section-title">🏷️ Brands</div>';
  brands.slice(0, 6).forEach(brand => html += `<a href="#" class="mobile-nav-link" data-view-brand="${brand}">${brand}</a>`);
  if (brands.length > 6) html += '<a href="#" class="mobile-nav-link" data-view-all-brands>View all brands →</a>';
  html += '</div><div class="mobile-nav-section">';
  html += '<a href="contact.html" class="mobile-nav-link">📍 Contact</a>';
  html += '<a href="#support" class="mobile-nav-link">🆘 Support</a></div>';
  
  container.innerHTML = html;
  
  document.querySelectorAll('.mobile-category-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = btn.dataset.category;
      const subList = document.getElementById(`mobileSubcat-${cat}`);
      btn.classList.toggle('active');
      subList.classList.toggle('show');
    });
  });
  document.querySelectorAll('[data-product-id]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileMenu();
      openProductDetail(link.dataset.productId);
    });
  });
  document.querySelector('[data-view-all-products]')?.addEventListener('click', (e) => {
    e.preventDefault(); closeMobileMenu();
    currentCategory = 'all'; currentPage = 1; renderAllProducts();
    document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-view-category]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); closeMobileMenu();
      currentCategory = link.dataset.viewCategory; currentPage = 1; renderAllProducts();
      document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  document.querySelectorAll('[data-view-brand]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); closeMobileMenu();
      window.currentBrand = link.dataset.viewBrand; window.renderBrandProducts();
      document.getElementById('brand-products')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  document.querySelector('[data-view-all-brands]')?.addEventListener('click', (e) => {
    e.preventDefault(); closeMobileMenu();
    window.currentBrand = 'all'; window.renderBrandProducts();
    document.getElementById('brand-products')?.scrollIntoView({ behavior: 'smooth' });
  });
}

function openMobileMenu() {
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('mobileNavOverlay');
  if (!mobileDrawer || !overlay) return;
  renderMobileMenu();
  mobileDrawer.classList.add('open');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('mobileNavOverlay');
  if (!mobileDrawer || !overlay) return;
  mobileDrawer.classList.remove('open');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// ===============================================
//           WISHLIST & REVIEW HELPERS (async)
// ===============================================
async function toggleWishlist(productId) {
  let wish = await getWishlist();
  if (wish.includes(productId)) wish = wish.filter(id => id !== productId);
  else wish.push(productId);
  await saveWishlist(wish);
  showToast(wish.includes(productId) ? "Added to wishlist" : "Removed from wishlist");
  updateAllWishlistIcons();
}

async function updateAllWishlistIcons() {
  const wishlist = await getWishlist();
  document.querySelectorAll('.wishlist-icon').forEach(icon => {
    const pid = icon.dataset.wish;
    icon.innerHTML = wishlist.includes(pid) ? '❤️' : '🤍';
    icon.classList.toggle('active', wishlist.includes(pid));
  });
}

async function renderWishlistCount() {
  const count = (await getWishlist()).length;
  const el = document.getElementById('wishlistCount');
  if (el) el.innerText = count;
}

async function renderWishlistModal() {
  let wishIds = await getWishlist();
  let products = await getProducts();
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
    </div>`;
}

function getProductReviews(productId) {
  const reviews = _cachedReviews || {};
  return reviews[productId] || [];
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

async function addReview(productId, userName, rating, comment) {
  if (!userName || !comment) { showToast("Please fill all review fields"); return; }
  let reviews = await getReviews();
  if (!reviews[productId]) reviews[productId] = [];
  reviews[productId].push({ id: Date.now(), user: userName, rating: parseInt(rating), comment, date: new Date().toLocaleDateString() });
  await saveReviews(reviews);
  
  if (!document.getElementById('productModal').classList.contains('hidden') && window.currentModalProductId === productId) {
    await renderProductDetailModal(productId);
  }
  await renderAllProducts();
  await renderHotProducts();
  await renderNewProducts();
  showToast("Review added!");
}

// ===============================================
//           CUSTOMER ACCOUNT SYSTEM (async)
// ===============================================
async function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  if (!name || !email || !password) { showToast("Please fill all required fields"); return; }
  if (password !== confirmPassword) { showToast("Passwords don't match"); return; }
  if (password.length < 4) { showToast("Password must be at least 4 characters"); return; }
  
  const accounts = await getAccounts();
  if (accounts.find(a => a.email === email)) { showToast("Email already registered"); return; }
  
  const newAccount = { id: 'CUST-' + Date.now(), name, email, phone, address, password, createdAt: new Date().toISOString() };
  accounts.push(newAccount);
  await saveAccounts(accounts);
  
  const loggedInUser = { ...newAccount }; delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  closeModal('accountModal');
  showToast(`Welcome, ${name}! 🎉`);
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast("Please fill all fields"); return; }
  
  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === email && a.password === password);
  if (!account) { showToast("Invalid email or password"); return; }
  
  const loggedInUser = { ...account }; delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  closeModal('accountModal');
  showToast(`Welcome back, ${account.name}! 👋`);
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem(CURRENT_USER_KEY);
    updateAccountUI();
    closeAccountDropdown();
    showToast('Logged out successfully');
  }
}

function showRegisterForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

function showLoginForm() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

function updateAccountUI() {
  const user = getCurrentUser();
  const accountBtn = document.getElementById('accountBtn');
  if (!accountBtn) return;
  
  if (user) {
    accountBtn.innerHTML = `<div class="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">${user.name.charAt(0).toUpperCase()}</div>`;
    accountBtn.classList.add('logged-in');
  } else {
    accountBtn.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    accountBtn.classList.remove('logged-in');
  }
}

function closeAccountDropdown() {
  document.getElementById('accountDropdown')?.classList.add('hidden');
}

async function viewMyOrders() {
  closeAccountDropdown();
  const user = getCurrentUser();
  if (!user) { showToast("Please login first"); return; }
  
  const orders = await getOrders();
  const myOrders = orders.filter(o => {
    const customerName = (o.customer || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/\D/g, '');
    const orderPhone = (o.phone || '').replace(/\D/g, '');
    const nameMatch = customerName.includes(userName) || userName.includes(customerName);
    const phoneMatch = userPhone && orderPhone && (userPhone.includes(orderPhone) || orderPhone.includes(userPhone));
    const emailMatch = user.email && o.email && o.email.toLowerCase() === user.email.toLowerCase();
    return nameMatch || phoneMatch || emailMatch;
  });
  
  if (myOrders.length === 0) {
    const msgHTML = `
      <div id="myOrdersModal" class="modal" style="display: flex; align-items: center; justify-content: center;">
        <div class="bg-white rounded-3xl max-w-md w-full p-8 mx-4 shadow-2xl text-center">
          <span class="text-5xl mb-4 block">📋</span>
          <h2 class="text-xl font-bold mb-2">No Orders Found</h2>
          <p class="text-gray-500 mb-4">You haven't placed any orders yet.</p>
          <button onclick="document.getElementById('myOrdersModal').remove();" class="bg-primary text-white px-6 py-3 rounded-xl font-medium">Start Shopping</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', msgHTML);
    document.getElementById('myOrdersModal').addEventListener('click', (e) => {
      if (e.target.id === 'myOrdersModal') e.target.remove();
    });
    return;
  }
  
  const ordersHTML = `
    <div id="myOrdersModal" class="modal" style="display: flex; align-items: center; justify-content: center;">
      <div class="bg-white rounded-3xl max-w-2xl w-full p-6 mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold">📋 My Orders (${myOrders.length})</h2>
          <button onclick="document.getElementById('myOrdersModal').remove()" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200">✕</button>
        </div>
        <div class="space-y-4">
          ${myOrders.slice(0, 20).map(order => {
            const status = order.status || 'pending';
            const statusConfig = {
              pending: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: '🟡' },
              confirmed: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '🟢' },
              processing: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: '🔵' },
              completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: '✅' },
              cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '❌' }
            };
            const cfg = statusConfig[status] || statusConfig.pending;
            return `
              <div class="${cfg.bg} rounded-2xl p-4 border">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <span class="font-mono font-bold">${order.id}</span>
                    <span class="${cfg.text} text-sm ml-2 font-medium">${cfg.icon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  </div>
                  <span class="font-bold text-lg">FCFA ${order.total.toFixed(2)}</span>
                </div>
                <p class="text-xs text-gray-500">📅 ${new Date(order.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <p class="text-xs text-gray-500">📍 ${order.address}</p>
                <div class="mt-2 text-sm flex flex-wrap gap-1">
                  ${order.items.map(i => `<span class="bg-white/50 px-2 py-0.5 rounded-full text-xs">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <a href="track.html?order=${order.id}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-primary text-sm font-medium hover:underline bg-white/50 px-3 py-1 rounded-full">
                  <i class="fas fa-external-link-alt text-xs"></i> Track Order
                </a>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', ordersHTML);
  document.getElementById('myOrdersModal').addEventListener('click', (e) => {
    if (e.target.id === 'myOrdersModal') e.target.remove();
  });
}

function autofillCheckoutFromAccount() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('custName').value = user.name || '';
  document.getElementById('custPhone').value = user.phone || '';
  document.getElementById('custAddr').value = user.address || '';
}

function getReviewerName() {
  const user = getCurrentUser();
  return user ? user.name : '';
}

window.toggleAccountDropdown = function() {
  const user = getCurrentUser();
  const dropdown = document.getElementById('accountDropdown');
  if (!dropdown) return;
  
  if (!user) {
    openModal('accountModal');
    showLoginForm();
    return;
  }
  
  document.getElementById('dropdownUserName').textContent = user.name;
  document.getElementById('dropdownUserEmail').textContent = user.email;
  document.getElementById('logoutBtn').classList.remove('hidden');
  document.getElementById('loginRegisterBtns').classList.add('hidden');
  dropdown.classList.toggle('hidden');
  
  if (!dropdown.classList.contains('hidden')) {
    setTimeout(() => {
      document.addEventListener('click', function closeDrop(e) {
        if (!dropdown.contains(e.target) && e.target.id !== 'accountBtn') {
          dropdown.classList.add('hidden');
          document.removeEventListener('click', closeDrop);
        }
      });
    }, 100);
  }
};

// ===============================================
//               INITIALIZATION (async)
// ===============================================
async function init() {
  // Load initial data from Supabase
  GLOBAL_PRODUCTS = await fetchProductsFromDB();
  if (!GLOBAL_PRODUCTS || GLOBAL_PRODUCTS.length === 0) {
    GLOBAL_PRODUCTS = normalizeProductImages(DEFAULT_PRODUCTS);
    await saveProducts(GLOBAL_PRODUCTS);
  }
  _cachedReviews = await getReviews();
  
  // Render all sections
  await renderAllProducts();
  await renderHotProducts();
  await renderNewProducts();
  await renderDealsOfToday();
  await renderFeaturedProduct();
  renderRecentlyViewed();
  await renderCart();
  await renderWishlistCount();
  await initSearch();
  await buildCategoryFilters();
  await renderCatalogSidebar();
  initCatalogDropdown();
  await buildBrandFilters();
  await initSliderControls();
  initializeDropdowns();
  await window.renderBrandProducts();
  await renderWishlistModal();
  updateAccountUI();
  
  // Initialize deals scroll and auto-scroll
  setTimeout(async () => {
    initDealsScroll();
    if ((await getDealsOfToday()).length > 3) {
      startAutoScroll();
      initAutoScrollPause();
    }
  }, 200);
  
  // Handle product ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const productIdFromUrl = urlParams.get('product');
  if (productIdFromUrl) {
    setTimeout(() => openProductDetail(productIdFromUrl), 300);
  }
  
  // Ensure at least one featured product exists
  let featured = await getFeaturedIds();
  if (!featured.length) {
    let products = await getProducts();
    if (products.length) await setFeaturedIds([products[0].id]);
  }
  currentFeaturedIndex = 0;
  await renderFeaturedProduct();
  
  // Close modal when clicking backdrop
  window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
  };
  
  // Mobile Navigation Drawer listeners
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileMenu);
  
  const closeBtn = document.getElementById('mobileNavClose');
  if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);
  
  const overlay = document.getElementById('mobileNavOverlay');
  if (overlay) overlay.addEventListener('click', closeMobileMenu);
  
  await renderMobileMenu();
  
  // Close product modal button
  const closeProductModalBtn = document.getElementById('closeProductModal');
  if (closeProductModalBtn) closeProductModalBtn.onclick = () => closeModal('productModal');
  
  // Scroll to top button
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    scrollTopBtn.style.display = 'none';
    window.addEventListener('scroll', () => {
      scrollTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  
  // Initialize business info
  await initializeBusinessInfo();
}

async function initializeBusinessInfo() {
  const business = await getBusinessInfo();
  const shopName = business.shop_name || business.shopName || 'ShopBoss';
  
  document.querySelectorAll('#headerShopName, #headerShopName123').forEach(el => {
    el.innerHTML = (shopName && shopName.toLowerCase() !== 'shopboss') 
      ? shopName 
      : `shop<span class="text-primary">Boss</span>`;
  });
  
  document.getElementById('footerEmail').textContent = business.email;
  document.getElementById('footerPhone').textContent = business.phone;
  document.getElementById('footerAddress').textContent = business.address;
  
  const facebookLink = document.getElementById('facebookLink');
  const instagramLink = document.getElementById('instagramLink');
  const tiktokLink = document.getElementById('tiktokLink');
  
  if (facebookLink) facebookLink.style.display = business.facebook ? 'block' : 'none';
  if (instagramLink) instagramLink.style.display = business.instagram ? 'block' : 'none';
  if (tiktokLink) tiktokLink.style.display = business.tiktok ? 'block' : 'none';
  if (business.facebook) facebookLink.href = business.facebook;
  if (business.instagram) instagramLink.href = business.instagram;
  if (business.tiktok) tiktokLink.href = business.tiktok;
}

document.addEventListener('DOMContentLoaded', () => {
  // Attach register/login form handlers
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleRegister();
    });
  }
  
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }
  
  // Attach checkout autofill trigger
  document.getElementById('checkoutModal')?.addEventListener('click', autofillCheckoutFromAccount);
});

// Initialize everything
init();