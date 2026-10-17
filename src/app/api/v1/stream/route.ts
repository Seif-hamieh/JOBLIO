import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { markConnected, markDisconnected, publishMany, subscribe, type RealtimeEvent } from "@/server/realtime";
import { conversationPartnerIds } from "@/server/services/counts";

export const dynamic = "force-dynamic";

// Serverless functions are cut off after a few minutes (300 s on Vercel), which Sentry reports
// as a hung request. The server ends each stream before that; EventSource reconnects by itself.
const MAX_STREAM_MS = 240_000;

// GET /api/v1/stream — per-user Server-Sent Events: new messages, read
// receipts, typing, notifications and presence.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const encoder = new TextEncoder();
  let stop: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let finished = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: RealtimeEvent) => write(`data: ${JSON.stringify(event)}\n\n`);

      write("retry: 5000\n\n");
      const unsubscribe = subscribe(userId, send);

      const announce = async (online: boolean) => {
        try {
          await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
          publishMany(await conversationPartnerIds(userId), { type: "presence", userId, online });
        } catch (err) {
          console.error("[stream presence]", err);
        }
      };
      if (markConnected(userId)) void announce(true);

      const heartbeat = setInterval(() => write(": ping\n\n"), 25_000);

      // Runs once, whichever comes first: the client leaves, the stream is cancelled, or it times out.
      // A planned timeout doesn't announce "offline": the tab reconnects within a second.
      const finish = (announceOffline: boolean) => {
        if (finished) return;
        finished = true;
        clearInterval(heartbeat);
        clearTimeout(rotate);
        unsubscribe();
        if (markDisconnected(userId) && announceOffline) void announce(false);
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      const rotate = setTimeout(() => {
        write("retry: 1000\n\n"); // reconnect quickly after this planned close
        finish(false);
      }, MAX_STREAM_MS);
      stop = () => finish(true);

      req.signal.addEventListener("abort", () => finish(true));
    },
    cancel() {
      stop?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
