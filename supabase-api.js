// supabase-api.js - ShopBoss Database Operations
// ===============================================
//               PRODUCTS CRUD
// ===============================================

// Fetch ALL products from Supabase
async function fetchProductsFromDB() {
  console.log('📡 Fetching products from Supabase...');
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching products:', error.message);
    return null;
  }
  
  console.log(`✅ Fetched ${data.length} products from Supabase`);
  return data;
}

// Add a new product to Supabase
async function addProductToDB(product) {
  console.log('📡 Adding product to Supabase...');
  const { data, error } = await supabase
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
    console.error('❌ Error adding product:', error.message);
    return null;
  }
  
  console.log('✅ Product added to Supabase:', data[0].name);
  return data[0];
}

// Update a product in Supabase
async function updateProductInDB(product) {
  console.log('📡 Updating product in Supabase...');
  const { data, error } = await supabase
    .from('products')
    .update({
      name: product.name,
      price: product.price,
      category: product.category,
      description: product.description,
      stock: product.stock,
      image: product.image,
      images: product.images,
      isHot: product.isHot,
      isNew: product.isNew,
      brand: product.brand,
      os: product.os,
      cpu: product.cpu,
      specs: product.specs,
      variants: product.variants,
      deliveryEstimate: product.deliveryEstimate
    })
    .eq('id', product.id)
    .select();
  
  if (error) {
    console.error('❌ Error updating product:', error.message);
    return null;
  }
  
  console.log('✅ Product updated in Supabase:', data[0].name);
  return data[0];
}

// Delete a product from Supabase
async function deleteProductFromDB(productId) {
  console.log('📡 Deleting product from Supabase...');
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  
  if (error) {
    console.error('❌ Error deleting product:', error.message);
    return false;
  }
  
  console.log('✅ Product deleted from Supabase');
  return true;
}

// ===============================================
//               ORDERS
// ===============================================

async function fetchOrdersFromDB() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching orders:', error.message);
    return [];
  }
  console.log(`✅ Fetched ${data.length} orders`);
  return data;
}

async function createOrderInDB(order) {
  console.log('📡 Creating order in Supabase...');
  const { data, error } = await supabase
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
  
  console.log('✅ Order created in Supabase:', data[0].id);
  return data[0];
}

async function updateOrderStatusInDB(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select();
  
  if (error) {
    console.error('❌ Error updating order:', error.message);
    return null;
  }
  
  console.log(`✅ Order ${orderId} status updated to ${status}`);
  return data[0];
}

// ===============================================
//               REVIEWS
// ===============================================

async function fetchReviewsFromDB(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching reviews:', error.message);
    return [];
  }
  return data;
}

async function addReviewToDB(review) {
  const { data, error } = await supabase
    .from('reviews')
    .insert([{
      id: review.id,
      product_id: review.productId,
      user_name: review.user,
      rating: review.rating,
      comment: review.comment
    }])
    .select();
  
  if (error) {
    console.error('❌ Error adding review:', error.message);
    return null;
  }
  
  console.log('✅ Review added to Supabase');
  return data[0];
}

// ===============================================
//               DEALS
// ===============================================

async function fetchDealsFromDB() {
  const { data, error } = await supabase
    .from('deals')
    .select('*');
  
  if (error) {
    console.error('❌ Error fetching deals:', error.message);
    return [];
  }
  return data;
}

async function saveDealToDB(productId, discount) {
  const { data, error } = await supabase
    .from('deals')
    .upsert({ product_id: productId, discount }, { onConflict: 'product_id' })
    .select();
  
  if (error) {
    console.error('❌ Error saving deal:', error.message);
    return null;
  }
  
  console.log('✅ Deal saved to Supabase');
  return data[0];
}

async function removeDealFromDB(productId) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('product_id', productId);
  
  if (error) {
    console.error('❌ Error removing deal:', error.message);
    return false;
  }
  
  console.log('✅ Deal removed from Supabase');
  return true;
}

// ===============================================
//               SYNC FUNCTIONS
// ===============================================

// Sync all products from Supabase to localStorage
async function syncProductsFromSupabase() {
  const products = await fetchProductsFromDB();
  if (products && products.length > 0) {
    localStorage.setItem('shop_products_v3', JSON.stringify(products));
    console.log(`✅ Synced ${products.length} products to localStorage`);
    return products;
  }
  return null;
}

// Initialize: Load products from Supabase on startup
async function initializeSupabaseData() {
  console.log('🔄 Initializing Supabase data...');
  
  // Try to get products from Supabase first
  const products = await syncProductsFromSupabase();
  
  if (products && products.length > 0) {
    console.log(`✅ Loaded ${products.length} products from Supabase`);
    return products;
  } else {
    console.log('⚠️ No products found in Supabase, using localStorage');
    return null;
  }
}
