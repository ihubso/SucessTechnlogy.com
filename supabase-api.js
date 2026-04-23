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