// ===============================================
//               PRODUCT RENDERING (async)
// ===============================================
async function renderProductCard(p) {
  const wishlist = await getWishlist();
  const isWished = wishlist.includes(p.id);
  const avgRating = getAverageRating(p.id);
  const deals = await getDealsOfToday();
  const dealInfo = deals.find(d => d.id === p.id);
  const hasDeal = !!dealInfo;
  const discount = hasDeal ? dealInfo.discount : 0;
  const originalPrice = p.price;
  const discountedPrice = hasDeal ? originalPrice * (1 - discount / 100) : originalPrice;

  return `
    <article class="product-card" data-product-id="${p.id}">
      <div class="wishlist-icon ${isWished ? 'active' : ''}" data-wish="${p.id}">
        ${isWished ? '❤️' : '🤍'}
      </div>
      ${p.isNew ? '<div class="new-badge">NEW</div>' : ''}
      ${p.isHot ? '<div class="hot-badge">HOT</div>' : ''}
      ${hasDeal ? `<div class="deal-badge">-${discount}%</div>` : ''}
      <img src="${p.image}" alt="${p.name}" loading="lazy">
      <h3>${p.name}</h3>
      <div class="star-rating">${renderStars(avgRating)} (${getReviewCount(p.id)})</div>
      ${hasDeal ? `
        <p class="deal-old-price">FCFA ${originalPrice.toFixed(2)}</p>
        <div class="price-row">
          <strong class="deal-new-price">FCFA ${discountedPrice.toFixed(2)}</strong>
          <button data-add="${p.id}">Add</button>
        </div>
      ` : `
        <div class="price-row">
          <strong>FCFA ${p.price.toFixed(2)}</strong>
          <button data-add="${p.id}">Add to cart</button>
        </div>
      `}
    </article>
  `;
}

async function renderAllProducts() {
  const container = document.getElementById('productsGrid');
  if (!container) return;
  
  // Reset infinite scroll
  InfiniteScroll.reset();
  
  // Clear previous "end of products" message
  const endMsg = document.getElementById('endOfProducts');
  if (endMsg) endMsg.remove();
  
  // Get products and apply filters
  let products = await getProducts();
  
  if (currentSearch) {
    products = products.filter(p => 
      p.name.toLowerCase().includes(currentSearch.toLowerCase())
    );
  }
  if (currentCategory !== 'all') {
    products = products.filter(p => p.category === currentCategory);
  }
  
  // Sort products
  let sorted = getSortedProducts(products);
  
  // Calculate total pages
  InfiniteScroll.totalPages = Math.ceil(sorted.length / InfiniteScroll.pageSize);
  InfiniteScroll.currentPage = 1;
  
  // Get first page
  const firstPage = sorted.slice(0, InfiniteScroll.pageSize);
  
  // Render first batch
  if (firstPage.length > 0) {
    const cardsHtml = await Promise.all(firstPage.map(p => renderProductCard(p)));
    container.innerHTML = cardsHtml.join('');
    attachCardEvents();
  } else {
    container.innerHTML = '<div class="text-center py-10 col-span-full">No products found.</div>';
  }
  
  // Update count display
  const loadedCount = document.getElementById('loadedProductsCount');
  if (loadedCount) {
    loadedCount.textContent = `Showing ${firstPage.length} of ${sorted.length} products`;
  }
  
  // Setup scroll trigger for next batch
  InfiniteScroll.createSentinel();
  InfiniteScroll.setupObserver();
}
function renderPagination(totalPages) {
  let paginationDiv = document.getElementById('paginationControls');
  if (!paginationDiv) return;
  if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active-page' : ''}" data-page="${i}">${i}</button>`;
  }
  paginationDiv.innerHTML = html;
  
  document.querySelectorAll('.pagination-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderAllProducts();
    });
  });
}

async function renderHotProducts() {
  let prods = (await getProducts()).filter(p => p.isHot);
  const grid = document.getElementById('hotProductsGrid');
  if (!grid) return;
  const cards = await Promise.all(prods.map(p => renderProductCard(p)));
  grid.innerHTML = cards.join('');
  attachCardEvents();
}

async function renderNewProducts() {
  let prods = (await getProducts()).filter(p => p.isNew);
  const grid = document.getElementById('newProductsGrid');
  if (!grid) return;
  const cards = await Promise.all(prods.map(p => renderProductCard(p)));
  grid.innerHTML = cards.join('');
  attachCardEvents();
}

function renderRecentlyViewed() {
  const container = document.getElementById('recentlyViewedGrid');
  if (!container) return;
  
  const recentIds = getRecentlyViewed();
  if (!recentIds.length) {
    container.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No recently viewed products yet.</p>';
    return;
  }
  
  const products = GLOBAL_PRODUCTS || [];
  const recentProducts = recentIds.map(id => products.find(p => p.id === id)).filter(Boolean);
  
  if (recentProducts.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">No recently viewed products.</p>';
    return;
  }
  
  const displayProducts = recentProducts.slice(0, 4);
  Promise.all(displayProducts.map(p => renderProductCard(p))).then(cards => {
    container.innerHTML = cards.join('');
    attachCardEvents();
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'text-sm text-gray-400 hover:text-red-500 transition-colors mt-2 clear-recent-btn';
    clearBtn.innerHTML = 'Clear History';
    clearBtn.onclick = () => {
      localStorage.removeItem(RECENTLY_VIEWED_KEY);
      renderRecentlyViewed();
    };
    const parent = container.parentElement;
    const existingClearBtn = parent.querySelector('.clear-recent-btn');
    if (existingClearBtn) existingClearBtn.remove();
    parent.appendChild(clearBtn);
  });
}
