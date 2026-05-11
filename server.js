const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = process.env.PORT || 3000;
const dataDir = path.join(root, "data");
const jwtSecret = process.env.JWT_SECRET || "dev-change-this-secret";
const otpTtlMs = 5 * 60 * 1000;

const storeFiles = {
  products: path.join(dataDir, "products.json"),
  users: path.join(dataDir, "users.json"),
  orders: path.join(dataDir, "orders.json"),
  otps: path.join(dataDir, "otps.json"),
  sessions: path.join(dataDir, "sessions.json"),
  payments: path.join(dataDir, "payments.json"),
  newsletter: path.join(dataDir, "newsletter.json"),
  sms: path.join(dataDir, "sms-log.json")
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const rateLimit = new Map();

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  for (const [key, file] of Object.entries(storeFiles)) {
    if (key !== "products" && !fs.existsSync(file)) fs.writeFileSync(file, "[]");
  }
}

function readJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2e6) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "").slice(-10);
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt).split(":")[1]), Buffer.from(hash));
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", jwtSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || token.split(".").length !== 3) return null;
  const [header, body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", jwtSecret).update(`${header}.${body}`).digest("base64url");
  if (signature !== expected) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function getBearer(request) {
  const auth = request.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function requireUser(request, response) {
  const payload = verifyToken(getBearer(request));
  if (!payload?.userId) {
    sendJson(response, 401, { error: "Login required" });
    return null;
  }
  const users = readJson(storeFiles.users);
  const user = users.find((item) => item.id === payload.userId);
  if (!user) {
    sendJson(response, 401, { error: "Invalid session" });
    return null;
  }
  return user;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email || "",
    createdAt: user.createdAt
  };
}

function createSession(user) {
  const token = signToken({
    userId: user.id,
    mobile: user.mobile,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14
  });
  const sessions = readJson(storeFiles.sessions);
  sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  writeJson(storeFiles.sessions, sessions.slice(-300));
  return token;
}

function createOtp(mobile, purpose) {
  const code = String(crypto.randomInt(100000, 999999));
  const otps = readJson(storeFiles.otps).filter((otp) => otp.expiresAt > Date.now());
  otps.push({
    id: crypto.randomUUID(),
    mobile,
    purpose,
    codeHash: crypto.createHash("sha256").update(code).digest("hex"),
    expiresAt: Date.now() + otpTtlMs,
    attempts: 0,
    verified: false,
    createdAt: new Date().toISOString()
  });
  writeJson(storeFiles.otps, otps);
  return code;
}

function verifyOtp(mobile, code, purpose) {
  const otps = readJson(storeFiles.otps);
  const hash = crypto.createHash("sha256").update(String(code || "")).digest("hex");
  const otp = [...otps].reverse().find((item) => item.mobile === mobile && item.purpose === purpose && item.expiresAt > Date.now());
  if (!otp) return null;
  otp.attempts += 1;
  if (otp.attempts > 5) return null;
  if (otp.codeHash !== hash) {
    writeJson(storeFiles.otps, otps);
    return null;
  }
  otp.verified = true;
  writeJson(storeFiles.otps, otps);
  return otp;
}

function checkRateLimit(request, response) {
  const ip = request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local";
  const key = `${ip}:${new URL(request.url, `http://${request.headers.host}`).pathname}`;
  const now = Date.now();
  const entry = rateLimit.get(key) || { count: 0, resetAt: now + 60_000 };
  if (entry.resetAt < now) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  entry.count += 1;
  rateLimit.set(key, entry);
  if (entry.count > 80) {
    sendJson(response, 429, { error: "Too many requests. Please try again shortly." });
    return false;
  }
  return true;
}

function getProducts(query = {}) {
  let products = readJson(storeFiles.products);
  if (query.search) {
    const search = String(query.search).toLowerCase();
    products = products.filter((product) => `${product.name} ${product.category} ${product.region} ${product.fabric} ${product.color}`.toLowerCase().includes(search));
  }
  for (const field of ["region", "category", "fabric", "color", "occasion", "brand"]) {
    if (query[field] && query[field] !== "All") products = products.filter((product) => product[field] === query[field]);
  }
  if (query.availability === "in-stock") products = products.filter((product) => product.stock > 0);
  if (query.rating) products = products.filter((product) => product.rating >= Number(query.rating));
  if (query.price) {
    products = products.filter((product) => {
      if (query.price === "under-10000") return product.discountPrice < 10000;
      if (query.price === "10000-20000") return product.discountPrice >= 10000 && product.discountPrice <= 20000;
      if (query.price === "above-20000") return product.discountPrice > 20000;
      return true;
    });
  }
  if (query.sort === "price-low") products.sort((a, b) => a.discountPrice - b.discountPrice);
  if (query.sort === "price-high") products.sort((a, b) => b.discountPrice - a.discountPrice);
  if (query.sort === "rating") products.sort((a, b) => b.rating - a.rating);
  if (query.sort === "popularity") products.sort((a, b) => b.reviews - a.reviews);
  if (query.sort === "newest") products.sort((a, b) => (b.badge === "New Arrival") - (a.badge === "New Arrival"));
  return products;
}

function getProductFacets(products) {
  const unique = (field) => [...new Set(products.map((product) => product[field]).filter(Boolean))].sort();
  return {
    regions: unique("region"),
    categories: unique("category"),
    fabrics: unique("fabric"),
    colors: unique("color"),
    occasions: unique("occasion"),
    brands: unique("brand")
  };
}

function calculateOrder(items, couponCode = "") {
  const products = readJson(storeFiles.products);
  const enriched = items.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) return null;
    const quantity = Math.max(1, Math.min(10, Number(item.quantity) || 1));
    return {
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      discountPrice: product.discountPrice,
      quantity,
      subtotal: product.discountPrice * quantity
    };
  }).filter(Boolean);
  const subtotal = enriched.reduce((sum, item) => sum + item.subtotal, 0);
  const coupon = String(couponCode || "").trim().toUpperCase();
  const couponDiscount = coupon === "MAYKAA10" ? Math.round(subtotal * 0.1) : 0;
  const delivery = subtotal > 15000 ? 0 : 149;
  const taxable = Math.max(0, subtotal - couponDiscount);
  const taxes = Math.round(taxable * 0.05);
  const total = taxable + delivery + taxes;
  const deliveryDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString().slice(0, 10);
  return { items: enriched, subtotal, coupon, couponDiscount, delivery, taxes, total, deliveryDate };
}

function logSms(order, mobile) {
  const smsLog = readJson(storeFiles.sms);
  smsLog.push({
    mobile,
    message: `Order ${order.id} confirmed. Amount Rs. ${order.total}. Delivery by ${order.deliveryDate}. Support: support@maykaa.in`,
    provider: process.env.SMS_PROVIDER || "demo-log",
    createdAt: new Date().toISOString()
  });
  writeJson(storeFiles.sms, smsLog);
}

function serveFile(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=86400"
    });
    response.end(content);
  });
}

async function routeApi(request, response) {
  if (!checkRateLimit(request, response)) return true;
  const url = new URL(request.url, `http://${request.headers.host}`);
  const query = Object.fromEntries(url.searchParams.entries());

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "maykaa-commerce" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/products") {
    const allProducts = readJson(storeFiles.products);
    sendJson(response, 200, { products: getProducts(query), facets: getProductFacets(allProducts) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/request-otp") {
    const body = await readBody(request);
    const mobile = normalizeMobile(body.mobile);
    const purpose = body.purpose === "reset" ? "reset" : "signup";
    if (!isValidMobile(mobile)) return sendJson(response, 400, { error: "Enter a valid 10 digit mobile number" });
    const code = createOtp(mobile, purpose);
    sendJson(response, 200, {
      message: "OTP sent successfully",
      devOtp: process.env.NODE_ENV === "production" ? undefined : code
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/verify-otp") {
    const body = await readBody(request);
    const mobile = normalizeMobile(body.mobile);
    const purpose = body.purpose === "reset" ? "reset" : "signup";
    const otp = verifyOtp(mobile, body.otp, purpose);
    if (!otp) return sendJson(response, 400, { error: "Invalid or expired OTP" });
    const setupToken = signToken({ mobile, purpose, otpId: otp.id, exp: Date.now() + otpTtlMs });
    sendJson(response, 200, { message: "OTP verified", setupToken });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/set-password") {
    const body = await readBody(request);
    const payload = verifyToken(body.setupToken);
    if (!payload?.mobile || !isValidPassword(body.password)) {
      return sendJson(response, 400, { error: "OTP verification and 8 character password required" });
    }
    const users = readJson(storeFiles.users);
    let user = users.find((item) => item.mobile === payload.mobile);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        name: body.name || "मायkaa Customer",
        mobile: payload.mobile,
        email: body.email || "",
        passwordHash: hashPassword(body.password),
        createdAt: new Date().toISOString()
      };
      users.push(user);
    } else {
      user.name = body.name || user.name;
      user.email = body.email || user.email;
      user.passwordHash = hashPassword(body.password);
    }
    writeJson(storeFiles.users, users);
    const token = createSession(user);
    sendJson(response, 200, { token, user: publicUser(user) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(request);
    const mobile = normalizeMobile(body.mobile);
    const user = readJson(storeFiles.users).find((item) => item.mobile === mobile);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return sendJson(response, 401, { error: "Invalid mobile number or password" });
    }
    const token = createSession(user);
    sendJson(response, 200, { token, user: publicUser(user) });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/account") {
    const user = requireUser(request, response);
    if (!user) return true;
    sendJson(response, 200, { user: publicUser(user) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/checkout/summary") {
    const body = await readBody(request);
    sendJson(response, 200, calculateOrder(body.items || [], body.couponCode));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/payments/create") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readBody(request);
    const summary = calculateOrder(body.items || [], body.couponCode);
    const payment = {
      id: `PAY-${Date.now()}`,
      provider: process.env.RAZORPAY_KEY_ID ? "razorpay" : "demo",
      amount: summary.total,
      status: "created",
      createdAt: new Date().toISOString()
    };
    const payments = readJson(storeFiles.payments);
    payments.push(payment);
    writeJson(storeFiles.payments, payments);
    sendJson(response, 201, { payment, summary, razorpayKeyId: process.env.RAZORPAY_KEY_ID || "" });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readBody(request);
    const summary = calculateOrder(body.items || [], body.couponCode);
    if (!summary.items.length) return sendJson(response, 400, { error: "Cart is empty" });
    const order = {
      id: `MYK-${Date.now()}`,
      userId: user.id,
      address: body.address,
      paymentMethod: body.paymentMethod || "Cash on Delivery",
      transactionId: body.transactionId || `TXN-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
      status: body.paymentMethod === "Cash on Delivery" ? "Placed" : "Payment Confirmed",
      deliveryStatus: "Processing",
      createdAt: new Date().toISOString(),
      ...summary
    };
    const orders = readJson(storeFiles.orders);
    orders.push(order);
    writeJson(storeFiles.orders, orders);
    logSms(order, user.mobile);
    sendJson(response, 201, { order });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/orders") {
    const user = requireUser(request, response);
    if (!user) return true;
    const orders = readJson(storeFiles.orders).filter((order) => order.userId === user.id).reverse();
    sendJson(response, 200, { orders });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/newsletter") {
    const body = await readBody(request);
    if (!isValidEmail(body.email)) return sendJson(response, 400, { error: "Valid email is required" });
    const subscriptions = readJson(storeFiles.newsletter);
    if (!subscriptions.some((item) => item.email === body.email)) {
      subscriptions.push({ email: body.email, createdAt: new Date().toISOString() });
      writeJson(storeFiles.newsletter, subscriptions);
    }
    sendJson(response, 201, { message: "Subscribed successfully" });
    return true;
  }

  return false;
}

ensureStore();

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      const handled = await routeApi(request, response);
      if (handled) return;
      sendJson(response, 404, { error: "API route not found" });
      return;
    }
    serveFile(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Maykaa commerce running at http://localhost:${port}`);
});
