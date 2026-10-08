import "server-only";
import { EventEmitter } from "node:events";

// In-process pub/sub that feeds the per-user Server-Sent Events stream
// (/api/v1/stream). SSE is one long-lived HTTP response per tab — no extra
// infrastructure or paid realtime service. To run several app instances,
// replace `emit` with Postgres LISTEN/NOTIFY or Redis pub/sub; the public
// functions below stay the same.

export type RealtimeEvent =
  | { type: "message"; conversationId: string; messageId: string; senderId: string }
  | { type: "read"; conversationId: string; userId: string; at: string }
  | { type: "typing"; conversationId: string; userId: string }
  | { type: "notification"; id: string; title: string; href: string | null }
  | { type: "presence"; userId: string; online: boolean };

type Hub = { emitter: EventEmitter; connections: Map<string, number> };

const hub: Hub = ((globalThis as { __joblioRealtime?: Hub }).__joblioRealtime ??= (() => {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return { emitter, connections: new Map<string, number>() };
})());

export function publish(userId: string, event: RealtimeEvent) {
  hub.emitter.emit(`user:${userId}`, event);
}

export function publishMany(userIds: Iterable<string>, event: RealtimeEvent) {
  for (const id of new Set(userIds)) publish(id, event);
}

export function subscribe(userId: string, listener: (event: RealtimeEvent) => void) {
  const channel = `user:${userId}`;
  hub.emitter.on(channel, listener);
  return () => hub.emitter.off(channel, listener);
}

/** Returns true when this is the user's first open connection (they just came online). */
export function markConnected(userId: string) {
  const n = (hub.connections.get(userId) ?? 0) + 1;
  hub.connections.set(userId, n);
  return n === 1;
}

/** Returns true when the user's last connection closed (they went offline). */
export function markDisconnected(userId: string) {
  const n = (hub.connections.get(userId) ?? 1) - 1;
  if (n <= 0) {
    hub.connections.delete(userId);
    return true;
  }
  hub.connections.set(userId, n);
  return false;
}

export function isOnline(userId: string) {
  return (hub.connections.get(userId) ?? 0) > 0;
}
