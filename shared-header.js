// shared-header.js - Shared header with Supabase account system for all pages
const CURRENT_USER_KEY = 'shop_current_user';

// ===============================================
//        SUPABASE ACCOUNT FUNCTIONS
// ===============================================

async function getBusinessInfo() {
  const data = await fetchBusinessInfoFromDB();
  return data || { 
    shopName: "Sucess Technology", 
    email: "hello@Sucess Technology.com", 
    phone: "+1234567890", 
    address: "123 Commerce St",
    facebook: "",
    instagram: "",
    tiktok: ""
  };
}

async function getAccounts() { 
  return await fetchCustomersFromDB() || []; 
}

async function saveAccounts(accounts) { 
  await saveCustomersToDB(accounts); 
}

function getCurrentUser() {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
  updateAccountUI();
}

// ===============================================
//           REGISTER / LOGIN / LOGOUT
// ===============================================

async function handleRegister() {
  const name = document.getElementById('regName')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim()?.toLowerCase();
  const phone = document.getElementById('regPhone')?.value?.trim() || '';
  const address = document.getElementById('regAddress')?.value?.trim() || '';
  const password = document.getElementById('regPassword')?.value;
  const confirmPassword = document.getElementById('regConfirmPassword')?.value;

  if (!name || !email || !password) {
    showToast("Please fill all required fields");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords don't match");
    return;
  }

  if (password.length < 4) {
    showToast("Password must be at least 4 characters");
    return;
  }

  const accounts = await getAccounts();
  
  if (accounts.find(a => a.email === email)) {
    showToast("Email already registered");
    return;
  }

  const newAccount = {
    id: 'CUST-' + Date.now(),
    name,
    email,
    phone,
    address,
    password,
    createdAt: new Date().toISOString()
  };

  accounts.push(newAccount);
  await saveAccounts(accounts);
  
  // Merge guest cart/wishlist if functions exist
  if (typeof mergeGuestDataToUser === 'function') {
    await mergeGuestDataToUser(newAccount.id);
  }
  
  const loggedInUser = { ...newAccount };
  delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  
  closeModal('accountModal');
  showToast(`Welcome, ${name}! 🎉`);
  
  // Refresh cart/wishlist if functions exist
  if (typeof renderCart === 'function') await renderCart();
  if (typeof renderWishlistModal === 'function') await renderWishlistModal();
}

async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim()?.toLowerCase();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showToast("Please fill all fields");
    return;
  }

  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === email && a.password === password);

  if (!account) {
    showToast("Invalid email or password");
    return;
  }

  // Merge guest cart/wishlist if functions exist
  if (typeof mergeGuestDataToUser === 'function') {
    await mergeGuestDataToUser(account.id);
  }

  const loggedInUser = { ...account };
  delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  
  closeModal('accountModal');
  showToast(`Welcome back, ${account.name}! 👋`);
  
  // Refresh cart/wishlist if functions exist
  if (typeof renderCart === 'function') await renderCart();
  if (typeof renderWishlistModal === 'function') await renderWishlistModal();
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem(CURRENT_USER_KEY);
    updateAccountUI();
    closeAccountDropdown();
    showToast('Logged out successfully');
    
    // Refresh cart/wishlist to show guest data
    if (typeof renderCart === 'function') renderCart();
    if (typeof renderWishlistModal === 'function') renderWishlistModal();
  }
}

function showRegisterForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm) loginForm.classList.add('hidden');
  if (registerForm) registerForm.classList.remove('hidden');
}

function showLoginForm() {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  if (registerForm) registerForm.classList.add('hidden');
  if (loginForm) loginForm.classList.remove('hidden');
}

function updateAccountUI() {
  const user = getCurrentUser();
  const accountBtn = document.getElementById('accountBtn');
  
  if (!accountBtn) return;

  if (user) {
    accountBtn.innerHTML = `
      <div class="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
        ${user.name.charAt(0).toUpperCase()}
      </div>
    `;
    accountBtn.classList.add('logged-in');
    
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginRegisterBtns = document.getElementById('loginRegisterBtns');
    
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (loginRegisterBtns) loginRegisterBtns.classList.add('hidden');
  } else {
    accountBtn.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    accountBtn.classList.remove('logged-in');
    
    const logoutBtn = document.getElementById('logoutBtn');
    const loginRegisterBtns = document.getElementById('loginRegisterBtns');
    
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (loginRegisterBtns) loginRegisterBtns.classList.remove('hidden');
    
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownName) dropdownName.textContent = 'Guest';
    if (dropdownEmail) dropdownEmail.textContent = '';
  }
}

function closeAccountDropdown() {
  document.getElementById('accountDropdown')?.classList.add('hidden');
}

window.toggleAccountDropdown = function() {
  const user = getCurrentUser();
  const dropdown = document.getElementById('accountDropdown');
  
  if (!dropdown) return;
  
  if (!user) {
    openModal('accountModal');
    showLoginForm();
    return;
  }
  
  updateAccountUI();
  dropdown.classList.toggle('hidden');
  
  // Close on outside click
  if (!dropdown.classList.contains('hidden')) {
    setTimeout(() => {
      document.addEventListener('click', function closeDrop(e) {
        if (!dropdown.contains(e.target) && e.target.id !== 'accountBtn' && !e.target.closest('#accountBtn')) {
          dropdown.classList.add('hidden');
          document.removeEventListener('click', closeDrop);
        }
      }, { once: true });
    }, 100);
  }
};

// ===============================================
//           VIEW MY ORDERS (Supabase)
// ===============================================

async function viewMyOrders() {
  closeAccountDropdown();
  const user = getCurrentUser();
  if (!user) {
    showToast("Please login first");
    return;
  }

  const orders = await getOrdersFromDB() || [];
  
  const myOrders = orders.filter(o => {
    const customerName = (o.customer_name || o.customer || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/\D/g, '');
    const orderPhone = (o.phone || '').replace(/\D/g, '');
    
    const nameMatch = customerName.includes(userName) || userName.includes(customerName);
    const phoneMatch = userPhone && orderPhone && (userPhone.includes(orderPhone) || orderPhone.includes(userPhone));
    const emailMatch = user.email && o.email && o.email.toLowerCase() === user.email.toLowerCase();
    
    return nameMatch || phoneMatch || emailMatch;
  });

  // Remove existing overlay if any
  const existing = document.getElementById('myOrdersOverlay');
  if (existing) existing.remove();

  const overlayHTML = `
    <div id="myOrdersOverlay" class="orders-overlay" style="position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);" onclick="document.getElementById('myOrdersOverlay').remove();document.body.style.overflow='';"></div>
      <div style="position:relative;background:white;border-radius:2rem;width:min(90vw,700px);max-height:85vh;display:flex;flex-direction:column;box-shadow:0 25px 50px rgba(0,0,0,0.25);animation:slideUp 0.3s ease;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:1.5rem;border-bottom:1px solid #e5e7eb;">
          <h2 style="font-size:1.5rem;font-weight:700;">📋 My Orders (${myOrders.length})</h2>
          <button onclick="document.getElementById('myOrdersOverlay').remove();document.body.style.overflow='';" style="width:2.5rem;height:2.5rem;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:1.5rem;cursor:pointer;border:none;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:1.5rem;">
          ${myOrders.length === 0 ? `
            <div style="text-align:center;padding:3rem 0;">
              <span style="font-size:4rem;display:block;margin-bottom:1rem;">📦</span>
              <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;">No Orders Yet</h3>
              <p style="color:#6b7280;">Start shopping to see your orders here!</p>
              <p style="color:#9ca3af;font-size:0.75rem;margin-top:1rem;">Logged in as: <strong>${user.name}</strong></p>
            </div>
          ` : myOrders.slice(0, 20).map(order => {
            const status = order.status || 'pending';
            const statusColors = {
              pending: { bg: '#fef9c3', border: '#fde68a', text: '#a16207', icon: '🟡' },
              confirmed: { bg: '#dcfce7', border: '#bbf7d0', text: '#15803d', icon: '🟢' },
              processing: { bg: '#dbeafe', border: '#bfdbfe', text: '#1d4ed8', icon: '🔵' },
              completed: { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: '✅' },
              cancelled: { bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: '❌' }
            };
            const c = statusColors[status] || statusColors.pending;
            return `
              <div style="background:${c.bg};border-radius:1rem;padding:1rem;border:1px solid ${c.border};margin-bottom:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
                  <div>
                    <span style="font-family:monospace;font-weight:700;">${order.id}</span>
                    <span style="color:${c.text};font-size:0.875rem;margin-left:0.5rem;font-weight:500;">${c.icon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  </div>
                  <span style="font-weight:700;font-size:1.125rem;">FCFA ${(order.total || 0).toFixed(2)}</span>
                </div>
                <p style="font-size:0.75rem;color:#6b7280;">📅 ${new Date(order.date || order.created_at).toLocaleDateString('en-US', {weekday:'short',year:'numeric',month:'short',day:'numeric'})}</p>
                <p style="font-size:0.75rem;color:#6b7280;">📍 ${order.address || 'N/A'}</p>
                <div style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.25rem;">
                  ${(order.items || []).map(i => `<span style="background:rgba(255,255,255,0.5);padding:0.125rem 0.5rem;border-radius:999px;font-size:0.75rem;">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <a href="track.html?order=${order.id}" target="_blank" style="display:inline-flex;align-items:center;gap:0.25rem;margin-top:0.75rem;color:#e60012;font-size:0.875rem;font-weight:500;text-decoration:none;background:rgba(255,255,255,0.5);padding:0.25rem 0.75rem;border-radius:999px;">
                  <i class="fas fa-external-link-alt" style="font-size:0.75rem;"></i> Track Order
                </a>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', overlayHTML);
  document.body.style.overflow = 'hidden';
}

// ===============================================
//           AUTO-FILL CHECKOUT
// ===============================================

function autofillCheckoutFromAccount() {
  const user = getCurrentUser();
  if (!user) return;
  
  const nameInput = document.getElementById('custName');
  const phoneInput = document.getElementById('custPhone');
  const addrInput = document.getElementById('custAddr');
  
  if (nameInput && !nameInput.value) nameInput.value = user.name || '';
  if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
  if (addrInput && !addrInput.value) addrInput.value = user.address || '';
}

// ===============================================
//           MODAL & TOAST FUNCTIONS
// ===============================================

window.openModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  if (id === 'checkoutModal') autofillCheckoutFromAccount();
};

window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

function showToast(msg) {
  let t = document.getElementById('toastMsg');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 2400);
}

// ===============================================
//           INITIALIZATION
// ===============================================

// Attach form handlers
document.addEventListener('DOMContentLoaded', () => {
  updateAccountUI();
  const searchInput = document.getElementById('searchInput');
if (searchInput && searchInput.value && !searchInput.dataset.userTyped) {
  setTimeout(() => { searchInput.value = ''; }, 200);
}
  // Register form submit
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleRegister();
    });
  }
  
  // Login form submit
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }
  
  // Close modals when clicking backdrop
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
  });
  
  // Initialize business info in header
  initBusinessInfo();
});

async function initBusinessInfo() {
  try {
    const business = await getBusinessInfo();
    const shopName = business.shopName || business.shop_name || 'Sucess Technology';
    
    // Update header shop names
    document.querySelectorAll('#headerShopName, #headerShopName123').forEach(el => {
      el.innerHTML = (shopName && shopName.toLowerCase() !== 'Sucess Technology') 
        ? shopName 
        : `shop<span style="color:#e60012;">Boss</span>`;
    });
    
    // Update footer
    const footerEmail = document.getElementById('footerEmail');
    const footerPhone = document.getElementById('footerPhone');
    const footerAddress = document.getElementById('footerAddress');
    if (footerEmail) footerEmail.textContent = business.email || '';
    if (footerPhone) footerPhone.textContent = business.phone || '';
    if (footerAddress) footerAddress.textContent = business.address || '';
    
    // Social links
    const fb = document.getElementById('facebookLink');
    const ig = document.getElementById('instagramLink');
    const tt = document.getElementById('tiktokLink');
    if (fb) { fb.style.display = business.facebook ? 'inline-block' : 'none'; if (business.facebook) fb.href = business.facebook; }
    if (ig) { ig.style.display = business.instagram ? 'inline-block' : 'none'; if (business.instagram) ig.href = business.instagram; }
    if (tt) { tt.style.display = business.tiktok ? 'inline-block' : 'none'; if (business.tiktok) tt.href = business.tiktok; }
  } catch (e) {
    console.warn('Could not load business info');
  }
}