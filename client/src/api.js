const base = import.meta.env.VITE_API_URL || "";

export function getToken() {
  return localStorage.getItem("hp_token");
}

async function request(path, opts = {}) {
  const headers = { ...opts.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${base}${path}`, { ...opts, headers, credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  login: (email, password, meta = {}) =>
    request("/api/auth/login", { method: "POST", body: { email, password, ...meta } }),
  me: () => request("/api/auth/me"),
  logs: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/logs?${q}`);
  },
  log: (id) => request(`/api/logs/${id}`),
  summary: () => request("/api/stats/summary"),
  timeseries: (minutes = 60) => request(`/api/stats/timeseries?minutes=${minutes}`),
  blocklist: () => request("/api/blocklist"),
  blockIp: (ip, reason) => request("/api/blocklist", { method: "POST", body: { ip, reason } }),
  unblockIp: (ip) => request(`/api/blocklist/${encodeURIComponent(ip)}`, { method: "DELETE" }),
  replay: (id) => request(`/api/replay/${id}`, { method: "POST" }),
  async exportCsv() {
    const token = getToken();
    const res = await fetch(`${base}/api/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "honeypot-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};
