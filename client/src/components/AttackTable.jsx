function classificationStyle(c) {
  if (c === "malicious") return { bg: "bg-red-950/50", text: "text-red-300", border: "border-red-800/50", dot: "bg-red-400" };
  if (c === "suspicious") return { bg: "bg-amber-950/40", text: "text-amber-200", border: "border-amber-700/50", dot: "bg-amber-400" };
  return { bg: "bg-slate-900/40", text: "text-slate-300", border: "border-slate-600/50", dot: "bg-slate-400" };
}

function geoQuality(r) {
  const hasCoords = typeof r?.lat === "number" && typeof r?.lon === "number";
  if (!hasCoords) return { label: "No coords", tone: "neutral" };
  if (r.geoSource === "browser_geolocation" && Number.isFinite(r.geoAccuracy) && r.geoAccuracy <= 50)
    return { label: "GPS Exact", tone: "exact" };
  if (r.geoSource === "browser_geolocation") return { label: "GPS", tone: "approx" };
  if (r.geoSource === "ip_lookup") return { label: "IP Lookup", tone: "approx" };
  return { label: "Unknown", tone: "neutral" };
}

function geoBadgeCls(tone) {
  if (tone === "exact") return "bg-emerald-950/60 text-emerald-300 border-emerald-700";
  if (tone === "approx") return "bg-amber-950/50 text-amber-200 border-amber-700";
  return "bg-slate-900/60 text-slate-300 border-slate-700";
}

function isPrivateOrLocalIp(ip) {
  const v = String(ip || "").trim();
  if (!v) return true;
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("::ffff:127.")) return true;
  if (v.startsWith("10.") || v.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  return false;
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  try {
    const cp = code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...cp);
  } catch { return ""; }
}

export default function AttackTable({ rows, onRowClick }) {
  return (
    <div className="rounded-xl border border-cyber-border overflow-hidden hover-glow">
      <div className="overflow-x-auto max-h-96 custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10" style={{ background: "rgba(10,14,20,0.97)" }}>
            <tr className="text-cyber-muted uppercase tracking-wider border-b border-cyber-border">
              <th className="px-3 py-2.5 font-medium">Time</th>
              <th className="px-3 py-2.5 font-medium">Real IP</th>
              <th className="px-3 py-2.5 font-medium">Location</th>
              <th className="px-3 py-2.5 font-medium">ISP</th>
              <th className="px-3 py-2.5 font-medium">Geo Quality</th>
              <th className="px-3 py-2.5 font-medium">Flags</th>
              <th className="px-3 py-2.5 font-medium">Request</th>
              <th className="px-3 py-2.5 font-medium">Attack Types</th>
              <th className="px-3 py-2.5 font-medium">Risk</th>
              <th className="px-3 py-2.5 font-medium">Class</th>
              <th className="px-3 py-2.5 font-medium">WebRTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-cyber-muted text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl opacity-30 animate-pulse">🔍</span>
                    No events captured yet. Waiting for activity…
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r, idx) => {
              const q = geoQuality(r);
              const displayIp = isPrivateOrLocalIp(r.ip) && r.clientPublicIp ? r.clientPublicIp : r.ip;
              const cls = classificationStyle(r.classification);
              const riskPct = Math.min((r.riskScore || 0), 100);
              const flag = countryFlag(r.countryCode);

              return (
                <tr
                  key={r._id || idx}
                  className="border-t border-cyber-border hover:bg-white/[0.03] cursor-pointer transition-all duration-200 group"
                  onClick={() => onRowClick(r)}
                  style={idx < 30 ? { animation: `rowSlideIn 0.3s ease ${idx * 0.02}s both` } : undefined}
                >
                  {/* Time */}
                  <td className="px-3 py-2 whitespace-nowrap text-cyber-muted">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>

                  {/* Real IP — highlighted */}
                  <td className="px-3 py-2">
                    <div className="font-mono text-cyber-accent font-semibold group-hover:text-white transition-colors duration-200">
                      {displayIp || "—"}
                    </div>
                    {r.clientPublicIp && r.clientPublicIp !== r.ip && !isPrivateOrLocalIp(r.ip) && (
                      <div className="font-mono text-[10px] text-cyber-muted">pub: {r.clientPublicIp}</div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {flag && <span className="text-base">{flag}</span>}
                      <div>
                        <div className="text-white text-xs">{r.country || "Unknown"}</div>
                        {r.city && <div className="text-cyber-muted text-[10px]">{r.city}</div>}
                      </div>
                    </div>
                    {typeof r.lat === "number" && typeof r.lon === "number" && (
                      <div className="text-[10px] text-cyber-muted font-mono mt-0.5">
                        {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
                      </div>
                    )}
                  </td>

                  {/* ISP */}
                  <td className="px-3 py-2 max-w-[160px]">
                    <div className="text-cyber-muted truncate" title={r.isp || ""}>{r.isp || "—"}</div>
                    {r.as && <div className="text-[10px] text-cyber-muted/60 font-mono">{r.as}</div>}
                  </td>

                  {/* Geo Quality */}
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] transition-all duration-200 ${geoBadgeCls(q.tone)}`}>
                      {q.label}
                    </span>
                    {r.geoAccuracy && (
                      <div className="text-[10px] text-cyber-muted mt-0.5">±{Math.round(r.geoAccuracy)}m</div>
                    )}
                  </td>

                  {/* Flags / threat indicators */}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.isProxy && (
                        <span className="text-[9px] bg-amber-950/40 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded transition-transform duration-200 hover:scale-105">PROXY</span>
                      )}
                      {r.isHosting && (
                        <span className="text-[9px] bg-red-950/40 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded transition-transform duration-200 hover:scale-105">VPN/HOST</span>
                      )}
                      {r.bruteForce && (
                        <span className="text-[9px] bg-red-950/50 text-red-200 border border-red-700/50 px-1.5 py-0.5 rounded transition-transform duration-200 hover:scale-105">BRUTE</span>
                      )}
                      {r.isMobile && (
                        <span className="text-[9px] bg-blue-950/40 text-blue-300 border border-blue-800/40 px-1.5 py-0.5 rounded transition-transform duration-200 hover:scale-105">MOBILE</span>
                      )}
                      {!r.isProxy && !r.isHosting && !r.bruteForce && !r.isMobile && (
                        <span className="text-[9px] text-cyber-muted">—</span>
                      )}
                    </div>
                  </td>

                  {/* Request */}
                  <td className="px-3 py-2 font-mono text-cyber-muted whitespace-nowrap">
                    <span className="text-cyan-400">{r.method || "—"}</span> {r.path ? r.path.slice(0, 30) : "—"}
                  </td>

                  {/* Attack Types */}
                  <td className="px-3 py-2 max-w-[160px]">
                    <div className="flex flex-wrap gap-1">
                      {(r.attackTypes || []).slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[9px] bg-red-950/30 text-red-300 border border-red-900/40 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                      {!r.attackTypes?.length && <span className="text-cyber-muted text-[10px]">{r.trapAction || "—"}</span>}
                    </div>
                  </td>

                  {/* Risk bar */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-cyber-border overflow-hidden">
                        <div
                          className="h-full rounded-full risk-animate"
                          style={{
                            width: `${riskPct}%`,
                            background: riskPct >= 70 ? "#ff4444" : riskPct >= 40 ? "#ffb020" : "#00d4aa",
                            boxShadow: riskPct >= 70 ? "0 0 6px rgba(255,68,68,0.5)" : "none",
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-cyber-muted w-6">{r.riskScore ?? 0}</span>
                    </div>
                  </td>

                  {/* Classification */}
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-all duration-200 ${cls.bg} ${cls.text} ${cls.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cls.dot}`} />
                      {r.classification || "normal"}
                    </span>
                  </td>

                  {/* WebRTC leaked IPs */}
                  <td className="px-3 py-2">
                    {r.webRtcIps?.length > 0 ? (
                      <span className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded font-mono">
                        {r.webRtcIps.length} leaked
                      </span>
                    ) : (
                      <span className="text-cyber-muted text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
