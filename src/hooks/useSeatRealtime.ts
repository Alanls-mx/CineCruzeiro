"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PUBLIC_BASE_PATH } from "@/utils/cinema";

type SeatRealtimeStatus = "connecting" | "connected" | "disconnected";
type SeatChange = { seatId: string; status: "available" | "held" | "unavailable"; heldByMe?: boolean; expiresAt?: string };
type SeatResult = { ok: boolean; code?: string; message?: string };

export function useSeatRealtime({ sessionId, ownerToken, enabled, selectedSeatIds, onSeatChange, onSessionState, onSessionRefresh }: {
  sessionId: string;
  ownerToken: string;
  enabled: boolean;
  selectedSeatIds: string[];
  onSeatChange: (change: SeatChange) => void;
  onSessionState: (state: { occupiedSeatIds: string[]; heldSeats: Array<{ seatId: string; heldByMe: boolean; expiresAt?: string }> }) => void;
  onSessionRefresh?: () => void;
}) {
  const [status, setStatus] = useState<SeatRealtimeStatus>("disconnected");
  const socketRef = useRef<WebSocket | null>(null);
  const selectedRef = useRef(selectedSeatIds);
  const callbacksRef = useRef({ onSeatChange, onSessionState, onSessionRefresh });
  const pendingRef = useRef(new Map<string, (result: SeatResult) => void>());

  selectedRef.current = selectedSeatIds;
  callbacksRef.current = { onSeatChange, onSessionState, onSessionRefresh };

  const sendRequest = useCallback((type: "select_seat" | "release_seat", seatId: string) => new Promise<SeatResult>((resolve) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      resolve({ ok: false, code: "REALTIME_DISCONNECTED", message: "Conexão em tempo real indisponível. Aguarde alguns segundos." });
      return;
    }
    const requestId = crypto.randomUUID();
    pendingRef.current.set(requestId, resolve);
    socket.send(JSON.stringify({ type, requestId, seatId }));
    window.setTimeout(() => {
      const pending = pendingRef.current.get(requestId);
      if (!pending) return;
      pendingRef.current.delete(requestId);
      pending({ ok: false, code: "REALTIME_TIMEOUT", message: "A reserva demorou para responder. Tente novamente." });
    }, 8000);
  }), []);

  useEffect(() => {
    if (!enabled || !sessionId || !ownerToken) {
      setStatus("disconnected");
      return;
    }
    let disposed = false;
    let reconnectTimer = 0;
    let heartbeatTimer = 0;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}${PUBLIC_BASE_PATH}/api/realtime/seats`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        attempt = 0;
        setStatus("connected");
        socket.send(JSON.stringify({ type: "join_session", requestId: crypto.randomUUID(), sessionId, ownerToken }));
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "heartbeat", requestId: crypto.randomUUID(), seatIds: selectedRef.current }));
          }
        }, 35000);
      });

      socket.addEventListener("message", (event) => {
        let message: Record<string, unknown>;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        const type = String(message.type || "");
        const requestId = String(message.requestId || "");
        if (requestId && pendingRef.current.has(requestId)) {
          const resolve = pendingRef.current.get(requestId)!;
          pendingRef.current.delete(requestId);
          if (type === "select_seat_rejected" || type === "protocol_error") {
            resolve({ ok: false, code: String(message.code || "SEAT_REALTIME_ERROR"), message: String(message.message || "Não foi possível reservar a poltrona.") });
          } else if (type === "select_seat_confirmed" || type === "release_seat_confirmed") {
            resolve({ ok: true });
          }
        }
        if (type === "session_state") {
          callbacksRef.current.onSessionState({
            occupiedSeatIds: Array.isArray(message.occupiedSeatIds) ? message.occupiedSeatIds.map(String) : [],
            heldSeats: Array.isArray(message.heldSeats) ? message.heldSeats as Array<{ seatId: string; heldByMe: boolean; expiresAt?: string }> : []
          });
        }
        if (type === "seat_status_changed" && message.seatId) {
          callbacksRef.current.onSeatChange({
            seatId: String(message.seatId),
            status: String(message.status) as SeatChange["status"],
            heldByMe: Boolean(message.heldByMe),
            expiresAt: message.expiresAt ? String(message.expiresAt) : undefined
          });
        }
        if (type === "session_refresh_required") {
          callbacksRef.current.onSessionRefresh?.();
        }
      });

      socket.addEventListener("close", () => {
        window.clearInterval(heartbeatTimer);
        if (disposed) return;
        setStatus("disconnected");
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(10000, 750 * (2 ** Math.min(attempt, 4))));
      });
      socket.addEventListener("error", () => socket.close());
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socketRef.current?.close();
      socketRef.current = null;
      for (const resolve of pendingRef.current.values()) resolve({ ok: false, code: "REALTIME_CLOSED" });
      pendingRef.current.clear();
    };
  }, [enabled, ownerToken, sessionId]);

  return {
    status,
    selectSeat: useCallback((seatId: string) => sendRequest("select_seat", seatId), [sendRequest]),
    releaseSeat: useCallback((seatId: string) => sendRequest("release_seat", seatId), [sendRequest])
  };
}
