import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { markConnected, markDisconnected, publishMany, subscribe, type RealtimeEvent } from "@/server/realtime";
import { conversationPartnerIds } from "@/server/services/counts";

export const dynamic = "force-dynamic";

// GET /api/v1/stream — per-user Server-Sent Events: new messages, read
// receipts, typing, notifications and presence.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
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

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        if (markDisconnected(userId)) void announce(false);
        closed = true;
        try {
          controller.close();
        } catch {}
      });
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
