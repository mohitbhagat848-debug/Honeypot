export default function ConnectionStatusBar({ apiError, socketError, onRetry }) {
  if (!apiError && !socketError) return null;

  return (
    <div className="mb-4 rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs">
      {apiError && <div className="text-red-200">API connection error: {apiError}</div>}
      {socketError && <div className="text-amber-200 mt-1">Socket error: {socketError}</div>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-700/70 bg-red-900/20 px-3 py-1.5 text-red-100 hover:bg-red-900/35 transition"
      >
        Retry connection
      </button>
    </div>
  );
}
