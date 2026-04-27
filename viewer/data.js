// ===============================================
//         STATE & SORTING
// ===============================================
const SESSION_KEY = 'shop_session_id';
const RECENTLY_VIEWED_KEY = 'shop_recently_viewed';
const MAX_RECENT = 8;
const CURRENT_USER_KEY = 'shop_current_user';
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
// ===============================================
//        SUPABASE WRAPPERS (async replacements)
// ===============================================
let GLOBAL_PRODUCTS = null;
let _cachedReviews = null;
let currentPage = 1;
let itemsPerPage = 6;
let currentSort = "name_asc";
let currentCategory = "all";
let currentSearch = "";
let currentSidebarCategory = null;
let autoScrollInterval;
window.currentModalProductId = null;
// Add these to your existing state variables in data.js
let productsPerLoad = 20;        // How many to load at once
let loadedProductsCount = 0;      // How many we've loaded so far
let allProductsCache = [];        // Local cache of all loaded products
let isLoadingMore = false;        // Prevent duplicate loads
let hasMoreProducts = true;       // Are there more to load?
let infiniteScrollObserver = null; // Intersection Observer
let activeSection = 'all-products'; // Track which section is visible

function getSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}
