// shared-header.js - Shared header with account system for all pages
const ACCOUNT_STORAGE = 'shop_customer_accounts';
const CURRENT_USER_KEY = 'shop_current_user';
const STORAGE_BUSINESS = 'business_info';
const STORAGE_ORDERS_KEY = 'shop_orders_v1';

function getStorage(key, def = null) {
  const raw = localStorage.getItem(key);
  if (!raw) return def;
  try { return JSON.parse(raw); } catch (e) { return def; }
}

function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getBusinessInfo() {
  return getStorage(STORAGE_BUSINESS, {
    shopName: "ShopBoss",
    email: "hello@shopboss.com",
    phone: "+1234567890",
    address: "123 Commerce St"
  });
}

// ===============================================
//           CUSTOMER ACCOUNT SYSTEM
// ===============================================

function getAccounts() {
  return getStorage(ACCOUNT_STORAGE, []);
}

function saveAccounts(accounts) {
  setStorage(ACCOUNT_STORAGE, accounts);
}

function getCurrentUser() {
  return getStorage(CURRENT_USER_KEY, null);
}

function setCurrentUser(user) {
  setStorage(CURRENT_USER_KEY, user);
  updateAccountUI();
}

function handleRegister() {
  const name = document.getElementById('regName')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim()?.toLowerCase();
  const phone = document.getElementById('regPhone')?.value?.trim();
  const address = document.getElementById('regAddress')?.value?.trim();
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

  const accounts = getAccounts();
  
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
  saveAccounts(accounts);
  
  const loggedInUser = { ...newAccount };
  delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  
  closeModal('accountModal');
  showToast(`Welcome, ${name}! 🎉`);
}

function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim()?.toLowerCase();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showToast("Please fill all fields");
    return;
  }

  const accounts = getAccounts();
  const account = accounts.find(a => a.email === email && a.password === password);

  if (!account) {
    showToast("Invalid email or password");
    return;
  }

  const loggedInUser = { ...account };
  delete loggedInUser.password;
  setCurrentUser(loggedInUser);
  
  closeModal('accountModal');
  showToast(`Welcome back, ${account.name}! 👋`);
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem(CURRENT_USER_KEY);
    updateAccountUI();
    closeAccountDropdown();
    showToast('Logged out successfully');
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
        if (!dropdown.contains(e.target) && e.target.id !== 'accountBtn') {
          dropdown.classList.add('hidden');
          document.removeEventListener('click', closeDrop);
        }
      });
    }, 100);
  }
};

function viewMyOrders() {
  closeAccountDropdown();
  const user = getCurrentUser();
  if (!user) {
    showToast("Please login first");
    return;
  }

  const ordersRaw = localStorage.getItem(STORAGE_ORDERS_KEY);
  const orders = ordersRaw ? JSON.parse(ordersRaw) : [];
  
  const myOrders = orders.filter(o => {
    const customerName = (o.customer || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/\D/g, '');
    const orderPhone = (o.phone || '').replace(/\D/g, '');
    
    const nameMatch = customerName.includes(userName) || userName.includes(customerName);
    const phoneMatch = userPhone && orderPhone && (userPhone.includes(orderPhone) || orderPhone.includes(userPhone));
    const emailMatch = user.email && o.email && o.email.toLowerCase() === user.email.toLowerCase();
    
    return nameMatch || phoneMatch || emailMatch;
  });

  if (myOrders.length === 0) {
    const msgHTML = `
      <div id="myOrdersModal" class="modal" style="display: flex; align-items: center; justify-content: center;">
        <div class="bg-white rounded-3xl max-w-md w-full p-8 mx-4 shadow-2xl text-center">
          <span class="text-5xl mb-4 block">📋</span>
          <h2 class="text-xl font-bold mb-2">No Orders Found</h2>
          <p class="text-gray-500 mb-4">You haven't placed any orders yet.</p>
          <p class="text-xs text-gray-400 mb-6">Logged in as: <strong>${user.name}</strong></p>
          <button onclick="document.getElementById('myOrdersModal').remove();" 
                  class="bg-primary text-white px-6 py-3 rounded-xl font-medium">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', msgHTML);
    document.getElementById('myOrdersModal').addEventListener('click', (e) => {
      if (e.target.id === 'myOrdersModal') e.target.remove();
    });
    return;
  }

  const ordersHTML = `
    <div id="myOrdersModal" class="modal" style="display: flex; align-items: center; justify-content: center;">
      <div class="bg-white rounded-3xl max-w-2xl w-full p-6 mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold">📋 My Orders (${myOrders.length})</h2>
          <button onclick="document.getElementById('myOrdersModal').remove()" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200">✕</button>
        </div>
        <div class="space-y-4">
          ${myOrders.slice(0, 20).map(order => {
            const status = order.status || 'pending';
            const cfg = {
              pending: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: '🟡' },
              confirmed: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '🟢' },
              processing: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: '🔵' },
              completed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: '✅' },
              cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '❌' }
            };
            const c = cfg[status] || cfg.pending;
            return `
              <div class="${c.bg} rounded-2xl p-4 border">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <span class="font-mono font-bold">${order.id}</span>
                    <span class="${c.text} text-sm ml-2 font-medium">${c.icon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  </div>
                  <span class="font-bold text-lg">FCFA ${order.total.toFixed(2)}</span>
                </div>
                <p class="text-xs text-gray-500">📅 ${new Date(order.date).toLocaleDateString()}</p>
                <p class="text-xs text-gray-500">📍 ${order.address}</p>
                <div class="mt-2 text-sm flex flex-wrap gap-1">
                  ${order.items.map(i => `<span class="bg-white/50 px-2 py-0.5 rounded-full text-xs">${i.name} x${i.qty}</span>`).join('')}
                </div>
                <a href="track.html?order=${order.id}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-primary text-sm font-medium hover:underline bg-white/50 px-3 py-1 rounded-full">
                  <i class="fas fa-external-link-alt text-xs"></i> Track Order
                </a>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', ordersHTML);
  document.getElementById('myOrdersModal').addEventListener('click', (e) => {
    if (e.target.id === 'myOrdersModal') e.target.remove();
  });
}

// Auto-fill checkout with user info
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

// Modal functions
window.openModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  // Auto-fill checkout if opening checkout modal
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateAccountUI();
  
  // Close modals when clicking backdrop
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
  });
});