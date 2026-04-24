const express = require("express");
const AttackLog = require("../models/AttackLog");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const skip = parseInt(req.query.skip, 10) || 0;
  const q = {};
  if (req.query.ip) q.ip = req.query.ip;
  if (req.query.classification) q.classification = req.query.classification;
  const [items, total] = await Promise.all([
    AttackLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AttackLog.countDocuments(q),
  ]);
  res.json({ items, total, limit, skip });
});

router.get("/:id", async (req, res) => {
  const doc = await AttackLog.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

module.exports = router;
