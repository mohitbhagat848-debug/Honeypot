const ADMIN_ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || "127.0.0.1,::1").split(",").map(ip => ip.trim());
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

const adminIpFilter = () => (req, res, next) => {
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
  const deviceId = deviceIdCookie ? deviceIdCookie.split("=")[1] : undefined;

  const isDeviceAllowed = !ADMIN_SECRET_KEY || deviceId === ADMIN_SECRET_KEY;

  const isLocalhost = normalizedIp === "127.0.0.1" || normalizedIp === "::1";

  if (isLocalhost || (isIpAllowed && isDeviceAllowed)) {
    return next();
  }

  // If not allowed, trap them!
  console.log(`[Security] Blocked access attempt: IP=${normalizedIp}, DeviceID=${deviceId ? "Provided" : "Missing"}`);
  return res.redirect("/trap");
};

module.exports = { adminIpFilter };
