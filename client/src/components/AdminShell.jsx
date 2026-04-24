import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import ConnectionStatusBar from "./ConnectionStatusBar.jsx";

function Kpi({ label, value, accent, icon, delay = 0, ready }) {
  const delayClass = `kpi-delay-${delay}`;
  return (
    <div className={`rounded-xl border px-4 py-3 min-w-[120px] hover-lift ${accent ? "border-cyber-accent/30 bg-cyber-accent/5" : "border-cyber-border bg-black/20"} ${ready ? `kpi-enter ${delayClass}` : "opacity-0"}`}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        <div className="text-[10px] uppercase tracking-wider text-cyber-muted">{label}</div>
      </div>
      <div className={`text-xl font-semibold mt-1 ${accent ? "text-cyber-accent" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default function AdminShell({
  user,
  connected,
  onLogout,
  onExport,
  apiBase,
  title,
  subtitle,
  summary,
  apiError,
  socketError,
  onRetryConnection,
  children,
}) {
  const kpi = summary || {};
  const [ready, setReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  return (
    <div className="min-h-screen flex bg-cyber-bg">
      <Sidebar user={user} connected={connected} onLogout={onLogout} onExport={onExport} apiBase={apiBase} />
      <main className="flex-1 overflow-auto">
        {/* Sticky page header */}
        <div className="dashboard-banner">
          <div className="dashboard-banner-inner">
            <div className={ready ? "kpi-enter" : "opacity-0"}>
              <h1 className="font-display text-xl text-white tracking-widest">{title}</h1>
              {subtitle && <p className="text-xs text-cyber-muted mt-1">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Kpi label="24h Events" value={kpi.total24h ?? "—"} accent icon="⚡" delay={1} ready={ready} />
              <Kpi label="Malicious" value={kpi.byClass?.malicious ?? 0} icon="🔴" delay={2} ready={ready} />
              <Kpi label="Suspicious" value={kpi.byClass?.suspicious ?? 0} icon="🟡" delay={3} ready={ready} />
              <Kpi label="All Time" value={kpi.totalAll ?? "—"} icon="📈" delay={4} ready={ready} />
            </div>
          </div>
        </div>
        <div className={`p-6 ${ready ? "panel-enter panel-delay-1" : "opacity-0"}`}>
          <ConnectionStatusBar apiError={apiError} socketError={socketError} onRetry={onRetryConnection} />
          {children}
        </div>
      </main>
    </div>
  );
}
