import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { useSocket } from "../hooks/useSocket.js";
import Sidebar from "../components/Sidebar.jsx";
import LiveFeed from "../components/LiveFeed.jsx";
import ChartsPanel from "../components/ChartsPanel.jsx";
import TopIpsChart from "../components/TopIpsChart.jsx";
import AttackMap from "../components/AttackMap.jsx";
import AttackTable from "../components/AttackTable.jsx";
import DetailModal from "../components/DetailModal.jsx";
import AlertToasts from "../components/AlertToasts.jsx";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";

function geoQuality(r) {
  const hasCoords = typeof r?.lat === "number" && typeof r?.lon === "number";
  if (!hasCoords) return { label: "Unknown", tone: "neutral" };
  if (r.geoSource === "browser_geolocation" && Number.isFinite(r.geoAccuracy) && r.geoAccuracy <= 50)
    return { label: "Verified exact", tone: "exact" };
  if (r.geoSource === "browser_geolocation") return { label: "Approximate", tone: "approx" };
  if (r.geoSource === "ip_lookup") return { label: "Approximate", tone: "approx" };
  return { label: "Unknown", tone: "neutral" };
}

export default function Dashboard() {
  const { user, logout, isAuthed } = useAuth();
  const { socket, connected } = useSocket(isAuthed);
  const [analystLocation, setAnalystLocation] = useState(null);
  const [feed, setFeed] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [geoFilter, setGeoFilter] = useState("all");
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [selected, setSelected] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setPageReady(true));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [logsRes, sum, ts] = await Promise.all([
        api.logs({ limit: 200 }),
        api.summary(),
        api.timeseries(120),
      ]);
      setTableRows(logsRes.items || []);
      setFeed((logsRes.items || []).slice(0, 40));
      setSummary(sum);
      setTimeseries(ts);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onLog = (payload) => {
      setFeed((prev) => [payload, ...prev].slice(0, 80));
      setTableRows((prev) => [payload, ...prev].slice(0, 200));
      setLastUpdate(new Date());
    };
    const onAlert = (payload) => {
      setAlerts((prev) => [...prev, { ...payload, id: `${payload.logId}-${Date.now()}` }].slice(-5));
    };
    socket.on("attack:log", onLog);
    socket.on("attack:alert", onAlert);
    return () => {
      socket.off("attack:log", onLog);
      socket.off("attack:alert", onAlert);
    };
  }, [socket]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => setAnalystLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const dismiss = (id) => setAlerts((a) => a.filter((x) => x.id !== id));

  async function onExport() {
    try { await api.exportCsv(); } catch (e) { alert(e.message); }
  }

  const kpi = summary || {};
  const filteredRows = tableRows.filter((r) => {
    const quality = geoQuality(r);
    if (geoFilter === "all") return true;
    if (geoFilter === "exact") return quality.tone === "exact";
    if (geoFilter === "approx") return quality.tone === "approx";
    if (geoFilter === "unknown") return quality.tone === "neutral";
    return true;
  });

  const locatedCount = tableRows.filter((r) => typeof r.lat === "number" && typeof r.lon === "number").length;
  const proxyCount = tableRows.filter((r) => r.isProxy || r.isHosting).length;
  const webrtcLeaks = tableRows.filter((r) => r.webRtcIps?.length > 0).length;

  return (
    <div className="min-h-screen flex bg-cyber-bg">
      <Sidebar user={user} connected={connected} onLogout={logout} onExport={onExport} apiBase={API_ORIGIN} />

      <main className="flex-1 overflow-auto">
        {/* Top banner */}
        <div className="dashboard-banner">
          <div className="dashboard-banner-inner">
            <div className={pageReady ? "kpi-enter" : ""}>
              <h1 className="font-display text-xl text-white tracking-widest">Operations Center</h1>
              <p className="text-xs text-cyber-muted mt-1 flex items-center gap-2">
                Real-time threat telemetry
                {lastUpdate && <span className="text-cyber-muted/50">· Updated {lastUpdate.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <KpiCard label="24h Events" value={kpi.total24h ?? "—"} accent icon="⚡" delay={1} ready={pageReady} />
              <KpiCard label="Malicious" value={kpi.byClass?.malicious ?? 0} icon="🔴" danger delay={2} ready={pageReady} />
              <KpiCard label="Suspicious" value={kpi.byClass?.suspicious ?? 0} icon="🟡" warn delay={3} ready={pageReady} />
              <KpiCard label="All Time" value={kpi.totalAll ?? "—"} icon="📈" delay={4} ready={pageReady} />
            </div>
          </div>
          {/* Extra stats row */}
          <div className="dashboard-stats-row">
            <StatPill label="Located" value={locatedCount} icon="📍" delay={0} ready={pageReady} />
            <StatPill label="Proxies/VPNs" value={proxyCount} icon="🔀" delay={1} ready={pageReady} />
            <StatPill label="WebRTC Leaks" value={webrtcLeaks} icon="⚠" delay={2} ready={pageReady} />
            <StatPill label="Countries" value={(kpi.topCountries?.length ?? new Set(tableRows.map(r => r.countryCode).filter(Boolean)).size) ?? 0} icon="🌍" delay={3} ready={pageReady} />
            <StatPill label="Unique IPs" value={kpi.uniqueIps ?? new Set(tableRows.map(r => r.ip)).size} icon="🔌" delay={4} ready={pageReady} />
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Main top grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Live feed */}
            <div className={`xl:col-span-3 rounded-xl border border-cyber-border bg-cyber-panel/50 p-4 h-[440px] flex flex-col min-h-0 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-1" : "opacity-0"}`}>
              <LiveFeed items={feed} onPick={setSelected} />
            </div>

            {/* Charts */}
            <div className={`xl:col-span-5 space-y-4 ${pageReady ? "panel-enter panel-delay-2" : "opacity-0"}`}>
              <ChartsPanel timeseries={timeseries} byType={kpi.byType} />
              <TopIpsChart topIps={kpi.topIps} />
            </div>

            {/* Map */}
            <div className={`xl:col-span-4 space-y-3 ${pageReady ? "panel-enter panel-delay-3" : "opacity-0"}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-cyber-accent uppercase tracking-wider">Threat Geography</h2>
                <div className="flex gap-1">
                  {["all", "exact", "approx", "unknown"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setGeoFilter(f)}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] transition-all duration-300 ${
                        geoFilter === f
                          ? "border-cyber-accent/60 bg-cyber-accent/15 text-cyber-accent shadow-[0_0_10px_rgba(0,212,170,0.15)]"
                          : "border-cyber-border bg-black/20 text-cyber-muted hover:border-cyber-accent/40 hover:text-cyber-accent hover:bg-cyber-accent/5"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="map-reveal">
                <AttackMap logs={filteredRows} analystLocation={analystLocation} onPick={setSelected} height="h-[340px]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Located" value={locatedCount} delay={0} ready={pageReady} />
                <MiniStat label="Proxies" value={proxyCount} delay={1} ready={pageReady} />
                <MiniStat label="Updates" value="Live" green delay={2} ready={pageReady} />
              </div>
            </div>
          </div>

          {/* Attackers table */}
          <section className={pageReady ? "table-reveal" : "opacity-0"}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-cyber-accent uppercase tracking-wider">
                Captured Sessions & Attackers
              </h2>
              <span className="text-[11px] text-cyber-muted">{filteredRows.length} records</span>
            </div>
            <AttackTable rows={filteredRows} onRowClick={setSelected} />
          </section>
        </div>
      </main>

      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} onBlocked={refresh} />}
      <AlertToasts alerts={alerts} onDismiss={dismiss} />
    </div>
  );
}

function KpiCard({ label, value, accent, danger, warn, icon, delay = 0, ready }) {
  const borderCls = accent ? "border-cyber-accent/30 bg-cyber-accent/5" : danger ? "border-red-800/30 bg-red-950/10" : warn ? "border-amber-700/30 bg-amber-950/10" : "border-cyber-border bg-black/20";
  const valueCls = accent ? "text-cyber-accent" : danger ? "text-red-400" : warn ? "text-amber-300" : "text-white";
  const delayClass = `kpi-delay-${delay}`;
  return (
    <div className={`rounded-xl border px-4 py-3 min-w-[120px] hover-lift ${borderCls} ${ready ? `kpi-enter ${delayClass}` : "opacity-0"}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <div className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</div>
      </div>
      <div className={`text-2xl font-semibold mt-1 ${valueCls}`}>{value}</div>
    </div>
  );
}

function StatPill({ label, value, icon, delay = 0, ready }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-cyber-border/50 text-xs transition-all duration-300 hover:border-cyber-accent/30 hover:bg-cyber-accent/5 ${ready ? "stat-pill-enter" : "opacity-0"}`}
      style={ready ? { animationDelay: `${0.3 + delay * 0.08}s` } : {}}
    >
      <span>{icon}</span>
      <span className="text-cyber-muted">{label}:</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, green, delay = 0, ready }) {
  return (
    <div
      className={`rounded-lg border border-cyber-border bg-black/20 p-2.5 text-center hover-lift transition-all duration-300 ${ready ? "kpi-enter" : "opacity-0"}`}
      style={ready ? { animationDelay: `${0.5 + delay * 0.1}s` } : {}}
    >
      <div className="text-[9px] uppercase tracking-wider text-cyber-muted mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${green ? "text-cyber-accent" : "text-white"}`}>{value}</div>
    </div>
  );
}
