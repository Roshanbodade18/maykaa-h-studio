const state = {
  products: [],
  facets: {},
  cart: JSON.parse(localStorage.getItem("maykaa_cart") || "[]"),
  wishlist: new Set(JSON.parse(localStorage.getItem("maykaa_wishlist") || "[]")),
  token: localStorage.getItem("maykaa_token") || "",
  user: JSON.parse(localStorage.getItem("maykaa_user") || "null"),
  filters: {
    region: "All",
    fabric: "All",
    price: "all",
    category: "All",
    color: "All",
    occasion: "All",
    brand: "All",
    rating: "0",
    availability: "all",
    search: "",
    sort: "popularity"
  },
  couponCode: "",
  checkout: {
    step: 0,
    address: {},
    paymentMethod: "UPI",
    summary: null
  },
  pendingAuth: null,
  pendingOtp: null
};

const els = {
  grid: document.querySelector("#productGrid"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCount: document.querySelector("#resultCount"),
  filterGroups: document.querySelector("#filterGroups"),
  sortSelect: document.querySelector("#sortSelect"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  cartButton: document.querySelector("#cartButton"),
  cartDrawer: document.querySelector("#cartDrawer"),
  cartCount: document.querySelector("#cartCount"),
  cartItems: document.querySelector("#cartItems"),
  cartSummary: document.querySelector("#cartSummary"),
  couponInput: document.querySelector("#couponInput"),
  authModal: document.querySelector("#authModal"),
  authTitle: document.querySelector("#authTitle"),
  authHint: document.querySelector("#authHint"),
  authMessage: document.querySelector("#authMessage"),
  loginForm: document.querySelector("#loginForm"),
  otpForm: document.querySelector("#otpForm"),
  verifyForm: document.querySelector("#verifyForm"),
  quickViewModal: document.querySelector("#quickViewModal"),
  quickViewContent: document.querySelector("#quickViewContent"),
  checkoutModal: document.querySelector("#checkoutModal"),
  checkoutContent: document.querySelector("#checkoutContent"),
  checkoutProgress: document.querySelector("#checkoutProgress"),
  ordersModal: document.querySelector("#ordersModal"),
  ordersContent: document.querySelector("#ordersContent"),
  accountButton: document.querySelector("#accountButton"),
  ordersButton: document.querySelector("#ordersButton"),
  newsletterForm: document.querySelector("#newsletterForm"),
  newsletterMessage: document.querySelector("#newsletterMessage")
};

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function discountPercent(product) {
  return Math.round(((product.price - product.discountPrice) / product.price) * 100);
}

function saveCart() {
  localStorage.setItem("maykaa_cart", JSON.stringify(state.cart));
}

function saveWishlist() {
  localStorage.setItem("maykaa_wishlist", JSON.stringify([...state.wishlist]));
}

function setUser(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("maykaa_token", token);
  localStorage.setItem("maykaa_user", JSON.stringify(user));
  renderAccount();
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function currentQuery() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.filters)) {
    if (value && value !== "All" && value !== "all" && value !== "0") params.set(key, value);
  }
  return params.toString();
}

async function loadProducts() {
  const query = currentQuery();
  const data = await api(`/api/products${query ? `?${query}` : ""}`);
  state.products = data.products;
  state.facets = data.facets;
  renderFilters();
  renderProducts();
}

function renderFilters() {
  const groups = [
    { title: "Region", key: "region", options: ["All", ...(state.facets.regions || [])] },
    { title: "Fabric", key: "fabric", options: ["All", ...(state.facets.fabrics || [])] },
    { title: "Price Range", key: "price", options: [["all", "All Prices"], ["under-10000", "Under Rs. 10,000"], ["10000-20000", "Rs. 10,000 - Rs. 20,000"], ["above-20000", "Above Rs. 20,000"]] },
    { title: "Category", key: "category", options: ["All", ...(state.facets.categories || [])] },
    { title: "Color", key: "color", options: ["All", ...(state.facets.colors || [])] },
    { title: "Occasion", key: "occasion", options: ["All", ...(state.facets.occasions || [])] },
    { title: "Brand", key: "brand", options: ["All", ...(state.facets.brands || [])] },
    { title: "Customer Rating", key: "rating", options: [["0", "All Ratings"], ["4.5", "4.5 stars & above"], ["4", "4 stars & above"]] },
    { title: "Availability", key: "availability", options: [["all", "All"], ["in-stock", "In Stock"]] }
  ];

  els.filterGroups.innerHTML = groups.map((group) => `
    <section class="filter-group">
      <h3>${group.title}</h3>
      ${group.options.map((option) => {
        const value = Array.isArray(option) ? option[0] : option;
        const label = Array.isArray(option) ? option[1] : option;
        return `
          <label class="radio-row">
            <input type="radio" name="${group.key}" value="${value}" ${state.filters[group.key] === value ? "checked" : ""}>
            <span>${label}</span>
          </label>
        `;
      }).join("")}
    </section>
  `).join("");
}

function renderProducts() {
  els.resultCount.textContent = `${state.products.length} products found`;
  els.resultTitle.textContent = state.filters.region === "All" ? "All designer sarees" : `${state.filters.region} sarees`;
  els.grid.innerHTML = state.products.map((product) => `
    <article class="product-card reveal">
      <div class="product-media">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="badge">${product.badge || `${discountPercent(product)}% off`}</span>
        <button class="wishlist-button ${state.wishlist.has(product.id) ? "active" : ""}" data-wishlist="${product.id}" type="button" aria-label="Wishlist ${product.name}">♥</button>
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="rating">★ ${product.rating} <span>(${product.reviews})</span></div>
        <p>${product.description}</p>
        <small>${product.fabric} • ${product.occasion} • ${product.availability}</small>
        <div class="price-row">
          <strong>${formatPrice(product.discountPrice)}</strong>
          <del>${formatPrice(product.price)}</del>
          <span>${discountPercent(product)}% off</span>
        </div>
        <div class="product-actions">
          <button class="add-button" data-add="${product.id}" type="button">Add to Cart</button>
          <button class="quick-button" data-quick="${product.id}" type="button">View</button>
        </div>
      </div>
    </article>
  `).join("");
  revealVisible();
}

function cartProduct(id) {
  return state.products.find((product) => product.id === id) || state.cart.find((item) => item.id === id);
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  const existing = state.cart.find((item) => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  renderCart();
  openDrawer();
}

function changeQty(id, delta) {
  const item = state.cart.find((entry) => entry.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
  saveCart();
  renderCart();
}

function cartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.discountPrice * item.quantity, 0);
  const couponDiscount = state.couponCode === "MAYKAA10" ? Math.round(subtotal * 0.1) : 0;
  const delivery = subtotal > 15000 || subtotal === 0 ? 0 : 149;
  const taxes = Math.round(Math.max(0, subtotal - couponDiscount) * 0.05);
  const total = Math.max(0, subtotal - couponDiscount) + delivery + taxes;
  const deliveryDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return { subtotal, couponDiscount, delivery, taxes, total, deliveryDate };
}

function renderCart() {
  els.cartCount.textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  els.cartItems.innerHTML = state.cart.length ? state.cart.map((item) => `
    <div class="cart-line">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <strong>${item.name}</strong>
        <small>${formatPrice(item.discountPrice)} • ${item.fabric}</small>
        <div class="qty-controls">
          <button data-qty="${item.id}" data-delta="-1" type="button">-</button>
          <span>${item.quantity}</span>
          <button data-qty="${item.id}" data-delta="1" type="button">+</button>
          <button data-remove="${item.id}" type="button">Remove</button>
        </div>
      </div>
      <strong>${formatPrice(item.discountPrice * item.quantity)}</strong>
    </div>
  `).join("") : "<p>Your cart is empty. Add a saree to begin checkout.</p>";

  const totals = cartTotals();
  els.cartSummary.innerHTML = `
    <div class="summary-line"><span>Subtotal</span><strong>${formatPrice(totals.subtotal)}</strong></div>
    <div class="summary-line"><span>Coupon discount</span><strong>-${formatPrice(totals.couponDiscount)}</strong></div>
    <div class="summary-line"><span>Delivery</span><strong>${totals.delivery ? formatPrice(totals.delivery) : "Free"}</strong></div>
    <div class="summary-line"><span>Taxes</span><strong>${formatPrice(totals.taxes)}</strong></div>
    <div class="summary-line total"><span>Total</span><strong>${formatPrice(totals.total)}</strong></div>
    <small>Estimated delivery: ${totals.deliveryDate}</small>
  `;
}

function openDrawer() {
  els.cartDrawer.classList.add("open");
  els.cartDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.cartDrawer.classList.remove("open");
  els.cartDrawer.setAttribute("aria-hidden", "true");
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  document.querySelectorAll(".modal.open").forEach((modal) => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  });
}

function renderAccount() {
  els.accountButton.textContent = state.user ? state.user.name.split(" ")[0] : "Login";
}

function switchAuthMode(mode) {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  els.loginForm.classList.toggle("hidden", mode !== "login");
  els.otpForm.classList.toggle("hidden", mode === "login");
  els.verifyForm.classList.add("hidden");
  els.authTitle.textContent = mode === "login" ? "Login to continue" : mode === "forgot" ? "Reset password with OTP" : "Create your account";
  els.authHint.textContent = mode === "forgot" ? "Verify your mobile number and create a fresh password." : "Use your mobile number for secure saree orders.";
  els.authMessage.textContent = "";
  els.otpForm.dataset.purpose = mode === "forgot" ? "reset" : "signup";
}

function requireAuth(action) {
  if (state.user && state.token) {
    action();
    return;
  }
  state.pendingAuth = action;
  openModal(els.authModal);
}

async function submitLogin(event) {
  event.preventDefault();
  els.authMessage.textContent = "Logging in...";
  const body = Object.fromEntries(new FormData(els.loginForm));
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
    setUser(data.token, data.user);
    closeModals();
    if (state.pendingAuth) state.pendingAuth();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function submitOtp(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(els.otpForm));
  body.purpose = els.otpForm.dataset.purpose || "signup";
  state.pendingOtp = body;
  els.authMessage.textContent = "Sending OTP...";
  try {
    const data = await api("/api/auth/request-otp", { method: "POST", body: JSON.stringify(body) });
    els.otpForm.classList.add("hidden");
    els.verifyForm.classList.remove("hidden");
    els.authMessage.textContent = data.devOtp ? `Demo OTP: ${data.devOtp}` : data.message;
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

async function submitVerify(event) {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(els.verifyForm));
  try {
    const verified = await api("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ mobile: state.pendingOtp.mobile, otp: form.otp, purpose: state.pendingOtp.purpose })
    });
    const data = await api("/api/auth/set-password", {
      method: "POST",
      body: JSON.stringify({
        setupToken: verified.setupToken,
        password: form.password,
        name: state.pendingOtp.name || "मायkaa Customer"
      })
    });
    setUser(data.token, data.user);
    closeModals();
    if (state.pendingAuth) state.pendingAuth();
  } catch (error) {
    els.authMessage.textContent = error.message;
  }
}

function showQuickView(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  els.quickViewContent.innerHTML = `
    <div class="quick-layout">
      <img src="${product.image}" alt="${product.name}">
      <div>
        <p class="eyebrow">${product.region} • ${product.fabric}</p>
        <h2>${product.name}</h2>
        <div class="rating">★ ${product.rating} (${product.reviews} reviews)</div>
        <p>${product.description}</p>
        <div class="price-row">
          <strong>${formatPrice(product.discountPrice)}</strong>
          <del>${formatPrice(product.price)}</del>
          <span>${discountPercent(product)}% off</span>
        </div>
        <p><strong>Availability:</strong> ${product.availability}</p>
        <p><strong>Occasion:</strong> ${product.occasion}</p>
        <button class="primary-btn" data-add="${product.id}" type="button">Add to Cart</button>
      </div>
    </div>
  `;
  openModal(els.quickViewModal);
}

async function startCheckout() {
  if (!state.cart.length) return;
  requireAuth(async () => {
    closeDrawer();
    state.checkout.step = 0;
    state.checkout.summary = await api("/api/checkout/summary", {
      method: "POST",
      body: JSON.stringify({ items: state.cart, couponCode: state.couponCode })
    });
    renderCheckout();
    openModal(els.checkoutModal);
  });
}

function updateCheckoutProgress() {
  [...els.checkoutProgress.children].forEach((item, index) => item.classList.toggle("active", index <= state.checkout.step));
}

function renderCheckout() {
  updateCheckoutProgress();
  const summary = state.checkout.summary || cartTotals();
  if (state.checkout.step === 0) {
    els.checkoutContent.innerHTML = `
      <h2>Cart Review</h2>
      ${state.cart.map((item) => `<p>${item.quantity} x ${item.name} - ${formatPrice(item.discountPrice * item.quantity)}</p>`).join("")}
      ${summaryHtml(summary)}
      <button class="primary-btn" data-next-checkout type="button">Continue to Address</button>
    `;
  }
  if (state.checkout.step === 1) {
    els.checkoutContent.innerHTML = `
      <h2>Delivery Address</h2>
      <form id="addressForm" class="address-grid">
        <input name="name" placeholder="Full name" required>
        <input name="mobile" inputmode="numeric" placeholder="Mobile number" required>
        <textarea name="address" placeholder="Address" required></textarea>
        <input name="city" placeholder="City" required>
        <input name="state" placeholder="State" required>
        <input name="pincode" inputmode="numeric" placeholder="Pincode" required>
        <input name="landmark" placeholder="Landmark">
        <button class="primary-btn" type="submit">Continue to Payment</button>
      </form>
    `;
  }
  if (state.checkout.step === 2) {
    const methods = ["UPI", "QR Code Payment", "Google Pay", "PhonePe", "Paytm", "Net Banking", "Credit/Debit Cards", "Cash on Delivery"];
    els.checkoutContent.innerHTML = `
      <h2>Payment</h2>
      <div class="payment-grid">
        ${methods.map((method) => `<button class="payment-option ${state.checkout.paymentMethod === method ? "active" : ""}" data-payment="${method}" type="button">${method}</button>`).join("")}
      </div>
      ${state.checkout.paymentMethod === "QR Code Payment" ? '<div class="qr-box">SCAN<br>UPI</div>' : ""}
      <p>Demo payment creates a transaction ID. Add Razorpay keys in Render environment variables for production gateway mode.</p>
      ${summaryHtml(summary)}
      <button class="primary-btn" data-place-order type="button">Pay & Place Order</button>
    `;
  }
  if (state.checkout.step === 3) {
    els.checkoutContent.innerHTML = `
      <h2>Order Confirmed</h2>
      <p id="orderConfirmation">Preparing confirmation...</p>
    `;
  }
}

function summaryHtml(summary) {
  return `
    <div class="price-box">
      <div class="summary-line"><span>Subtotal</span><strong>${formatPrice(summary.subtotal)}</strong></div>
      <div class="summary-line"><span>Discount</span><strong>-${formatPrice(summary.couponDiscount)}</strong></div>
      <div class="summary-line"><span>Delivery</span><strong>${summary.delivery ? formatPrice(summary.delivery) : "Free"}</strong></div>
      <div class="summary-line"><span>Taxes</span><strong>${formatPrice(summary.taxes)}</strong></div>
      <div class="summary-line total"><span>Total</span><strong>${formatPrice(summary.total)}</strong></div>
      <small>Estimated delivery: ${summary.deliveryDate}</small>
    </div>
  `;
}

async function placeOrder() {
  try {
    const payment = await api("/api/payments/create", {
      method: "POST",
      body: JSON.stringify({ items: state.cart, couponCode: state.couponCode })
    });
    const orderData = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: state.cart,
        couponCode: state.couponCode,
        address: state.checkout.address,
        paymentMethod: state.checkout.paymentMethod,
        transactionId: payment.payment.id
      })
    });
    state.cart = [];
    state.couponCode = "";
    saveCart();
    renderCart();
    state.checkout.step = 3;
    renderCheckout();
    document.querySelector("#orderConfirmation").innerHTML = `
      <strong>Order ID:</strong> ${orderData.order.id}<br>
      <strong>Transaction:</strong> ${orderData.order.transactionId}<br>
      <strong>Amount:</strong> ${formatPrice(orderData.order.total)}<br>
      SMS confirmation has been logged by the backend.
    `;
  } catch (error) {
    els.checkoutContent.insertAdjacentHTML("beforeend", `<p class="form-note">Payment failed: ${error.message}. Please retry.</p>`);
  }
}

async function showOrders() {
  requireAuth(async () => {
    try {
      const data = await api("/api/orders");
      els.ordersContent.innerHTML = data.orders.length ? data.orders.map((order) => `
        <article class="order-card">
          <h3>${order.id}</h3>
          <p>${new Date(order.createdAt).toLocaleString("en-IN")} • ${order.paymentMethod} • ${order.deliveryStatus}</p>
          ${order.items.map((item) => `
            <div class="order-item">
              <img src="${item.image}" alt="${item.name}">
              <span>${item.name} x ${item.quantity}</span>
              <strong>${formatPrice(item.subtotal)}</strong>
            </div>
          `).join("")}
          <div class="summary-line total"><span>Paid</span><strong>${formatPrice(order.total)}</strong></div>
          <div class="drawer-actions">
            <button class="ghost-btn" type="button">Download invoice</button>
            <button class="primary-btn" type="button">Reorder</button>
          </div>
        </article>
      `).join("") : "<p>No orders yet. Your confirmed orders will appear here.</p>";
      openModal(els.ordersModal);
    } catch (error) {
      alert(error.message);
    }
  });
}

function revealVisible() {
  document.querySelectorAll(".reveal").forEach((element) => {
    if (element.getBoundingClientRect().top < window.innerHeight - 60) element.classList.add("visible");
  });
}

document.addEventListener("click", async (event) => {
  const add = event.target.closest("[data-add]");
  if (add) addToCart(add.dataset.add);

  const quick = event.target.closest("[data-quick]");
  if (quick) showQuickView(quick.dataset.quick);

  const wishlist = event.target.closest("[data-wishlist]");
  if (wishlist) {
    const id = wishlist.dataset.wishlist;
    state.wishlist.has(id) ? state.wishlist.delete(id) : state.wishlist.add(id);
    saveWishlist();
    renderProducts();
  }

  const qty = event.target.closest("[data-qty]");
  if (qty) changeQty(qty.dataset.qty, Number(qty.dataset.delta));

  const remove = event.target.closest("[data-remove]");
  if (remove) {
    state.cart = state.cart.filter((item) => item.id !== remove.dataset.remove);
    saveCart();
    renderCart();
  }

  if (event.target.matches("[data-close-cart]")) closeDrawer();
  if (event.target.matches("[data-close-modal]")) closeModals();
  if (event.target.matches("[data-next-checkout]")) {
    state.checkout.step = 1;
    renderCheckout();
  }
  if (event.target.matches("[data-place-order]")) placeOrder();
  if (event.target.matches("[data-payment]")) {
    state.checkout.paymentMethod = event.target.dataset.payment;
    renderCheckout();
  }
  if (event.target.matches("[data-auth-mode]")) switchAuthMode(event.target.dataset.authMode);
});

els.filterGroups.addEventListener("change", async (event) => {
  if (event.target.matches("input[type='radio']")) {
    state.filters[event.target.name] = event.target.value;
    await loadProducts();
  }
});

document.querySelectorAll("[data-quick-region]").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll("[data-quick-region]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filters.region = button.dataset.quickRegion;
    await loadProducts();
  });
});

els.searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.filters.search = els.searchInput.value.trim();
  await loadProducts();
});

els.sortSelect.addEventListener("change", async () => {
  state.filters.sort = els.sortSelect.value;
  await loadProducts();
});

document.querySelector("#clearFilters").addEventListener("click", async () => {
  state.filters = { ...state.filters, region: "All", fabric: "All", price: "all", category: "All", color: "All", occasion: "All", brand: "All", rating: "0", availability: "all", search: "" };
  els.searchInput.value = "";
  await loadProducts();
});

els.cartButton.addEventListener("click", openDrawer);
document.querySelector("#clearCart").addEventListener("click", () => {
  state.cart = [];
  saveCart();
  renderCart();
});
document.querySelector("#applyCoupon").addEventListener("click", () => {
  state.couponCode = els.couponInput.value.trim().toUpperCase();
  renderCart();
});
document.querySelector("#checkoutStart").addEventListener("click", startCheckout);
els.accountButton.addEventListener("click", () => openModal(els.authModal));
document.querySelector("#heroLoginButton").addEventListener("click", () => openModal(els.authModal));
els.ordersButton.addEventListener("click", showOrders);
els.loginForm.addEventListener("submit", submitLogin);
els.otpForm.addEventListener("submit", submitOtp);
els.verifyForm.addEventListener("submit", submitVerify);
els.checkoutContent.addEventListener("submit", (event) => {
  if (event.target.matches("#addressForm")) {
    event.preventDefault();
    state.checkout.address = Object.fromEntries(new FormData(event.target));
    state.checkout.step = 2;
    renderCheckout();
  }
});
els.newsletterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/newsletter", {
      method: "POST",
      body: JSON.stringify({ email: document.querySelector("#newsletterEmail").value })
    });
    els.newsletterMessage.textContent = "Subscribed successfully.";
    els.newsletterForm.reset();
  } catch (error) {
    els.newsletterMessage.textContent = error.message;
  }
});

window.addEventListener("scroll", revealVisible, { passive: true });
window.addEventListener("load", revealVisible);

renderAccount();
renderCart();
loadProducts().catch((error) => {
  els.resultCount.textContent = error.message;
});
