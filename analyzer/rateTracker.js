/**
 * In-memory sliding window for request rate anomaly detection.
 * Tracks requests per IP per minute.
 * >10 requests/min = suspicious (scanning activity)
 * >30 requests/min = high (aggressive scanning/bot)
 */

const DEFAULT_WINDOW_MS = 60_000;      // 1 minute window
const DEFAULT_HIGH_THRESHOLD = 30;     // aggressive bot/scanner
const DEFAULT_SUSPICIOUS_THRESHOLD = 10; // possible scanning

class RateTracker {
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.highThreshold = options.highThreshold ?? DEFAULT_HIGH_THRESHOLD;
    this.suspiciousThreshold = options.suspiciousThreshold ?? DEFAULT_SUSPICIOUS_THRESHOLD;
    this.buckets = new Map(); // ip -> number[]
  }

  prune(ip, now) {
    const arr = this.buckets.get(ip) || [];
    const cutoff = now - this.windowMs;
    const next = arr.filter((t) => t > cutoff);
    this.buckets.set(ip, next);
    return next;
  }

  /**
   * Record a hit; returns { countInWindow, anomaly: 'none'|'suspicious'|'high' }
   */
  record(ip) {
    const now = Date.now();
    const times = this.prune(ip, now);
    times.push(now);
    this.buckets.set(ip, times);
    const count = times.length;
    let anomaly = "none";
    if (count >= this.highThreshold) anomaly = "high";
    else if (count >= this.suspiciousThreshold) anomaly = "suspicious";
    return { countInWindow: count, anomaly };
  }

  getCount(ip) {
    return this.prune(ip, Date.now()).length;
  }
}

module.exports = { RateTracker };
