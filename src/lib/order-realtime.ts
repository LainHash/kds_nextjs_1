"use client";

import * as signalR from "@microsoft/signalr";
import { authStorage } from "./auth-storage";
import { env } from "./env";

export interface OrderRealtimeEvent {
  eventType: string;
  branchPublicId: string;
  orderPublicId: string;
  orderCode: string;
  orderStatus: string;
  paymentStatus: string;
  orderItemPublicId?: string | null;
  preparationStatus?: string | null;
  occurredAtUtc?: string;
}

export type RealtimeTransportState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

function buildHubUrl(): string {
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/api/commerce/hubs/orders`;
}

export function subscribeBranchOrdersRealtime(options: {
  branchId: string;
  onBatchedEvents: (events: OrderRealtimeEvent[]) => void;
  onStateChange?: (state: RealtimeTransportState) => void;
}): () => void {
  const { branchId, onBatchedEvents, onStateChange } = options;
  let disposed = false;
  let flushTimer: number | null = null;
  let rafId: number | null = null;
  const pendingEvents: OrderRealtimeEvent[] = [];

  const flushBatch = () => {
    flushTimer = null;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (disposed || pendingEvents.length === 0) return;
    const batch = pendingEvents.splice(0, pendingEvents.length);
    onBatchedEvents(batch);
  };

  const enqueueEvent = (evt: OrderRealtimeEvent) => {
    if (disposed) return;
    pendingEvents.push(evt);
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(flushBatch);
    }, 100);
  };

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(buildHubUrl(), {
      withCredentials: true,
      accessTokenFactory: () => authStorage.getAccessToken() ?? "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on("OrderChanged", (evt: OrderRealtimeEvent) => {
    if (
      evt.branchPublicId &&
      evt.branchPublicId.toLowerCase() !== branchId.toLowerCase()
    ) {
      return;
    }
    enqueueEvent(evt);
  });

  connection.onreconnecting(() => {
    if (!disposed) onStateChange?.("reconnecting");
  });

  connection.onreconnected(async () => {
    if (disposed) return;
    try {
      await connection.invoke("JoinBranch", branchId);
      onStateChange?.("connected");
      // Sync delta after reconnect so no orders are missed
      enqueueEvent({
        eventType: "Reconnected",
        branchPublicId: branchId,
        orderPublicId: "",
        orderCode: "",
        orderStatus: "",
        paymentStatus: "",
      });
    } catch {
      onStateChange?.("reconnecting");
    }
  });

  connection.onclose(() => {
    if (!disposed) onStateChange?.("disconnected");
  });

  onStateChange?.("connecting");
  connection
    .start()
    .then(async () => {
      if (disposed) return;
      await connection.invoke("JoinBranch", branchId);
      if (!disposed) onStateChange?.("connected");
    })
    .catch(() => {
      if (!disposed) onStateChange?.("disconnected");
    });

  return () => {
    disposed = true;
    if (flushTimer !== null) window.clearTimeout(flushTimer);
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    if (connection.state === signalR.HubConnectionState.Connected) {
      void connection.invoke("LeaveBranch", branchId).catch(() => undefined);
    }
    void connection.stop().catch(() => undefined);
  };
}

