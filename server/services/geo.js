const http = require("http");
const https = require("https");
const { URL } = require("url");

function httpGetJson(urlString, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib
      .get(urlString, { timeout: timeoutMs }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject)
      .on("timeout", function () {
        this.destroy();
        reject(new Error("timeout"));
      });
    return req;
  });
}

function isPrivateIp(ip) {
  if (!ip || ip === "unknown") return true;
  const v = String(ip).trim();
  if (v.startsWith("127.") || v === "::1" || v === "::ffff:127.0.0.1") return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v === "localhost") return true;
  return false;
}

function emptyGeo(extras = {}) {
  return {
    country: "Unknown",
    countryCode: "",
    region: "",
    regionName: "",
    city: "",
    zip: "",
    timezone: "",
    lat: null,
    lon: null,
    isp: "",
    org: "",
    as: "",
    asname: "",
    proxy: false,
    hosting: false,
    mobile: false,
    ...extras,
  };
}

/**
 * Provider 1: ip-api.com (free, 45 req/min, no HTTPS on free)
 */
async function tryIpApi(ip) {
  const fields =
    "status,message,country,countryCode,region,regionName,city,zip,timezone,lat,lon,query,isp,org,as,mobile,proxy,hosting";
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`;
  const j = await httpGetJson(url, 5000);
  if (j.status !== "success") throw new Error(j.message || "ip-api failed");
  return {
    country: j.country || "",
    countryCode: j.countryCode || "",
    region: j.region || "",
    regionName: j.regionName || "",
    city: j.city || "",
    zip: j.zip || "",
    timezone: j.timezone || "",
    lat: typeof j.lat === "number" ? j.lat : null,
    lon: typeof j.lon === "number" ? j.lon : null,
    isp: j.isp || "",
    org: j.org || "",
    as: j.as || "",
    asname: "",
    proxy: !!j.proxy,
    hosting: !!j.hosting,
    mobile: !!j.mobile,
    geoProvider: "ip-api.com",
    geoAccuracy: 70,
  };
}

/**
 * Provider 2: ipwho.is (free, no key needed, HTTPS)
 */
async function tryIpWhoIs(ip) {
  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
  const j = await httpGetJson(url, 5000);
  if (!j.success) throw new Error(j.message || "ipwho.is failed");
  return {
    country: j.country || "",
    countryCode: j.country_code || "",
    region: j.region_code || "",
    regionName: j.region || "",
    city: j.city || "",
    zip: j.postal || "",
    timezone: j.timezone?.id || "",
    lat: typeof j.latitude === "number" ? j.latitude : null,
    lon: typeof j.longitude === "number" ? j.longitude : null,
    isp: j.connection?.isp || "",
    org: j.connection?.org || "",
    as: j.connection?.asn ? `AS${j.connection.asn}` : "",
    asname: j.connection?.domain || "",
    proxy: false,
    hosting: false,
    mobile: false,
    geoProvider: "ipwho.is",
    geoAccuracy: 65,
  };
}

/**
 * Provider 3: freeipapi.com (free, HTTPS)
 */
async function tryFreeIpApi(ip) {
  const url = `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`;
  const j = await httpGetJson(url, 5000);
  if (!j.ipVersion) throw new Error("freeipapi failed");
  return {
    country: j.countryName || "",
    countryCode: j.countryCode || "",
    region: j.regionCode || "",
    regionName: j.regionName || "",
    city: j.cityName || "",
    zip: j.zipCode || "",
    timezone: j.timeZone || "",
    lat: typeof j.latitude === "number" ? j.latitude : null,
    lon: typeof j.longitude === "number" ? j.longitude : null,
    isp: "",
    org: "",
    as: "",
    asname: "",
    proxy: false,
    hosting: false,
    mobile: false,
    geoProvider: "freeipapi.com",
    geoAccuracy: 60,
  };
}

async function lookupGeo(ip) {
  if (isPrivateIp(ip)) {
    return {
      ...emptyGeo({ country: "Local", countryCode: "LOC", city: "Private network" }),
      geoSource: "private_ip",
      geoProvider: "none",
      geoAccuracy: null,
      geoCapturedAt: null,
    };
  }

  const providers = [tryIpApi, tryIpWhoIs, tryFreeIpApi];
  let lastErr = null;

  for (const provider of providers) {
    try {
      const result = await provider(ip);
      return {
        ...result,
        geoSource: "ip_lookup",
        geoCapturedAt: new Date(),
      };
    } catch (err) {
      lastErr = err;
      // try next provider
    }
  }

  // All providers failed
  console.warn(`[geo] All providers failed for ${ip}:`, lastErr?.message);
  return {
    ...emptyGeo(),
    geoSource: "ip_lookup",
    geoProvider: "none",
    geoAccuracy: null,
    geoCapturedAt: null,
  };
}

module.exports = { lookupGeo, isPrivateIp };
