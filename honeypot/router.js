const express = require("express");
const multer = require("multer");
const { loginPage, dbPanelPage, uploadPage, adminPage } = require("./trapPages");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

/**
 * @param {object} deps
 * @param {(req: object, extra: object) => Promise<void>} deps.recordInteraction
 */
function createHoneypotRouter({ recordInteraction }) {
  const r = express.Router();
  const GEO_FIELDS = [
    "geoLat", "geoLon", "geoAccuracy", "geoAltitude", "geoCapturedAt", "clientTimeZone", "clientPublicIp",
    "webRtcIps", "clientLanguage", "clientPlatform", "clientVendor", "screenRes", "screenAvail",
    "colorDepth", "pixelRatio", "clientHardwareConcurrency", "clientMemory", "cookiesEnabled",
    "doNotTrack", "referrer", "pageUrl", "maxTouchPoints", "touchSupport", "pluginsCount",
    "canvasFingerprint", "webglRenderer", "connectionType", "connectionDownlink", "connectionRtt",
    "batteryLevel", "batteryCharging",
    "ipGeoCity", "ipGeoRegion", "ipGeoCountry", "ipGeoCountryCode", "ipGeoIsp", "ipGeoSource",
  ];

  // Fields that may contain longer JSON values
  const LONG_FIELDS = new Set(["webRtcIps"]);

  // Standard security headers — no honeypot markers
  r.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  async function safeRecord(req, extra) {
    try {
      await recordInteraction(req, extra);
    } catch (e) {
      console.error("[system] record error", e.message);
    }
  }

  function enrichBodyWithClientGeo(req, body = {}) {
    const out = { ...body };
    for (const key of GEO_FIELDS) {
      if (req.body && req.body[key] !== undefined && req.body[key] !== "") {
        const maxLen = LONG_FIELDS.has(key) ? 512 : 64;
        out[key] = String(req.body[key]).slice(0, maxLen);
      }
    }
    return out;
  }

  /* ── Trap page views ─────────────────────────────────────────── */

  r.get("/", async (req, res) => {
    await safeRecord(req, {
      trapAction: "page_view",
      trapPage: "login",
    });
    res.type("html").send(loginPage);
  });

  r.get("/db", async (req, res) => {
    await safeRecord(req, { trapAction: "page_view", trapPage: "db" });
    res.type("html").send(dbPanelPage);
  });

  r.get("/upload", async (req, res) => {
    await safeRecord(req, { trapAction: "page_view", trapPage: "upload" });
    res.type("html").send(uploadPage);
  });

  r.get("/admin", async (req, res) => {
    await safeRecord(req, { trapAction: "page_view", trapPage: "admin" });
    res.type("html").send(adminPage);
  });

  /* ── Login trap ──────────────────────────────────────────────── */
  r.post("/login", express.urlencoded({ extended: true, limit: "32kb" }), async (req, res) => {
    const { username = "", password = "" } = req.body;
    const u = String(username).slice(0, 128);
    const p = String(password).slice(0, 256);

    // Realistic delay 1–2 seconds to simulate real auth
    const delay = 1000 + Math.floor(Math.random() * 1000);

    // Determine trap action
    const trapAction =
      u.toLowerCase() === "admin" && p === "admin123"
        ? "login_success_fake"
        : "login_fail";

    await safeRecord(req, {
      trapAction,
      trapPage: "login",
      body: enrichBodyWithClientGeo(req, { username: u, password: "[redacted]" }),
    });

    // Fake "success" → redirect to DB panel (honeypot deeper trap)
    if (trapAction === "login_success_fake") {
      return res.json({
        delay,
        redirect: "/trap/db?welcome=1",
      });
    }

    // ALWAYS return "invalid credentials" — never reveal real auth status
    const msgs = [
      "Invalid credentials. Please try again.",
      "Account temporarily locked due to multiple failed attempts.",
      "Authentication failed. Please verify your access key.",
      "Session expired. Re-enter credentials.",
      "Unable to authenticate. Contact your administrator.",
    ];
    return res.json({
      delay,
      message: msgs[Math.floor(Math.random() * msgs.length)],
    });
  });

  /* ── Fake DB query trap ──────────────────────────────────────── */
  r.post("/query", express.urlencoded({ extended: true, limit: "64kb" }), async (req, res) => {
    const q = String(req.body.q || "").slice(0, 2000);
    const delay = 800 + Math.floor(Math.random() * 1200);

    await safeRecord(req, {
      trapAction: "fake_query",
      trapPage: "db",
      body: enrichBodyWithClientGeo(req, { q }),
    });

    // Fake database response to keep attacker engaged
    const fakeTables = [
      "id | username  | role   | last_login\n---|-----------|--------|-------------------\n01 | svc_batch | read   | 2026-04-15 23:41\n02 | legacy    | none   | 2026-03-02 11:18\n03 | backup_sa | admin  | 2026-04-16 08:30",
      "ERROR 1045 (28000): Access denied for user 'root'@'%'\nTry: SELECT @@version;",
      "id | email              | status\n---|--------------------|---------\n01 | ops@internal.corp  | active\n02 | dev@internal.corp  | disabled",
    ];

    const fakeDump = fakeTables[Math.floor(Math.random() * fakeTables.length)];
    const html = `<p class="ok">Query executed — ${Math.floor(Math.random() * 3) + 1} rows returned</p><pre class="dump">${fakeDump}</pre>`;
    return res.json({ delay, html });
  });

  /* ── Fake file upload trap ───────────────────────────────────── */
  r.post("/upload", upload.single("file"), async (req, res) => {
    const delay = 800 + Math.floor(Math.random() * 1200);
    const name = req.file ? req.file.originalname : "(none)";
    await safeRecord(req, {
      trapAction: "fake_upload",
      trapPage: "upload",
      body: enrichBodyWithClientGeo(req, {
        originalname: name,
        size: req.file ? req.file.size : 0,
      }),
    });
    return res.json({
      delay,
      message: `File "${name}" uploaded successfully to /var/data/uploads/`,
    });
  });

  /* ── Silent beacon (auto-fires on page load) ─────────────────── */
  r.post("/beacon", express.urlencoded({ extended: true, limit: "64kb" }), async (req, res) => {
    const beaconPage = String(req.body._beaconPage || "/trap").slice(0, 128);
    await safeRecord(req, {
      trapAction: "silent_beacon",
      trapPage: beaconPage.replace(/^\/trap\/?/, "") || "login",
      body: enrichBodyWithClientGeo(req, {
        beaconType: "page_load",
        canvasFingerprint: String(req.body.canvasFingerprint || "").slice(0, 64),
        webglRenderer: String(req.body.webglRenderer || "").slice(0, 256),
        connectionType: String(req.body.connectionType || "").slice(0, 32),
        connectionDownlink: String(req.body.connectionDownlink || "").slice(0, 16),
        connectionRtt: String(req.body.connectionRtt || "").slice(0, 16),
        batteryLevel: String(req.body.batteryLevel || "").slice(0, 8),
        batteryCharging: String(req.body.batteryCharging || "").slice(0, 8),
        maxTouchPoints: String(req.body.maxTouchPoints || "").slice(0, 8),
        touchSupport: String(req.body.touchSupport || "").slice(0, 8),
        pluginsCount: String(req.body.pluginsCount || "").slice(0, 8),
        screenAvail: String(req.body.screenAvail || "").slice(0, 32),
        colorDepth: String(req.body.colorDepth || "").slice(0, 8),
        pixelRatio: String(req.body.pixelRatio || "").slice(0, 16),
        clientVendor: String(req.body.clientVendor || "").slice(0, 128),
        clientHardwareConcurrency: String(req.body.clientHardwareConcurrency || "").slice(0, 8),
        clientMemory: String(req.body.clientMemory || "").slice(0, 8),
        cookiesEnabled: String(req.body.cookiesEnabled || "").slice(0, 8),
        doNotTrack: String(req.body.doNotTrack || "").slice(0, 8),
        referrer: String(req.body.referrer || "").slice(0, 512),
        pageUrl: String(req.body.pageUrl || "").slice(0, 512),
      }),
    });
    res.status(204).end();
  });

  /* ── Delayed fingerprint update (GPS that arrives late) ────────── */
  r.post("/fingerprint", express.urlencoded({ extended: true, limit: "64kb" }), async (req, res) => {
    await safeRecord(req, {
      trapAction: "delayed_fingerprint",
      trapPage: String(req.body._beaconPage || "/trap").replace(/^\/trap\/?/, "") || "login",
      body: enrichBodyWithClientGeo(req, {
        beaconType: "delayed_gps",
      }),
    });
    res.status(204).end();
  });

  /* ── Catch-all for common probe paths ────────────────────────── */
  r.use(async (req, res) => {
    await safeRecord(req, {
      trapAction: "probe_scan",
      trapPage: "unknown",
    });
    res.status(404).json({ error: "Not found" });
  });

  return r;
}

module.exports = { createHoneypotRouter };
