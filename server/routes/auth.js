const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

function createAuthRouter({ recordInteraction } = {}) {
  const router = express.Router();

  async function safeRecord(req, extra) {
    if (typeof recordInteraction !== "function") return;
    try {
      await recordInteraction(req, extra);
    } catch (err) {
      console.error("[auth] record error:", err.message);
    }
  }

  router.post("/login", express.json(), async (req, res) => {
    try {
      const { email, password, geoLat, geoLon, geoAccuracy, geoCapturedAt, clientTimeZone, clientPublicIp } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: "Server auth configuration missing" });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const geoBody = {
        email: normalizedEmail,
      };
      if (geoLat !== undefined) geoBody.geoLat = geoLat;
      if (geoLon !== undefined) geoBody.geoLon = geoLon;
      if (geoAccuracy !== undefined) geoBody.geoAccuracy = geoAccuracy;
      if (geoCapturedAt !== undefined) geoBody.geoCapturedAt = geoCapturedAt;
      if (clientTimeZone !== undefined) geoBody.clientTimeZone = clientTimeZone;
      if (clientPublicIp !== undefined) geoBody.clientPublicIp = clientPublicIp;

      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !(await user.comparePassword(password))) {
        await safeRecord(req, {
          source: "dashboard_auth",
          trapPage: "admin_auth",
          trapAction: "admin_login_fail",
          body: geoBody,
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      await safeRecord(req, {
        source: "dashboard_auth",
        trapPage: "admin_auth",
        trapAction: "admin_login_success",
        body: geoBody,
      });

      const token = jwt.sign(
        { sub: user._id.toString(), email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );
      return res.json({
        token,
        user: { email: user.email, role: user.role },
      });
    } catch (err) {
      console.error("Login failed:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/me", authMiddleware, async (req, res) => {
    return res.json({ user: { email: req.user.email, role: req.user.role } });
  });

  return router;
}

module.exports = { createAuthRouter };
