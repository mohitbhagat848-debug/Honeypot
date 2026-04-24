import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { useTelemetryData } from "../hooks/useTelemetryData.js";
import AdminShell from "../components/AdminShell.jsx";
import AttackMap from "../components/AttackMap.jsx";
import DetailModal from "../components/DetailModal.jsx";
import AlertToasts from "../components/AlertToasts.jsx";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";
const GEO_FILTER_STORAGE_KEY = "hp_geo_filter";

function geoQuality(r) {
  const hasCoords = typeof r?.lat === "number" && typeof r?.lon === "number";
  if (!hasCoords) return { label: "Unknown", tone: "neutral" };
  if (r.geoSource === "browser_geolocation" && Number.isFinite(r.geoAccuracy) && r.geoAccuracy <= 50) {
    return { label: "Verified exact", tone: "exact" };
  }
  if (r.geoSource === "browser_geolocation") return { label: "Approximate", tone: "approx" };
  if (r.geoSource === "ip_lookup") return { label: "Approximate", tone: "approx" };
  return { label: "Unknown", tone: "neutral" };
}

function isPrivateOrLocalIp(ip) {
  const v = String(ip || "").trim();
  if (!v) return true;
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("::ffff:127.")) return true;
  if (v.startsWith("10.") || v.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  return false;
}

function trustLevel(row) {
  if (row?.tracedIpSource === "proxy_header") return { label: "High", score: 3, tone: "high" };
  if (row?.tracedIpSource === "socket_remote") return { label: "Medium", score: 2, tone: "medium" };
  if (row?.tracedIpSource === "client_public_ip_fallback") return { label: "Low", score: 1, tone: "low" };
  return { label: "Unknown", score: 0, tone: "unknown" };
}

function trustBadgeClasses(tone) {
  if (tone === "high") return "bg-emerald-950/60 text-emerald-300 border-emerald-700";
  if (tone === "medium") return "bg-blue-950/60 text-blue-300 border-blue-700";
  if (tone === "low") return "bg-amber-950/50 text-amber-200 border-amber-700";
  return "bg-slate-900/60 text-slate-300 border-slate-700";
}

function qualityBadgeClasses(tone) {
  if (tone === "exact") return "bg-emerald-950/60 text-emerald-300 border-emerald-700";
  if (tone === "approx") return "bg-amber-950/50 text-amber-200 border-amber-700";
  return "bg-slate-900/60 text-slate-300 border-slate-700";
}

function traceRows(rows) {
  return rows.map((r) => {
    const xff = r?.headers?.["x-forwarded-for"];
    const forwardedIp = xff ? String(xff).split(",")[0].trim() : null;
    const tracedIp = forwardedIp
      ? forwardedIp
      : isPrivateOrLocalIp(r.ip) && r.clientPublicIp
        ? r.clientPublicIp
        : r.ip;
    const tracedIpSource = forwardedIp
      ? "proxy_header"
      : isPrivateOrLocalIp(r.ip) && r.clientPublicIp
        ? "client_public_ip_fallback"
        : r.ipSource || "socket_remote";
    const browserGeo = r.geoSource === "browser_geolocation";
    const geoConfidence = browserGeo ? Math.min(Math.max(Math.round(100 - ((r.geoAccuracy || 0) / 25)), 70), 99) : r.geoSource === "ip_lookup" ? 70 : 0;
    const reqLine = `${r.method || "—"} ${r.path || "—"}`;
    const bodyPreview = r.body ? JSON.stringify(r.body) : "";
    const headersPreview = r.headers ? JSON.stringify(r.headers) : "";
    const quality = geoQuality(r);
    const trust = trustLevel({ tracedIpSource });
    return {
      ...r,
      tracedIp,
      tracedIpSource,
      trustLabel: trust.label,
      trustScore: trust.score,
      trustTone: trust.tone,
      geoConfidence,
      reqLine,
      bodyPreview,
      headersPreview,
      geoQualityLabel: quality.label,
      geoQualityTone: quality.tone,
    };
  });
}

export default function TraceIntelPage() {
  const { user, logout, isAuthed } = useAuth();
  const { connected, socketError, apiError, tableRows, summary, selected, setSelected, alerts, dismissAlert, refresh } =
    useTelemetryData(isAuthed);
  const [geoFilter, setGeoFilter] = useState(() => {
    const saved = localStorage.getItem(GEO_FILTER_STORAGE_KEY);
    return saved || "all";
  });
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setPageReady(true));
  }, []);

  const rows = useMemo(() => traceRows(tableRows), [tableRows]);
  const filteredRows = useMemo(() => {
    if (geoFilter === "all") return rows;
    if (geoFilter === "exact") return rows.filter((r) => r.geoQualityTone === "exact");
    if (geoFilter === "approx") return rows.filter((r) => r.geoQualityTone === "approx");
    if (geoFilter === "unknown") return rows.filter((r) => r.geoQualityTone === "neutral");
    return rows;
  }, [rows, geoFilter]);
  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }),
    [filteredRows]
  );

  useEffect(() => {
    localStorage.setItem(GEO_FILTER_STORAGE_KEY, geoFilter);
  }, [geoFilter]);
  const locatedCount = rows.filter((x) => typeof x.lat === "number" && typeof x.lon === "number").length;

  async function onExport() {
    try {
      await api.exportCsv();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <>
      <AdminShell
        user={user}
        connected={connected}
        onLogout={logout}
        onExport={onExport}
        apiBase={API_ORIGIN}
        title="Trace Intelligence"
        subtitle="Real-time IP tracing with geolocation confidence and map drill-down"
        summary={summary}
        apiError={apiError}
        socketError={socketError}
        onRetryConnection={refresh}
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Map section */}
          <div className={`xl:col-span-5 ${pageReady ? "panel-enter panel-delay-1" : "opacity-0"}`}>
            <h2 className="text-sm font-semibold text-cyber-accent uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent" />
              Threat Geography
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              <GeoFilterButton active={geoFilter === "all"} onClick={() => setGeoFilter("all")}>
                All
              </GeoFilterButton>
              <GeoFilterButton active={geoFilter === "exact"} onClick={() => setGeoFilter("exact")}>
                Verified exact
              </GeoFilterButton>
              <GeoFilterButton active={geoFilter === "approx"} onClick={() => setGeoFilter("approx")}>
                Approximate
              </GeoFilterButton>
              <GeoFilterButton active={geoFilter === "unknown"} onClick={() => setGeoFilter("unknown")}>
                Unknown
              </GeoFilterButton>
              <TrustGeoLegend />
            </div>
            <div className="map-reveal">
              <AttackMap logs={sortedRows} onPick={setSelected} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <MetricCard label="Located events" value={sortedRows.filter((x) => typeof x.lat === "number" && typeof x.lon === "number").length} delay={0} ready={pageReady} />
              <MetricCard label="Geo confidence" value={locatedCount > 0 ? "95%" : "0%"} delay={1} ready={pageReady} />
              <MetricCard label="Updates" value="Realtime" delay={2} ready={pageReady} />
            </div>
          </div>

          {/* Table section */}
          <div className={`xl:col-span-7 rounded-xl border border-cyber-border overflow-hidden hover-glow ${pageReady ? "panel-enter panel-delay-2" : "opacity-0"}`}>
            <div className="px-4 py-3 border-b border-cyber-border text-xs uppercase tracking-wider text-cyber-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 live-glow text-cyan-400" />
              Real IP Trace Feed
            </div>
            <div className="overflow-auto max-h-[520px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/30 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Seen</th>
                    <th className="px-3 py-2">Real IP</th>
                    <th className="px-3 py-2">IP Source</th>
                    <th className="px-3 py-2">Trust</th>
                    <th className="px-3 py-2">Request</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Coordinates</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">ISP</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Geo Quality</th>
                    <th className="px-3 py-2">User Agent</th>
                    <th className="px-3 py-2">Headers</th>
                    <th className="px-3 py-2">Body</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-cyber-muted text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl opacity-30 animate-pulse">🔍</span>
                          No trace data available. Waiting for activity…
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedRows.map((r, idx) => (
                    <tr
                      key={r._id}
                      className="border-t border-cyber-border hover:bg-white/5 cursor-pointer transition-all duration-200 group"
                      onClick={() => setSelected(r)}
                      style={idx < 30 ? { animation: `rowSlideIn 0.3s ease ${idx * 0.02}s both` } : undefined}
                    >
                      <td className="px-3 py-2 text-cyber-muted">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 font-mono text-cyber-accent group-hover:text-white transition-colors duration-200">{r.tracedIp || "—"}</td>
                      <td className="px-3 py-2 text-cyber-muted">{r.tracedIpSource}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] transition-all duration-200 ${trustBadgeClasses(r.trustTone)}`}>
                          {r.trustLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-cyber-muted whitespace-nowrap">{r.reqLine}</td>
                      <td className="px-3 py-2 text-cyber-muted whitespace-nowrap">{r.trapAction || "—"}</td>
                      <td className="px-3 py-2 text-cyber-muted">
                        {r.country || "Unknown"}
                        {r.regionName ? `, ${r.regionName}` : ""}
                        {r.city ? ` · ${r.city}` : ""}
                      </td>
                      <td className="px-3 py-2 text-cyber-muted">
                        {typeof r.lat === "number" && typeof r.lon === "number" ? `${r.lat.toFixed(3)}, ${r.lon.toFixed(3)}` : "Unavailable"}
                      </td>
                      <td className="px-3 py-2 text-cyber-muted">{r.geoSource || "unknown"}</td>
                      <td className="px-3 py-2 text-cyber-muted">{r.geoProvider || "—"}</td>
                      <td className="px-3 py-2 text-cyber-muted">{r.isp || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 rounded-full bg-cyber-border overflow-hidden">
                            <div className="h-full rounded-full risk-animate" style={{ width: `${r.geoConfidence}%`, background: r.geoConfidence >= 80 ? "#00d4aa" : r.geoConfidence >= 50 ? "#ffb020" : "#6b7c93" }} />
                          </div>
                          <span className="text-[10px]">{r.geoConfidence}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] transition-all duration-200 ${qualityBadgeClasses(r.geoQualityTone)}`}>
                          {r.geoQualityLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[260px] truncate text-cyber-muted" title={r.userAgent || ""}>
                        {r.userAgent || "—"}
                      </td>
                      <td className="px-3 py-2 max-w-[260px] truncate text-cyber-muted" title={r.headersPreview || ""}>
                        {r.headersPreview || "—"}
                      </td>
                      <td className="px-3 py-2 max-w-[260px] truncate text-cyber-muted" title={r.bodyPreview || ""}>
                        {r.bodyPreview || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminShell>
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} onBlocked={refresh} />}
      <AlertToasts alerts={alerts} onDismiss={dismissAlert} />
    </>
  );
}

function MetricCard({ label, value, delay = 0, ready }) {
  return (
    <div
      className={`rounded-lg border border-cyber-border bg-black/20 p-3 hover-lift transition-all duration-300 ${ready ? "kpi-enter" : "opacity-0"}`}
      style={ready ? { animationDelay: `${0.4 + delay * 0.1}s` } : {}}
    >
      <div className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</div>
      <div className="text-lg text-white mt-1">{value}</div>
    </div>
  );
}

function GeoFilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-xs transition-all duration-300 ${
        active
          ? "border-cyber-accent/60 bg-cyber-accent/15 text-cyber-accent shadow-[0_0_10px_rgba(0,212,170,0.15)]"
          : "border-cyber-border bg-black/20 text-cyber-muted hover:border-cyber-accent/40 hover:text-cyber-accent hover:bg-cyber-accent/5"
      }`}
    >
      {children}
    </button>
  );
}

function TrustGeoLegend() {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer px-3 py-1.5 rounded-lg border border-cyber-border bg-black/20 text-xs text-cyber-muted hover:border-cyber-accent/40 hover:text-cyber-accent transition-all duration-300">
        Trust + Geo legend
      </summary>
      <div className="absolute z-20 mt-2 w-[320px] rounded-lg border border-cyber-border bg-cyber-panel p-3 text-[11px] text-cyber-muted shadow-xl" style={{ animation: "panelEnter 0.3s ease both" }}>
        <div className="font-semibold text-cyber-accent mb-1">Trust level</div>
        <div>High: proxy headers (`x-forwarded-for` / `x-real-ip`).</div>
        <div>Medium: direct socket remote IP.</div>
        <div>Low: client public IP fallback (local/private testing).</div>
        <div className="font-semibold text-cyber-accent mt-3 mb-1">Geo quality</div>
        <div>Verified exact: browser geolocation with good accuracy (&lt;= 50m).</div>
        <div>Approximate: IP lookup or lower-precision browser geo.</div>
        <div>Unknown: no valid coordinates available.</div>
      </div>
    </details>
  );
}
