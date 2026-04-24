import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

async function collectGeoMeta() {
  const meta = { clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "" };
  // Public IP from multiple fallback sources
  for (const src of [
    "https://api.ipify.org?format=json",
    "https://api.my-ip.io/ip.json",
    "https://api.myip.com",
  ]) {
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const j = await r.json();
        const ip = j.ip || j.YourFuckingIPAddress || j.IP;
        if (ip) { meta.clientPublicIp = String(ip); break; }
      }
    } catch {}
  }
  if (!navigator.geolocation) return meta;
  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 4000, maximumAge: 0,
      })
    );
    meta.geoLat = position.coords.latitude;
    meta.geoLon = position.coords.longitude;
    meta.geoAccuracy = position.coords.accuracy;
    meta.geoCapturedAt = new Date(position.timestamp || Date.now()).toISOString();
  } catch {}
  return meta;
}

export default function Login() {
  const { login, isAuthed } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  if (isAuthed) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setLoading(true); setProgress(0);
    const prog = setInterval(() => setProgress(p => Math.min(p + Math.random() * 18, 88)), 180);
    try {
      const geoMeta = await collectGeoMeta();
      await login(email, password, geoMeta);
      setProgress(100);
      setTimeout(() => nav("/", { replace: true }), 200);
    } catch (ex) {
      setErr(ex.message || "Authentication failed");
    } finally {
      clearInterval(prog);
      setLoading(false);
    }
  }

  return (
    <div className="login-page-root">
      {/* Animated scanning line */}
      <div className="login-scan-line" />

      {/* Animated orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />

      {/* Clock / status bar */}
      <div className={`login-status-bar ${mounted ? "login-fade-in login-delay-1" : "login-hidden"}`}>
        <span className="login-status-dot-wrap">
          <span className="login-status-dot" />
          Secure Connection
        </span>
        <span className="login-time">{time.toLocaleTimeString()}</span>
      </div>

      {/* Brand top-left */}
      <div className={`login-brand ${mounted ? "login-fade-in login-delay-1" : "login-hidden"}`}>
        <span className="login-brand-icon">🛡️</span>
        <span className="login-brand-name">HP-NET</span>
        <span className="login-brand-tag">Security Platform</span>
      </div>

      {/* Card */}
      <div className={`login-card-wrap ${mounted ? "login-card-enter" : "login-hidden"}`} ref={cardRef}>
        {/* Top glow line */}
        <div className="login-glow-line login-glow-top" />

        <div className="login-card">
          {/* Logo header */}
          <div className={`login-logo-row ${mounted ? "login-slide-up login-delay-2" : "login-hidden"}`}>
            <div className="login-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div className="login-logo-title">HP-NET</div>
              <div className="login-logo-subtitle">Command Center</div>
            </div>
            <div className="login-live-badge">
              <span className="login-live-dot" />
              LIVE
            </div>
          </div>

          {/* Divider */}
          <div className={`login-divider ${mounted ? "login-divider-animate login-delay-3" : "login-hidden"}`} />

          <form onSubmit={onSubmit} className="login-form">
            {/* Email */}
            <div className={`login-field ${mounted ? "login-slide-up login-delay-3" : "login-hidden"}`}>
              <label className="login-label">Email Address</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
                <input
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  type="email"
                  placeholder="analyst@hp-net.sec"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className={`login-field ${mounted ? "login-slide-up login-delay-4" : "login-hidden"}`}>
              <label className="login-label">Access Key</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                </span>
                <input
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••••••••••"
                  required
                />
              </div>
            </div>

            {/* Progress bar */}
            {loading && (
              <div className="login-progress-track">
                <div
                  className="login-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Error */}
            {err && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {err}
              </div>
            )}

            {/* Submit */}
            <div className={mounted ? "login-slide-up login-delay-5" : "login-hidden"}>
              <button type="submit" disabled={loading} className="login-submit">
                {loading ? (
                  <span className="login-submit-loading">
                    <span className="login-spinner" />
                    Authenticating…
                  </span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Authenticate Session
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className={`login-footer ${mounted ? "login-slide-up login-delay-6" : "login-hidden"}`}>
            <div className="login-footer-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              END-TO-END ENCRYPTED
            </div>
            <div className="login-footer-right">v2.1</div>
          </div>
        </div>

        {/* Bottom glow line */}
        <div className="login-glow-line login-glow-bottom" />
      </div>
    </div>
  );
}
