const fallbackProducts = [
  {
    id: "kanchipuram-silk",
    name: "Kanchipuram Silk",
    category: "sarees",
    tags: ["sarees", "silk"],
    price: 18500,
    image: "assets/kanchipuram.svg",
    limited: true,
    description: "A ceremonial silk saree with luminous zari borders and rich jewel-toned drape."
  },
  {
    id: "paithani-weaves",
    name: "Paithani Weaves",
    category: "sarees",
    tags: ["sarees"],
    price: 16200,
    image: "assets/paithani.svg",
    limited: true,
    description: "Peacock-inspired color, heritage motifs, and a festive pallu statement."
  },
  {
    id: "banarasi-silk",
    name: "Banarasi Silk",
    category: "sarees",
    tags: ["sarees", "silk"],
    price: 21400,
    image: "assets/banarasi.svg",
    limited: false,
    description: "A luminous Banarasi saree with jari-inspired detailing and heirloom polish."
  },
  {
    id: "designer-kurtas",
    name: "Designer Kurtas",
    category: "kurtas",
    tags: ["kurtas"],
    price: 6900,
    image: "assets/designer-kurta.svg",
    limited: false,
    description: "Tailored occasion kurtas with clean lines, rich trims, and a refined silhouette."
  }
];

const grid = document.querySelector("#productGrid");
const filters = document.querySelectorAll(".filter");
const limitedToggle = document.querySelector("#limitedToggle");
const cartButton = document.querySelector(".cart-button");
const cartDrawer = document.querySelector("#cartDrawer");
const closeCart = document.querySelector("#closeCart");
const cartItems = document.querySelector("#cartItems");
const cartCount = document.querySelector("#cartCount");
const cartTotal = document.querySelector("#cartTotal");
const checkoutButton = document.querySelector("#checkoutButton");
const checkoutNote = document.querySelector("#checkoutNote");
const newsletterForm = document.querySelector("#newsletterForm");
const newsletterMessage = document.querySelector("#newsletterMessage");

let products = fallbackProducts;
let activeFilter = "all";
const cart = new Map();

function formatPrice(value) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Products API unavailable");
    products = await response.json();
  } catch {
    products = fallbackProducts;
  }
  renderProducts();
}

function visibleProducts() {
  return products.filter((product) => {
    const tags = product.tags || [product.category];
    const matchesCategory = activeFilter === "all" || tags.includes(activeFilter);
    const matchesLimited = !limitedToggle.checked || product.limited;
    return matchesCategory && matchesLimited;
  });
}

function renderProducts() {
  grid.innerHTML = visibleProducts().map((product, index) => `
    <article class="product-card reveal" style="--delay: ${index * 90}ms">
      <div class="product-visual">
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-info">
        <div class="product-meta">
          <h3>${product.name}</h3>
          ${product.limited ? '<span class="badge">Signature</span>' : ""}
        </div>
        <p>${product.description}</p>
        <div class="product-price">
          <strong>${formatPrice(product.price)}</strong>
          <button class="add-button magnetic" type="button" data-id="${product.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".add-button").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.id));
  });
  revealVisible();
}

function addToCart(id) {
  const product = products.find((item) => item.id === id);
  const current = cart.get(id) || { product, quantity: 0 };
  current.quantity += 1;
  cart.set(id, current);
  renderCart();
  openCart();
}

function renderCart() {
  const entries = Array.from(cart.values());
  const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalPrice = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);

  cartCount.textContent = totalQuantity;
  cartTotal.textContent = formatPrice(totalPrice);
  cartItems.innerHTML = entries.length
    ? entries.map(({ product, quantity }) => `
      <div class="cart-item">
        <div>
          <p>${product.name}</p>
          <small>${quantity} x ${formatPrice(product.price)}</small>
        </div>
        <strong>${formatPrice(product.price * quantity)}</strong>
      </div>
    `).join("")
    : "<p>Your cart is waiting for a first designer piece.</p>";
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function hideCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

async function requestCheckout() {
  const items = Array.from(cart.values()).map(({ product, quantity }) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    quantity
  }));

  if (!items.length) {
    checkoutNote.textContent = "Add a product before requesting checkout.";
    return;
  }

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    if (!response.ok) throw new Error("Order API unavailable");
    const order = await response.json();
    checkoutNote.textContent = `Request saved. Order ID: ${order.id}`;
  } catch {
    checkoutNote.textContent = "Checkout request is ready. Run the backend server to save orders.";
  }
}

async function subscribe(event) {
  event.preventDefault();
  const email = new FormData(newsletterForm).get("email");

  try {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error("Newsletter API unavailable");
    newsletterMessage.textContent = "Subscribed. Welcome to the private list.";
    newsletterForm.reset();
  } catch {
    newsletterMessage.textContent = "Run the backend server to save newsletter emails.";
  }
}

function revealVisible() {
  document.querySelectorAll(".reveal").forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight - 70) {
      element.classList.add("visible");
    }
  });
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderProducts();
  });
});

document.querySelectorAll(".magnetic").forEach((element) => {
  element.addEventListener("mousemove", (event) => {
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    element.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`;
  });
  element.addEventListener("mouseleave", () => {
    element.style.transform = "";
  });
});

limitedToggle.addEventListener("change", renderProducts);
cartButton.addEventListener("click", openCart);
closeCart.addEventListener("click", hideCart);
checkoutButton.addEventListener("click", requestCheckout);
newsletterForm.addEventListener("submit", subscribe);
cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) hideCart();
});
window.addEventListener("scroll", revealVisible, { passive: true });
window.addEventListener("load", revealVisible);

loadProducts();
renderCart();
