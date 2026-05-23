import { NextRequest } from "next/server";
import { subscribe } from "@/lib/events";
import { sql, ensureSchema } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await ctx.params;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // initial repo status
      const repos = await sql()<{ status: string; current_stage: string | null }[]>`
        SELECT status, current_stage FROM repos WHERE id = ${id}
      `;
      if (repos.length === 0) {
        send({ stage: "error", level: "error", message: "repo not found", ts: Date.now() });
        controller.close();
        return;
      }

      const unsubscribe = subscribe(id, send);

      // heartbeat
      const hb = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: heartbeat\n\n`));
        } catch {}
      }, 15000);

      // poll status; close stream when terminal
      const poll = setInterval(async () => {
        try {
          const r = await sql()<{ status: string }[]>`SELECT status FROM repos WHERE id = ${id}`;
          if (r[0]?.status === "done" || r[0]?.status === "failed") {
            setTimeout(() => {
              clearInterval(poll);
              clearInterval(hb);
              unsubscribe();
              try { controller.close(); } catch {}
            }, 2000);
          }
        } catch {}
      }, 1500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
