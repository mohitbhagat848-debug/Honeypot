/**
 * Tracks failed login attempts per IP.
 * Threshold: 5 failures within 10 minutes = brute force.
 */

const DEFAULT_WINDOW_MS = 10 * 60_000; // 10 minutes
const DEFAULT_FAIL_THRESHOLD = 5;      // 5 attempts = brute force

class BruteForceTracker {
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.failThreshold = options.failThreshold ?? DEFAULT_FAIL_THRESHOLD;
    this.failures = new Map(); // ip -> timestamp[]
  }

  prune(ip, now) {
    const arr = this.failures.get(ip) || [];
    const cutoff = now - this.windowMs;
    const next = arr.filter((t) => t > cutoff);
    this.failures.set(ip, next);
    return next;
  }

  recordFailure(ip) {
    const now = Date.now();
    const times = this.prune(ip, now);
    times.push(now);
    this.failures.set(ip, times);
    const count = times.length;
    return {
      failCount: count,
      bruteForce: count >= this.failThreshold,
    };
  }

  reset(ip) {
    this.failures.delete(ip);
  }

  getFailCount(ip) {
    const times = this.prune(ip, Date.now());
    return times.length;
  }
}

module.exports = { BruteForceTracker };
