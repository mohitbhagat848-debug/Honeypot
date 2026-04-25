const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || "127.0.0.1,::1").split(",").map(ip => ip.trim());
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

const adminIpFilter = (recordInteraction) => (req, res, next) => {
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const normalizedIp = clientIp === "::ffff:127.0.0.1" ? "127.0.0.1" : clientIp;

  // 1. Check IP Allowlist (Supports '*' for debugging)
  const isIpAllowed = ADMIN_ALLOWED_IPS.includes("*") || ADMIN_ALLOWED_IPS.some(allowed => {
    if (allowed === "localhost") return normalizedIp === "127.0.0.1" || normalizedIp === "::1";
    return normalizedIp === allowed;
  });

  // 2. Check Device Secret Key (The Browser Cookie)
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map(c => c.trim());
  const deviceIdCookie = cookies.find(c => c.startsWith("x-admin-device-id="));
  
  // Support both Cookie and Header for cross-domain compatibility
  const deviceId = (deviceIdCookie ? deviceIdCookie.split("=")[1] : undefined) || req.headers["x-admin-device-id"];

  const isDeviceAllowed = !ADMIN_SECRET_KEY || deviceId === ADMIN_SECRET_KEY;

  const isLocalhost = normalizedIp === "127.0.0.1" || normalizedIp === "::1";

  if (isLocalhost || (isIpAllowed && isDeviceAllowed)) {
    return next();
  }

  // --- THE GHOST TRAP ---
  // 1. Record the attack silently
  if (typeof recordInteraction === "function") {
    recordInteraction(req, {
      source: "admin_firewall",
      trapPage: "admin_panel",
      trapAction: "unauthorized_entry_attempt",
      classification: "malicious",
      riskScore: 95, // Extremely high risk
      body: { 
        attemptedPath: req.path,
        reason: isIpAllowed ? "Device ID Mismatch" : "Unauthorized IP",
        browserDeviceId: deviceId || "none"
      }
    }).catch(() => {});
  }

  // 2. Show a generic "Processing" error instead of a security warning
  // This keeps the attacker confused and "stuck" trying different things
  console.log(`[Ghost Trap] Blocked & Recorded: IP=${normalizedIp}`);
  return res.status(403).json({ 
    error: "Connection timeout", 
    message: "The server is taking too long to respond. Please try again in a few minutes." 
  });
};

module.exports = { adminIpFilter };
