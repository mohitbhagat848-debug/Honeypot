const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || "127.0.0.1,::1").split(",").map(ip => ip.trim());
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

/**
 * Middleware to restrict access to administrative routes based on IP allowlist
 * AND a secret device-specific key.
 */
function adminIpFilter() {
  return (req, res, next) => {
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    // Normalize IPv6 loopback
    const normalizedIp = clientIp === "::ffff:127.0.0.1" ? "127.0.0.1" : clientIp;

    const isIpAllowed = ADMIN_ALLOWED_IPS.some(allowed => {
      if (allowed === "localhost") return normalizedIp === "127.0.0.1" || normalizedIp === "::1";
      return normalizedIp === allowed;
    });

    // Check for the Secret Device Key in Cookies
    const deviceId = req.headers.cookie
      ?.split("; ")
      ?.find(row => row.startsWith("x-admin-device-id="))
      ?.split("=")[1];

    const isDeviceAllowed = deviceId === ADMIN_SECRET_KEY;

    // LOCALHOST EXEMPTION: To prevent locking yourself out of your own computer
    const isLocalhost = normalizedIp === "127.0.0.1" || normalizedIp === "::1";

    if (!isIpAllowed || (!isDeviceAllowed && !isLocalhost)) {
      console.warn(`[Security] Blocked access attempt: IP=${normalizedIp}, DeviceValid=${isDeviceAllowed}`);
      return res.redirect("/trap");
    }

    next();
  };
}

module.exports = { adminIpFilter };
