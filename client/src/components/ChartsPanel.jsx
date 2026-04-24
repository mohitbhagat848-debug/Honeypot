import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

/* Premium curated color palette — each attack type gets a distinct hue */
const ATTACK_COLORS = {
  sql_injection:      "#ff6b6b",    // Coral red
  xss:                "#ffd93d",    // Amber gold
  command_injection:  "#ff4757",    // Crimson
  path_traversal:     "#ff9f43",    // Tangerine
  brute_force:        "#ee5a24",    // Burnt orange
  credential_stuffing:"#eb4d4b",   // Soft red
  scanner_probe:      "#7c5cfc",    // Electric purple
  ssrf:               "#3742fa",    // Deep blue
  xxe:                "#2ed573",    // Emerald
  file_inclusion:     "#1e90ff",    // Dodger blue
  ldap_injection:     "#ffa502",    // Orange
  rate_anomaly:       "#a29bfe",    // Lavender
  rate_anomaly_high:  "#6c5ce7",    // Purple
  unknown:            "#636e72",    // Slate
};

const FALLBACK_COLORS = [
  "#ff6b6b", "#ffd93d", "#7c5cfc", "#1e90ff", "#2ed573",
  "#ff9f43", "#ee5a24", "#a29bfe", "#ff4757", "#00d4aa",
  "#f472b6", "#6c5ce7",
];

function getColor(name, idx) {
  return ATTACK_COLORS[name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

/* Custom animated pie — clockwise loading sweep */
function AnimatedPie({ data }) {
  const [phase, setPhase] = useState("hidden"); // hidden → loading → done
  const dataKey = data.map(d => `${d.name}:${d.value}`).join(",");

  useEffect(() => {
    setPhase("hidden");
    const t1 = setTimeout(() => setPhase("loading"), 80);
    const t2 = setTimeout(() => setPhase("done"), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [dataKey]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#c9d1d9" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={9} fontFamily="'JetBrains Mono', monospace">
        {name} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const wrapClass =
    phase === "hidden" ? "pie-loading-hidden" :
    phase === "loading" ? "pie-loading-sweep" : "pie-loading-done";

  return (
    <div key={dataKey} className={wrapClass} style={{ height: "85%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={68}
            innerRadius={28}
            paddingAngle={3}
            label={phase === "done" ? renderCustomLabel : false}
            isAnimationActive={phase !== "hidden"}
            animationBegin={0}
            animationDuration={1400}
            animationEasing="ease-out"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={getColor(entry.name, i)}
                stroke="rgba(7,11,16,0.6)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            formatter={(value) => <span style={{ color: "#8b949e" }}>{value}</span>}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(12,18,28,0.97)",
              border: "1px solid rgba(0,212,170,0.2)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              color: "#c9d1d9",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
            }}
            itemStyle={{ color: "#c9d1d9" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Custom bar tooltip */
const barTooltipStyle = {
  background: "rgba(12,18,28,0.97)",
  border: "1px solid rgba(0,212,170,0.2)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
};

export default function ChartsPanel({ timeseries, byType }) {
  const lineData = (timeseries?.buckets || []).map((b) => ({
    t: b._id,
    count: b.count,
  }));

  const pieData = (byType || []).map((x) => ({ name: x._id || "unknown", value: x.c }));
  const pieEmpty = pieData.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
      {/* Bar chart panel */}
      <div className="rounded-xl border border-cyber-border bg-black/20 p-3 chart-panel-wrapper hover-lift panel-enter panel-delay-1">
        <h3 className="text-xs uppercase text-cyber-muted mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: "linear-gradient(135deg, #00d4aa, #1d9bf0)" }} />
          Attacks per Minute
        </h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={lineData.length ? lineData : [{ t: "—", count: 0 }]}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#1d9bf0" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,42,58,0.5)" />
            <XAxis dataKey="t" tick={{ fill: "#6b7c93", fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#6b7c93", fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={barTooltipStyle}
              labelStyle={{ color: "#00d4aa" }}
              cursor={{ fill: "rgba(0,212,170,0.05)" }}
            />
            <Bar
              dataKey="count"
              fill="url(#barGrad)"
              radius={[4, 4, 0, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart panel — circular reveal */}
      <div className="rounded-xl border border-cyber-border bg-black/20 p-3 chart-panel-wrapper hover-lift panel-enter panel-delay-2">
        <h3 className="text-xs uppercase text-cyber-muted mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #ff6b6b, #ffd93d)" }} />
          Attack Types (24h)
        </h3>
        {pieEmpty ? (
          <div className="h-[85%] flex items-center justify-center text-cyber-muted text-sm">
            <div className="text-center">
              <div className="text-3xl mb-3 opacity-20">📊</div>
              <div className="text-xs">No tagged attack types</div>
              <div className="text-[10px] text-cyber-muted/50 mt-1">Data will appear when events are captured</div>
            </div>
          </div>
        ) : (
          <AnimatedPie data={pieData} />
        )}
      </div>
    </div>
  );
}
