/**
 * Attack pattern detection engine.
 * Tags payloads for monitoring and classification.
 */

const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR\s+1\s*=\s*1|OR\s+'1'\s*=\s*'1')\b)/i,
  /(--|\#|\/\*)/,
  /(\bEXEC(\s|\()\b|\bEXECUTE\b)/i,
  /(\bWAITFOR\s+DELAY\b)/i,
  /(\bINTO\s+OUTFILE\b)/i,
  /(\bINFORMATION_SCHEMA\b)/i,
  /(\bSLEEP\s*\()/i,
  /(\bBENCHMARK\s*\()/i,
  /(\bLOAD_FILE\s*\()/i,
  /(\bHAVING\s+\d)/i,
  /(\bGROUP\s+BY\s+\d)/i,
  /(\bORDER\s+BY\s+\d)/i,
];

const XSS_PATTERNS = [
  /<script[\s\S]*?>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /eval\s*\(/i,
  /document\.(cookie|write|domain)/i,
  /<img[^>]+onerror/i,
  /<svg[\s\S]*?onload/i,
  /expression\s*\(/i,
  /url\s*\(\s*(['"]?)data:/i,
  /String\.fromCharCode/i,
  /atob\s*\(/i,
];

const PATH_TRAVERSAL = [
  /\.\.[\\/]/,
  /%2e%2e[\\/]/i,
  /\/etc\/passwd/i,
  /\.\.%2f/i,
  /\/etc\/shadow/i,
  /\/proc\/self/i,
  /\/var\/log/i,
  /\\windows\\system32/i,
];

const COMMAND_INJECTION = [
  /[;&|`$()]\s*(cat|ls|wget|curl|nc\s|bash|sh|cmd|powershell)/i,
  /\|\s*nc\b/i,
  /`[^`]+`/,
  /\$\([^)]+\)/,
  /;\s*(whoami|id|uname|passwd|ifconfig|netstat)/i,
  /\b(chmod|chown|rm\s+-rf)\b/i,
];

const LDAP_INJECTION = [
  /[()&|!*]/,
  /\*\)\(\w+=/i,
  /\)\(\|/,
];

const SSRF_PATTERNS = [
  /https?:\/\/(localhost|127\.0\.0\.\d|0\.0\.0\.0|169\.254\.\d)/i,
  /https?:\/\/\[::1\]/i,
  /https?:\/\/metadata\.google/i,
  /https?:\/\/169\.254\.169\.254/i,
];

const XXE_PATTERNS = [
  /<!DOCTYPE[^>]+ENTITY/i,
  /<!ENTITY/i,
  /SYSTEM\s+["']/i,
];

const FILE_INCLUSION = [
  /\b(include|require|include_once|require_once)\s*\(/i,
  /php:\/\/filter/i,
  /php:\/\/input/i,
  /data:\/\/text/i,
  /expect:\/\//i,
];

const SCANNER_PROBE = [
  /\/wp-admin/i,
  /\/phpmyadmin/i,
  /\/\.env/i,
  /\/config\.(json|php|yml|yaml|xml)/i,
  /\/shell/i,
  /\/cgi-bin/i,
  /\/admin\.php/i,
  /\/\.git\//i,
  /\/\.svn\//i,
  /\/\.DS_Store/i,
  /\/xmlrpc\.php/i,
  /\/wp-login/i,
  /\/actuator/i,
  /\/api\/swagger/i,
  /\/debug/i,
  /\/console/i,
  /\/server-status/i,
  /\/telescope/i,
  /\/solr\//i,
  /\/manager\/html/i,
  /\/jmx-console/i,
];

const CREDENTIAL_STUFFING = [
  /\b(admin|root|administrator|test|user|guest)\b/i,
];

function matchAny(text, patterns) {
  if (text == null || String(text).length === 0) return false;
  const s = String(text);
  return patterns.some((re) => re.test(s));
}

function scanObject(obj, depth = 0) {
  if (depth > 6) return [];
  const hits = [];
  if (obj == null) return hits;
  if (typeof obj === "string") {
    if (matchAny(obj, SQL_PATTERNS)) hits.push("sql_injection");
    if (matchAny(obj, XSS_PATTERNS)) hits.push("xss");
    if (matchAny(obj, PATH_TRAVERSAL)) hits.push("path_traversal");
    if (matchAny(obj, COMMAND_INJECTION)) hits.push("command_injection");
    if (matchAny(obj, LDAP_INJECTION)) hits.push("ldap_injection");
    if (matchAny(obj, SSRF_PATTERNS)) hits.push("ssrf");
    if (matchAny(obj, XXE_PATTERNS)) hits.push("xxe");
    if (matchAny(obj, FILE_INCLUSION)) hits.push("file_inclusion");
    return [...new Set(hits)];
  }
  if (Array.isArray(obj)) {
    for (const item of obj) hits.push(...scanObject(item, depth + 1));
    return [...new Set(hits)];
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj)) hits.push(...scanObject(v, depth + 1));
    return [...new Set(hits)];
  }
  return hits;
}

/**
 * Scan the URL path for scanner/probe patterns.
 */
function scanPath(path) {
  if (!path) return [];
  const hits = [];
  if (matchAny(path, SCANNER_PROBE)) hits.push("scanner_probe");
  if (matchAny(path, PATH_TRAVERSAL)) hits.push("path_traversal");
  if (matchAny(path, FILE_INCLUSION)) hits.push("file_inclusion");
  return [...new Set(hits)];
}

module.exports = {
  SQL_PATTERNS,
  XSS_PATTERNS,
  PATH_TRAVERSAL,
  COMMAND_INJECTION,
  LDAP_INJECTION,
  SSRF_PATTERNS,
  XXE_PATTERNS,
  FILE_INCLUSION,
  SCANNER_PROBE,
  scanObject,
  scanPath,
  matchAny,
};
