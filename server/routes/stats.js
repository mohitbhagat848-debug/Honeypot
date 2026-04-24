const express = require("express");
const AttackLog = require("../models/AttackLog");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/summary", async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [byClass, topIps, byType, total24h, totalAll] = await Promise.all([
    AttackLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$classification", c: { $sum: 1 } } },
    ]),
    AttackLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$ip", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 10 },
    ]),
    AttackLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: "$attackTypes" },
      { $group: { _id: "$attackTypes", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 12 },
    ]),
    AttackLog.countDocuments({ createdAt: { $gte: since } }),
    AttackLog.countDocuments(),
  ]);

  res.json({
    byClass: Object.fromEntries(byClass.map((x) => [x._id, x.c])),
    topIps,
    byType,
    total24h,
    totalAll,
  });
});

router.get("/timeseries", async (req, res) => {
  const minutes = Math.min(parseInt(req.query.minutes, 10) || 60, 24 * 60);
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const buckets = await AttackLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%dT%H:%M", date: "$createdAt", timezone: "UTC" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ minutes, buckets });
});

module.exports = router;
