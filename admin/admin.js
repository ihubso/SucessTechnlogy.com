// admin.js - ShopBoss Admin Panel (Supabase Integration)

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

const ACCOUNT_STORAGE_KEY = 'shop_customer_accounts';
let editAddedImages = [];
let addedImages = [];
let variantsList = [];
let editVariantsList = [];
let GLOBAL_PRODUCTS = [];

// Session ID for cart/wishlist (in production, use a proper session management)
const SESSION_ID = 'admin_session_' + (localStorage.getItem('admin_session_id') || (() => {
  const id = Date.now() + '-' + Math.random().toString(36).substr(2, 8);
  localStorage.setItem('admin_session_id', id);
  return id;
})());

function genId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 8);
}

function normalizeProductImages(products) {
  return products.map(p => ({
    ...p,
    images: p.images && p.images.length ? p.images : [p.image]
  }));
}

// ===============================================
//          SUPABASE-BACKED DATA FUNCTIONS
// ===============================================

async function getProducts() {
  // Try Supabase first
  const cloudProducts = await fetchProductsFromDB();
  if (cloudProducts && cloudProducts.length > 0) {
    GLOBAL_PRODUCTS = normalizeProductImages(cloudProducts);
    return GLOBAL_PRODUCTS;
  }
  
  // Fallback to localStorage
  let p = JSON.parse(localStorage.getItem(STORAGE.PRODUCTS) || 'null');
  if (!p || p.length === 0) {
    const normalized = normalizeProductImages(DEFAULT_PRODUCTS);
    localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(normalized));
    return normalized;
  }
  if (p.some(prod => !prod.images)) {
    p = normalizeProductImages(p);
    localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(p));
  }
  GLOBAL_PRODUCTS = p;
  return p;
}

async function saveProducts(prods) {
  GLOBAL_PRODUCTS = prods;
  localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(prods));
  
  // Sync to Supabase
  for (const product of prods) {
    await addProductToDB(product);
  }
}

async function addNewProduct(product) {
  const saved = await addProductToDB(product);
  if (saved) {
    GLOBAL_PRODUCTS.unshift(saved);
    localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(GLOBAL_PRODUCTS));
    renderAllProducts();
    showToast("✅ Product added");
  } else {
    showToast("❌ Failed to save product");
  }
}

async function getCart() {
  const cloudCart = await fetchCartFromDB(SESSION_ID);
  if (cloudCart && cloudCart.length > 0) {
    return cloudCart.map(item => ({
      id: item.product_id,
      name: item.name,
      price: item.price,
      qty: item.qty,
      image: item.image
    }));
  }
  return JSON.parse(localStorage.getItem(STORAGE.CART) || '[]');
}

async function saveCart(cart) {
  localStorage.setItem(STORAGE.CART, JSON.stringify(cart));
  await saveCartToDB(SESSION_ID, cart);
  renderCart();
}

async function getWishlist() {
  const cloudWishlist = await fetchWishlistFromDB(SESSION_ID);
  if (cloudWishlist && cloudWishlist.length > 0) {
    return cloudWishlist;
  }
  return JSON.parse(localStorage.getItem(STORAGE.WISHLIST) || '[]');
}

async function saveWishlist(wish) {
  localStorage.setItem(STORAGE.WISHLIST, JSON.stringify(wish));
  await saveWishlistToDB(SESSION_ID, wish);
  renderWishlistCount();
  renderAllProducts();
  renderWishlistModal();
}

async function getReviews() {
  const cloudReviews = await fetchReviewsFromDB();
  if (cloudReviews && Object.keys(cloudReviews).length > 0) {
    return cloudReviews;
  }
  return JSON.parse(localStorage.getItem(STORAGE.REVIEWS) || '{}');
}

async function saveReviews(rev) {
  localStorage.setItem(STORAGE.REVIEWS, JSON.stringify(rev));
  await saveReviewsToDB(rev);
}

async function getOrders() {
  const cloudOrders = await getOrdersFromDB();
  if (cloudOrders && cloudOrders.length > 0) {
    return cloudOrders.map(o => ({
      id: o.id,
      date: o.created_at,
      customer: o.customer_name,
      phone: o.phone,
      address: o.address,
      email: o.email || '',
      items: o.items,
      total: o.total,
      status: o.status
    }));
  }
  return JSON.parse(localStorage.getItem(STORAGE.ORDERS) || '[]');
}

async function saveOrders(orders) {
  localStorage.setItem(STORAGE.ORDERS, JSON.stringify(orders));
  // Orders are saved individually through createOrderInDB
}

async function getBusinessInfo() {
  const cloudInfo = await fetchBusinessInfoFromDB();
  if (cloudInfo) {
    return cloudInfo;
  }
  return JSON.parse(localStorage.getItem(STORAGE.BUSINESS) || JSON.stringify({
    shopName: "ShopBoss",
    email: "hello@shopboss.com",
    phone: "+1234567890",
    address: "123 Commerce St",
    facebook: "",
    instagram: "",
    tiktok: ""
  }));
}

async function saveBusinessInfo(info) {
  localStorage.setItem(STORAGE.BUSINESS, JSON.stringify(info));
  await saveBusinessInfoToDB(info);
}

async function getFeaturedIds() {
  const cloudIds = await fetchFeaturedIdsFromDB();
  if (cloudIds && cloudIds.length > 0) {
    return cloudIds;
  }
  return JSON.parse(localStorage.getItem(STORAGE.FEATURED) || '[]');
}

async function setFeaturedIds(ids) {
  localStorage.setItem(STORAGE.FEATURED, JSON.stringify(ids));
  await saveFeaturedIdsToDB(ids);
}

async function getDealsOfToday() {
  const cloudDeals = await fetchDealsFromDB();
  if (cloudDeals && cloudDeals.length > 0) {
    return cloudDeals.map(d => ({ id: d.product_id, discount: d.discount }));
  }
  return JSON.parse(localStorage.getItem(STORAGE.DEALS) || '[]');
}

async function setDealsOfToday(deals) {
  localStorage.setItem(STORAGE.DEALS, JSON.stringify(deals));
  for (const deal of deals) {
    await saveDealToDB(deal.id, deal.discount);
  }
}

async function getSearchAnalytics() {
  const cloudAnalytics = await fetchSearchAnalyticsFromDB();
  if (cloudAnalytics && Object.keys(cloudAnalytics).length > 0) {
    return cloudAnalytics;
  }
  return JSON.parse(localStorage.getItem(STORAGE.SEARCH_ANALYTICS) || '{}');
}

async function saveSearchAnalytics(analytics) {
  localStorage.setItem(STORAGE.SEARCH_ANALYTICS, JSON.stringify(analytics));
  await saveSearchAnalyticsToDB(analytics);
}

async function getViewAnalytics() {
  const cloudAnalytics = await fetchViewAnalyticsFromDB();
  if (cloudAnalytics && Object.keys(cloudAnalytics).length > 0) {
    return cloudAnalytics;
  }
  return JSON.parse(localStorage.getItem(STORAGE.VIEW_ANALYTICS) || '{}');
}

async function saveViewAnalytics(analytics) {
  localStorage.setItem(STORAGE.VIEW_ANALYTICS, JSON.stringify(analytics));
  await saveViewAnalyticsToDB(analytics);
}

async function getFailedSearches() {
  const cloudFailed = await fetchFailedSearchesFromDB();
  if (cloudFailed && cloudFailed.length > 0) {
    return cloudFailed;
  }
  return JSON.parse(localStorage.getItem(STORAGE.FAILED_SEARCHES) || '[]');
}

async function saveFailedSearches(failed) {
  localStorage.setItem(STORAGE.FAILED_SEARCHES, JSON.stringify(failed));
  await saveFailedSearchesToDB(failed);
}

async function getCustomers() {
  const cloudCustomers = await fetchCustomersFromDB();
  if (cloudCustomers && cloudCustomers.length > 0) {
    return cloudCustomers;
  }
  return JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || '[]');
}

async function saveCustomers(customers) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(customers));
  await saveCustomersToDB(customers);
}

async function getContactInfo() {
  const cloudInfo = await fetchContactInfoFromDB();
  if (cloudInfo) {
    return cloudInfo;
  }
  return JSON.parse(localStorage.getItem(STORAGE.CONTACT) || JSON.stringify({
    latitude: 40.7128,
    longitude: -74.0060,
    hours: "Mon - Fri: 9:00 AM - 6:00 PM\nSat: 10:00 AM - 4:00 PM\nSun: Closed",
    description: "",
    shopPhoto: ""
  }));
}

async function saveContactInfo(info) {
  localStorage.setItem(STORAGE.CONTACT, JSON.stringify(info));
  await saveContactInfoToDB(info);
}

// ===============================================
//               REVIEWS MANAGEMENT
// ===============================================

let reviewFilterProduct = 'all';
let reviewFilterRating = 'all';

async function renderReviewsList() {
  const container = document.getElementById('reviewsListContainer');
  if (!container) return;

  const reviews = await getReviews();
  const products = await getProducts();
  
  let allReviews = [];
  Object.entries(reviews).forEach(([productId, productReviews]) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    productReviews.forEach(rev => {
      allReviews.push({
        ...rev,
        productId,
        productName: product.name,
        productImage: product.image
      });
    });
  });

  if (reviewFilterProduct !== 'all') {
    allReviews = allReviews.filter(r => r.productId === reviewFilterProduct);
  }
  if (reviewFilterRating !== 'all') {
    allReviews = allReviews.filter(r => r.rating === parseInt(reviewFilterRating));
  }

  allReviews.sort((a, b) => (b.id || 0) - (a.id || 0));

  if (allReviews.length === 0) {
    container.innerHTML = '<p class="text-center text-slate-500 py-8">No reviews found.</p>';
    return;
  }

  container.innerHTML = allReviews.map(rev => `
    <div class="border rounded-xl p-4 bg-slate-50" data-review-id="${rev.id}" data-product-id="${rev.productId}">
      <div class="flex gap-4">
        <img src="${rev.productImage}" class="w-16 h-16 object-cover rounded-lg">
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-bold">${rev.productName}</h4>
              <p class="text-sm text-slate-600">by ${rev.user} on ${rev.date || 'Unknown date'}</p>
            </div>
            <button class="delete-review-btn text-red-500 hover:bg-red-50 p-2 rounded-lg" data-review-id="${rev.id}" data-product-id="${rev.productId}">
              🗑️ Delete
            </button>
          </div>
          <div class="star-rating text-yellow-500">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</div>
          <p class="mt-2 text-slate-700">${rev.comment}</p>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.delete-review-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reviewId = parseInt(btn.dataset.reviewId);
      const productId = btn.dataset.productId;
      await deleteReview(productId, reviewId);
    });
  });
}

async function deleteReview(productId, reviewId) {
  if (!confirm('Delete this review?')) return;
  
  const reviews = await getReviews();
  if (reviews[productId]) {
    reviews[productId] = reviews[productId].filter(r => r.id !== reviewId);
    await saveReviews(reviews);
    showToast('Review deleted');
    renderReviewsList();
  }
}

function populateReviewFilters() {
  const productSelect = document.getElementById('reviewFilterProduct');
  if (!productSelect) return;

  getProducts().then(products => {
    productSelect.innerHTML = '<option value="all">All Products</option>' +
      products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  });
}

function initReviewsFilters() {
  document.getElementById('applyReviewFilter')?.addEventListener('click', () => {
    reviewFilterProduct = document.getElementById('reviewFilterProduct')?.value || 'all';
    reviewFilterRating = document.getElementById('reviewFilterRating')?.value || 'all';
    renderReviewsList();
  });
}

function showToast(msg) { 
  let t = document.getElementById('toastMsg'); 
  t.textContent = msg; 
  t.style.opacity = '1'; 
  setTimeout(() => t.style.opacity = '0', 2500);
}

window.openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

// Wishlist
async function toggleWishlist(pid) { 
  let w = await getWishlist(); 
  if(w.includes(pid)) w = w.filter(id=>id!==pid);
  else w.push(pid); 
  await saveWishlist(w); 
  showToast(w.includes(pid)?"Added to wishlist":"Removed"); 
  renderAllProducts();
  renderWishlistModal();
}

function renderWishlistCount() { 
  getWishlist().then(w => {
    document.getElementById('wishlistCount').innerText = w.length;
  });
}

async function renderWishlistModal() { 
  let wishIds = await getWishlist();
  let products = await getProducts(); 
  let items = products.filter(p=>wishIds.includes(p.id)); 
  document.getElementById('wishlistItems').innerHTML =
    items.length ? `<div class="grid gap-3">${items.map(p=>
      `<div class="flex gap-4 border-b pb-3"><img src="${p.image}" class="w-16 h-16 object-cover rounded"><div>
      <h3 class="font-bold">${p.name}</h3>
      <p>FCFA${p.price}</p>
      <button onclick="openProductDetail('${p.id}');closeModal('wishlistModal')" class="text-primary text-sm">View</button> 
      <button onclick="toggleWishlist('${p.id}')" class="text-red-500 text-sm">Remove</button>
      </div>
      </div>`).join('')}</div>` : '<p class="text-center">Empty wishlist</p>';
}

// Reviews
async function getProductReviews(pid) { 
  const reviews = await getReviews();
  return reviews[pid] || []; 
}

async function getAverageRating(pid) { 
  let revs = await getProductReviews(pid); 
  if(!revs.length) return 0; 
  let sum = revs.reduce((s,r)=>s+r.rating,0); 
  return sum/revs.length;
}

function renderStars(rating) {
  let full = Math.floor(rating);
  let stars = ''; 
  for(let i=0;i<full;i++) stars+='★';
  for(let i=stars.length;i<5;i++) stars+='☆'; 
  return stars;
}

async function addReview(pid, userName, rating, comment) { 
  if(!userName) return showToast("Enter name");
  let reviews = await getReviews(); 
  if(!reviews[pid]) reviews[pid]=[]; 
  reviews[pid].push({ 
    id:Date.now(), 
    user:userName, 
    rating:parseInt(rating),
    comment, 
    date:new Date().toLocaleDateString() 
  }); 
  await saveReviews(reviews); 
  if(window.currentModalProductId === pid) 
    renderProductDetailModal(pid); 
  renderAllProducts(); 
  showToast("Review added");
}

// Product Grid Logic
let currentPage = 1, itemsPerPage = 6, currentSort = "name_asc", currentCategory = "all", currentSearch = "";
let adminProductSearch = "";
const ADMIN_SEARCH_SUGGESTION_LIMIT = 8;

// ===============================================
//               Helper Functions
// ===============================================

function getSortedProducts(products) {
  let sorted = [...products];
  if (currentSort === "name_asc") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === "name_desc") {
    sorted.sort((a, b) => b.name.localeCompare(a.name));
  } else if (currentSort === "price_asc") {
    sorted.sort((a, b) => a.price - b.price);
  } else if (currentSort === "price_desc") {
    sorted.sort((a, b) => b.price - a.price);
  }
  return sorted;
}

async function renderProductCard(p) {
  let wished = (await getWishlist()).includes(p.id);
  let avg = await getAverageRating(p.id);
  let revCount = (await getProductReviews(p.id)).length;

  return `
    <div class="product-card relative p-4 shadow-sm" data-product-id="${p.id}">
      <div class="wishlist-icon" data-wish="${p.id}">${wished ? '❤️' : '🤍'}</div>
      <img src="${p.image}" class="w-full h-44 object-cover rounded-xl mb-3">
      <h3 class="font-bold">${p.name}</h3>
      <div class="star-rating text-sm">${renderStars(avg)} (${revCount})</div>
      <div class="flex justify-between items-center mt-2">
        <span class="text-primary font-bold">FCFA${p.price.toFixed(2)}</span>
        <button data-add="${p.id}" class="bg-dark text-white px-4 py-1.5 rounded-full text-sm">Add</button>
      </div>
    </div>
  `;
}

function compressImage(base64String, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // Skip compression for remote URLs to avoid CORS issues
    if (!base64String.startsWith('data:')) {
      console.log('ℹ️ Remote image detected, skipping compression');
      resolve(base64String);
      return;
    }
    
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Don't scale up small images
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        
        // Only return compressed version if it's actually smaller
        if (compressedBase64.length < base64String.length) {
          console.log(`🗜️ Image compressed: ${(base64String.length / 1024).toFixed(1)}KB → ${(compressedBase64.length / 1024).toFixed(1)}KB`);
          resolve(compressedBase64);
        } else {
          console.log('ℹ️ Compressed image larger than original, using original');
          resolve(base64String);
        }
      } catch (error) {
        console.warn('⚠️ Compression failed:', error.message);
        resolve(base64String); // Return original on error
      }
    };
    
    img.onerror = () => {
      console.warn('⚠️ Failed to load image for compression, using original');
      resolve(base64String);
    };
    
    img.src = base64String;
  });
}

async function processImagesForUpload(imageArray) {
  const processedImages = [];
  for (const img of imageArray) {
    try {
      // Skip processing for remote URLs that might cause CORS issues
      if (img && (img.startsWith('http://') || img.startsWith('https://'))) {
        console.log('ℹ️ Remote image, skipping upload processing');
        processedImages.push(img);
        continue;
      }
      
      const compressed = await compressImage(img, 800, 0.7);
      processedImages.push(compressed);
    } catch (e) {
      console.warn('Could not process image:', e);
      processedImages.push(img); // Use original if compression fails
    }
  }
  return processedImages;
}
// ===============================================
//             Main Rendering Functions
// ===============================================

async function renderAllProducts() {
  let products = await getProducts();

  if (currentSearch) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(currentSearch.toLowerCase())
    );
  }
  if (currentCategory !== "all") {
    products = products.filter(p => p.category === currentCategory);
  }

  let sorted = getSortedProducts(products);
  let totalPages = Math.ceil(sorted.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  let start = (currentPage - 1) * itemsPerPage;
  let paginated = sorted.slice(start, start + itemsPerPage);

  const grid = document.getElementById('productsGrid');
  const cardsHtml = await Promise.all(paginated.map(p => renderProductCard(p)));
  grid.innerHTML = cardsHtml.length
    ? cardsHtml.join('')
    : '<div class="col-span-full text-center">No products</div>';

  attachCardEvents();

  let pgDiv = document.getElementById('paginationControls');
  if (totalPages <= 1) {
    pgDiv.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
  }
  pgDiv.innerHTML = html;

  document.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderAllProducts();
    });
  });
}

function updateAddPreviews() {
  updateMultiImagePreviews('multiImagePreviews', 'imagesJsonField', addedImages);
}

document.getElementById('multiImageUpload')?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  
  for (const file of files) {
    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 800, 0.7);
      addedImages.push(compressed);
    } catch (err) {
      console.error('Error processing image:', err);
      showToast('Error processing image');
    }
  }
  
  updateMultiImagePreviews('multiImagePreviews', 'imagesJsonField', addedImages);
  e.target.value = '';
});

document.getElementById('editMultiImageUpload')?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  
  for (const file of files) {
    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 800, 0.7);
      editAddedImages.push(compressed);
    } catch (err) {
      console.error('Error processing image:', err);
      showToast('Error processing image');
    }
  }
  
  updateMultiImagePreviews('editMultiImagePreviews', 'editImagesJsonField', editAddedImages);
  e.target.value = '';
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function renderHotProducts() {
  let p = (await getProducts()).filter(p => p.isHot);
  const cardsHtml = await Promise.all(p.map(pr => renderProductCard(pr)));
  document.getElementById('hotProductsGrid').innerHTML =
    cardsHtml.join('') || '<p>No hot products</p>';
  attachCardEvents();
}

async function renderNewProducts() {
  let p = (await getProducts()).filter(p => p.isNew);
  const cardsHtml = await Promise.all(p.map(pr => renderProductCard(pr)));
  document.getElementById('newProductsGrid').innerHTML =
    cardsHtml.join('') || '<p>No new products</p>';
  attachCardEvents();
}

async function renderFeaturedProduct() {
  let ids = await getFeaturedIds();
  let allProducts = await getProducts();
  let featuredItems = allProducts.filter(p => ids.includes(p.id));
  let container = document.getElementById('featuredProductContainer');

  if (featuredItems.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-center py-4">No featured products set.</p>';
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${featuredItems.map(product => `
        <div class="flex gap-4 p-4 border rounded-2xl hover:border-primary transition-colors">
          <img src="${product.image}" class="w-24 h-24 object-cover rounded-xl">
          <div class="flex-1">
            <h3 class="font-bold text-lg">${product.name}</h3>
            <p class="text-primary font-bold text-xl">FCFA${product.price}</p>
            <button data-add="${product.id}" class="mt-2 text-sm bg-dark text-white px-4 py-1.5 rounded-full">
              Add to Cart
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  attachCardEvents();
}

// ===============================================
//                Event Handling
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

function productClick(e) {
  if (e.target.closest('button[data-add]') || e.target.closest('.wishlist-icon')) return;
  const id = this.dataset.productId;
  if (id) openProductDetail(id);
}

function addClick(e) {
  e.stopPropagation();
  window.addToCart(this.dataset.add);
}

function wishClick(e) {
  e.stopPropagation();
  const id = this.dataset.wish;
  if (id) toggleWishlist(id);
}

// ===============================================
//                   Cart Logic
// ===============================================

window.addToCart = async function (id) {
  let products = await getProducts();
  let p = products.find(p => p.id === id);
  if (!p || p.stock <= 0) {
    showToast("Out of stock");
    return;
  }

  let cart = await getCart();
  let existing = cart.find(i => i.id === id);

  if (existing) {
    if (existing.qty >= p.stock) {
      showToast(`Max ${p.stock}`);
      return;
    }
    existing.qty++;
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      price: p.price,
      qty: 1,
      image: p.image
    });
  }

  await saveCart(cart);
  showToast(`${p.name} added`);
};

async function renderCart() {
  let cart = await getCart();
  document.getElementById('cartCount').innerText = cart.reduce((s, i) => s + i.qty, 0);

  let container = document.getElementById('cartItems');
  if (!cart.length) {
    container.innerHTML = '<div class="text-center">Cart empty</div>';
    document.getElementById('cartTotal').innerText = '0';
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(item => {
    total += item.price * item.qty;
    return `
      <div class="flex justify-between items-center mb-2">
        <span>${item.name} x${item.qty}</span>
        <span>FCFA${(item.price * item.qty).toFixed(2)}</span>
        <div>
          <button class="qty-minus" data-id="${item.id}">-</button>
          <button class="qty-plus ml-1" data-id="${item.id}">+</button>
          <button class="remove-item ml-1" data-id="${item.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotal').innerText = total.toFixed(2);

  document.querySelectorAll('.qty-minus').forEach(btn =>
    (btn.onclick = () => updateQty(btn.dataset.id, -1))
  );
  document.querySelectorAll('.qty-plus').forEach(btn =>
    (btn.onclick = () => updateQty(btn.dataset.id, 1))
  );
  document.querySelectorAll('.remove-item').forEach(btn =>
    (btn.onclick = async () => {
      let cart = (await getCart()).filter(i => i.id !== btn.dataset.id);
      await saveCart(cart);
    })
  );
}

async function updateQty(id, delta) {
  let cart = await getCart();
  let idx = cart.findIndex(i => i.id === id);
  if (idx === -1) return;

  let prod = (await getProducts()).find(p => p.id === id);
  let newQ = cart[idx].qty + delta;

  if (newQ <= 0) {
    cart.splice(idx, 1);
  } else if (prod && newQ > prod.stock) {
    showToast(`Only ${prod.stock} left`);
    return;
  } else {
    cart[idx].qty = newQ;
  }

  await saveCart(cart);
}

window.clearCart = async function () {
  await saveCart([]);
  showToast("Cart cleared");
};

// ===============================================
//              Product Detail Modal
// ===============================================

window.currentModalProductId = null;

async function openProductDetail(id) {
  window.currentModalProductId = id;
  await trackProductView(id);
  await renderProductDetailModal(id);
  openModal('productModal');
}

async function renderProductDetailModal(id) {
  const p = (await getProducts()).find(pr => pr.id === id);
  if (!p) return;

  const avgRating = await getAverageRating(id);
  const reviews = await getProductReviews(id);
  const isWished = (await getWishlist()).includes(id);
  const shareUrl = `${window.location.origin}${window.location.pathname}?product=${id}`;

  const allProducts = await getProducts();
  const related = allProducts
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
          <div class="w-20 h-20 flex-shrink-0 rounded-2xl border-2 border-gray-100 overflow-hidden cursor-pointer hover:border-black transition-all bg-white shadow-sm focus-within:border-black">
            <img src="${img}" 
                 alt="View ${index + 1}"
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
          <div class="bg-white rounded-[2.5rem] overflow-hidden aspect-square flex items-center justify-center border border-gray-100 shadow-sm relative">
            <img id="mainImageDisplay" 
                 src="${p.image}" 
                 alt="${p.name}" 
                 style="transition: opacity 0.2s ease-in-out;"
                 class="object-contain w-full h-full p-8" />
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

        <div class="text-4xl font-light text-gray-900 mb-6">FCFA${p.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>

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
          <button onclick="addToCart('${p.id}');" class="flex-[2] bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all transform active:scale-95 shadow-xl shadow-gray-200">
            Add to Bag
          </button>
          <button onclick="shareProduct('${shareUrl}', '${p.name}')" class="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            <span>📤</span> Share
          </button>
        </div>

        <p class="text-center text-xs text-gray-400">✨ Free shipping on orders over $100 • 30-day returns</p>
      </div>
    </div>

    <div class="mt-16 pt-10 border-t border-gray-100">
      <h3 class="text-2xl font-bold mb-8 text-center">Complete the Look</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        ${related.map(rp => `
          <div class="group cursor-pointer" onclick="openProductDetail('${rp.id}')">
            <div class="bg-gray-50 rounded-2xl p-4 mb-3 overflow-hidden border border-transparent group-hover:border-primary/20 transition-all">
              <img src="${rp.image}" class="w-full aspect-square object-contain group-hover:scale-110 transition-transform duration-300">
            </div>
            <h4 class="font-bold text-sm truncate">${rp.name}</h4>
            <p class="text-gray-500 text-sm">FCFA${rp.price.toFixed(2)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Attach variant option listeners
  document.querySelectorAll('.variant-option').forEach(btn => {
    btn.addEventListener('click', function() {
      this.parentElement.querySelectorAll('.variant-option').forEach(b => b.classList.remove('bg-primary', 'text-white', 'border-primary'));
      this.classList.add('bg-primary', 'text-white', 'border-primary');
      window.selectedVariants = window.selectedVariants || {};
      window.selectedVariants[this.dataset.variantType] = this.dataset.variantValue;
    });
  });
}

window.buyNow = function (id) {
  addToCart(id);
  openCheckout();
};

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

// ===============================================
//           ANALYTICS RENDERING
// ===============================================

async function renderAnalyticsDashboard() {
  renderTopSearches();
  renderTopViewed();
  renderFailedSearches();
  renderRecentSearches();
  renderAnalyticsStats();
}

async function renderAnalyticsStats() {
  const searchAnalytics = await getSearchAnalytics();
  const viewAnalytics = await getViewAnalytics();
  const failedSearches = await getFailedSearches();
  
  const totalSearches = Object.values(searchAnalytics).reduce((sum, s) => sum + s.count, 0);
  const totalViews = Object.values(viewAnalytics).reduce((sum, v) => sum + v.count, 0);
  
  document.getElementById('totalSearchesStat').textContent = totalSearches;
  document.getElementById('totalViewsStat').textContent = totalViews;
  document.getElementById('failedSearchesStat').textContent = failedSearches.length;
}

async function renderTopSearches() {
  const container = document.getElementById('topSearchesList');
  if (!container) return;
  
  const analytics = await getSearchAnalytics();
  const sorted = Object.values(analytics)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  if (!sorted.length) {
    container.innerHTML = '<p class="text-slate-400 text-sm">No search data yet</p>';
    return;
  }
  
  container.innerHTML = sorted.map((item, index) => {
    const percentage = Math.min(100, item.count * 10);
    const isTop = index < 3;
    
    return `
      <div class="flex items-center gap-3 p-3 bg-white rounded-xl border">
        <span class="text-2xl font-bold ${isTop ? 'text-primary' : 'text-slate-300'} w-8">
          #${index + 1}
        </span>
        <div class="flex-1">
          <div class="flex justify-between mb-1">
            <span class="font-semibold text-sm">${item.query}</span>
            <span class="text-xs text-slate-500">
              ${item.count} searches • ${item.results} results
            </span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full" style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderTopViewed() {
  const container = document.getElementById('topViewedList');
  if (!container) return;
  
  const analytics = await getViewAnalytics();
  const products = await getProducts();
  
  const sorted = Object.entries(analytics)
    .map(([id, data]) => {
      const product = products.find(p => p.id === id);
      return {
        id,
        name: product ? product.name : 'Deleted Product',
        image: product ? product.image : 'https://placehold.co/100x100?text=X',
        ...data
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  if (!sorted.length) {
    container.innerHTML = '<p class="text-slate-400 text-sm">No view data yet</p>';
    return;
  }
  
  container.innerHTML = sorted.map((item, index) => `
    <div class="flex items-center gap-3 p-3 bg-white rounded-xl border">
      <span class="text-2xl font-bold ${index < 3 ? 'text-primary' : 'text-slate-300'} w-8">
        #${index + 1}
      </span>
      <img src="${item.image}" class="w-12 h-12 object-cover rounded-lg" alt="${item.name}">
      <div class="flex-1">
        <p class="font-semibold text-sm truncate">${item.name}</p>
        <div class="flex justify-between">
          <span class="text-xs text-primary font-bold">${item.count} views</span>
          <span class="text-xs text-slate-400" title="${new Date(item.lastViewed).toLocaleString()}">
            ${timeAgo(item.lastViewed)}
          </span>
        </div>
      </div>
    </div>
  `).join('');
}

async function renderFailedSearches() {
  const container = document.getElementById('failedSearchesList');
  if (!container) return;
  
  const failedSearches = await getFailedSearches();
  const sorted = failedSearches.sort((a, b) => b.count - a.count).slice(0, 10);
  
  if (!sorted.length) {
    container.innerHTML = '<p class="text-slate-400 text-sm">No failed searches 🎉</p>';
    return;
  }
  
  container.innerHTML = sorted.map(item => `
    <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-red-100">
      <span class="text-2xl">❌</span>
      <div class="flex-1">
        <p class="font-semibold text-sm">"${item.query}"</p>
        <div class="flex justify-between">
          <span class="text-xs text-red-500">${item.count} failed searches</span>
          <span class="text-xs text-slate-400">${timeAgo(item.lastSearched)}</span>
        </div>
      </div>
      <button onclick="addQuickProduct('${item.query}')" class="text-xs bg-primary text-white px-3 py-1 rounded-full">
        + Add Product
      </button>
    </div>
  `).join('');
}

async function renderRecentSearches() {
  const container = document.getElementById('recentSearchesList');
  if (!container) return;
  
  const analytics = await getSearchAnalytics();
  const sorted = Object.values(analytics)
    .sort((a, b) => new Date(b.lastSearched) - new Date(a.lastSearched))
    .slice(0, 10);
  
  if (!sorted.length) {
    container.innerHTML = '<p class="text-slate-400 text-sm">No recent activity</p>';
    return;
  }
  
  container.innerHTML = sorted.map(item => `
    <div class="flex items-center gap-3 p-3 bg-white rounded-xl border">
      <span class="text-sm">🔍</span>
      <div class="flex-1">
        <p class="font-semibold text-sm">${item.query}</p>
        <div class="flex justify-between">
          <span class="text-xs text-slate-500">Found: ${item.results} results</span>
          <span class="text-xs text-slate-400">${timeAgo(item.lastSearched)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function timeAgo(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diff = Math.floor((now - then) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function clearSearchAnalytics() {
  if (!confirm('Clear all search data?')) return;
  await saveSearchAnalytics({});
  await saveFailedSearches([]);
  showToast('Search analytics cleared');
  renderAnalyticsDashboard();
}

async function clearViewAnalytics() {
  if (!confirm('Clear all view data?')) return;
  await saveViewAnalytics({});
  showToast('View analytics cleared');
  renderAnalyticsDashboard();
}

// Quick add product from failed search
window.addQuickProduct = async function(productName) {
  if (!confirm(`Create a product named "${productName}"?`)) return;
  
  const newProduct = {
    id: genId(),
    name: productName,
    price: 0,
    category: 'phone',
    description: '',
    stock: 0,
    image: 'https://placehold.co/600x400?text=' + encodeURIComponent(productName),
    images: ['https://placehold.co/600x400?text=' + encodeURIComponent(productName)],
    isHot: false,
    isNew: true,
    brand: 'New Product',
    variants: [],
    os: '',
    cpu: '',
    specs: 'Quick add from search analytics',
    deliveryEstimate: '3-5 business days'
  };
  
  const products = await getProducts();
  products.unshift(newProduct);
  await saveProducts(products);
  showToast('Product added');
  refreshAll();
};

// ===============================================
//               Checkout & Orders
// ===============================================

async function openCheckout() {
  const cart = await getCart();
  if (cart.length === 0) {
    showToast("Cart empty");
    return;
  }
  closeModal('cartModal');
  openModal('checkoutModal');
}

async function checkoutWhatsApp() {
  let cart = await getCart();
  if (!cart.length) {
    showToast("Cart empty");
    return;
  }

  let info = await getBusinessInfo();
  let phone = info.phone.replace(/\D/g, '') || "1234567890";
  let msg = "🛍️ *New Order*%0A";
  cart.forEach(i => {
    msg += `- ${i.name} x${i.qty} = FCFA${(i.price * i.qty).toFixed(2)}%0A`;
  });
  let total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  msg += `%0A*Total: FCFA${total.toFixed(2)}*`;
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  let name = document.getElementById('custName').value.trim();
  let phone = document.getElementById('custPhone').value.trim();
  let addr = document.getElementById('custAddr').value.trim();

  if (!name || !phone || !addr) {
    showToast("Fill all fields");
    return;
  }

  let cart = await getCart();
  if (cart.length === 0) return;

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
    items: cart.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty
    })),
    total
  };

  // Save to Supabase
  await createOrderInDB(order);

  let orders = await getOrders();
  orders.unshift(order);
  localStorage.setItem(STORAGE.ORDERS, JSON.stringify(orders));
  
  await saveCart([]);
  closeModal('checkoutModal');
  showToast(`✅ Order placed #${order.id}`);
  refreshAll();
});

// ===============================================
//                Admin Functions
// ===============================================

async function renderAnalytics() {
  let products = await getProducts();
  let orders = await getOrders();

  document.getElementById('totalProductsStat').innerText = products.length;
  document.getElementById('totalOrdersStat').innerText = orders.length;
  document.getElementById('totalRevenueStat').innerText =
    'FCFA' + orders.reduce((s, o) => s + o.total, 0).toFixed(2);

  let lowStock = products.filter(p => p.stock <= 5);
  document.getElementById('lowStockList').innerHTML = lowStock.length
    ? lowStock.map(p => `<div>⚠️ ${p.name} (stock: ${p.stock})</div>`).join('')
    : '<div>✅ No low stock</div>';

  let recent = orders.slice(-6).reverse();
  document.getElementById('recentOrdersList').innerHTML = recent.length
    ? recent.map(o => `
        <div class="border-b py-2">
          <b>${o.customer}</b> - FCFA${o.total.toFixed(2)} - ${new Date(o.date).toLocaleDateString()}
        </div>
      `).join('')
    : '<div>No orders yet</div>';
}

async function renderProductListAdmin() {
  let products = await getProducts();
  if (adminProductSearch.trim()) {
    const q = adminProductSearch.trim().toLowerCase();
    products = products.filter(p => (p.name || '').toLowerCase().includes(q));
  }
  const dealsMap = new Map((await getDealsOfToday()).map(d => [d.id, d.discount]));
  
  if (!products.length) {
    document.getElementById('productsList').innerHTML = '<p class="col-span-full text-center text-slate-500 py-6">No products found</p>';
    return;
  }

  document.getElementById('productsList').innerHTML = products.map(p => {
    const dealDiscount = dealsMap.get(p.id);
    const hasDeal = dealDiscount !== undefined;
    
    return `
      <div class="border rounded-2xl p-4 shadow-sm relative ${hasDeal ? 'border-primary border-2' : ''}">
        ${hasDeal ? '<div class="absolute -top-2 -right-2 bg-primary text-white px-2 py-1 rounded-full text-xs font-bold z-10">🔥 DEAL</div>' : ''}
        <img
          src="${p.image || 'https://placehold.co/600x400'}"
          alt="${p.name}"
          class="product-image-edit-trigger w-full h-40 object-cover rounded-xl mb-3 bg-slate-100 cursor-pointer"
          data-id="${p.id}"
          title="Click image to edit"
          loading="lazy"
        />
        <div class="flex items-start justify-between gap-3">
          <div>
            <strong class="block">${p.name}</strong>
            <span class="text-sm text-slate-600">
              ${hasDeal ? 
                `<span class="line-through text-gray-400">FCFA${p.price}</span> 
                 <span class="text-primary font-bold">FCFA${(p.price * (1 - dealDiscount/100)).toFixed(2)}</span>
                 <span class="text-xs bg-primary text-white px-1.5 py-0.5 rounded ml-1">-${dealDiscount}%</span>` : 
                `FCFA${p.price}`
              } · stock: ${p.stock} ${p.isHot ? '🔥' : ''} ${p.isNew ? '✨' : ''}
            </span>
          </div>
          <div class="shrink-0">
            <button class="edit-product-btn text-blue-600 mr-2" data-id="${p.id}">✏️ Edit</button>
            <button class="delete-product-btn text-red-500" data-id="${p.id}">Delete</button>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <span class="text-xs text-slate-500">Deal of Today</span>
          <input
            type="number"
            min="1"
            max="95"
            value="${dealDiscount || ''}"
            placeholder="% off"
            class="deal-discount-input border rounded px-2 py-1 text-sm w-24"
            data-id="${p.id}"
          />
          <button class="set-deal-btn text-xs bg-primary text-white px-3 py-1 rounded-full" data-id="${p.id}">
            Save Deal
          </button>
          ${hasDeal
            ? `<button class="remove-deal-btn text-xs bg-slate-200 px-3 py-1 rounded-full" data-id="${p.id}">Remove Deal</button>`
            : ''
          }
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.edit-product-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditProduct(btn.dataset.id))
  );

  document.querySelectorAll('.product-image-edit-trigger').forEach(img =>
    img.addEventListener('click', () => openEditProduct(img.dataset.id))
  );

  document.querySelectorAll('.delete-product-btn').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (confirm('Delete?')) {
        let prods = (await getProducts()).filter(p => p.id !== btn.dataset.id);
        let featured = await getFeaturedIds();
        if (featured.includes(btn.dataset.id)) {
          await setFeaturedIds(featured.filter(id => id !== btn.dataset.id));
        }
        await removeDealForProduct(btn.dataset.id, true);
        await saveProducts(prods);
        showToast('Deleted');
        refreshAll();
      }
    })
  );

  document.querySelectorAll('.set-deal-btn').forEach(btn =>
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.id;
      const input = document.querySelector(`.deal-discount-input[data-id="${productId}"]`);
      if (!input) return;
      await saveDealForProduct(productId, input.value);
    })
  );

  document.querySelectorAll('.remove-deal-btn').forEach(btn =>
    btn.addEventListener('click', async () => {
      await removeDealForProduct(btn.dataset.id);
    })
  );
}

async function renderAdminSearchSuggestions(query = "") {
  const suggestionsBox = document.getElementById('productListSearchSuggestions');
  if (!suggestionsBox) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.add('hidden');
    return;
  }

  const matches = (await getProducts())
    .filter(p => (p.name || '').toLowerCase().includes(q))
    .slice(0, ADMIN_SEARCH_SUGGESTION_LIMIT);

  if (!matches.length) {
    suggestionsBox.innerHTML = '<div class="px-3 py-2 text-sm text-slate-400">No suggestions</div>';
    suggestionsBox.classList.remove('hidden');
    return;
  }

  suggestionsBox.innerHTML = matches.map(p => `
    <button
      type="button"
      class="admin-search-suggestion-item w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
      data-name="${p.name}"
    >
      ${p.name}
    </button>
  `).join('');
  suggestionsBox.classList.remove('hidden');

  document.querySelectorAll('.admin-search-suggestion-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('productListSearchInput');
      if (!input) return;
      input.value = btn.dataset.name || '';
      adminProductSearch = input.value;
      suggestionsBox.classList.add('hidden');
      renderProductListAdmin();
    });
  });
}

async function openEditProduct(id) {
  let p = (await getProducts()).find(p => p.id === id);
  if (!p) return;

  let form = document.getElementById('editForm');
  form.name.value = p.name;
  form.price.value = p.price;
  form.category.value = p.category;
  form.description.value = p.description || '';
  form.stock.value = p.stock;
  form.image.value = p.image;
  form.isHot.checked = p.isHot;
  form.isNew.checked = p.isNew;
  form.brand.value = p.brand || '';
  form.os.value = p.os || '';
  form.cpu.value = p.cpu || '';
  form.specs.value = p.specs || '';
  form.deliveryEstimate.value = p.deliveryEstimate || '';
  
  editAddedImages = p.images && Array.isArray(p.images) ? [...p.images] : [p.image];
  updateMultiImagePreviews('editMultiImagePreviews', 'editImagesJsonField', editAddedImages);
  editVariantsList = p.variants ? JSON.parse(JSON.stringify(p.variants)) : [];
  renderVariantsUI('editVariantsContainer', editVariantsList);

  window.editingId = id;
  openModal('editModal');
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.editingId) return;

  let fd = new FormData(e.target);
  
  let allImages = [...editAddedImages];
  const mainImage = fd.get('image');
  
  if (allImages.length === 0) {
    allImages = [mainImage || 'https://placehold.co/600x400'];
  } else if (mainImage && !allImages.includes(mainImage)) {
    allImages.unshift(mainImage);
  }
  
  const urlInput = fd.get('imageUrls');
  if (urlInput) {
    let urls = urlInput.split(',').map(u => u.trim()).filter(u => u);
    allImages = [...allImages, ...urls];
  }
  
  const processedImages = await processImagesForUpload(allImages);
  const validVariants = editVariantsList.filter(v => v.type.trim() && v.values.length);

  let updated = {
    id: window.editingId,
    name: fd.get('name'),
    price: Number(fd.get('price')),
    category: fd.get('category'),
    description: fd.get('description'),
    stock: Number(fd.get('stock')),
    variants: validVariants,
    image: processedImages[0] || 'https://placehold.co/600x400',
    images: processedImages,
    isHot: fd.get('isHot') === 'on',
    isNew: fd.get('isNew') === 'on',
    brand: fd.get('brand'),
    os: fd.get('os'),
    cpu: fd.get('cpu'),
    specs: fd.get('specs'),
    deliveryEstimate: fd.get('deliveryEstimate')
  };

  // Try to update in Supabase
  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client
        .from('products')
        .upsert([updated], { onConflict: 'id' });
      
      if (error) {
        console.error('❌ Error updating in Supabase:', error.message);
      } else {
        console.log('✅ Product updated in Supabase!');
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not update Supabase:', err.message);
  }

  // Always update localStorage
  let prods = await getProducts();
  let idx = prods.findIndex(p => p.id === window.editingId);
  if (idx !== -1) prods[idx] = updated;
  localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(prods));
  GLOBAL_PRODUCTS = prods;
  
  closeModal('editModal');
  showToast('Product updated');
  refreshAll();
});

document.getElementById('adminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  let fd = new FormData(e.target);
  
  const mainImage = fd.get('image') || 'https://placehold.co/600x400';
  
  let allImages = [...addedImages];
  if (allImages.length === 0) {
    allImages = [mainImage];
  } else if (!allImages.includes(mainImage)) {
    allImages.unshift(mainImage);
  }
  
  const processedImages = await processImagesForUpload(allImages);
  const validVariants = variantsList.filter(v => v.type.trim() && v.values.length);
  
  let newProd = {
    id: genId(),
    name: fd.get('name'),
    price: Number(fd.get('price')),
    category: fd.get('category'),
    description: fd.get('description') || '',
    stock: Number(fd.get('stock')),
    image: processedImages[0],
    images: processedImages,
    isHot: fd.get('isHot') === 'on',
    isNew: fd.get('isNew') === 'on',
    brand: fd.get('brand') || '',
    variants: validVariants,
    os: fd.get('os') || '',
    cpu: fd.get('cpu') || '',
    specs: fd.get('specs') || '',
    deliveryEstimate: fd.get('deliveryEstimate') || ''
  };

  // Try Supabase first
  let savedToCloud = false;
  console.log('📤 Sending product to Supabase...');
  const result = await addProductToDB(newProd);
  if (result) {
    savedToCloud = true;
    console.log('✅ Product saved to Supabase successfully!');
  } else {
    console.warn('⚠️ Failed to save to Supabase, saving locally only');
  }

  // Always save to localStorage as backup
  let prods = await getProducts();
  prods.unshift(newProd);
  localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(prods));
  GLOBAL_PRODUCTS = prods;

  // Reset form
  e.target.reset();
  addedImages = [];
  variantsList = [];
  updateMultiImagePreviews('multiImagePreviews', 'imagesJsonField', addedImages);
  renderVariantsUI('variantsContainer', variantsList);
  
  showToast(savedToCloud ? '✅ Product added to cloud!' : '⚠️ Product saved locally');
  refreshAll();
});

async function loadAdminFromSupabase() {
  try {
    const client = getSupabase();
    if (!client) {
      console.log('⚠️ Supabase not available, using localStorage only');
      return null;
    }
    
    const { data: products, error } = await client
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error loading from Supabase:', error.message);
      return null;
    }
    
    if (products && products.length > 0) {
      localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(products));
      console.log(`✅ Admin loaded ${products.length} products from Supabase`);
      return products;
    } else {
      console.log('ℹ️ No products found in Supabase, using defaults');
      return null;
    }
  } catch (e) {
    console.log('⚠️ Using localStorage for admin:', e.message);
  }
  return null;
}

document.getElementById('imageUpload')?.addEventListener('change', (e) => {
  let file = e.target.files[0];
  if (file) {
    let reader = new FileReader();
    reader.onload = ev => {
      document.querySelector('#adminForm input[name="image"]').value = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

async function populateFeaturedSelect() {
  let products = await getProducts();
  let featuredIds = await getFeaturedIds();
  let sel = document.getElementById('featuredSelect');
  let available = products.filter(p => !featuredIds.includes(p.id));

  sel.innerHTML = available.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (available.length === 0) {
    sel.innerHTML = '<option value="">All items are featured</option>';
  }

  let listContainer = document.getElementById('featuredAdminList');
  let featuredItems = products.filter(p => featuredIds.includes(p.id));
  listContainer.innerHTML = featuredItems.length
    ? featuredItems.map(p => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border">
          <div class="flex items-center gap-3">
            <img src="${p.image}" class="w-10 h-10 object-cover rounded-lg">
            <span class="font-medium">${p.name}</span>
          </div>
          <button onclick="toggleFeatured('${p.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg text-sm font-bold">
            Remove
          </button>
        </div>
      `).join('')
    : '<p class="text-center text-slate-400 text-sm py-4">No items set as featured.</p>';
}

document.getElementById('addFeaturedBtn')?.addEventListener('click', () => {
  const id = document.getElementById('featuredSelect').value;
  if (id && id !== "") {
    toggleFeatured(id);
  } else {
    showToast("Select a product first");
  }
});

document.getElementById('businessForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  let info = {
    shopName: e.target.shopName.value,
    email: e.target.email.value,
    phone: e.target.phone.value,
    address: e.target.address.value,
    facebook: e.target.facebook.value,
    instagram: e.target.instagram.value,
    tiktok: e.target.tiktok.value
  };
  await saveBusinessInfo(info);
  showToast('Business info saved');
  refreshAll();
});

document.getElementById('resetDefaultBtn')?.addEventListener('click', async () => {
  if (confirm('Reset to default products?')) {
    localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    GLOBAL_PRODUCTS = DEFAULT_PRODUCTS;
    await setDealsOfToday([]);
    let currentFeatured = await getFeaturedIds();
    let validFeatured = currentFeatured.filter(id =>
      DEFAULT_PRODUCTS.some(p => p.id === id)
    );
    await setFeaturedIds(validFeatured);
    refreshAll();
    showToast('Reset done');
  }
});

async function loadBusinessForm() {
  let info = await getBusinessInfo();
  let form = document.getElementById('businessForm');
  if (form) {
    form.shopName.value = info.shopName;
    form.email.value = info.email;
    form.phone.value = info.phone;
    form.address.value = info.address;
    form.facebook.value = info.facebook || '';
    form.instagram.value = info.instagram || '';
    form.tiktok.value = info.tiktok || '';
  }
  
  const adminHeader = document.getElementById('adminHeaderShopName');
  if (adminHeader) {
    if (info.shopName && info.shopName.toLowerCase() !== 'shopboss') {
      adminHeader.innerHTML = `${info.shopName}<span class="text-xs text-slate-400 ml-1">admin</span>`;
    }
  }
  
  const mainHeader = document.getElementById('mainHeaderShopName');
  if (mainHeader) {
    if (info.shopName && info.shopName.toLowerCase() !== 'shopboss') {
      mainHeader.textContent = info.shopName;
    } else {
      mainHeader.innerHTML = `shop<span class="text-primary">Boss</span>`;
    }
  }
}

// ==========================================
//         CONTACT & LOCATION PAGE
// ==========================================

async function loadContactForm() {
  let contact = await getContactInfo();
  let form = document.getElementById('contactForm');
  if (form) {
    form.latitude.value = contact.latitude;
    form.longitude.value = contact.longitude;
    form.hours.value = contact.hours;
    form.description.value = contact.description;
    if (contact.shopPhoto) {
      document.getElementById('shopPhotoPreviewImg').src = contact.shopPhoto;
      document.getElementById('shopPhotoPreviewImg').classList.remove('hidden');
      document.getElementById('shopPhotoDataField').value = contact.shopPhoto;
    }
    if (form.shopPhoto) form.shopPhoto.value = contact.shopPhoto || '';
  }
  updateContactPreview();
}

async function updateContactPreview() {
  let business = await getBusinessInfo();
  let contact = await getContactInfo();
  
  document.getElementById('previewShopName').textContent = business.shopName || 'ShopBoss';
  document.getElementById('previewAddress').textContent = business.address;
  document.getElementById('previewPhone').textContent = business.phone;
  document.getElementById('previewEmail').textContent = business.email;
  
  document.getElementById('previewAddressMain').textContent = business.address;
  document.getElementById('previewPhoneMain').textContent = business.phone;
  document.getElementById('previewEmailMain').textContent = business.email;
  document.getElementById('previewHours').textContent = contact.hours;
  
  if (contact.description && contact.description.trim()) {
    document.getElementById('previewDescription').textContent = contact.description;
    document.getElementById('previewDescriptionDiv').classList.remove('hidden');
  } else {
    document.getElementById('previewDescriptionDiv').classList.add('hidden');
  }
  const previewImg = document.getElementById('previewShopPhotoImg');
  const previewPlaceholder = document.getElementById('previewShopPhotoPlaceholder');
  if (contact.shopPhoto) {
    previewImg.src = contact.shopPhoto;
    previewImg.classList.remove('hidden');
    if (previewPlaceholder) previewPlaceholder.classList.add('hidden');
  } else {
    previewImg.classList.add('hidden');
    if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
  }
}

document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  let info = {
    latitude: parseFloat(e.target.latitude.value) || 40.7128,
    longitude: parseFloat(e.target.longitude.value) || -74.0060,
    hours: e.target.hours.value,
    description: e.target.description.value,
    shopPhoto: document.getElementById('shopPhotoDataField')?.value || e.target.shopPhoto?.value || ''
  };
  await saveContactInfo(info);
  updateContactPreview();
  showToast('Location settings saved');
});

async function buildCategoryFilters() {
  let products = await getProducts();
  let cats = [...new Set(products.map(p => p.category))];
  let html = `<button data-cat="all" class="filter-btn active">All</button>`;
  html += cats.map(c => `<button data-cat="${c}" class="filter-btn">${c}</button>`).join('');

  document.getElementById('categoryFilterContainer').innerHTML = html;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      currentPage = 1;
      renderAllProducts();
    });
  });
}

async function refreshAll() {
  await renderAllProducts();
  await renderHotProducts();
  await renderNewProducts();
  await renderFeaturedProduct();
  await buildCategoryFilters();
  await renderProductListAdmin();
  await populateFeaturedSelect();
  await updateOrderStats();
  await renderAnalytics();
  await renderCustomerList();
  await renderAnalyticsDashboard();
  renderWishlistCount();
  renderCart();
}

function updateMultiImagePreviews(containerId, hiddenFieldId, imagesArray) {
  const previewContainer = document.getElementById(containerId);
  const hiddenField = document.getElementById(hiddenFieldId);
  if (!previewContainer || !hiddenField) return;

  previewContainer.innerHTML = imagesArray.map((url, idx) => `
    <div class="relative w-20 h-20 border rounded-lg overflow-hidden">
      <img src="${url}" class="w-full h-full object-cover" />
      <button type="button" data-index="${idx}" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs remove-preview">×</button>
    </div>
  `).join('');
  hiddenField.value = JSON.stringify(imagesArray);

  previewContainer.querySelectorAll('.remove-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.index);
      imagesArray.splice(idx, 1);
      updateMultiImagePreviews(containerId, hiddenFieldId, imagesArray);
    });
  });
}

// ===============================================
//           VARIANTS MANAGEMENT (Admin)
// ===============================================

function renderVariantsUI(containerId, list, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = list.map((variant, idx) => `
    <div class="flex gap-2 mb-3 items-start variant-row" data-index="${idx}">
      <input type="text" placeholder="Type (e.g., Size)" value="${variant.type}" data-index="${idx}" data-field="type" class="flex-1 border p-2 rounded-lg text-sm" />
      <input type="text" placeholder="Values (comma separated)" value="${variant.values.join(', ')}" data-index="${idx}" data-field="values" class="flex-[2] border p-2 rounded-lg text-sm" />
      <button type="button" class="remove-variant-btn text-red-500 hover:bg-red-50 p-2 rounded-lg" data-index="${idx}">🗑️</button>
    </div>
  `).join('');

  container.querySelectorAll('.variant-row input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.index);
      const field = input.dataset.field;
      if (field === 'type') list[idx].type = input.value;
      else if (field === 'values') list[idx].values = input.value.split(',').map(s => s.trim()).filter(s => s);
      if (onChange) onChange(list);
    });
  });

  container.querySelectorAll('.remove-variant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      list.splice(idx, 1);
      renderVariantsUI(containerId, list, onChange);
      if (onChange) onChange(list);
    });
  });
}

function addVariant(list, containerId, onChange) {
  list.push({ type: '', values: [] });
  renderVariantsUI(containerId, list, onChange);
  if (onChange) onChange(list);
}

function initAddVariants() {
  variantsList = [];
  renderVariantsUI('variantsContainer', variantsList);
  document.getElementById('addVariantBtn')?.addEventListener('click', () => {
    addVariant(variantsList, 'variantsContainer');
  });
}

function initEditVariants() {
  editVariantsList = [];
  renderVariantsUI('editVariantsContainer', editVariantsList);
  document.getElementById('editAddVariantBtn')?.addEventListener('click', () => {
    addVariant(editVariantsList, 'editVariantsContainer');
  });
}

// ===============================================
//           ANALYTICS TRACKING
// ===============================================

async function trackProductSearch(query) {
  if (!query || query.trim().length < 2) return;
  
  const analytics = await getSearchAnalytics();
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
  
  await saveSearchAnalytics(analytics);
}

async function trackSearchResults(query, resultCount) {
  if (!query || query.trim().length < 2) return;
  
  const analytics = await getSearchAnalytics();
  const normalizedQuery = query.trim().toLowerCase();
  
  if (analytics[normalizedQuery]) {
    analytics[normalizedQuery].results = resultCount;
    await saveSearchAnalytics(analytics);
  }
  
  if (resultCount === 0) {
    const failedSearches = await getFailedSearches();
    const existingIndex = failedSearches.findIndex(fs => fs.query.toLowerCase() === normalizedQuery);
    
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
    
    await saveFailedSearches(failedSearches);
  }
}

async function trackProductView(productId) {
  if (!productId) return;
  
  const analytics = await getViewAnalytics();
  
  if (!analytics[productId]) {
    analytics[productId] = {
      count: 0,
      firstViewed: new Date().toISOString(),
      lastViewed: new Date().toISOString()
    };
  }
  
  analytics[productId].count++;
  analytics[productId].lastViewed = new Date().toISOString();
  
  await saveViewAnalytics(analytics);
}

// ===============================================
//           ORDER MANAGEMENT
// ===============================================

async function renderOrderList() {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;
  
  let orders = await getOrders();
  const searchQuery = document.getElementById('orderSearchInput')?.value.trim().toLowerCase() || '';
  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  
  if (searchQuery) {
    orders = orders.filter(o => 
      o.id.toLowerCase().includes(searchQuery) ||
      o.customer.toLowerCase().includes(searchQuery) ||
      o.phone.includes(searchQuery)
    );
  }
  
  if (statusFilter !== 'all') {
    orders = orders.filter(o => (o.status || 'pending') === statusFilter);
  }
  
  await updateOrderStats();
  
  if (!orders.length) {
    container.innerHTML = '<p class="text-center text-slate-400 py-8">No orders found.</p>';
    return;
  }
  
  container.innerHTML = orders.map(order => {
    const status = order.status || 'pending';
    const statusColors = {
      pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: '🟡', text: 'Pending' },
      confirmed: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', icon: '🟢', text: 'Confirmed' },
      processing: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🔵', text: 'Processing' },
      completed: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✅', text: 'Completed' },
      cancelled: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', icon: '❌', text: 'Cancelled' }
    };
    const colors = statusColors[status] || statusColors.pending;
    
    return `
      <div class="${colors.bg} ${colors.border} border rounded-2xl p-5 transition-all hover:shadow-md">
        <div class="flex flex-col md:flex-row justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-3">
              <span class="font-mono font-bold text-lg">#${order.id}</span>
              <span class="${colors.badge} px-3 py-1 rounded-full text-xs font-bold">${colors.icon} ${colors.text}</span>
              ${status === 'pending' ? '<span class="text-xs text-yellow-600 animate-pulse">New Order!</span>' : ''}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <p class="text-xs text-gray-500 uppercase font-bold">Customer</p>
                <p class="font-semibold">${order.customer}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase font-bold">Contact</p>
                <p class="text-sm">📱 ${order.phone}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase font-bold">Date</p>
                <p class="text-sm">${new Date(order.date).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                })}</p>
              </div>
            </div>
            
            <div class="mb-3">
              <p class="text-xs text-gray-500 uppercase font-bold mb-1">Address</p>
              <p class="text-sm">📍 ${order.address}</p>
            </div>
            
            <div class="mb-3">
              <p class="text-xs text-gray-500 uppercase font-bold mb-2">Items (${order.items.length})</p>
              <div class="space-y-1">
                ${order.items.map(item => `
                  <div class="flex justify-between text-sm bg-white/50 rounded-lg px-3 py-1.5">
                    <span>${item.name} <span class="text-gray-400">x${item.qty}</span></span>
                    <span class="font-medium">FCFA${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="flex items-center justify-between">
              <p class="text-xl font-bold">Total: FCFA${order.total.toFixed(2)}</p>
              
              <a href="https://wa.me/${order.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(order.customer)}!%20About%20your%20order%20%23${order.id}" 
                 target="_blank"
                 class="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-green-600 transition-colors">
                <i class="fab fa-whatsapp"></i> Contact
              </a>
            </div>
          </div>
          
          <div class="md:w-64 flex flex-col gap-2">
            <p class="text-xs text-gray-500 uppercase font-bold">Update Status</p>
            <button onclick="updateOrderStatus('${order.id}', 'confirmed')" 
                    class="w-full bg-green-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors ${status === 'confirmed' ? 'ring-2 ring-offset-2 ring-green-500' : ''}">
              🟢 Confirm Order
            </button>
            <button onclick="updateOrderStatus('${order.id}', 'processing')" 
                    class="w-full bg-blue-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors ${status === 'processing' ? 'ring-2 ring-offset-2 ring-blue-500' : ''}">
              🔵 Mark as Processing
            </button>
            <button onclick="updateOrderStatus('${order.id}', 'completed')" 
                    class="w-full bg-emerald-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors ${status === 'completed' ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}">
              ✅ Mark as Completed
            </button>
            <button onclick="updateOrderStatus('${order.id}', 'cancelled')" 
                    class="w-full bg-red-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors ${status === 'cancelled' ? 'ring-2 ring-offset-2 ring-red-500' : ''}">
              ❌ Cancel Order
            </button>
            
            <div class="mt-2 p-3 bg-gray-100 rounded-xl">
              <p class="text-xs text-gray-500 mb-1">Tracking Link</p>
              <div class="flex gap-2">
                <input type="text" value="${window.location.origin}${window.location.pathname.replace('admin.html', '')}track.html?order=${order.id}" 
                       class="flex-1 text-xs bg-white border rounded-lg px-2 py-1" readonly />
                <button onclick="copyTrackingLinkAdmin('${order.id}', this)" 
                        class="bg-primary text-white px-3 py-1 rounded-lg text-xs hover:bg-primaryHover transition-colors">
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  const orders = await getOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    showToast('Order not found');
    return;
  }
  
  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  
  if (confirm(`Change order #${orderId} status to "${statusLabels[newStatus]}"?`)) {
    orders[orderIndex].status = newStatus;
    localStorage.setItem(STORAGE.ORDERS, JSON.stringify(orders));
    
    // Update in Supabase
    await updateOrderStatusInDB(orderId, newStatus);
    
    showToast(`Order #${orderId} marked as ${statusLabels[newStatus]}`);
    renderOrderList();
    renderAnalytics();
  }
}

async function updateOrderStats() {
  const orders = await getOrders();
  
  const counts = {
    pending: orders.filter(o => (o.status || 'pending') === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  };
  
  document.getElementById('pendingOrdersCount').textContent = counts.pending;
  document.getElementById('confirmedOrdersCount').textContent = counts.confirmed;
  document.getElementById('processingOrdersCount').textContent = counts.processing;
  document.getElementById('completedOrdersCount').textContent = counts.completed;
  document.getElementById('cancelledOrdersCount').textContent = counts.cancelled;
}

window.copyTrackingLinkAdmin = function(orderId, btn) {
  const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
  const link = `${baseUrl}track.html?order=${orderId}`;
  
  navigator.clipboard.writeText(link).then(() => {
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('bg-green-500');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('bg-green-500');
    }, 1500);
  });
  showToast('Tracking link copied!');
};

// ===============================================
//           CUSTOMER MANAGEMENT
// ===============================================

async function renderCustomerList() {
  const container = document.getElementById('customerListContainer');
  if (!container) return;
  
  let customers = await getCustomers();
  const searchQuery = document.getElementById('customerSearchInput')?.value?.trim()?.toLowerCase() || '';
  const orders = await getOrders();
  
  if (searchQuery) {
    customers = customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery) ||
      c.email.toLowerCase().includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery))
    );
  }
  
  await updateCustomerStats(customers, orders);
  
  if (!customers.length) {
    container.innerHTML = '<p class="text-center text-slate-400 py-8">No customers found.</p>';
    return;
  }
  
  customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  container.innerHTML = customers.map(customer => {
    const customerOrders = orders.filter(o => {
      const orderName = (o.customer || '').toLowerCase();
      const custName = (customer.name || '').toLowerCase();
      const custPhone = (customer.phone || '').replace(/\D/g, '');
      const orderPhone = (o.phone || '').replace(/\D/g, '');
      return orderName.includes(custName) || custName.includes(orderName) || 
             (custPhone && orderPhone && orderPhone.includes(custPhone)) ||
             (customer.email && o.email && o.email.toLowerCase() === customer.email.toLowerCase());
    });
    
    const totalSpent = customerOrders.reduce((sum, o) => sum + o.total, 0);
    const lastOrder = customerOrders.length > 0 ? customerOrders[0] : null;
    
    return `
      <div class="border rounded-2xl p-5 bg-white hover:shadow-md transition-all">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
            ${customer.name.charAt(0).toUpperCase()}
          </div>
          
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-bold text-lg">${customer.name}</h4>
                <p class="text-sm text-gray-500 flex items-center gap-2">
                  <i class="fas fa-envelope text-xs"></i> ${customer.email}
                </p>
                ${customer.phone ? `
                  <p class="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <i class="fas fa-phone text-xs"></i> ${customer.phone}
                  </p>
                ` : ''}
                ${customer.address ? `
                  <p class="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <i class="fas fa-map-marker-alt text-xs"></i> ${customer.address}
                  </p>
                ` : ''}
              </div>
              <span class="text-xs text-gray-400">
                Joined ${new Date(customer.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            <div class="grid grid-cols-3 gap-3 mt-4">
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-primary">${customerOrders.length}</p>
                <p class="text-xs text-gray-500">Orders</p>
              </div>
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-green-600">FCFA${totalSpent.toFixed(2)}</p>
                <p class="text-xs text-gray-500">Total Spent</p>
              </div>
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <p class="text-lg font-bold text-blue-600">
                  ${lastOrder ? new Date(lastOrder.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : 'N/A'}
                </p>
                <p class="text-xs text-gray-500">Last Order</p>
              </div>
            </div>
            
            ${customerOrders.length > 0 ? `
              <div class="mt-3 pt-3 border-t">
                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Recent Orders</p>
                <div class="space-y-1">
                  ${customerOrders.slice(0, 3).map(order => {
                    const status = order.status || 'pending';
                    const statusIcons = { pending:'🟡', confirmed:'🟢', processing:'🔵', completed:'✅', cancelled:'❌' };
                    return `
                      <div class="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                        <span class="font-mono text-xs">${order.id}</span>
                        <span>${statusIcons[status] || '🟡'} ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        <span class="font-medium">FCFA${order.total.toFixed(2)}</span>
                        <a href="track.html?order=${order.id}" target="_blank" class="text-primary text-xs hover:underline">Track</a>
                      </div>
                    `;
                  }).join('')}
                  ${customerOrders.length > 3 ? `<p class="text-xs text-gray-400 text-center">+ ${customerOrders.length - 3} more orders</p>` : ''}
                </div>
              </div>
            ` : ''}
            
            <div class="flex gap-2 mt-3 pt-3 border-t">
              ${customer.phone ? `
                <a href="https://wa.me/${customer.phone.replace(/\D/g,'')}" target="_blank" 
                   class="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors">
                  <i class="fab fa-whatsapp mr-1"></i> WhatsApp
                </a>
              ` : ''}
              <a href="mailto:${customer.email}" 
                 class="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors">
                <i class="fas fa-envelope mr-1"></i> Email
              </a>
              <button onclick="deleteCustomer('${customer.id}', '${customer.name}')" 
                      class="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors ml-auto">
                <i class="fas fa-trash mr-1"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateCustomerStats(customers, orders) {
  document.getElementById('totalCustomersStat').textContent = customers.length;
  
  const activeCustomers = customers.filter(c => {
    return orders.some(o => {
      const orderName = (o.customer || '').toLowerCase();
      const custName = (c.name || '').toLowerCase();
      return orderName.includes(custName) || custName.includes(orderName);
    });
  });
  document.getElementById('activeCustomersStat').textContent = activeCustomers.length;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newCustomers = customers.filter(c => new Date(c.createdAt) >= startOfMonth);
  document.getElementById('newCustomersStat').textContent = newCustomers.length;
}

async function deleteCustomer(customerId, customerName) {
  if (!confirm(`Delete customer "${customerName}"? This cannot be undone.`)) return;
  
  const accounts = await getCustomers();
  const updatedAccounts = accounts.filter(a => a.id !== customerId);
  await saveCustomers(updatedAccounts);
  
  showToast(`Customer "${customerName}" deleted`);
  renderCustomerList();
}

// Shop Photo Upload
document.getElementById('shopPhotoUpload')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const previewImg = document.getElementById('shopPhotoPreviewImg');
      previewImg.src = ev.target.result;
      previewImg.classList.remove('hidden');
      document.getElementById('shopPhotoDataField').value = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// ===============================================
//           DEALS FUNCTIONS
// ===============================================

async function saveDealForProduct(productId, discount) {
  const cleanDiscount = Number(discount);
  if (!Number.isFinite(cleanDiscount) || cleanDiscount < 1 || cleanDiscount > 95) {
    showToast("Discount must be between 1 and 95");
    return;
  }
  const deals = (await getDealsOfToday()).filter(d => d.id !== productId);
  deals.push({ id: productId, discount: cleanDiscount });
  await setDealsOfToday(deals);
  showToast("Deal of the day saved");
  refreshAll();
}

async function removeDealForProduct(productId, silent = false) {
  const deals = (await getDealsOfToday()).filter(d => d.id !== productId);
  await setDealsOfToday(deals);
  if (!silent) {
    showToast("Deal removed");
    refreshAll();
  }
}

async function toggleFeatured(id) {
  let ids = await getFeaturedIds();
  if (ids.includes(id)) {
    ids = ids.filter(i => i !== id);
    showToast("Removed from Featured");
  } else {
    ids.push(id);
    showToast("Added to Featured");
  }
  await setFeaturedIds(ids);
  refreshAll();
}

// ===============================================
//                    INIT
// ===============================================

async function init() {
  GLOBAL_PRODUCTS = await getProducts();
  
  if (!localStorage.getItem(STORAGE.PRODUCTS)) {
    localStorage.setItem(STORAGE.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    GLOBAL_PRODUCTS = DEFAULT_PRODUCTS;
  }
  
  const existingFeatured = await getFeaturedIds();
  if (!existingFeatured.length && GLOBAL_PRODUCTS.length) {
    await setFeaturedIds([GLOBAL_PRODUCTS[0].id]);
  }

  const cloudProducts = await loadAdminFromSupabase();
  if (cloudProducts) {
    console.log('📦 Loaded from cloud');
    GLOBAL_PRODUCTS = cloudProducts;
  } else {
    console.log('📦 Using local storage');
  }
  
  refreshAll();

  loadBusinessForm();

  document.getElementById('searchInput').addEventListener('input', async (e) => {
    currentSearch = e.target.value;
    currentPage = 1;
    
    const query = e.target.value.trim();
    if (query) {
      await trackProductSearch(query);
      const products = await getProducts();
      const results = products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
      ).length;
      await trackSearchResults(query, results);
    }
    
    renderAllProducts();
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    renderAllProducts();
  });

  document.getElementById('productListSearchBtn')?.addEventListener('click', () => {
    adminProductSearch = document.getElementById('productListSearchInput')?.value || '';
    document.getElementById('productListSearchSuggestions')?.classList.add('hidden');
    renderProductListAdmin();
  });

  document.getElementById('productListSearchInput')?.addEventListener('input', (e) => {
    adminProductSearch = e.target.value || '';
    renderAdminSearchSuggestions(e.target.value || '');
    renderProductListAdmin();
  });

  document.getElementById('productListSearchInput')?.addEventListener('focus', (e) => {
    renderAdminSearchSuggestions(e.target.value || '');
  });

  document.getElementById('productListSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    adminProductSearch = e.target.value || '';
    document.getElementById('productListSearchSuggestions')?.classList.add('hidden');
    renderProductListAdmin();
  });

  document.addEventListener('click', (e) => {
    const input = document.getElementById('productListSearchInput');
    const box = document.getElementById('productListSearchSuggestions');
    if (!input || !box) return;
    if (input.contains(e.target) || box.contains(e.target)) return;
    box.classList.add('hidden');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      let view = btn.dataset.view;
      document.querySelectorAll('.admin-panel-section').forEach(sec =>
        sec.classList.remove('active-section')
      );
      document.getElementById(view + 'Section').classList.add('active-section');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'dashboard') renderAnalytics();
      if (view === 'productList') renderProductListAdmin();
      if (view === 'featuredProduct') populateFeaturedSelect();
      if (view === 'businessInfo') loadBusinessForm();
      if (view === 'contactPage') loadContactForm();
      if (view === 'reviews') {
        populateReviewFilters();
        renderReviewsList();
      }
      if (view === 'analyticsDashboard') {
        renderAnalyticsDashboard();
      }
      if (view === 'ordersManagement') {
        renderOrderList();
      }
      if (view === 'customerManagement') {
        renderCustomerList();
      }
    });
  });

  document.getElementById('homeSection').classList.add('active-section');
  document.querySelector('.nav-btn[data-view="home"]').classList.add('active');
  loadBusinessForm();
  loadContactForm();
  initAddVariants();
  initEditVariants();
}

init();