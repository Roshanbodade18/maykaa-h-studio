const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 3000;

const products = [
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

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) request.destroy();
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

function appendJsonLine(fileName, data) {
  const dataDir = path.join(root, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  fs.appendFileSync(path.join(dataDir, fileName), `${JSON.stringify(data)}\n`);
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
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/products") {
    sendJson(response, 200, products);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    try {
      const payload = await readBody(request);
      const order = {
        id: `MYK-${Date.now()}`,
        createdAt: new Date().toISOString(),
        items: payload.items || []
      };
      appendJsonLine("orders.jsonl", order);
      sendJson(response, 201, order);
    } catch {
      sendJson(response, 400, { error: "Invalid order request" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/newsletter") {
    try {
      const payload = await readBody(request);
      if (!payload.email || !String(payload.email).includes("@")) {
        sendJson(response, 400, { error: "Valid email is required" });
        return;
      }
      const subscription = { email: payload.email, createdAt: new Date().toISOString() };
      appendJsonLine("newsletter.jsonl", subscription);
      sendJson(response, 201, subscription);
    } catch {
      sendJson(response, 400, { error: "Invalid newsletter request" });
    }
    return;
  }

  serveFile(request, response);
});

server.listen(port, () => {
  console.log(`मायkaa website running at http://localhost:${port}`);
});
