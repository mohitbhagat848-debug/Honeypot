const AttackLog = require("../models/AttackLog");
const { analyzeInteraction } = require("../../analyzer");
const { lookupGeo, isPrivateIp } = require("./geo");
const { fingerprintFromUA } = require("./fingerprint");

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  const xrip = req.headers["x-real-ip"];
  if (xrip) return String(xrip).trim();
  const cfip = req.headers["cf-connecting-ip"];
  if (cfip) return String(cfip).trim();
  let ip = req.socket?.remoteAddress || "unknown";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
}

function sanitizeHeaders(headers) {
  const out = { ...headers };
  if (out.authorization) out.authorization = "[redacted]";
  if (out.cookie) out.cookie = "[redacted]";
  return out;
}

function numberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deriveClientGeo(body) {
  const lat = numberOrNull(body.geoLat);
  const lon = numberOrNull(body.geoLon);
  const accuracy = numberOrNull(body.geoAccuracy);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat,
    lon,
    geoAccuracy: accuracy,
    geoAltitude: numberOrNull(body.geoAltitude),
    geoSource: "browser_geolocation",
    geoProvider: "navigator.geolocation",
    geoCapturedAt:
      body.geoCapturedAt && !Number.isNaN(new Date(body.geoCapturedAt).getTime())
        ? new Date(body.geoCapturedAt)
        : new Date(),
    timezone: body.clientTimeZone || "",
  };
}

function parseWebRtcIps(body) {
  try {
    if (!body.webRtcIps) return [];
    const ips = JSON.parse(body.webRtcIps);
    if (!Array.isArray(ips)) return [];
    return ips.filter((ip) => typeof ip === "string" && ip.length > 3);
  } catch {
    return [];
  }
}

function normalizeIpLike(raw) {
  if (!raw) return null;
  let ip = String(raw).trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (!ip || ip === "unknown") return null;
  return ip;
}

function ipSourceFromHeaders(req) {
  if (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.headers["cf-connecting-ip"]) {
    return "proxy_header";
  }
  return "socket_remote";
}

function createInteractionRecorder({ io }) {
  const geoCache = new Map();
  const GEO_TTL = 3600_000;

  async function recordFromExpressReq(req, extra = {}) {
    const mergedBody =
      extra.body && Object.keys(extra.body).length > 0
        ? extra.body
        : req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? req.body
          : {};

    const socketOrProxyIp = clientIp(req);
    const reportedPublicIp = normalizeIpLike(mergedBody.clientPublicIp);
    // Never overwrite network-observed IP with client-provided values.
    const ip = socketOrProxyIp;
    const ipSource = ipSourceFromHeaders(req);
    const ua = req.headers["user-agent"] || "";
    const { browser, os } = fingerprintFromUA(ua);

    // For local/private network testing, IP geo can fallback to reported public IP.
    const geoLookupIp =
      reportedPublicIp && isPrivateIp(ip) && !isPrivateIp(reportedPublicIp) ? reportedPublicIp : ip;

    let geo = geoCache.get(geoLookupIp);
    if (!geo || Date.now() - geo.at > GEO_TTL) {
      const g = await lookupGeo(geoLookupIp);
      geo = { ...g, at: Date.now() };
      geoCache.set(geoLookupIp, geo);
    }
    const clientGeo = deriveClientGeo(mergedBody);
    let resolvedGeo = clientGeo ? { ...geo, ...clientGeo } : geo;

    // Fallback: use client-provided IP geolocation if we still lack coordinates
    if (resolvedGeo.lat == null && resolvedGeo.lon == null && mergedBody.ipGeoSource) {
      const ipLat = numberOrNull(mergedBody.geoLat);
      const ipLon = numberOrNull(mergedBody.geoLon);
      if (ipLat !== null && ipLon !== null) {
        resolvedGeo = {
          ...resolvedGeo,
          lat: ipLat,
          lon: ipLon,
          geoAccuracy: numberOrNull(mergedBody.geoAccuracy),
          geoSource: "client_ip_geolocation",
          geoProvider: mergedBody.ipGeoSource || "ip_api_client",
          geoCapturedAt: mergedBody.geoCapturedAt ? new Date(mergedBody.geoCapturedAt) : new Date(),
          city: mergedBody.ipGeoCity || resolvedGeo.city || "",
          regionName: mergedBody.ipGeoRegion || resolvedGeo.regionName || "",
          country: mergedBody.ipGeoCountry || resolvedGeo.country || "",
          countryCode: mergedBody.ipGeoCountryCode || resolvedGeo.countryCode || "",
          isp: mergedBody.ipGeoIsp || resolvedGeo.isp || "",
        };
      }
    }

    const webRtcIps = parseWebRtcIps(mergedBody);

    const analysis = analyzeInteraction({
      ip,
      method: req.method,
      path: req.path || req.url,
      query: req.query || {},
      body: mergedBody,
      headers: sanitizeHeaders(req.headers),
      trapAction: extra.trapAction ?? null,
    });

    const logData = {
      source: extra.source || "honeypot",
      ip,
      ipSource,
      clientPublicIp: reportedPublicIp || undefined,
      webRtcIps: webRtcIps.length > 0 ? webRtcIps : undefined,
      country: resolvedGeo.country,
      countryCode: resolvedGeo.countryCode,
      region: resolvedGeo.region,
      regionName: resolvedGeo.regionName,
      city: resolvedGeo.city,
      zip: resolvedGeo.zip,
      timezone: resolvedGeo.timezone || mergedBody.clientTimeZone || "",
      lat: resolvedGeo.lat,
      lon: resolvedGeo.lon,
      geoSource: resolvedGeo.geoSource,
      geoProvider: resolvedGeo.geoProvider,
      geoAccuracy: resolvedGeo.geoAccuracy,
      geoCapturedAt: resolvedGeo.geoCapturedAt,
      isp: resolvedGeo.isp,
      org: resolvedGeo.org,
      as: resolvedGeo.as,
      asname: resolvedGeo.asname || undefined,
      isProxy: resolvedGeo.proxy || false,
      isHosting: resolvedGeo.hosting || false,
      isMobile: resolvedGeo.mobile || false,
      userAgent: ua,
      browser,
      os,
      clientLanguage: mergedBody.clientLanguage || undefined,
      clientPlatform: mergedBody.clientPlatform || undefined,
      screenRes: mergedBody.screenRes || undefined,
      screenAvail: mergedBody.screenAvail || undefined,
      canvasFingerprint: mergedBody.canvasFingerprint || undefined,
      webglRenderer: mergedBody.webglRenderer || undefined,
      connectionType: mergedBody.connectionType || undefined,
      connectionDownlink: mergedBody.connectionDownlink || undefined,
      connectionRtt: mergedBody.connectionRtt || undefined,
      batteryLevel: mergedBody.batteryLevel || undefined,
      batteryCharging: mergedBody.batteryCharging || undefined,
      maxTouchPoints: mergedBody.maxTouchPoints || undefined,
      touchSupport: mergedBody.touchSupport || undefined,
      pluginsCount: mergedBody.pluginsCount || undefined,
      colorDepth: mergedBody.colorDepth || undefined,
      pixelRatio: mergedBody.pixelRatio || undefined,
      clientVendor: mergedBody.clientVendor || undefined,
      clientHardwareConcurrency: mergedBody.clientHardwareConcurrency || undefined,
      clientMemory: mergedBody.clientMemory || undefined,
      cookiesEnabled: mergedBody.cookiesEnabled || undefined,
      doNotTrack: mergedBody.doNotTrack || undefined,
      referrer: mergedBody.referrer || undefined,
      pageUrl: mergedBody.pageUrl || undefined,
      method: req.method,
      path: req.originalUrl || req.url,
      trapPage: extra.trapPage,
      trapAction: extra.trapAction,
      headers: sanitizeHeaders(req.headers),
      query: req.query || {},
      body: mergedBody,
      attackTypes: analysis.attackTypes,
      classification: analysis.classification,
      riskScore: analysis.riskScore,
      rateCount: analysis.rateCount,
      rateAnomaly: analysis.rateAnomaly,
      bruteForce: analysis.bruteForce,
    };

    let doc;
    const isUpdateAction = extra.trapAction === "delayed_fingerprint" || extra.trapAction === "silent_beacon";
    
    if (isUpdateAction) {
      // Try to find a very recent log (last 30s) from the same IP and trapPage to update
      const recentDoc = await AttackLog.findOne({
        ip,
        trapPage: extra.trapPage,
        createdAt: { $gt: new Date(Date.now() - 30000) }
      }).sort({ createdAt: -1 });

      if (recentDoc) {
        // Update the existing doc with new data (especially GPS)
        // We only overwrite if the new data is better (e.g. has coordinates)
        if (resolvedGeo.lat != null) {
          Object.assign(recentDoc, logData);
        } else {
          // If no GPS, just update metadata but keep old location
          Object.assign(recentDoc, { ...logData, lat: recentDoc.lat, lon: recentDoc.lon });
        }
        doc = await recentDoc.save();
      }
    }

    if (!doc) {
      doc = await AttackLog.create(logData);
    }

    const payload = doc.toObject();
    io?.emit("attack:log", payload);

    if (
      analysis.classification === "malicious" ||
      analysis.bruteForce ||
      analysis.rateAnomaly === "high"
    ) {
      io?.emit("attack:alert", {
        message: "High-risk honeypot activity",
        logId: doc._id,
        ip,
        classification: analysis.classification,
        attackTypes: analysis.attackTypes,
      });
    }

    return doc;
  }

  return { recordFromExpressReq, clientIp };
}

module.exports = { createInteractionRecorder, clientIp, sanitizeHeaders };
