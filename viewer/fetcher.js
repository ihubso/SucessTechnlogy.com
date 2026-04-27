
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
      // Only upsert/update - NEVER delete automatically
      for (const p of prods) {
        const { error } = await client
          .from('products')
          .upsert([p], { onConflict: 'id' });
        
        if (error) {
          console.warn('⚠️ Could not update product:', p.id, error.message);
        }
      }
      // REMOVED the automatic delete logic
      // Products should only be deleted manually from admin panel
    }
  } catch (e) {
    console.warn('Supabase save failed, products not persisted.');
  }
}
function getUserSessionKey() {
  const user = getCurrentUser();
  return user ? `user_${user.id}` : getSessionId();
}

async function getCart() { 
  const sessionKey = getUserSessionKey();
  return await fetchCartFromDB(sessionKey) || []; 
}
async function saveCart(cart) {
  const sessionKey = getUserSessionKey();
  
  console.log('💾 saveCart called with:', cart.length, 'items');
  if (cart.length > 0 && cart[0].variants) {
    console.log('💾 Variants present:', cart[0].variants);
  } else if (cart.length > 0) {
    console.log('⚠️ No variants in first cart item!');
  }
  
  // Ensure each cart item has required fields
  const safeCart = cart.map(item => ({
    product_id: item.product_id || item.id || '',
    id: item.product_id || item.id || '',
    name: item.name || 'Product',
    price: item.price || 0,
    qty: item.qty || 1,
    image: item.image || 'https://placehold.co/600x400',
    variants: item.variants || {}, // Make sure variants is passed through!
    isDeal: item.isDeal || false,
    originalPrice: item.originalPrice || null,
    discount: item.discount || null
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
  renderWishlistCount();
  updateAllWishlistIcons();
  renderWishlistModal();
}
// ===============================================
//   USER-SPECIFIC CART, WISHLIST & ORDERS
// ===============================================
async function mergeGuestDataToUser(userId) {
  const guestSessionId = getSessionId();
  const userSessionKey = `user_${userId}`;
  
  // Merge cart
  const guestCart = await fetchCartFromDB(guestSessionId) || [];
  const userCart = await fetchCartFromDB(userSessionKey) || [];
  
  if (guestCart.length > 0) {
    // Merge carts (add quantities for same products)
    const mergedCart = [...userCart];
    guestCart.forEach(guestItem => {
      const existingIndex = mergedCart.findIndex(item => 
        item.product_id === guestItem.product_id
      );
      if (existingIndex >= 0) {
        mergedCart[existingIndex].qty = (mergedCart[existingIndex].qty || 0) + (guestItem.qty || 1);
      } else {
        mergedCart.push({
          ...guestItem,
          session_id: userSessionKey
        });
      }
    });
    
    // Save merged cart to user session
    const safeCart = mergedCart.map(item => ({
      product_id: item.product_id || '',
      name: item.name || 'Product',
      price: item.price || 0,
      qty: item.qty || 1,
      image: item.image || ''
    })).filter(item => item.product_id);
    
    await saveCartToDB(userSessionKey, safeCart);
    
    // Clear guest cart
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
    shop_name: "Sucess Technology", 
    email: "hello@Sucess Technology.com", 
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
  // Always try Supabase first
  const cloudIds = await fetchFeaturedIdsFromDB();
  if (cloudIds && cloudIds.length > 0) {
    // Update localStorage cache
    localStorage.setItem(STORAGE.FEATURED, JSON.stringify(cloudIds));
    return cloudIds;
  }
  
  // Fallback to localStorage only if Supabase is empty
  const localIds = JSON.parse(localStorage.getItem(STORAGE.FEATURED) || '[]');
  return localIds;
}
async function setFeaturedIds(ids) {
  // Update localStorage as cache only
  localStorage.setItem(STORAGE.FEATURED, JSON.stringify(ids));
  
  // Save to Supabase
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
