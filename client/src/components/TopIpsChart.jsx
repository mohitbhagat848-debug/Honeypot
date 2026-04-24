import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TopIpsChart({ topIps }) {
  const data = (topIps || []).map((x) => ({ ip: x._id, count: x.c }));
  return (
    <div className="rounded-xl border border-cyber-border bg-black/20 p-3 h-56 chart-panel-wrapper hover-lift panel-enter panel-delay-3">
      <h3 className="text-xs uppercase text-cyber-muted mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #7c5cfc, #1e90ff)" }} />
        Top IPs (24h)
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <defs>
            <linearGradient id="ipGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#1e90ff" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,42,58,0.4)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#6b7c93", fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="ip" width={100} tick={{ fill: "#6b7c93", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} />
          <Tooltip
            contentStyle={{
              background: "rgba(12,18,28,0.97)",
              border: "1px solid rgba(124,92,252,0.3)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
            }}
            cursor={{ fill: "rgba(124,92,252,0.05)" }}
          />
          <Bar
            dataKey="count"
            fill="url(#ipGrad)"
            radius={[0, 4, 4, 0]}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
