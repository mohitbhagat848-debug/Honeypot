import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { useTelemetryData } from "../hooks/useTelemetryData.js";
import AdminShell from "../components/AdminShell.jsx";
import ChartsPanel from "../components/ChartsPanel.jsx";
import TopIpsChart from "../components/TopIpsChart.jsx";
import AttackTable from "../components/AttackTable.jsx";
import DetailModal from "../components/DetailModal.jsx";
import AlertToasts from "../components/AlertToasts.jsx";
import AttackMap from "../components/AttackMap.jsx";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
} from "recharts";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";

/* Color mapping for attack types */
const ATTACK_COLORS = {
  sql_injection:      "#ff6b6b",
  xss:                "#ffd93d",
  command_injection:  "#ff4757",
  path_traversal:     "#ff9f43",
  brute_force:        "#ee5a24",
  credential_stuffing:"#eb4d4b",
  scanner_probe:      "#7c5cfc",
  ssrf:               "#3742fa",
  xxe:                "#2ed573",
  file_inclusion:     "#1e90ff",
  ldap_injection:     "#ffa502",
  rate_anomaly:       "#a29bfe",
  rate_anomaly_high:  "#6c5ce7",
};

const SEVERITY_COLORS = {
  malicious: "#ff4444",
  suspicious: "#ffb020",
  normal: "#00d4aa",
};

const tooltipStyle = {
  background: "rgba(12,18,28,0.97)",
  border: "1px solid rgba(0,212,170,0.2)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "#c9d1d9",
};

export default function AnalyticsPage() {
  const { user, logout, isAuthed } = useAuth();
  const { connected, socketError, apiError, tableRows, summary, timeseries, selected, setSelected, alerts, dismissAlert, refresh } =
    useTelemetryData(isAuthed);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setPageReady(true));
  }, []);

  async function onExport() {
    try { await api.exportCsv(); } catch (e) { alert(e.message); }
  }

  /* Derive analytics data */
  const attackBreakdown = useMemo(() => {
    const map = {};
    tableRows.forEach((r) => {
      (r.attackTypes || []).forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, fill: ATTACK_COLORS[name] || "#636e72" }))
      .sort((a, b) => b.count - a.count);
  }, [tableRows]);

  const severityData = useMemo(() => {
    const counts = { malicious: 0, suspicious: 0, normal: 0 };
    tableRows.forEach((r) => {
      const cls = r.classification || "normal";
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] }));
  }, [tableRows]);

  const hourlyHeatmap = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, count: 0, malicious: 0 }));
    tableRows.forEach((r) => {
      if (!r.createdAt) return;
      const h = new Date(r.createdAt).getHours();
      hours[h].count++;
      if (r.classification === "malicious") hours[h].malicious++;
    });
    return hours;
  }, [tableRows]);

  const countryData = useMemo(() => {
    const map = {};
    tableRows.forEach((r) => {
      const cc = r.country || r.countryCode || "Unknown";
      map[cc] = (map[cc] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 12);
  }, [tableRows]);

  const radarData = useMemo(() => {
    const types = ["sql_injection", "xss", "path_traversal", "command_injection", "brute_force", "scanner_probe", "credential_stuffing", "ssrf"];
    const map = {};
    tableRows.forEach((r) => {
      (r.attackTypes || []).forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return types.map((t) => ({
      type: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: map[t] || 0,
      fullMark: Math.max(...types.map((tt) => map[tt] || 0), 1),
    }));
  }, [tableRows]);

  const methodData = useMemo(() => {
    const map = {};
    tableRows.forEach((r) => {
      const m = r.method || "UNKNOWN";
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [tableRows]);

  const avgRisk = useMemo(() => {
    if (!tableRows.length) return 0;
    return Math.round(tableRows.reduce((sum, r) => sum + (r.riskScore || 0), 0) / tableRows.length);
  }, [tableRows]);

  const topAttacker = useMemo(() => {
    const map = {};
    tableRows.forEach((r) => {
      const ip = r.ip || "—";
      map[ip] = (map[ip] || 0) + 1;
    });
    let max = ["—", 0];
    Object.entries(map).forEach(([ip, c]) => { if (c > max[1]) max = [ip, c]; });
    return { ip: max[0], count: max[1] };
  }, [tableRows]);

  return (
    <>
      <AdminShell
        user={user}
        connected={connected}
        onLogout={logout}
        onExport={onExport}
        apiBase={API_ORIGIN}
        title="Behavior Analytics"
        subtitle="Traffic trends, top sources, and attack pattern distribution"
        summary={summary}
        apiError={apiError}
        socketError={socketError}
        onRetryConnection={refresh}
      >
        {/* Quick stats row */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 ${pageReady ? "panel-enter" : "opacity-0"}`}>
          <QuickStat label="Avg Risk Score" value={avgRisk} suffix="/100" color={avgRisk >= 60 ? "#ff4444" : avgRisk >= 30 ? "#ffb020" : "#00d4aa"} icon="🎯" delay={0} ready={pageReady} />
          <QuickStat label="Attack Types" value={attackBreakdown.length} color="#7c5cfc" icon="🔬" delay={1} ready={pageReady} />
          <QuickStat label="Top Attacker" value={topAttacker.count} suffix={` (${topAttacker.ip.slice(0, 15)})`} color="#ff6b6b" icon="👤" delay={2} ready={pageReady} />
          <QuickStat label="Countries" value={countryData.length} color="#1e90ff" icon="🌍" delay={3} ready={pageReady} />
        </div>

        <div className="space-y-5">
          {/* Row 1: Charts + Pie */}
          <div className={pageReady ? "panel-enter panel-delay-1" : "opacity-0"}>
            <ChartsPanel timeseries={timeseries} byType={summary?.byType} />
          </div>

          {/* Row 2: Attack breakdown + Threat radar + Hourly heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Attack type breakdown */}
            <div className={`rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-2" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: "#ff6b6b" }} />
                Attack Type Breakdown
              </h3>
              {attackBreakdown.length === 0 ? (
                <EmptyState icon="🛡️" text="No attacks detected yet" />
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {attackBreakdown.map((item, idx) => (
                    <AttackBar key={item.name} name={item.name} count={item.count} color={item.fill} total={attackBreakdown[0]?.count || 1} delay={idx} ready={pageReady} />
                  ))}
                </div>
              )}
            </div>

            {/* Threat radar */}
            <div className={`rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-3" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "#7c5cfc" }} />
                Threat Vector Radar
              </h3>
              <ResponsiveContainer width="100%" height={230}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(30,42,58,0.6)" />
                  <PolarAngleAxis dataKey="type" tick={{ fill: "#6b7c93", fontSize: 8 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="Attacks" dataKey="value" stroke="#7c5cfc" fill="#7c5cfc" fillOpacity={0.3} animationDuration={1200} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly activity heatmap */}
            <div className={`rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-4" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #ff4444, #ffb020)" }} />
                Hourly Activity
              </h3>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={hourlyHeatmap}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00d4aa" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="malGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff4444" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ff4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,42,58,0.4)" />
                  <XAxis dataKey="hour" tick={{ fill: "#6b7c93", fontSize: 8 }} interval={3} />
                  <YAxis tick={{ fill: "#6b7c93", fontSize: 9 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#00d4aa" fill="url(#areaGrad)" strokeWidth={2} animationDuration={1200} />
                  <Area type="monotone" dataKey="malicious" stroke="#ff4444" fill="url(#malGrad)" strokeWidth={1.5} animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 3: Top IPs + Severity split + Country + Method */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 ${pageReady ? "panel-enter panel-delay-2" : "opacity-0"}`}>
              <TopIpsChart topIps={summary?.topIps} />
            </div>

            {/* Severity breakdown */}
            <div className={`lg:col-span-3 rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-3" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "#ff4444" }} />
                Severity Split
              </h3>
              <div className="space-y-4 mt-4">
                {severityData.map((s) => (
                  <SeverityBar key={s.name} name={s.name} value={s.value} total={tableRows.length || 1} color={s.fill} />
                ))}
              </div>
            </div>

            {/* HTTP method distribution */}
            <div className={`lg:col-span-4 rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-4" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: "#1e90ff" }} />
                HTTP Methods & Origins
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={methodData} layout="vertical">
                  <defs>
                    <linearGradient id="methodGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1e90ff" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,42,58,0.4)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#6b7c93", fontSize: 9 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fill: "#6b7c93", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(30,90,255,0.05)" }} />
                  <Bar dataKey="count" fill="url(#methodGrad)" radius={[0, 4, 4, 0]} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 4: Map + Country leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-8 ${pageReady ? "panel-enter panel-delay-3" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent" />
                Threat Geography
              </h3>
              <AttackMap logs={tableRows} onPick={setSelected} height="h-[320px]" />
            </div>

            <div className={`lg:col-span-4 rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift hover-glow ${pageReady ? "panel-enter panel-delay-4" : "opacity-0"}`}>
              <h3 className="text-xs uppercase text-cyber-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: "#2ed573" }} />
                Top Source Countries
              </h3>
              {countryData.length === 0 ? (
                <EmptyState icon="🌍" text="No geo data available" />
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                  {countryData.map((c, idx) => (
                    <div
                      key={c.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-cyber-border/50 bg-black/20 hover:border-cyber-accent/20 transition-all duration-300"
                      style={pageReady ? { animation: `rowSlideIn 0.3s ease ${idx * 0.05}s both` } : undefined}
                    >
                      <span className="text-sm font-bold text-cyber-muted w-5 text-center">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="text-xs text-white font-medium">{c.name}</div>
                        <div className="w-full h-1 rounded-full bg-cyber-border/50 mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full risk-animate"
                            style={{
                              width: `${(c.size / (countryData[0]?.size || 1)) * 100}%`,
                              background: `linear-gradient(90deg, #2ed573, #1e90ff)`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-mono text-cyber-accent">{c.size}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Events table */}
          <section className={pageReady ? "panel-enter panel-delay-5" : "opacity-0"}>
            <h2 className="text-sm font-semibold text-cyber-accent uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent" />
              Recent Classified Events
            </h2>
            <AttackTable rows={tableRows} onRowClick={setSelected} />
          </section>
        </div>
      </AdminShell>
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} onBlocked={refresh} />}
      <AlertToasts alerts={alerts} onDismiss={dismissAlert} />
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function QuickStat({ label, value, suffix = "", color, icon, delay = 0, ready }) {
  return (
    <div
      className={`rounded-xl border border-cyber-border bg-black/20 p-4 hover-lift transition-all duration-300 ${ready ? "kpi-enter" : "opacity-0"}`}
      style={ready ? { animationDelay: `${delay * 0.08}s` } : {}}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {suffix && <span className="text-xs text-cyber-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function AttackBar({ name, count, color, total, delay = 0, ready }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div
      className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-all duration-300"
      style={ready ? { animation: `rowSlideIn 0.3s ease ${delay * 0.05}s both` } : undefined}
    >
      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[11px] text-white font-medium truncate">{name.replace(/_/g, " ")}</span>
          <span className="text-[10px] font-mono text-cyber-muted ml-2 flex-shrink-0">{count}</span>
        </div>
        <div className="w-full h-1 rounded-full bg-cyber-border/50 overflow-hidden">
          <div className="h-full rounded-full risk-animate" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function SeverityBar({ name, value, total, color }) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-xs text-white capitalize">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyber-muted">{value}</span>
          <span className="text-[10px] text-cyber-muted/60">({pct}%)</span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-cyber-border/50 overflow-hidden">
        <div className="h-full rounded-full risk-animate" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-cyber-muted">
      <div className="text-3xl mb-3 opacity-20 animate-pulse">{icon}</div>
      <div className="text-xs">{text}</div>
    </div>
  );
}
