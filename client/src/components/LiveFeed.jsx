function clsColor(c) {
  if (c === "malicious") return "text-cyber-danger border-red-900/40 bg-red-950/20";
  if (c === "suspicious") return "text-cyber-warn border-amber-900/40 bg-amber-950/20";
  return "text-slate-400 border-cyber-border bg-black/20";
}

export default function LiveFeed({ items, onPick }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <h2 className="text-sm font-semibold text-cyber-accent uppercase tracking-wider mb-3 shrink-0 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent" />
        Live Feed
      </h2>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-0">
        {items.length === 0 && (
          <div className="text-cyber-muted text-sm flex flex-col items-center py-8">
            <div className="text-2xl mb-2 opacity-30 animate-pulse">📡</div>
            Waiting for events…
          </div>
        )}
        {items.map((ev, idx) => (
          <button
            key={ev._id}
            type="button"
            onClick={() => onPick(ev)}
            className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-all duration-300 hover:brightness-110 hover:translate-x-0.5 hover:shadow-lg ${clsColor(ev.classification)}`}
            style={{
              animation: idx < 20 ? `feedSlide 0.35s ease ${idx * 0.03}s both` : undefined,
            }}
          >
            <div className="flex justify-between gap-2">
              <span className="font-mono text-[11px]">{ev.ip}</span>
              <span className="text-cyber-muted shrink-0">
                {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ""}
              </span>
            </div>
            <div className="mt-1 text-[11px] truncate">
              {(ev.attackTypes || []).join(", ") || ev.trapAction || "activity"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
