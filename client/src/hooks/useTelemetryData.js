import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useSocket } from "./useSocket.js";

export function useTelemetryData(isAuthed) {
  const { socket, connected, socketError } = useSocket(isAuthed);
  const [feed, setFeed] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [selected, setSelected] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [apiError, setApiError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [logsRes, sum, ts] = await Promise.all([api.logs({ limit: 150 }), api.summary(), api.timeseries(120)]);
      const items = logsRes.items || [];
      setTableRows(items);
      setFeed(items.slice(0, 60));
      setSummary(sum);
      setTimeseries(ts);
      setApiError("");
    } catch (e) {
      const message = e?.message || "Failed to fetch telemetry from backend";
      setApiError(message);
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onLog = (payload) => {
      setFeed((prev) => [payload, ...prev].slice(0, 100));
      setTableRows((prev) => [payload, ...prev].slice(0, 250));
    };
    const onAlert = (payload) => {
      setAlerts((prev) => [...prev, { ...payload, id: `${payload.logId}-${Date.now()}` }].slice(-8));
    };
    socket.on("attack:log", onLog);
    socket.on("attack:alert", onAlert);
    return () => {
      socket.off("attack:log", onLog);
      socket.off("attack:alert", onAlert);
    };
  }, [socket]);

  return {
    connected,
    socketError,
    apiError,
    feed,
    tableRows,
    summary,
    timeseries,
    selected,
    setSelected,
    alerts,
    dismissAlert: (id) => setAlerts((a) => a.filter((x) => x.id !== id)),
    refresh,
  };
}
