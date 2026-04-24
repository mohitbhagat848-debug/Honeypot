import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { useTelemetryData } from "../hooks/useTelemetryData.js";
import AdminShell from "../components/AdminShell.jsx";
import LiveFeed from "../components/LiveFeed.jsx";
import AttackTable from "../components/AttackTable.jsx";
import DetailModal from "../components/DetailModal.jsx";
import AlertToasts from "../components/AlertToasts.jsx";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";

export default function OperationsPage() {
  const { user, logout, isAuthed } = useAuth();
  const { connected, socketError, apiError, feed, tableRows, summary, selected, setSelected, alerts, dismissAlert, refresh } =
    useTelemetryData(isAuthed);

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
        title="Operations Center"
        subtitle="Real-time threat telemetry and active session monitoring"
        summary={summary}
        apiError={apiError}
        socketError={socketError}
        onRetryConnection={refresh}
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
          <div className="xl:col-span-4 rounded-xl border border-cyber-border bg-cyber-panel/50 p-4 h-[500px] flex flex-col min-h-0 hover-lift hover-glow panel-enter panel-delay-1">
            <LiveFeed items={feed} onPick={setSelected} />
          </div>
          <div className="xl:col-span-8 panel-enter panel-delay-2">
            <h2 className="text-sm font-semibold text-cyber-accent uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent live-glow text-cyber-accent" />
              Attackers & Sessions
            </h2>
            <AttackTable rows={tableRows} onRowClick={setSelected} />
          </div>
        </div>
      </AdminShell>
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} onBlocked={refresh} />}
      <AlertToasts alerts={alerts} onDismiss={dismissAlert} />
    </>
  );
}
