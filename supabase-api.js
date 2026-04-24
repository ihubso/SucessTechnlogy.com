// supabase-api.js - ShopBoss Database Operations
// Uses getSupabase() from supabase-config.js

// supabase-api.js - With better error handling

async function fetchProductsFromDB() {
  const client = getSupabase();
  if (!client) {
    console.warn('⚠️ Supabase not available, skipping cloud fetch');
    return null;
  }
  
  try {
    const { data, error } = await client
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching products:', error.message);
      return null;
    }
    
    console.log(`✅ Fetched ${data.length} products from Supabase`);
    return data;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return null;
  }
}

async function addProductToDB(product) {
  const client = getSupabase();
  if (!client) {
    console.warn('⚠️ Supabase not available, saving to localStorage only');
    return null;
  }
  
  try {
    const { data, error } = await client
      .from('products')
      .insert([{
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category || 'phone',
        description: product.description || '',
        stock: product.stock || 0,
        image: product.image || 'https://placehold.co/600x400',
        images: product.images || [product.image],
        isHot: product.isHot || false,
        isNew: product.isNew || false,
        brand: product.brand || '',
        os: product.os || '',
        cpu: product.cpu || '',
        specs: product.specs || '',
        variants: product.variants || [],
        deliveryEstimate: product.deliveryEstimate || ''
      }])
      .select();
    
    if (error) {
      console.error('❌ Error saving to Supabase:', error.message);
      return null;
    }
    
    console.log('✅ Product saved to Supabase!');
    return data[0];
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function createOrderInDB(order) {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('orders')
    .insert([{
      id: order.id,
      customer_name: order.customer,
      phone: order.phone,
      address: order.address,
      email: order.email || '',
      items: order.items,
      total: order.total,
      status: 'pending'
    }])
    .select();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
  return data[0];
}

async function updateOrderStatusInDB(orderId, status) {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
  return data[0];
}

async function fetchDealsFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  const { data, error } = await client
    .from('deals')
    .select('*');
  
  if (error) return [];
  return data || [];
}

async function saveDealToDB(productId, discount) {
  const client = getSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('deals')
    .upsert({ product_id: productId, discount }, { onConflict: 'product_id' })
    .select();
  
  if (error) return null;
  return data[0];
}

async function getOrdersFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  const { data, error } = await client
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) return [];
  return data || [];
}
// --- Cart
async function fetchCartFromDB(sessionId) {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('cart').select('*').eq('session_id', sessionId);
  return data || [];
}

async function saveCartToDB(sessionId, cart) {
  const client = getSupabase();
  if (!client) return;
  // Replace whole cart for this session: delete then insert
  await client.from('cart').delete().eq('session_id', sessionId);
  if (cart.length > 0) {
    const rows = cart.map(item => ({
      session_id: sessionId,
      product_id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
      image: item.image
    }));
    await client.from('cart').insert(rows);
  }
}

// --- Wishlist
async function fetchWishlistFromDB(sessionId) {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('wishlist').select('product_id').eq('session_id', sessionId);
  return (data || []).map(row => row.product_id);
}

async function saveWishlistToDB(sessionId, wishlist) {
  const client = getSupabase();
  if (!client) return;
  await client.from('wishlist').delete().eq('session_id', sessionId);
  if (wishlist.length > 0) {
    const rows = wishlist.map(pid => ({ session_id: sessionId, product_id: pid }));
    await client.from('wishlist').insert(rows);
  }
}

// --- Reviews
async function fetchReviewsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  const { data } = await client.from('reviews').select('*');
  const reviews = {};
  (data || []).forEach(r => {
    if (!reviews[r.product_id]) reviews[r.product_id] = [];
    reviews[r.product_id].push({
      id: r.id,
      user: r.user_name,
      rating: r.rating,
      comment: r.comment,
      date: r.date
    });
  });
  return reviews;
}

async function saveReviewsToDB(reviews) {
  const client = getSupabase();
  if (!client) return;
  // Flatten and upsert all reviews (replace entire table for simplicity)
  const rows = [];
  Object.entries(reviews).forEach(([productId, productReviews]) => {
    productReviews.forEach(r => rows.push({
      id: r.id,
      product_id: productId,
      user_name: r.user,
      rating: r.rating,
      comment: r.comment,
      date: r.date
    }));
  });
  await client.from('reviews').delete().neq('id', -1); // clear all
  if (rows.length > 0) await client.from('reviews').insert(rows);
}

// --- Business Info
async function fetchBusinessInfoFromDB() {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.from('business_info').select('*').eq('id', 1).single();
  return data;
}

async function saveBusinessInfoToDB(info) {
  const client = getSupabase();
  if (!client) return;
  await client.from('business_info').upsert({ id: 1, ...info });
}

// --- Contact Info
async function fetchContactInfoFromDB() {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.from('contact_info').select('*').eq('id', 1).single();
  return data;
}

async function saveContactInfoToDB(info) {
  const client = getSupabase();
  if (!client) return;
  await client.from('contact_info').upsert({ id: 1, ...info });
}

// --- Featured Products
async function fetchFeaturedIdsFromDB() {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('featured_products').select('product_id');
  return (data || []).map(row => row.product_id);
}

async function saveFeaturedIdsToDB(ids) {
  const client = getSupabase();
  if (!client) return;
  await client.from('featured_products').delete().neq('product_id', '');
  if (ids.length > 0) {
    const rows = ids.map(id => ({ product_id: id }));
    await client.from('featured_products').insert(rows);
  }
}

// --- Deals (already in supabase-api.js: fetchDealsFromDB, saveDealToDB; we'll adjust slightly)
// Ensure fetchDealsFromDB returns array of { product_id, discount } and saveDealToDB already works with upsert.

// --- Search Analytics
async function fetchSearchAnalyticsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  const { data } = await client.from('search_analytics').select('*');
  const analytics = {};
  (data || []).forEach(row => {
    analytics[row.query] = {
      query: row.query,
      count: row.count,
      lastSearched: row.last_searched,
      results: row.results
    };
  });
  return analytics;
}

async function saveSearchAnalyticsToDB(analytics) {
  const client = getSupabase();
  if (!client) return;
  const rows = Object.values(analytics).map(a => ({
    query: a.query,
    count: a.count,
    last_searched: a.lastSearched,
    results: a.results
  }));
  // No easy upsert on query, so delete all and insert
  await client.from('search_analytics').delete().neq('query', '');
  if (rows.length > 0) await client.from('search_analytics').insert(rows);
}

// --- View Analytics
async function fetchViewAnalyticsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  const { data } = await client.from('view_analytics').select('*');
  const analytics = {};
  (data || []).forEach(row => {
    analytics[row.product_id] = {
      count: row.count,
      firstViewed: row.first_viewed,
      lastViewed: row.last_viewed
    };
  });
  return analytics;
}

async function saveViewAnalyticsToDB(analytics) {
  const client = getSupabase();
  if (!client) return;
  const rows = Object.entries(analytics).map(([product_id, data]) => ({
    product_id,
    count: data.count,
    first_viewed: data.firstViewed,
    last_viewed: data.lastViewed
  }));
  await client.from('view_analytics').delete().neq('product_id', '');
  if (rows.length > 0) await client.from('view_analytics').insert(rows);
}

// --- Failed Searches
async function fetchFailedSearchesFromDB() {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('failed_searches').select('*');
  return (data || []).map(row => ({
    query: row.query,
    count: row.count,
    lastSearched: row.last_searched
  }));
}

async function saveFailedSearchesToDB(failed) {
  const client = getSupabase();
  if (!client) return;
  await client.from('failed_searches').delete().neq('query', '');
  if (failed.length > 0) await client.from('failed_searches').insert(failed);
}

// --- Customer Accounts
async function fetchCustomersFromDB() {
  const client = getSupabase();
  if (!client) return [];
  const { data } = await client.from('customer_accounts').select('*');
  return data || [];
}

async function saveCustomersToDB(customers) {
  const client = getSupabase();
  if (!client) return;
  await client.from('customer_accounts').delete().neq('id', '');
  if (customers.length > 0) await client.from('customer_accounts').insert(customers);
}