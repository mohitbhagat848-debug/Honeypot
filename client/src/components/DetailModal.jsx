import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";

function geoQuality(log) {
  const hasCoords = typeof log?.lat === "number" && typeof log?.lon === "number";
  if (!hasCoords) return { label: "No Coordinates", tone: "neutral" };
  if (log.geoSource === "browser_geolocation" && Number.isFinite(log.geoAccuracy) && log.geoAccuracy <= 50)
    return { label: "✓ GPS Verified", tone: "exact" };
  if (log.geoSource === "browser_geolocation") return { label: "GPS (low accuracy)", tone: "approx" };
  if (log.geoSource === "ip_lookup") return { label: "IP Geolocation", tone: "approx" };
  return { label: "Unknown", tone: "neutral" };
}

function geoBadgeClass(tone) {
  if (tone === "exact") return "badge-exact";
  if (tone === "approx") return "badge-approx";
  return "badge-neutral";
}

function trustLevel(source) {
  if (source === "proxy_header") return { label: "High — Via proxy header", tone: "high", icon: "🔴" };
  if (source === "socket_remote") return { label: "Medium — Direct socket", tone: "medium", icon: "🟡" };
  if (source === "client_public_ip_fallback") return { label: "Low — Client-reported", tone: "low", icon: "🟠" };
  return { label: "Unknown", tone: "unknown", icon: "⚪" };
}

function isPrivateOrLocalIp(ip) {
  const v = String(ip || "").trim();
  if (!v) return true;
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("::ffff:127.")) return true;
  if (v.startsWith("10.") || v.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  return false;
}

function classColor(c) {
  if (c === "malicious") return "#ff4444";
  if (c === "suspicious") return "#ffb020";
  return "#00d4aa";
}

function InfoCard({ label, value, mono, accent, children }) {
  return (
    <div className="detail-card">
      <div className="detail-card-label">{label}</div>
      <div className={`detail-card-value ${mono ? "font-mono" : ""} ${accent ? "text-cyber-accent" : ""}`}>
        {children || value || "—"}
      </div>
    </div>
  );
}

export default function DetailModal({ log, onClose, onBlocked }) {
  const [replay, setReplay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fullLog, setFullLog] = useState(log);
  const [showRaw, setShowRaw] = useState(false);
  const [mapType, setMapType] = useState("dark");

  const MAP_LAYERS = {
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png",
      attr: '&copy; <a href="https://carto.com/">CARTO</a>'
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: "Esri, Maxar, Earthstar Geographics"
    },
    streets: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    terrain: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attr: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }
  };

  useEffect(() => {
    let cancelled = false;
    setFullLog(log);
    setReplay(null);
    setMsg("");
    api.log(log._id).then((doc) => { if (!cancelled) setFullLog(doc); }).catch(() => {});
    return () => { cancelled = true; };
  }, [log]);

  if (!log) return null;
  const L = fullLog || log;
  const hasCoords = typeof L.lat === "number" && typeof L.lon === "number";
  const mapLink = hasCoords ? `https://www.google.com/maps?q=${L.lat},${L.lon}&z=14` : null;
  const quality = geoQuality(L);
  const displayIp = isPrivateOrLocalIp(L.ip) && L.clientPublicIp ? L.clientPublicIp : L.ip;
  const displayIpSource = isPrivateOrLocalIp(L.ip) && L.clientPublicIp ? "client_public_ip_fallback" : L.ipSource || "socket_remote";
  const trust = trustLevel(displayIpSource);
  const col = classColor(L.classification);
  const riskPct = Math.min((L.riskScore || 0), 100);

  async function block() {
    setBusy(true); setMsg("");
    try { await api.blockIp(L.ip, "dashboard"); setMsg("✓ IP added to blocklist."); onBlocked?.(); }
    catch (e) { setMsg("✗ " + e.message); }
    finally { setBusy(false); }
  }

  async function handleReplay() {
    setBusy(true); setMsg("");
    try { const r = await api.replay(log._id); setReplay(r); }
    catch (e) { setMsg("✗ " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,14,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: col, boxShadow: `0 0 10px ${col}` }}
            />
            <span className="font-display text-base tracking-widest" style={{ color: col }}>
              INTRUSION RECORD
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: col, borderColor: col + "40", background: col + "15" }}
            >
              {L.classification?.toUpperCase() || "NORMAL"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cyber-muted">{L.createdAt ? new Date(L.createdAt).toLocaleString() : ""}</span>
            <button onClick={onClose} className="modal-close-btn">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Action bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={block} disabled={busy}
              className="action-btn action-btn-danger">
              🚫 Block IP
            </button>
            <button onClick={handleReplay} disabled={busy}
              className="action-btn action-btn-default">
              🔄 Replay detection
            </button>
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer"
                className="action-btn action-btn-accent">
                🗺 Open in Maps
              </a>
            )}
            <button onClick={() => setShowRaw(s => !s)}
              className="action-btn action-btn-default ml-auto">
              {showRaw ? "Hide raw" : "Raw JSON"}
            </button>
          </div>
          {msg && <p className={`text-xs mb-3 ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>}

          {/* Risk Score bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-cyber-muted mb-1">
              <span>RISK SCORE</span>
              <span style={{ color: col, fontWeight: 700 }}>{L.riskScore ?? 0} / 100</span>
            </div>
            <div className="risk-bar-bg">
              <div className="risk-bar-fill" style={{ width: `${riskPct}%`, background: `linear-gradient(90deg, ${col}88, ${col})` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: identity */}
            <div className="space-y-3">
              <div className="section-title">📡 Network Identity</div>

              {/* Real IP — hero */}
              <div className="ip-hero">
                <div className="ip-hero-label">REAL IP ADDRESS</div>
                <div className="ip-hero-value" style={{ color: col }}>{displayIp || "—"}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {L.isProxy && <span className="flag-badge flag-proxy">🔀 Proxy</span>}
                  {L.isHosting && <span className="flag-badge flag-hosting">🖥 Hosting/VPN</span>}
                  {L.isMobile && <span className="flag-badge flag-mobile">📱 Mobile</span>}
                  <span className={`flag-badge ${trust.tone === "high" ? "flag-high" : trust.tone === "medium" ? "flag-medium" : "flag-low"}`}>
                    {trust.icon} {trust.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="Socket IP" mono>{L.ip || "—"}</InfoCard>
                <InfoCard label="Client Public IP" mono>{L.clientPublicIp || "—"}</InfoCard>
                <InfoCard label="IP Source">{displayIpSource}</InfoCard>
                <InfoCard label="Trap Page">{L.trapPage || "—"}</InfoCard>
              </div>

              {/* WebRTC leaked IPs */}
              {L.webRtcIps?.length > 0 && (
                <div className="detail-card border-amber-800/40">
                  <div className="detail-card-label text-amber-400">⚠ WebRTC Leaked IPs</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {L.webRtcIps.map((ip, i) => (
                      <span key={i} className="font-mono text-xs bg-amber-950/40 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40">{ip}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="section-title mt-2">🌐 ISP & Network</div>
              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="ISP">{L.isp || "—"}</InfoCard>
                <InfoCard label="Organization">{L.org || "—"}</InfoCard>
                <InfoCard label="AS Number" mono>{L.as || "—"}</InfoCard>
                <InfoCard label="AS Name">{L.asname || "—"}</InfoCard>
              </div>

              <div className="section-title mt-2">💻 Device Fingerprint</div>
              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="Browser">{L.browser || "—"}</InfoCard>
                <InfoCard label="OS">{L.os || "—"}</InfoCard>
                <InfoCard label="Language">{L.clientLanguage || "—"}</InfoCard>
                <InfoCard label="Platform">{L.clientPlatform || "—"}</InfoCard>
                <InfoCard label="Screen">{L.screenRes || "—"}</InfoCard>
                <InfoCard label="Available Screen">{L.screenAvail || "—"}</InfoCard>
                <InfoCard label="Timezone">{L.timezone || "—"}</InfoCard>
                <InfoCard label="Color Depth">{L.colorDepth ? `${L.colorDepth}-bit` : "—"}</InfoCard>
                <InfoCard label="Pixel Ratio">{L.pixelRatio || "—"}</InfoCard>
                <InfoCard label="Touch Points">{L.maxTouchPoints || "—"}</InfoCard>
                <InfoCard label="Touch Support">{L.touchSupport || "—"}</InfoCard>
                <InfoCard label="CPU Cores">{L.clientHardwareConcurrency || "—"}</InfoCard>
                <InfoCard label="Device Memory">{L.clientMemory ? `${L.clientMemory} GB` : "—"}</InfoCard>
                <InfoCard label="Plugins">{L.pluginsCount || "—"}</InfoCard>
                <InfoCard label="Cookies">{L.cookiesEnabled || "—"}</InfoCard>
                <InfoCard label="Do Not Track">{L.doNotTrack || "—"}</InfoCard>
              </div>

              {/* Canvas & WebGL fingerprint */}
              {(L.canvasFingerprint || L.webglRenderer) && (
                <div className="detail-card mt-2">
                  <div className="detail-card-label text-purple-400">🎨 Rendering Fingerprint</div>
                  {L.canvasFingerprint && (
                    <div className="text-[11px] text-cyber-muted mt-1">
                      <span className="text-cyber-accent">Canvas Hash:</span> <span className="font-mono">{L.canvasFingerprint}</span>
                    </div>
                  )}
                  {L.webglRenderer && (
                    <div className="text-[11px] text-cyber-muted mt-1">
                      <span className="text-cyber-accent">WebGL:</span> <span className="font-mono">{L.webglRenderer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Connection & Battery */}
              {(L.connectionType || L.batteryLevel) && (
                <div className="detail-card mt-2">
                  <div className="detail-card-label text-blue-400">📡 Connection & Power</div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {L.connectionType && <div className="text-[11px] text-cyber-muted"><span className="text-cyber-accent">Network:</span> {L.connectionType}</div>}
                    {L.connectionDownlink && <div className="text-[11px] text-cyber-muted"><span className="text-cyber-accent">Downlink:</span> {L.connectionDownlink} Mbps</div>}
                    {L.connectionRtt && <div className="text-[11px] text-cyber-muted"><span className="text-cyber-accent">RTT:</span> {L.connectionRtt}ms</div>}
                    {L.batteryLevel && <div className="text-[11px] text-cyber-muted"><span className="text-cyber-accent">Battery:</span> {L.batteryLevel}% {L.batteryCharging === "true" ? "⚡ Charging" : "🔋"}</div>}
                  </div>
                </div>
              )}

              {/* Referrer & Page URL */}
              {(L.referrer || L.pageUrl) && (
                <div className="detail-card mt-2">
                  <div className="detail-card-label">🔗 Navigation Context</div>
                  {L.referrer && <div className="text-[11px] text-cyber-muted mt-1 break-all"><span className="text-cyber-accent">Referrer:</span> {L.referrer}</div>}
                  {L.pageUrl && <div className="text-[11px] text-cyber-muted mt-1 break-all"><span className="text-cyber-accent">Page URL:</span> {L.pageUrl}</div>}
                </div>
              )}

              <div className="detail-card">
                <div className="detail-card-label">USER AGENT</div>
                <div className="text-[11px] text-cyber-muted break-all leading-relaxed mt-1">{L.userAgent || "—"}</div>
              </div>
            </div>

            {/* Right: geolocation */}
            <div className="space-y-3">
              <div className="section-title">📍 Geolocation</div>

              {/* Location hero */}
              <div className="location-hero">
                <div className="text-2xl mb-1">
                  {L.countryCode ? `${countryFlag(L.countryCode)} ` : "🌍 "}
                  <span className="text-white font-semibold">{L.country || "Unknown Country"}</span>
                </div>
                <div className="text-cyber-muted text-sm">
                  {[L.city, L.regionName].filter(Boolean).join(", ") || "City unknown"}
                </div>
                {L.zip && <div className="text-cyber-muted text-xs mt-0.5">ZIP: {L.zip}</div>}
                <div className="flex gap-2 mt-2">
                  <span className={`flag-badge ${geoBadgeClass(quality.tone)}`}>{quality.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="Latitude" mono>{typeof L.lat === "number" ? L.lat.toFixed(6) : "—"}</InfoCard>
                <InfoCard label="Longitude" mono>{typeof L.lon === "number" ? L.lon.toFixed(6) : "—"}</InfoCard>
                <InfoCard label="Geo Source">{L.geoSource || "—"}</InfoCard>
                <InfoCard label="Provider">{L.geoProvider || "—"}</InfoCard>
                <InfoCard label="GPS Accuracy">{L.geoAccuracy ? `±${Math.round(L.geoAccuracy)}m` : "—"}</InfoCard>
                <InfoCard label="Captured At">{L.geoCapturedAt ? new Date(L.geoCapturedAt).toLocaleTimeString() : "—"}</InfoCard>
              </div>

              {/* Mini embedded map */}
              {hasCoords ? (
                <div className="relative rounded-xl overflow-hidden border border-cyber-border" style={{ height: "240px" }}>
                  {/* Map Type Switcher */}
                  <div className="absolute top-2 right-2 z-[1000] flex gap-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
                    {Object.keys(MAP_LAYERS).map((t) => (
                      <button
                        key={t}
                        onClick={() => setMapType(t)}
                        className={`text-[10px] px-2 py-1 rounded capitalize transition-all ${
                          mapType === t ? "bg-cyber-accent text-black font-bold" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <MapContainer
                    key={`${L._id}-${mapType}`} // Remount on log change or type change
                    center={[L.lat, L.lon]}
                    zoom={12}
                    className="h-full w-full"
                    scrollWheelZoom={false}
                    zoomControl={false}
                    dragging={true}
                  >
                    <TileLayer
                      attribution={MAP_LAYERS[mapType].attr}
                      url={MAP_LAYERS[mapType].url}
                    />
                    <CircleMarker
                      center={[L.lat, L.lon]}
                      radius={14}
                      pathOptions={{ color: col, fillColor: col, fillOpacity: 0.4, weight: 3 }}
                    >
                      <Popup>
                        <div style={{ fontFamily: "monospace", fontSize: "12px" }}>
                          <strong style={{ color: col }}>{displayIp}</strong><br />
                          {L.city}, {L.country}
                        </div>
                      </Popup>
                    </CircleMarker>
                    <CircleMarker
                      center={[L.lat, L.lon]}
                      radius={5}
                      pathOptions={{ color: "#fff", fillColor: col, fillOpacity: 1, weight: 2 }}
                    />
                  </MapContainer>
                </div>
              ) : (
                <div className="no-coords-box">
                  <div className="text-4xl mb-2">🌐</div>
                  <div className="text-cyber-muted text-sm">No coordinates available</div>
                  <div className="text-cyber-muted text-xs mt-1">IP geolocation returned no GPS data</div>
                </div>
              )}

              <div className="section-title mt-1">⚔️ Attack Classification</div>
              <div className="grid grid-cols-2 gap-2">
                <InfoCard label="Classification">
                  <span style={{ color: col, fontWeight: 700 }}>{L.classification?.toUpperCase() || "NORMAL"}</span>
                </InfoCard>
                <InfoCard label="Method">{L.method || "—"}</InfoCard>
                <InfoCard label="Trap Action">{L.trapAction || "—"}</InfoCard>
                <InfoCard label="Brute Force">{L.bruteForce ? "⚠ YES" : "No"}</InfoCard>
              </div>
              {L.attackTypes?.length > 0 && (
                <div className="detail-card">
                  <div className="detail-card-label">ATTACK TYPES</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {L.attackTypes.map((t, i) => (
                      <span key={i} className="font-mono text-[10px] bg-red-950/40 text-red-300 px-2 py-0.5 rounded border border-red-800/40">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Replay result */}
          {replay && (
            <div className="mt-4">
              <div className="section-title">🔄 Replay Analysis</div>
              <pre className="raw-json">{JSON.stringify(replay, null, 2)}</pre>
            </div>
          )}

          {/* Raw JSON */}
          {showRaw && (
            <div className="mt-4">
              <div className="section-title">📄 Raw Log</div>
              <pre className="raw-json">{JSON.stringify(L, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const cp = code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cp);
}
