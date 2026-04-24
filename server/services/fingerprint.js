const UAParser = require("ua-parser-js");

function fingerprintFromUA(ua) {
  if (!ua) return { browser: "Unknown", os: "Unknown" };
  const p = new UAParser(ua).getResult();
  const browser = [p.browser.name, p.browser.version].filter(Boolean).join(" ") || "Unknown";
  const os = [p.os.name, p.os.version].filter(Boolean).join(" ") || "Unknown";
  return { browser, os };
}

module.exports = { fingerprintFromUA };
