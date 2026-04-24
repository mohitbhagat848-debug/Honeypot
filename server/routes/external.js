const express = require("express");
const BlockedIP = require("../models/BlockedIP");
const AttackLog = require("../models/AttackLog");
const { isBlocked, refreshCache } = require("../middleware/blocklist");

const router = express.Router();
const API_KEY = process.env.EXTERNAL_API_KEY || "hp_ext_7721_safe_shield";

/**
 * PUBLIC: Check if an IP is blocked.
 * Used by external sites to decide whether to allow a visitor.
 */
router.get("/check", async (req, res) => {
  const ip = req.query.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const blocked = await isBlocked(ip);
  res.json({ ip, blocked, action: blocked ? "block" : "allow" });
});

/**
 * PROTECTED: Report an attack from an external site.
 * Requires X-HP-KEY header.
 */
router.post("/signal", express.json(), async (req, res) => {
  const key = req.headers["x-hp-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ error: "Invalid API Key" });
  }

  const { ip, type, detail, metadata } = req.body;
  if (!ip) return res.status(400).json({ error: "IP required" });

  // 1. Log the attack in the central database
  const log = await AttackLog.create({
    ip,
    attackTypes: [type || "external_report"],
    classification: "malicious",
    riskScore: 90,
    path: detail || "External Protection Signal",
    method: "REMOTE",
    userAgent: metadata?.userAgent || "Remote Sensor",
    country: metadata?.country || "Remote",
    city: metadata?.city || "Remote",
    // Mark as remote signal
    trapPage: "remote_sensor",
    trapAction: "signal_received"
  });

  // 2. Automatically block the IP globally
  await BlockedIP.findOneAndUpdate(
    { ip },
    { reason: `Remote Signal: ${type || 'attack'} detected on external site`, createdBy: "System Sensor" },
    { upsert: true }
  );

  await refreshCache();

  res.json({ ok: true, message: "Signal received, IP blocked globally", logId: log._id });
});

module.exports = router;
