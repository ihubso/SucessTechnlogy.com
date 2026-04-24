// products-shared.js - Pure Supabase API (Minimal localStorage - session only)

// ===============================================
//        SESSION MANAGEMENT (Only localStorage kept)
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

function getUserSessionKey() {
  const user = getCurrentUser();
  return user ? `user_${user.id}` : getSessionId();
}

// ===============================================
//        USER ACCOUNT (Memory-based)
// ===============================================
let _currentUser = null;

function getCurrentUser() {
  return _currentUser;
}

function setCurrentUser(user) {
  _currentUser = user || null;
  updateAccountUI();
}

function getReviewerName() {
  const user = getCurrentUser();
  return user ? user.name : '';
}

// ===============================================
//        IN-MEMORY CACHE
// ===============================================
const Cache = {
  products: null,
  reviews: null,
  deals: null,
  featured: null
};

// ===============================================
//        SUPABASE-BACKED DATA FUNCTIONS
// ===============================================
async function getProducts() {
  if (Cache.products) return Cache.products;
  const data = await fetchProductsFromDB();
  if (data && data.length > 0) {
    Cache.products = normalizeProductImages(data);
    return Cache.products;
  }
  Cache.products = normalizeProductImages(DEFAULT_PRODUCTS);
  await saveProducts(Cache.products);
  return Cache.products;
}

async function saveProducts(prods) {
  Cache.products = prods;
  try {
    const client = getSupabase();
    if (client) {
      for (const p of prods) {
        await client.from('products').upsert([p], { onConflict: 'id' });
      }
      const { data: allIds } = await client.from('products').select('id');
      const existingIds = (allIds || []).map(r => r.id);
      const toDelete = existingIds.filter(id => !prods.some(pp => pp.id === id));
      if (toDelete.length) await client.from('products').delete().in('id', toDelete);
    }
  } catch (e) {
    console.warn('Supabase save failed:', e);
  }
}

async function getCart() {
  const sessionKey = getUserSessionKey();
  return await fetchCartFromDB(sessionKey) || [];
}

async function saveCart(cart) {
  const sessionKey = getUserSessionKey();
  const safeCart = cart.map(item => ({
    product_id: item.product_id || item.id || '',
    name: item.name || 'Product',
    price: item.price || 0,
    qty: item.qty || 1,
    image: item.image || 'https://placehold.co/600x400'
  })).filter(item => item.product_id);
  
  await saveCartToDB(sessionKey, safeCart);
  renderCart();
}

async function getWishlist() {
  const sessionKey = getUserSessionKey();
  return await fetchWishlistFromDB(sessionKey) || [];
}

async function saveWishlist(wish) {
  const sessionKey = getUserSessionKey();
  await saveWishlistToDB(sessionKey, wish);
}

async function toggleWishlist(productId) {
  let wish = await getWishlist();
  if (wish.includes(productId)) {
    wish = wish.filter(id => id !== productId);
  } else {
    wish.push(productId);
  }
  await saveWishlist(wish);
  showToast(wish.includes(productId) ? "Added to wishlist" : "Removed from wishlist");
  await renderWishlistModal();
  await updateAllWishlistIcons();
}

async function getDealsOfToday() {
  if (Cache.deals) return Cache.deals;
  const deals = await fetchDealsFromDB();
  Cache.deals = (deals || []).map(d => ({ id: d.product_id, discount: d.discount }));
  return Cache.deals;
}

async function getReviews() {
  if (Cache.reviews) return Cache.reviews;
  Cache.reviews = await fetchReviewsFromDB() || {};
  return Cache.reviews;
}

async function saveReviews(reviews) {
  Cache.reviews = reviews;
  await saveReviewsToDB(reviews);
}

async function getProductReviews(productId) {
  let revs = await getReviews();
  return revs[productId] || [];
}

async function getAverageRating(productId) {
  let revs = await getProductReviews(productId);
  if (revs.length === 0) return 0;
  let sum = revs.reduce((s, r) => s + r.rating, 0);
  return sum / revs.length;
}

async function getReviewCount(productId) {
  let revs = await getProductReviews(productId);
  return revs.length;
}

async function getFeaturedIds() {
  if (Cache.featured) return Cache.featured;
  Cache.featured = await fetchFeaturedIdsFromDB() || [];
  return Cache.featured;
}

async function setFeaturedIds(ids) {
  Cache.featured = ids;
  await saveFeaturedIdsToDB(ids);
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
    shopName: "Sucess Technology", email: "hello@Sucess Technology.com", 
    phone: "+1 800 555 1234", address: "123 Commerce Street", 
    facebook: "", instagram: "", tiktok: "" 
  };
}

async function getContactInfo() {
  const data = await fetchContactInfoFromDB();
  return data || { 
    latitude: 40.7128, longitude: -74.0060, 
    hours: "", description: "", shopPhoto: "" 
  };
}

// ===============================================
//        ACCOUNT FUNCTIONS
// ===============================================
async function getAccounts() {
  return await fetchCustomersFromDB() || [];
}

async function saveAccounts(accounts) {
  await saveCustomersToDB(accounts);
}

async function mergeGuestDataToUser(userId) {
  const guestSessionId = getSessionId();
  const userSessionKey = `user_${userId}`;
  
  // Merge cart
  const guestCart = await fetchCartFromDB(guestSessionId) || [];
  const userCart = await fetchCartFromDB(userSessionKey) || [];
  
  if (guestCart.length > 0) {
    const mergedCart = [...userCart];
    guestCart.forEach(guestItem => {
      const existingIndex = mergedCart.findIndex(item => item.product_id === guestItem.product_id);
      if (existingIndex >= 0) {
        mergedCart[existingIndex].qty = (mergedCart[existingIndex].qty || 0) + (guestItem.qty || 1);
      } else {
        mergedCart.push({ ...guestItem, session_id: userSessionKey });
      }
    });
    
    const safeCart = mergedCart.map(item => ({
      product_id: item.product_id || '',
      name: item.name || 'Product',
      price: item.price || 0,
      qty: item.qty || 1,
      image: item.image || ''
    })).filter(item => item.product_id);
    
    await saveCartToDB(userSessionKey, safeCart);
    await saveCartToDB(guestSessionId, []);
  }
  
  // Merge wishlist
  const guestWishlist = await fetchWishlistFromDB(guestSessionId) || [];
  const userWishlist = await fetchWishlistFromDB(userSessionKey) || [];
  
  if (guestWishlist.length > 0) {
    const mergedWishlist = [...new Set([...userWishlist, ...guestWishlist])];
    await saveWishlistToDB(userSessionKey, mergedWishlist);
    await saveWishlistToDB(guestSessionId, []);
  }
}

async function handleRegister() {
  const name = document.getElementById('regName')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim()?.toLowerCase();
  const phone = document.getElementById('regPhone')?.value?.trim() || '';
  const address = document.getElementById('regAddress')?.value?.trim() || '';
  const password = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('regConfirmPassword')?.value;
  
  if (!name || !email || !password) { showToast("Please fill all required fields"); return; }
  if (password !== confirmPassword) { showToast("Passwords don't match"); return; }
  if (password.length < 4) { showToast("Password must be at least 4 characters"); return; }
  
  const accounts = await getAccounts();
  if (accounts.find(a => a.email === email)) { showToast("Email already registered"); return; }
  
  const newAccount = { 
    id: 'CUST-' + Date.now(), name, email, phone, address, password, 
    createdAt: new Date().toISOString() 
  };
  accounts.push(newAccount);
  await saveAccounts(accounts);
  
  const loggedInUser = { ...newAccount };
  delete loggedInUser.password;
  
  await mergeGuestDataToUser(newAccount.id);
  setCurrentUser(loggedInUser);
  closeModal('accountModal');
  showToast(`Welcome, ${name}! 🎉`);
  
  await renderCart();
  await updateAllWishlistIcons();
  await renderWishlistModal();
  updateAccountUI();
}

async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim()?.toLowerCase();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { showToast("Please fill all fields"); return; }
  
  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === email && a.password === password);
  if (!account) { showToast("Invalid email or password"); return; }
  
  const loggedInUser = { ...account };
  delete loggedInUser.password;
  
  await mergeGuestDataToUser(account.id);
  setCurrentUser(loggedInUser);
  closeModal('accountModal');
  showToast(`Welcome back, ${account.name}! 👋`);
  
  await renderCart();
  await updateAllWishlistIcons();
  await renderWishlistModal();
  updateAccountUI();
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    setCurrentUser(null);
    updateAccountUI();
    closeAccountDropdown();
    renderCart();
    renderWishlistModal();
    updateAllWishlistIcons();
    showToast('Logged out successfully');
  }
}

function updateAccountUI() {
  const user = getCurrentUser();
  const accountBtn = document.getElementById('accountBtn');
  if (!accountBtn) return;
  
  if (user) {
    accountBtn.innerHTML = `<div class="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">${user.name.charAt(0).toUpperCase()}</div>`;
    accountBtn.classList.add('logged-in');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginRegisterBtns = document.getElementById('loginRegisterBtns');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (loginRegisterBtns) loginRegisterBtns.classList.add('hidden');
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
  } else {
    accountBtn.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    accountBtn.classList.remove('logged-in');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginRegisterBtns = document.getElementById('loginRegisterBtns');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (loginRegisterBtns) loginRegisterBtns.classList.remove('hidden');
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownName) dropdownName.textContent = 'Guest';
    if (dropdownEmail) dropdownEmail.textContent = '';
  }
}

function closeAccountDropdown() {
  const dropdown = document.getElementById('accountDropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function showRegisterForm() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.remove('hidden');
}

function showLoginForm() {
  document.getElementById('registerForm')?.classList.add('hidden');
  document.getElementById('loginForm')?.classList.remove('hidden');
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
  
  updateAccountUI();
  dropdown.classList.toggle('hidden');
  
  if (!dropdown.classList.contains('hidden')) {
    setTimeout(() => {
      document.addEventListener('click', function closeDrop(e) {
        if (!dropdown.contains(e.target) && e.target.id !== 'accountBtn' && !e.target.closest('#accountBtn')) {
          dropdown.classList.add('hidden');
          document.removeEventListener('click', closeDrop);
        }
      });
    }, 100);
  }
};

async function viewMyOrders() {
  closeAccountDropdown();
  const user = getCurrentUser();
  if (!user) { showToast("Please login first"); return; }
  
  const orders = await getOrdersFromDB() || [];
  const myOrders = orders.filter(o => {
    const customerName = (o.customer_name || o.customer || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/\D/g, '');
    const orderPhone = (o.phone || '').replace(/\D/g, '');
    const nameMatch = customerName.includes(userName) || userName.includes(customerName);
    const phoneMatch = userPhone && orderPhone && (userPhone.includes(orderPhone) || orderPhone.includes(userPhone));
    const emailMatch = user.email && o.email && o.email.toLowerCase() === user.email.toLowerCase();
    return nameMatch || phoneMatch || emailMatch;
  });
  
  const overlayHTML = `
    <div id="myOrdersOverlay" class="orders-overlay">
      <div class="orders-overlay-backdrop" onclick="closeMyOrdersOverlay()"></div>
      <div class="orders-overlay-panel">
        <div class="orders-overlay-header">
          <h2>📋 My Orders (${myOrders.length})</h2>
          <button onclick="closeMyOrdersOverlay()" class="orders-overlay-close">✕</button>
        </div>
        <div class="orders-overlay-content">
          ${myOrders.length === 0 ? `
            <div class="text-center py-12">
              <span class="text-6xl mb-4 block">📦</span>
              <h3 class="text-xl font-bold mb-2">No Orders Yet</h3>
              <p class="text-gray-500">Start shopping to see your orders here!</p>
            </div>
          ` : myOrders.slice(0, 20).map(order => {
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
              <div class="${cfg.bg} rounded-2xl p-4 border ${cfg.border}">
                <div class="flex justify-between items-start mb-2">
                  <div><span class="font-mono font-bold">${order.id}</span><span class="${cfg.text} text-sm ml-2 font-medium">${cfg.icon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span></div>
                  <span class="font-bold text-lg">FCFA ${order.total.toFixed(2)}</span>
                </div>
                <p class="text-xs text-gray-500">📅 ${new Date(order.date || order.created_at).toLocaleDateString()}</p>
                <p class="text-xs text-gray-500">📍 ${order.address}</p>
                <div class="mt-2 text-sm flex flex-wrap gap-1">
                  ${(order.items || []).map(i => `<span class="bg-white/50 px-2 py-0.5 rounded-full text-xs">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <a href="track.html?order=${order.id}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-primary text-sm font-medium hover:underline bg-white/50 px-3 py-1 rounded-full">Track Order</a>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  const existing = document.getElementById('myOrdersOverlay');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', overlayHTML);
  document.body.style.overflow = 'hidden';
}

window.closeMyOrdersOverlay = function() {
  const overlay = document.getElementById('myOrdersOverlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
};

function autofillCheckoutFromAccount() {
  const user = getCurrentUser();
  if (!user) return;
  const nameInput = document.getElementById('custName');
  const phoneInput = document.getElementById('custPhone');
  const addrInput = document.getElementById('custAddr');
  if (nameInput) nameInput.value = user.name || '';
  if (phoneInput) phoneInput.value = user.phone || '';
  if (addrInput) addrInput.value = user.address || '';
}

// ===============================================
//        ANALYTICS TRACKING (Supabase)
// ===============================================
async function trackProductSearch(query) {
  if (!query || query.trim().length < 2) return;
  const analytics = await fetchSearchAnalyticsFromDB() || {};
  const normalizedQuery = query.trim().toLowerCase();
  if (!analytics[normalizedQuery]) {
    analytics[normalizedQuery] = { query: query.trim(), count: 0, lastSearched: new Date().toISOString(), results: 0 };
  }
  analytics[normalizedQuery].count++;
  analytics[normalizedQuery].lastSearched = new Date().toISOString();
  await saveSearchAnalyticsToDB(analytics);
}

async function trackSearchResults(query, resultCount) {
  if (!query || query.trim().length < 2) return;
  const analytics = await fetchSearchAnalyticsFromDB() || {};
  const normalizedQuery = query.trim().toLowerCase();
  if (analytics[normalizedQuery]) {
    analytics[normalizedQuery].results = resultCount;
    await saveSearchAnalyticsToDB(analytics);
  }
  if (resultCount === 0) {
    const failedSearches = await fetchFailedSearchesFromDB() || [];
    const existingIndex = failedSearches.findIndex(fs => fs.query.toLowerCase() === normalizedQuery);
    if (existingIndex !== -1) {
      failedSearches[existingIndex].count++;
      failedSearches[existingIndex].lastSearched = new Date().toISOString();
    } else {
      failedSearches.push({ query: query.trim(), count: 1, lastSearched: new Date().toISOString() });
    }
    await saveFailedSearchesToDB(failedSearches);
  }
}

async function trackProductView(productId) {
  if (!productId) return;
  const analytics = await fetchViewAnalyticsFromDB() || {};
  if (!analytics[productId]) {
    analytics[productId] = { count: 0, firstViewed: new Date().toISOString(), lastViewed: new Date().toISOString() };
  }
  analytics[productId].count++;
  analytics[productId].lastViewed = new Date().toISOString();
  await saveViewAnalyticsToDB(analytics);
}

// ===============================================
//        RECENTLY VIEWED (In-Memory Only)
// ===============================================
let _recentlyViewed = [];
const MAX_RECENT = 8;

function addToRecentlyViewed(productId) {
  _recentlyViewed = _recentlyViewed.filter(id => id !== productId);
  _recentlyViewed.unshift(productId);
  if (_recentlyViewed.length > MAX_RECENT) _recentlyViewed.pop();
}

function getRecentlyViewed() {
  return _recentlyViewed;
}

// ===============================================
//        HELPER FUNCTIONS
// ===============================================
function normalizeProductImages(products) {
  return products.map(p => ({ ...p, images: p.images && p.images.length ? p.images : [p.image] }));
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

function normalizeProductIdForUrl(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

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
//        WISHLIST ICONS & MODAL
// ===============================================
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

// ===============================================
//        PRODUCT DETAIL MODAL
// ===============================================
window.currentModalProductId = null;

async function openProductDetail(id) {
  window.currentModalProductId = id;
  addToRecentlyViewed(id);
  await trackProductView(id);
  updateBrowserUrl(id);
  await renderProductDetailModal(id);
  openModal('productModal');
  setTimeout(() => scrollModalToTop(), 100);
}

async function cleanCloseProductModal(updateUrl = true) {
  const modal = document.getElementById('productModal');
  const modalInner = document.getElementById('productDetailInner');
  if (!modal || !modalInner) return;
  
  modalInner.style.opacity = '0';
  modalInner.style.transform = 'scale(0.95)';
  modalInner.style.transition = 'all 0.3s ease';
  
  setTimeout(() => {
    modalInner.innerHTML = '';
    modalInner.style.opacity = '1';
    modalInner.style.transform = 'scale(1)';
    window.currentModalProductId = null;
    window.currentModalDealPrice = null;
    window.currentModalVariants = {};
    const qtyInput = document.getElementById('modalQtyInput');
    if (qtyInput) qtyInput.value = 1;
    modal.classList.add('hidden');
    if (updateUrl) cleanBrowserUrl();
  }, 200);
}

async function renderProductDetailModal(id) {
  const p = (await getProducts()).find(pr => pr.id === id);
  if (!p) { showToast("Product not found"); return; }

  const avgRating = await getAverageRating(id);
  const reviews = await getProductReviews(id);
  const isWished = (await getWishlist()).includes(id);
  const shareUrl = `${window.location.origin}${window.location.pathname}?product=${p.id}`;
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === id);
  const hasDeal = !!dealInfo;
  const discount = hasDeal ? dealInfo.discount : 0;
  const originalPrice = p.price;
  const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;
  const allProducts = await getProducts();
  const related = allProducts.filter(prod => prod.id !== id && (prod.category === p.category || prod.brand === p.brand)).slice(0, 4);

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
      </div>`;
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
        <div class="flex flex-col sm:flex-row gap-3 mb-8">
          <button onclick="addToCartWithVariants('${p.id}')" class="flex-[2] ${hasDeal ? 'bg-primary' : 'bg-black'} text-white py-4 rounded-xl font-bold hover:bg-opacity-90 transition-all">
            ${hasDeal ? '🔥 Add Deal to Bag' : 'Add to Bag'}
          </button>
          <button onclick="copyProductLink('${id}', '${p.name}')" class="flex-1 bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
            <span>🔗</span> Copy Link
          </button>
          <button onclick="shareProduct('${shareUrl}', '${p.name}')" class="flex-1 bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            <span>📤</span> Share
          </button>
        </div>
      </div>
    </div>

    <!-- Reviews Section (same as before, kept for brevity) -->
    <div class="mt-8 border-t border-gray-200 pt-6">
      <h4 class="text-lg font-bold mb-4">⭐ Customer Reviews (${reviews.length})</h4>
      <div class="space-y-4 max-h-64 overflow-y-auto pr-2 mb-6">
        ${reviews.length ? reviews.map(r => `
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex justify-between items-start">
              <div><p class="font-semibold">${r.user}</p><div class="star-rating text-yellow-500 text-sm">${renderStars(r.rating)}</div></div>
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
      </div>` : `
      <div class="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 flex items-center gap-2">
        <i class="fas fa-check-circle"></i>
        <span>Reviewing as <strong>${getReviewerName()}</strong></span>
      </div>`}
      <div class="bg-gray-50 rounded-xl p-5">
        <h5 class="font-bold mb-3">✏️ Write a Review</h5>
        <div class="space-y-3">
          <input type="text" id="reviewUserName-${id}" placeholder="Your name" value="${getReviewerName()}" class="w-full border border-gray-200 rounded-lg p-2 text-sm" ${getCurrentUser() ? 'readonly style="background:#f0fdf4; border-color:#86efac;"' : ''} />
          <select id="reviewRating-${id}" class="w-full border border-gray-200 rounded-lg p-2 text-sm">
            <option value="5">★★★★★ (5)</option><option value="4">★★★★☆ (4)</option><option value="3">★★★☆☆ (3)</option><option value="2">★★☆☆☆ (2)</option><option value="1">★☆☆☆☆ (1)</option>
          </select>
          <textarea id="reviewComment-${id}" placeholder="Your review..." rows="3" class="w-full border border-gray-200 rounded-lg p-2 text-sm"></textarea>
          <button onclick="submitReview('${id}')" class="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primaryHover transition">Submit Review</button>
        </div>
      </div>
    </div>

    <!-- Related Products Section (kept for brevity) -->
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
            <div class="related-product-card group cursor-pointer opacity-0 transform translate-y-4" onclick="openProductDetail('${rp.id}')" style="animation: fadeInUp 0.5s ease forwards ${index * 0.1}s;">
              <div class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 mb-3 overflow-hidden border-2 border-transparent group-hover:border-primary/20 group-hover:shadow-lg transition-all duration-300 relative">
                <div class="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                  <button onclick="event.stopPropagation(); quickAddToCart('${rp.id}')" class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-primary hover:text-white transition-all text-sm" title="Add to cart"><i class="fas fa-shopping-cart"></i></button>
                  <button onclick="event.stopPropagation(); toggleWishlist('${rp.id}')" class="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all text-sm" title="Add to wishlist"><i class="far fa-heart"></i></button>
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
        ${related.length > 4 ? `<div class="text-center mt-6"><button onclick="toggleRelatedPanel()" class="inline-flex items-center gap-2 text-primary font-medium hover:underline"><span id="relatedPanelToggleText">View All ${related.length} Products</span><i class="fas fa-arrow-right"></i></button></div>` : ''}
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
    });
  });
}

// ===============================================
//        BROWSER URL MANAGEMENT
// ===============================================
function updateBrowserUrl(productId) {
  if (!productId) return;
  const baseUrl = window.location.origin + window.location.pathname;
  const newUrl = `${baseUrl}?product=${productId}`;
  if (window.history && window.history.pushState) {
    window.history.pushState({ productId: productId }, '', newUrl);
  }
}

function cleanBrowserUrl() {
  const baseUrl = window.location.origin + window.location.pathname;
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, baseUrl);
  }
}

// ===============================================
//        MODAL HELPERS
// ===============================================
window.toggleRelatedPanel = function() {
  const panel = document.getElementById('relatedProductsPanel');
  const btnText = document.getElementById('relatedPanelBtnText');
  const btnIcon = document.getElementById('relatedPanelBtnIcon');
  if (!panel || !btnText || !btnIcon) return;
  if (panel.style.maxHeight === '300px' || panel.style.maxHeight === '') {
    panel.style.maxHeight = '0px'; panel.style.opacity = '0';
    btnText.textContent = 'Show More'; btnIcon.style.transform = 'rotate(0deg)';
  } else {
    panel.style.maxHeight = '2000px'; panel.style.opacity = '1';
    btnText.textContent = 'Show Less'; btnIcon.style.transform = 'rotate(180deg)';
  }
};

function scrollModalToTop() {
  const modalContent = document.querySelector('.modalcontent');
  if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
}

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

// ===============================================
//        CART RENDERING
// ===============================================
async function renderCart() {
  let cart = await getCart();
  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.innerText = cart.reduce((s, i) => s + (i.qty || 0), 0);

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
    const itemPrice = item.price || 0;
    const itemQty = item.qty || 0;
    total += itemPrice * itemQty;
    return `
      <div class="cart-item flex justify-between items-center mb-4 border-b pb-2" data-cart-index="${index}">
        <div>
          <strong>${item.name || 'Product'}</strong><br>
          ${item.isDeal ? `
            <div>
              <small class="text-gray-400 line-through">FCFA ${(item.originalPrice || 0).toFixed(2)}</small>
              <small class="text-primary font-bold ml-2">FCFA ${itemPrice.toFixed(2)}</small>
              <span class="text-xs bg-primary text-white px-2 py-0.5 rounded-full ml-2">-${item.discount || 0}%</span>
            </div>
          ` : `<small>FCFA ${itemPrice.toFixed(2)}</small>`}
        </div>
        <div>
          <button class="cart-qty-dec px-2 bg-gray-200 rounded" data-index="${index}">-</button>
          <span class="mx-2">${itemQty}</span>
          <button class="cart-qty-inc px-2 bg-gray-200 rounded" data-index="${index}">+</button>
        </div>
      </div>`;
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

async function updateQtyByIndex(index, delta) {
  let cart = await getCart();
  if (index < 0 || index >= cart.length) return;
  let item = cart[index];
  const itemId = item.product_id || item.id;
  let products = await getProducts();
  let prod = products.find(p => p.id === itemId);
  let newQ = (item.qty || 0) + delta;
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

// ===============================================
//        ADD TO CART FUNCTIONS
// ===============================================
window.addToCart = async function (id, qty = 1, variants = {}) {
  let products = await getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) { showToast("Out of stock"); return; }
  let cart = await getCart();
  let existing = cart.find(i => (i.product_id === id || i.id === id) && JSON.stringify(i.variants || {}) === JSON.stringify(variants));
  if (existing) {
    if ((existing.qty || 0) + qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    existing.qty = (existing.qty || 0) + qty;
  } else {
    if (qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    cart.push({ product_id: id, id, name: product.name, price: product.price, qty, image: product.image, variants: variants || {} });
  }
  await saveCart(cart);
  showToast(`${product.name} added`);
};

window.addToCartWithDealPrice = async function(id, qty = 1, variants = {}, dealPrice, discount) {
  let products = await getProducts();
  let product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) { showToast("Out of stock"); return; }
  let cart = await getCart();
  let existing = cart.find(i => (i.product_id === id || i.id === id) && JSON.stringify(i.variants || {}) === JSON.stringify(variants));
  if (existing) {
    if ((existing.qty || 0) + qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    existing.qty = (existing.qty || 0) + qty;
  } else {
    if (qty > product.stock) { showToast(`Only ${product.stock} left`); return; }
    cart.push({ product_id: id, id, name: product.name, price: dealPrice, originalPrice: product.price, discount, qty, image: product.image, variants: variants || {}, isDeal: true });
  }
  await saveCart(cart);
  showToast(`${product.name} added at deal price!`);
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

window.clearCart = async function () { await saveCart([]); showToast("Cart cleared"); };
window.openCheckout = async function () {
  if ((await getCart()).length === 0) { showToast("Cart empty"); return; }
  closeModal('cartModal'); openModal('checkoutModal');
};

window.submitReview = async function(productId) {
  const user = getCurrentUser();
  let userName;
  if (user) { userName = user.name; }
  else {
    userName = document.getElementById(`reviewUserName-${productId}`).value.trim();
    if (!userName) { showToast("Please enter your name or login first"); return; }
  }
  const rating = document.getElementById(`reviewRating-${productId}`).value;
  const comment = document.getElementById(`reviewComment-${productId}`).value.trim();
  if (!comment) { showToast("Please write a review"); return; }
  await addReview(productId, userName, rating, comment);
  await renderProductDetailModal(productId);
  showToast("Thank you for your review!");
};

async function addReview(productId, userName, rating, comment) {
  if (!userName || !comment) { showToast("Please fill all review fields"); return; }
  let reviews = await getReviews();
  if (!reviews[productId]) reviews[productId] = [];
  reviews[productId].push({ id: Date.now(), user: userName, rating: parseInt(rating), comment, date: new Date().toLocaleDateString() });
  await saveReviews(reviews);
  if (!document.getElementById('productModal').classList.contains('hidden') && window.currentModalProductId === productId) {
    await renderProductDetailModal(productId);
  }
  showToast("Review added!");
}

window.shareProduct = async function (url, name) {
  if (navigator.share) {
    try { await navigator.share({ title: name, url: url }); } catch (e) { copyToClipboard(url); }
  } else { copyToClipboard(url); }
};

window.copyProductLink = async function(productId, productName) {
  const cleanUrl = `${window.location.origin}${window.location.pathname}?product=${productId}`;
  try {
    await navigator.clipboard.writeText(cleanUrl);
    showToast(`✅ Link copied! Share this product: ${productName}`);
  } catch (error) {
    const textArea = document.createElement('textarea');
    textArea.value = cleanUrl;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); showToast('✅ Link copied!'); } catch (err) { showToast('❌ Failed to copy link'); }
    document.body.removeChild(textArea);
  }
};

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast("Link copied!");
}

// ===============================================
//        EVENT LISTENERS
// ===============================================
window.addEventListener('popstate', (event) => {
  const modal = document.getElementById('productModal');
  if (event.state && event.state.productId) {
    const productId = event.state.productId;
    if (modal && modal.classList.contains('hidden')) openProductDetail(productId);
  } else {
    if (modal && !modal.classList.contains('hidden')) cleanCloseProductModal(false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const productModal = document.getElementById('productModal');
    if (productModal && !productModal.classList.contains('hidden')) cleanCloseProductModal(true);
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    if (e.target.id === 'productModal') cleanCloseProductModal(true);
    else e.target.classList.add('hidden');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  if (registerForm) { registerForm.addEventListener('submit', (e) => { e.preventDefault(); handleRegister(); }); }
  if (loginForm) { loginForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); }); }
  
  const closeProductModalBtn = document.getElementById('closeProductModal');
  if (closeProductModalBtn) closeProductModalBtn.onclick = () => cleanCloseProductModal(true);
  
  document.getElementById('checkoutModal')?.addEventListener('click', autofillCheckoutFromAccount);
  
  updateAccountUI();
});