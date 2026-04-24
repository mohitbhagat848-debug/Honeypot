import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import OperationsPage from "./pages/OperationsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import TraceIntelPage from "./pages/TraceIntelPage.jsx";

function Private({ children }) {
  const { isAuthed, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cyber-bg gap-4">
        {/* Loading pulse animation */}
        <div className="relative">
          <div className="loading-shield text-5xl">🛡️</div>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(0,212,170,0.15), transparent 70%)",
              animation: "liveGlow 2s ease-in-out infinite",
            }}
          />
        </div>
        <div className="font-display text-base tracking-widest text-cyber-accent" style={{ animation: "panelEnter 0.5s ease both 0.2s", opacity: 0 }}>
          HP-NET
        </div>
        <div className="text-xs text-cyber-muted" style={{ animation: "panelEnter 0.5s ease both 0.4s", opacity: 0 }}>
          Initializing secure session…
        </div>
        {/* Animated progress dots */}
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-cyber-accent"
              style={{
                animation: `loginBlink 1.2s ease ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Dashboard />
          </Private>
        }
      />
      <Route
        path="/operations"
        element={
          <Private>
            <OperationsPage />
          </Private>
        }
      />
      <Route
        path="/analytics"
        element={
          <Private>
            <AnalyticsPage />
          </Private>
        }
      />
      <Route
        path="/trace-intel"
        element={
          <Private>
            <TraceIntelPage />
          </Private>
        }
      />
    </Routes>
  );
}
