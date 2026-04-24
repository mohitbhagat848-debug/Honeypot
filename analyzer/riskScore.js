/**
 * Risk score 0–100 for dashboard sorting and severity ranking.
 */

const ATTACK_WEIGHTS = {
  sql_injection: 18,
  command_injection: 20,
  path_traversal: 15,
  xss: 14,
  ssrf: 18,
  xxe: 16,
  file_inclusion: 15,
  ldap_injection: 12,
  scanner_probe: 8,
  brute_force: 22,
  credential_stuffing: 10,
  rate_anomaly: 6,
  rate_anomaly_high: 14,
};

function riskScoreFromTags({ classification, attackTypes, rateAnomaly, bruteForce }) {
  let score = 0;

  // Base score from classification
  if (classification === "malicious") score += 35;
  else if (classification === "suspicious") score += 15;

  // Weight each attack type individually
  const types = attackTypes || [];
  for (const t of types) {
    score += ATTACK_WEIGHTS[t] || 8;
  }

  // Rate anomaly bonus
  if (rateAnomaly === "high") score += 18;
  else if (rateAnomaly === "suspicious") score += 8;

  // Brute force bonus
  if (bruteForce) score += 20;

  return Math.min(100, Math.round(score));
}

module.exports = { riskScoreFromTags };
