const BlockedIP = require("../models/BlockedIP");

let cache = new Map();
let cacheAt = 0;
const TTL_MS = 30_000;

async function refreshCache() {
  const rows = await BlockedIP.find().lean();
  cache = new Map(rows.map((r) => [r.ip, true]));
  cacheAt = Date.now();
}

async function isBlocked(ip) {
  if (Date.now() - cacheAt > TTL_MS) {
    try {
      await refreshCache();
    } catch {
      /* ignore */
    }
  }
  return cache.has(ip);
}

function isLocalDevIp(ip) {
  if (!ip || ip === "unknown") {
    return false;
  }
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  );
}

function blocklistMiddleware() {
  return async (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    // Never block local loopback traffic in development.
    if (isLocalDevIp(ip)) {
      return next();
    }
    if (await isBlocked(ip)) {
      return res.status(403).type("text/plain").send("Forbidden");
    }
    next();
  };
}

module.exports = { blocklistMiddleware, isBlocked, refreshCache };
