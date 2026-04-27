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
  ActionProgressBar.start();
  
  try {
    await saveCart([]);
    ActionProgressBar.complete();
    showToast("Cart cleared");
  } catch (e) {
    ActionProgressBar.error();
    console.error('Clear cart error:', e);
  }
};


window.openCheckout = async function () {
  if ((await getCart()).length === 0) {
    showToast("Cart empty");
    return;
  }
  closeModal('cartModal');
  openModal('checkoutModal');
};
