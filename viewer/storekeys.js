

// ===============================================
//         DEALS HORIZONTAL SCROLL
// ===============================================
function initDealsScroll() {
  const dealsGrid = document.getElementById('dealsGrid');
  const prevBtn = document.getElementById('dealsPrevBtn');
  const nextBtn = document.getElementById('dealsNextBtn');
  const progressFill = document.getElementById('dealsProgressFill');
  if (!dealsGrid) return;
  
  function updateNavButtons() {
    if (!dealsGrid) return;
    const scrollLeft = dealsGrid.scrollLeft;
    const maxScroll = dealsGrid.scrollWidth - dealsGrid.clientWidth;
    if (prevBtn) prevBtn.classList.toggle('hidden', scrollLeft <= 0);
    if (nextBtn) nextBtn.classList.toggle('hidden', scrollLeft >= maxScroll - 1);
    if (progressFill) progressFill.style.width = `${(scrollLeft / maxScroll) * 100}%`;
  }
  
  function scrollLeft() {
    const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
    dealsGrid.scrollBy({ left: -(cardWidth + 24), behavior: 'smooth' });
  }
  function scrollRight() {
    const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
    dealsGrid.scrollBy({ left: cardWidth + 24, behavior: 'smooth' });
  }
  
  if (prevBtn) prevBtn.addEventListener('click', scrollLeft);
  if (nextBtn) nextBtn.addEventListener('click', scrollRight);
  dealsGrid.addEventListener('scroll', updateNavButtons);
  dealsGrid.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      dealsGrid.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  
  setTimeout(updateNavButtons, 100);
  window.addEventListener('resize', updateNavButtons);
  new MutationObserver(updateNavButtons).observe(dealsGrid, { childList: true, subtree: true });
}

async function renderDealsOfToday() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  
  const products = await getProducts();
  const dealItems = (await getDealsOfToday())
    .map(deal => {
      const product = products.find(p => p.id === deal.id);
      if (!product) return null;
      const discount = Math.max(1, Math.min(95, Number(deal.discount) || 0));
      const oldPrice = Number(product.price) || 0;
      const newPrice = oldPrice * (1 - discount / 100);
      return { product, discount, oldPrice, newPrice };
    })
    .filter(Boolean);
  
  if (!dealItems.length) {
    dealsGrid.innerHTML = '<p class="text-slate-500 text-center w-full py-8">No deals of today yet.</p>';
    const dealsSection = document.getElementById('deals-section');
    if (dealsSection) dealsSection.classList.add('hidden');
    return;
  }
  
  dealsGrid.style.opacity = '0';
  dealsGrid.innerHTML = dealItems.map(({ product, discount, oldPrice, newPrice }, index) => `
    <article class="product-card deal-card" data-product-id="${product.id}" style="animation-delay: ${index * 0.1}s">
      <div class="deal-badge">-${discount}%</div>
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <h3>${product.name}</h3>
      <div class="star-rating">${renderStars(getAverageRating(product.id))} (${getReviewCount(product.id)})</div>
      <p class="deal-old-price">FCFA ${oldPrice.toFixed(2)}</p>
      <div class="price-row">
        <strong class="deal-new-price">FCFA ${newPrice.toFixed(2)}</strong>
        <button data-add="${product.id}">Add to cart</button>
      </div>
    </article>
  `).join('');
  
  setTimeout(() => {
    dealsGrid.style.opacity = '1';
    dealsGrid.style.transition = 'opacity 0.5s ease';
  }, 50);
  
  attachCardEvents();
  setTimeout(() => initDealsScroll(), 100);
}


function startAutoScroll() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  stopAutoScroll();
  autoScrollInterval = setInterval(() => {
    const maxScroll = dealsGrid.scrollWidth - dealsGrid.clientWidth;
    if (dealsGrid.scrollLeft >= maxScroll - 1) {
      dealsGrid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const cardWidth = dealsGrid.querySelector('.product-card')?.offsetWidth || 280;
      dealsGrid.scrollBy({ left: cardWidth + 24, behavior: 'smooth' });
    }
  }, 4000);
}
function stopAutoScroll() { 
  if (autoScrollInterval) { clearInterval(autoScrollInterval); autoScrollInterval = null; } 
}
function initAutoScrollPause() {
  const dealsGrid = document.getElementById('dealsGrid');
  if (!dealsGrid) return;
  dealsGrid.addEventListener('mouseenter', stopAutoScroll);
  dealsGrid.addEventListener('mouseleave', startAutoScroll);
}
