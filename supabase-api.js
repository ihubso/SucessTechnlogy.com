// supabase-api.js - ShopBoss Database Operations
// Uses getSupabase() from supabase-config.js

// supabase-api.js - With better error handling and column name mapping

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
      console.error('Error details:', error);
      return null;
    }
    
    console.log('✅ Product saved to Supabase!');
    return data ? data[0] : null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function createOrderInDB(order) {
  const client = getSupabase();
  if (!client) return null;
  
  try {
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
      console.error('❌ Error creating order:', error.message);
      return null;
    }
    return data ? data[0] : null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function updateOrderStatusInDB(orderId, status) {
  const client = getSupabase();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select();
    
    if (error) {
      console.error('❌ Error updating order:', error.message);
      return null;
    }
    return data ? data[0] : null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function fetchDealsFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('deals')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching deals:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveDealToDB(productId, discount) {
  const client = getSupabase();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('deals')
      .upsert({ product_id: productId, discount }, { onConflict: 'product_id' })
      .select();
    
    if (error) {
      console.error('❌ Error saving deal:', error.message);
      return null;
    }
    return data ? data[0] : null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function getOrdersFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching orders:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

// --- Cart
async function fetchCartFromDB(sessionId) {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('cart')
      .select('*')
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('❌ Error fetching cart:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveCartToDB(sessionId, cart) {
  const client = getSupabase();
  if (!client) return;
  
  try {
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
      const { error } = await client.from('cart').insert(rows);
      if (error) {
        console.error('❌ Error saving cart:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Wishlist
async function fetchWishlistFromDB(sessionId) {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('wishlist')
      .select('product_id')
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('❌ Error fetching wishlist:', error.message);
      return [];
    }
    return (data || []).map(row => row.product_id);
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveWishlistToDB(sessionId, wishlist) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    await client.from('wishlist').delete().eq('session_id', sessionId);
    
    if (wishlist.length > 0) {
      const rows = wishlist.map(pid => ({ 
        session_id: sessionId, 
        product_id: pid 
      }));
      const { error } = await client.from('wishlist').insert(rows);
      if (error) {
        console.error('❌ Error saving wishlist:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Reviews
async function fetchReviewsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  
  try {
    const { data, error } = await client.from('reviews').select('*');
    
    if (error) {
      console.error('❌ Error fetching reviews:', error.message);
      return {};
    }
    
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
  } catch (err) {
    console.error('❌ Error:', err.message);
    return {};
  }
}

async function saveReviewsToDB(reviews) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    // Flatten all reviews for upsert
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
    
    // Clear all and re-insert
    await client.from('reviews').delete().neq('id', -1);
    if (rows.length > 0) {
      const { error } = await client.from('reviews').insert(rows);
      if (error) {
        console.error('❌ Error saving reviews:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Business Info
async function fetchBusinessInfoFromDB() {
  const client = getSupabase();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('business_info')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('❌ Error fetching business info:', error.message);
      return null;
    }
    
    if (data) {
      // Map snake_case DB columns to camelCase for app
      return {
        shopName: data.shop_name || 'ShopBoss',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        facebook: data.facebook || '',
        instagram: data.instagram || '',
        tiktok: data.tiktok || ''
      };
    }
    return null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function saveBusinessInfoToDB(info) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    const { error } = await client
      .from('business_info')
      .upsert({ 
        id: 1, 
        shop_name: info.shopName,
        email: info.email,
        phone: info.phone,
        address: info.address,
        facebook: info.facebook || '',
        instagram: info.instagram || '',
        tiktok: info.tiktok || ''
      });
    
    if (error) {
      console.error('❌ Error saving business info:', error.message);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Contact Info
async function fetchContactInfoFromDB() {
  const client = getSupabase();
  if (!client) return null;
  
  try {
    const { data, error } = await client
      .from('contact_info')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('❌ Error fetching contact info:', error.message);
      return null;
    }
    
    if (data) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        hours: data.hours || '',
        description: data.description || '',
        shopPhoto: data.shop_photo || ''
      };
    }
    return null;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return null;
  }
}

async function saveContactInfoToDB(info) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    const { error } = await client
      .from('contact_info')
      .upsert({ 
        id: 1, 
        latitude: info.latitude,
        longitude: info.longitude,
        hours: info.hours || '',
        description: info.description || '',
        shop_photo: info.shopPhoto || ''
      });
    
    if (error) {
      console.error('❌ Error saving contact info:', error.message);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Featured Products
async function fetchFeaturedIdsFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('featured_products')
      .select('product_id');
    
    if (error) {
      console.error('❌ Error fetching featured:', error.message);
      return [];
    }
    return (data || []).map(row => row.product_id);
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveFeaturedIdsToDB(ids) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    await client.from('featured_products').delete().neq('product_id', '');
    if (ids.length > 0) {
      const rows = ids.map(id => ({ product_id: id }));
      const { error } = await client.from('featured_products').insert(rows);
      if (error) {
        console.error('❌ Error saving featured:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Search Analytics
async function fetchSearchAnalyticsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  
  try {
    const { data, error } = await client
      .from('search_analytics')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching search analytics:', error.message);
      return {};
    }
    
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
  } catch (err) {
    console.error('❌ Error:', err.message);
    return {};
  }
}

async function saveSearchAnalyticsToDB(analytics) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    const rows = Object.values(analytics).map(a => ({
      query: a.query,
      count: a.count,
      last_searched: a.lastSearched,
      results: a.results
    }));
    
    await client.from('search_analytics').delete().neq('query', '');
    if (rows.length > 0) {
      const { error } = await client.from('search_analytics').insert(rows);
      if (error) {
        console.error('❌ Error saving search analytics:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- View Analytics
async function fetchViewAnalyticsFromDB() {
  const client = getSupabase();
  if (!client) return {};
  
  try {
    const { data, error } = await client
      .from('view_analytics')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching view analytics:', error.message);
      return {};
    }
    
    const analytics = {};
    (data || []).forEach(row => {
      analytics[row.product_id] = {
        count: row.count,
        firstViewed: row.first_viewed,
        lastViewed: row.last_viewed
      };
    });
    return analytics;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return {};
  }
}

async function saveViewAnalyticsToDB(analytics) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    const rows = Object.entries(analytics).map(([product_id, data]) => ({
      product_id,
      count: data.count,
      first_viewed: data.firstViewed,
      last_viewed: data.lastViewed
    }));
    
    await client.from('view_analytics').delete().neq('product_id', '');
    if (rows.length > 0) {
      const { error } = await client.from('view_analytics').insert(rows);
      if (error) {
        console.error('❌ Error saving view analytics:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Failed Searches
async function fetchFailedSearchesFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('failed_searches')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching failed searches:', error.message);
      return [];
    }
    return (data || []).map(row => ({
      query: row.query,
      count: row.count,
      lastSearched: row.last_searched
    }));
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveFailedSearchesToDB(failed) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    await client.from('failed_searches').delete().neq('query', '');
    if (failed.length > 0) {
      const { error } = await client.from('failed_searches').insert(failed);
      if (error) {
        console.error('❌ Error saving failed searches:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// --- Customer Accounts
async function fetchCustomersFromDB() {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data, error } = await client
      .from('customer_accounts')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching customers:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ Error:', err.message);
    return [];
  }
}

async function saveCustomersToDB(customers) {
  const client = getSupabase();
  if (!client) return;
  
  try {
    await client.from('customer_accounts').delete().neq('id', '');
    if (customers.length > 0) {
      const { error } = await client.from('customer_accounts').insert(customers);
      if (error) {
        console.error('❌ Error saving customers:', error.message);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}
