/**
 * dashboard_proxy.js
 * ---------------------------------------------------------------------------
 * Full reverse proxy for Apache Superset.
 * Anyone on the WiFi opens  http://<your-ip>:3000/
 * The proxy auto-logs in as admin and forwards ALL requests (including the
 * POST chart-data calls Superset's React SPA needs) to Superset on :8088.
 *
 * Run:  node dashboard_proxy.js
 * ---------------------------------------------------------------------------
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const SUPERSET_BASE  = "http://localhost:8088";
const DASHBOARD_PATH = "/superset/dashboard/17/";
const USERNAME       = "admin";
const PASSWORD       = "admin";
const PROXY_PORT     = 3000;

// Headers from the browser we pass through to Superset
const PASSTHROUGH_REQ_HEADERS = [
  "content-type",
  "accept",
  "accept-encoding",
  "accept-language",
  "x-csrftoken",
  "x-requested-with",
  "referer",
  "cache-control",
];

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchUrl(options, body) {
  return new Promise((resolve, reject) => {
    const mod = options.protocol === "https:" ? https : http;
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    if (body && body.length) req.write(body);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const h of [].concat(setCookieHeaders || [])) {
    const [pair] = h.split(";");
    const [k, v] = pair.split("=");
    if (k) jar[k.trim()] = (v || "").trim();
  }
  return jar;
}

function cookieString(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ── login flow ────────────────────────────────────────────────────────────────

async function getSessionCookies() {
  const base = new URL(SUPERSET_BASE);
  const host = base.hostname;
  const port = parseInt(base.port, 10) || 80;
  const proto = base.protocol;

  // 1. GET /login/ → CSRF token + initial session cookie
  const loginGet = await fetchUrl({ hostname: host, port, protocol: proto, path: "/login/", method: "GET" });
  let jar = parseCookies(loginGet.headers["set-cookie"]);
  const html = loginGet.body.toString();
  const csrfMatch = html.match(/name="csrf_token"[^>]+value="([^"]+)"/);
  if (!csrfMatch) throw new Error("CSRF token not found on login page");
  const csrf = csrfMatch[1];

  // 2. POST /login/
  const bodyStr = new URLSearchParams({ username: USERNAME, password: PASSWORD, csrf_token: csrf }).toString();
  const bodyBuf = Buffer.from(bodyStr);

  const loginPost = await fetchUrl({
    hostname: host, port, protocol: proto,
    path: "/login/",
    method: "POST",
    headers: {
      "Content-Type":   "application/x-www-form-urlencoded",
      "Content-Length": bodyBuf.length,
      Cookie:           cookieString(jar),
      Referer:          `${SUPERSET_BASE}/login/`,
    },
  }, bodyBuf);

  jar = { ...jar, ...parseCookies(loginPost.headers["set-cookie"]) };
  if (!jar.session) throw new Error("Login failed — no session cookie returned");
  return jar;
}

// ── upstream request ──────────────────────────────────────────────────────────

async function proxyRequest(path, method, jar, body, extraHeaders) {
  const base = new URL(SUPERSET_BASE);
  const headers = {
    Cookie:       cookieString(jar),
    "User-Agent": "SupersetProxy/2.0",
    ...extraHeaders,
  };
  if (body && body.length) headers["Content-Length"] = body.length;

  return fetchUrl(
    { hostname: base.hostname, port: parseInt(base.port, 10) || 80, protocol: base.protocol, path, method, headers },
    body
  );
}

// ── session cache ─────────────────────────────────────────────────────────────

let cachedJar = null;
let jarExpiry  = 0;

async function getJar() {
  if (!cachedJar || Date.now() > jarExpiry) {
    console.log("  [proxy] authenticating with Superset...");
    cachedJar = await getSessionCookies();
    jarExpiry  = Date.now() + 20 * 60 * 1000; // 20 min
    console.log("  [proxy] session ready");
  }
  return cachedJar;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }

  // Root → redirect browser to dashboard (React router must see the real path)
  if (!req.url || req.url === "/") {
    res.writeHead(302, { Location: DASHBOARD_PATH });
    res.end();
    return;
  }

  const targetPath = req.url;

  // Collect request body (needed for POST chart-data calls)
  const bodyChunks = [];
  req.on("data", (c) => bodyChunks.push(c));
  await new Promise((r) => req.on("end", r));
  const bodyBuf = bodyChunks.length ? Buffer.concat(bodyChunks) : null;

  // Extract passthrough headers from the browser request
  const extraHeaders = {};
  for (const h of PASSTHROUGH_REQ_HEADERS) {
    if (req.headers[h]) extraHeaders[h] = req.headers[h];
  }

  console.log(`  [proxy] ${req.method} ${targetPath}${bodyBuf ? ` (${bodyBuf.length}B body)` : ""}`);

  try {
    const jar = await getJar();
    let upstream = await proxyRequest(targetPath, req.method, jar, bodyBuf, extraHeaders);

    // Session expired mid-run → refresh and retry once
    if (
      upstream.status === 302 &&
      (upstream.headers.location || "").includes("/login")
    ) {
      cachedJar = null;
      const freshJar = await getJar();
      upstream = await proxyRequest(targetPath, req.method, freshJar, bodyBuf, extraHeaders);
    }

    sendResponse(res, upstream);
  } catch (err) {
    console.error("  [proxy] ERROR:", err.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy error: ${err.message}`);
  }
});

function sendResponse(res, upstream) {
  const headers = { ...upstream.headers };

  // Don't give the browser the Superset session — proxy is the sole bearer
  delete headers["set-cookie"];
  delete headers["transfer-encoding"];

  // Rewrite absolute Location headers pointing at :8088 → :3000
  if (headers.location) {
    headers.location = headers.location
      .replace(SUPERSET_BASE, `http://localhost:${PROXY_PORT}`)
      .replace(/http:\/\/127\.0\.0\.1:8088/g, `http://localhost:${PROXY_PORT}`);
  }

  res.writeHead(upstream.status, headers);
  res.end(upstream.body);
}

// ── startup ───────────────────────────────────────────────────────────────────

server.listen(PROXY_PORT, "0.0.0.0", async () => {
  console.log("=".repeat(60));
  console.log("  Superset Dashboard Proxy  —  ready");
  console.log("=".repeat(60));
  console.log(`  This machine : http://localhost:${PROXY_PORT}/`);
  console.log(`  WiFi (share) : http://192.168.29.41:${PROXY_PORT}/`);
  console.log("  Click either link to open the Sales Overview dashboard.");
  console.log("  No login required — proxy authenticates automatically.");
  console.log("=".repeat(60));

  try {
    await getJar();
    console.log("  Dashboard is ready to view.\n");
  } catch (e) {
    console.error("  WARNING: Could not pre-warm session:", e.message);
    console.error("  Is Superset running on localhost:8088?\n");
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`  Port ${PROXY_PORT} already in use — change PROXY_PORT at the top of this file.`);
  } else {
    console.error("  Server error:", e.message);
  }
  process.exit(1);
});
