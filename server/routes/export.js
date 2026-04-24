const express = require("express");
const AttackLog = require("../models/AttackLog");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

function escapeCsv(v) {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/csv", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5000, 20000);
  const rows = await AttackLog.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const cols = [
    "createdAt",
    "ip",
    "country",
    "city",
    "classification",
    "riskScore",
    "attackTypes",
    "trapAction",
    "path",
    "method",
    "userAgent",
  ];
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(
      cols
        .map((c) => {
          if (c === "attackTypes") return escapeCsv((r.attackTypes || []).join("|"));
          return escapeCsv(r[c]);
        })
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=honeypot-logs.csv");
  res.send(lines.join("\n"));
});

module.exports = router;
