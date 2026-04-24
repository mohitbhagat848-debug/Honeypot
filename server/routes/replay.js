const express = require("express");
const AttackLog = require("../models/AttackLog");
const { authMiddleware } = require("../middleware/auth");
const { analyzeInteraction } = require("../../analyzer");

const router = express.Router();
router.use(authMiddleware);

/**
 * Re-runs detection on a stored log (research / training). Does not forward traffic.
 */
router.post("/:id", async (req, res) => {
  const doc = await AttackLog.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: "Not found" });

  const analysis = analyzeInteraction({
    ip: doc.ip,
    method: doc.method || "GET",
    path: doc.path || "",
    query: doc.query || {},
    body: doc.body || {},
    headers: doc.headers || {},
    trapAction: doc.trapAction || null,
    skipSideEffects: true,
  });

  res.json({
    original: {
      classification: doc.classification,
      attackTypes: doc.attackTypes,
      riskScore: doc.riskScore,
    },
    replay: analysis,
  });
});

module.exports = router;
