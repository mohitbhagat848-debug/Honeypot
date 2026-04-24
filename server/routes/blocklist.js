const express = require("express");
const BlockedIP = require("../models/BlockedIP");
const { authMiddleware } = require("../middleware/auth");
const { refreshCache } = require("../middleware/blocklist");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const rows = await BlockedIP.find().sort({ createdAt: -1 }).lean();
  res.json(rows);
});

router.post("/", express.json(), async (req, res) => {
  const { ip, reason } = req.body || {};
  if (!ip || typeof ip !== "string") {
    return res.status(400).json({ error: "ip required" });
  }
  const doc = await BlockedIP.findOneAndUpdate(
    { ip: ip.trim() },
    { reason: reason || "", createdBy: req.user.email },
    { upsert: true, new: true }
  );
  await refreshCache();
  res.json(doc);
});

router.delete("/:ip", async (req, res) => {
  await BlockedIP.deleteOne({ ip: req.params.ip });
  await refreshCache();
  res.json({ ok: true });
});

module.exports = router;
