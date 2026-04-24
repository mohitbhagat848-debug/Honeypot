const { scanObject, scanPath } = require("./patterns");
const { RateTracker } = require("./rateTracker");
const { BruteForceTracker } = require("./bruteForceTracker");
const { riskScoreFromTags } = require("./riskScore");

const rateTracker = new RateTracker();
const bruteTracker = new BruteForceTracker();

/**
 * Classify request: normal | suspicious | malicious
 */
function classifyRequest({ patternHits, rateAnomaly, bruteForce, path }) {
  if (bruteForce || patternHits.length > 0) {
    const severe =
      patternHits.some((p) =>
        ["sql_injection", "command_injection", "path_traversal", "ssrf", "xxe", "file_inclusion"].includes(p)
      ) || bruteForce;
    if (severe || rateAnomaly === "high") return "malicious";
    return "suspicious";
  }
  if (rateAnomaly === "suspicious" || rateAnomaly === "high")
    return "suspicious";

  // Check path for scanner probes
  const pathHits = scanPath(path);
  if (pathHits.length > 0) return "suspicious";

  return "normal";
}

/**
 * Full analysis for one interaction.
 */
function analyzeInteraction({
  ip,
  method,
  path,
  query,
  body,
  headers,
  trapAction = null,
  skipSideEffects = false,
}) {
  const patternHits = [];
  patternHits.push(...scanObject(query));
  patternHits.push(...scanObject(body));
  patternHits.push(...scanObject(headers));

  // Also scan the path itself for probes and traversal
  const pathHits = scanPath(path);
  patternHits.push(...pathHits);

  let countInWindow = 0;
  let rateAnomaly = "none";
  if (!skipSideEffects) {
    const r = rateTracker.record(ip);
    countInWindow = r.countInWindow;
    rateAnomaly = r.anomaly;
  }

  let bruteForce = false;
  let bruteInfo = { failCount: 0, bruteForce: false };
  if (!skipSideEffects) {
    if (trapAction === "login_fail") {
      bruteInfo = bruteTracker.recordFailure(ip);
      bruteForce = bruteInfo.bruteForce;
    } else if (trapAction === "login_success_fake" || trapAction === "login_success") {
      bruteTracker.reset(ip);
    }
  }

  const attackTypes = [...new Set(patternHits)];
  if (bruteForce) attackTypes.push("brute_force");
  if (rateAnomaly === "high") attackTypes.push("rate_anomaly_high");
  else if (rateAnomaly === "suspicious") attackTypes.push("rate_anomaly");

  // Add credential stuffing if login attempt with common usernames
  if (trapAction && body) {
    const username = body.username || body.user || body.login || "";
    if (/^(admin|root|administrator|test|user|guest|sa|postgres|mysql)$/i.test(String(username))) {
      if (!attackTypes.includes("credential_stuffing")) {
        attackTypes.push("credential_stuffing");
      }
    }
  }

  const classification = classifyRequest({
    patternHits: attackTypes.filter((t) => !t.startsWith("rate_")),
    rateAnomaly,
    bruteForce,
    path,
  });

  const riskScore = riskScoreFromTags({
    classification,
    attackTypes,
    rateAnomaly,
    bruteForce,
  });

  return {
    attackTypes,
    classification,
    riskScore,
    rateCount: countInWindow,
    rateAnomaly,
    bruteForce,
    bruteFailCount: bruteInfo.failCount,
  };
}

module.exports = {
  analyzeInteraction,
  rateTracker,
  bruteTracker,
  riskScoreFromTags,
  scanObject,
  scanPath,
};
