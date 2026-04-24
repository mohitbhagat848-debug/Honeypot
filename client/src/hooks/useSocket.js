import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "../api";

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export function useSocket(enabled) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [socketError, setSocketError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    const s = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      setSocketError("");
    });
    s.on("disconnect", (reason) => {
      setConnected(false);
      setSocketError(`Realtime socket disconnected: ${reason || "unknown reason"}`);
    });
    s.on("connect_error", (err) => {
      setConnected(false);
      setSocketError(err?.message || "Realtime socket failed to connect");
    });

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
      setSocketError("");
    };
  }, [enabled]);

  return { socket, connected, socketError };
}
