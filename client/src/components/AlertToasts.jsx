export default function AlertToasts({ alerts, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[2100] flex flex-col gap-2 max-w-sm">
      {alerts.map((a, idx) => (
        <div
          key={a.id}
          className="rounded-lg border border-red-500/50 bg-red-950/90 text-red-100 px-4 py-3 text-xs shadow-lg shadow-black/40 backdrop-blur-sm"
          style={{
            animation: `alertSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${idx * 0.1}s both`,
          }}
        >
          <div className="font-semibold text-red-300 mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            High-risk activity detected
          </div>
          <div className="text-cyber-muted">
            {a.ip} — {(a.attackTypes || []).join(", ") || a.classification}
          </div>
          <button
            type="button"
            className="mt-2 text-[10px] underline text-red-200 hover:text-red-100 transition-colors duration-200"
            onClick={() => onDismiss(a.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
