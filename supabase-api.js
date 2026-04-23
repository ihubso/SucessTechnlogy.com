// supabase-api.js - ShopBoss Database Operations

// ===============================================
//               PRODUCTS
// ===============================================
async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data;
}

async function addProductToDB(product) {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select();
  
  if (error) {
    console.error('Error adding product:', error);
    return null;
  }
  return data[0];
}

async function updateProductInDB(product) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', product.id)
    .select();
  
  if (error) {
    console.error('Error updating product:', error);
    return null;
  }
  return data[0];
}

async function deleteProductFromDB(productId) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  
  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }
  return true;
}

// ===============================================
//               ORDERS
// ===============================================
async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data;
}

async function createOrder(order) {
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
    console.error('Error creating order:', error);
    return null;
  }
  return data[0];
}

async function updateOrderStatusInDB(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select();
  
  if (error) {
    console.error('Error updating order:', error);
    return null;
  }
  return data[0];
}

// ===============================================
//               REVIEWS
// ===============================================
async function fetchReviews(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching reviews:', error);
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
    console.error('Error adding review:', error);
    return null;
  }
  return data[0];
}

// ===============================================
//               DEALS
// ===============================================
async function fetchDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('*');
  
  if (error) {
    console.error('Error fetching deals:', error);
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
    console.error('Error saving deal:', error);
    return null;
  }
  return data[0];
}

async function removeDealFromDB(productId) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('product_id', productId);
  
  if (error) {
    console.error('Error removing deal:', error);
    return false;
  }
  return true;
}

// ===============================================
//               WISHLIST
// ===============================================
async function fetchWishlist(userId) {
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching wishlist:', error);
    return [];
  }
  return data.map(w => w.product_id);
}

async function toggleWishlistInDB(userId, productId) {
  // Check if exists
  const { data: existing } = await supabase
    .from('wishlists')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();
  
  if (existing) {
    // Remove
    await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    return false; // removed
  } else {
    // Add
    await supabase
      .from('wishlists')
      .insert([{ user_id: userId, product_id: productId }]);
    return true; // added
  }
}