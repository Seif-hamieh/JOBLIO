"use client";

import { useI18n } from "@/i18n/client";
import { resolveMessage } from "@/i18n/message";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";

export type RealtimeEvent =
  | { type: "message"; conversationId: string; messageId: string; senderId: string }
  | { type: "read"; conversationId: string; userId: string; at: string }
  | { type: "typing"; conversationId: string; userId: string }
  | { type: "notification"; id: string; title: string; href: string | null }
  | { type: "presence"; userId: string; online: boolean };

export type Counts = { notifications: number; messages: number; pendingConnections: number };

type Ctx = {
  counts: Counts;
  refreshCounts: () => void;
  subscribe: (fn: (e: RealtimeEvent) => void) => () => void;
  online: Set<string>;
  connected: boolean;
};

const RealtimeContext = createContext<Ctx | null>(null);

export function RealtimeProvider({ initialCounts, children }: { initialCounts: Counts; children: ReactNode }) {
  const [counts, setCounts] = useState(initialCounts);
  const [online, setOnline] = useState<Set<string>>(() => new Set());
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(e: RealtimeEvent) => void>());
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me/counts", { cache: "no-store" });
      if (res.ok) setCounts(await res.json());
    } catch {}
  }, []);

  useEffect(() => setCounts(initialCounts), [initialCounts]);

  useEffect(() => {
    const es = new EventSource("/api/v1/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      listeners.current.forEach((l) => l(event));
      if (event.type === "notification") {
        setCounts((c) => ({ ...c, notifications: c.notifications + 1 }));
        if (!pathRef.current.startsWith("/notifications")) toast.info(resolveMessage(tRef.current, event.title));
      } else if (event.type === "message") {
        void refreshCounts();
      } else if (event.type === "presence") {
        setOnline((prev) => {
          const next = new Set(prev);
          if (event.online) next.add(event.userId);
          else next.delete(event.userId);
          return next;
        });
      }
    };
    return () => es.close();
  }, [refreshCounts]);

  const subscribe = useCallback((fn: (e: RealtimeEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  return <RealtimeContext value={{ counts, refreshCounts, subscribe, online, connected }}>{children}</RealtimeContext>;
}

const EMPTY: Ctx = {
  counts: { notifications: 0, messages: 0, pendingConnections: 0 },
  refreshCounts: () => {},
  subscribe: () => () => {},
  online: new Set(),
  connected: false,
};

/** Realtime context; inert for signed-out visitors. */
export function useRealtime() {
  return use(RealtimeContext) ?? EMPTY;
}

export function useRealtimeEvent(fn: (e: RealtimeEvent) => void) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
