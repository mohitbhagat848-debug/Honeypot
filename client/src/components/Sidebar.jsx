import { NavLink } from "react-router-dom";

const navItems = [
  {
    to: "/",
    label: "Operations Center",
    icon: "⚡",
    desc: "Live dashboard",
    end: true,
  },
  {
    to: "/analytics",
    label: "Behavior Analytics",
    icon: "📊",
    desc: "Attack patterns",
  },
  {
    to: "/operations",
    label: "Live Operations",
    icon: "🎯",
    desc: "Real-time feed",
  },
  {
    to: "/trace-intel",
    label: "Trace Intelligence",
    icon: "🔍",
    desc: "IP & geo tracing",
  },
];

export default function Sidebar({ user, connected, onLogout, onExport, apiBase }) {
  return (
    <aside className="w-64 shrink-0 border-r border-cyber-border flex flex-col min-h-screen sidebar-glass">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-cyber-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-500 hover:scale-110"
            style={{ background: "linear-gradient(135deg,rgba(0,212,170,0.25),rgba(29,155,240,0.2))", border: "1px solid rgba(0,212,170,0.3)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div className="font-display text-base text-cyber-accent tracking-widest leading-none">HP-NET</div>
            <div className="text-[9px] text-cyber-muted/70 uppercase tracking-[0.18em] mt-1">Security Platform</div>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="px-5 py-3 border-b border-cyber-border">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full live-glow ${connected ? "bg-emerald-400 text-emerald-400" : "bg-red-500 text-red-500 animate-pulse"}`}
            style={connected ? { boxShadow: "0 0 6px #34d399" } : {}} />
          <span className={`text-[11px] transition-colors duration-300 ${connected ? "text-emerald-400" : "text-red-400"}`}>
            {connected ? "Connected" : "Reconnecting…"}
          </span>
          {connected && (
            <span className="ml-auto text-[9px] text-cyber-muted/50 uppercase tracking-wider">LIVE</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 flex-1 space-y-1">
        <div className="text-[10px] text-cyber-muted/60 uppercase tracking-[0.18em] px-2 pb-2">Monitor</div>
        {navItems.map((item, idx) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 border text-[12px] font-medium tracking-wide transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? "bg-cyber-accent/10 border-cyber-accent/30 text-cyber-accent shadow-[0_0_12px_rgba(0,212,170,0.08)]"
                  : "border-transparent text-cyber-muted hover:border-cyber-border hover:text-white hover:bg-white/[0.025] hover:translate-x-1"
              }`
            }
            style={{ animationDelay: `${idx * 0.06}s` }}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-cyber-accent"
                    style={{ boxShadow: "0 0 10px #00d4aa" }} />
                )}
                <span className={`text-base w-5 text-center transition-transform duration-300 ${isActive ? "" : "group-hover:scale-110"}`}>{item.icon}</span>
                <div className="flex flex-col leading-tight">
                  <span>{item.label}</span>
                  <span className={`text-[9px] mt-0.5 transition-colors duration-200 ${isActive ? "text-cyber-accent/70" : "text-cyber-muted/50"}`}>{item.desc}</span>
                </div>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent"
                    style={{ boxShadow: "0 0 8px #00d4aa" }} />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Info card */}
        <div className="px-3 py-3 text-cyber-muted text-[10px] leading-relaxed border border-dashed border-cyber-border/40 rounded-xl mt-6 space-y-1 transition-all duration-300 hover:border-cyber-accent/20">
          <div className="text-cyber-accent/80 text-[11px] font-semibold mb-1">Monitoring Active</div>
          <div>All endpoints secured. Threat detection enabled. Real-time analysis active.</div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cyber-border space-y-2">
        {/* Trap URL */}
        <div className="px-2 py-1.5 rounded-lg bg-black/30 border border-cyber-border/50 transition-all duration-300 hover:border-cyber-accent/20">
          <div className="text-[9px] text-cyber-muted/50 uppercase tracking-wider mb-0.5">Trap Endpoint</div>
          <div className="text-[10px] text-cyber-accent/80 font-mono break-all">{apiBase}/trap</div>
        </div>

        {/* User */}
        {user?.email && (
          <div className="px-2 py-1 text-[11px] text-cyber-muted truncate" title={user.email}>
            👤 {user.email}
          </div>
        )}

        <button
          type="button"
          onClick={onExport}
          className="w-full py-2 rounded-lg border border-cyber-border/60 hover:border-cyber-accent/50 text-cyber-muted hover:text-cyber-accent text-xs transition-all duration-300 hover:bg-cyber-accent/5 hover:shadow-[0_0_12px_rgba(0,212,170,0.08)] active:scale-[0.98]"
        >
          ⬇ Export CSV
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-950/50 hover:text-red-300 text-xs transition-all duration-300 hover:shadow-[0_0_12px_rgba(255,92,92,0.1)] active:scale-[0.98]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
