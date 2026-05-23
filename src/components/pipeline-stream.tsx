"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Event = {
  ts: number;
  stage: string;
  level: "info" | "warn" | "error" | "stage-start" | "stage-done";
  message: string;
  data?: Record<string, unknown>;
};

const STAGE_ORDER = ["ingest", "index", "scrape", "extract", "verify", "synthesize", "kpi", "done"];
const STAGE_LABEL: Record<string, string> = {
  ingest: "Ingest repository",
  index: "Parse · chunk · embed · index",
  scrape: "Scrape external sources",
  extract: "Extract atomic claims",
  verify: "3-agent verification",
  synthesize: "Synthesize doc patches",
  kpi: "Roll up KPIs",
  done: "Done",
};

export function PipelineStream({ repoId, onDone }: { repoId: string; onDone?: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeStage, setActiveStage] = useState<string>("ingest");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/repos/${repoId}/events`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as Event;
        setEvents((prev) => [...prev, data]);
        if (data.level === "stage-start") setActiveStage(data.stage);
        if (data.stage === "done" || data.level === "error") {
          setTimeout(() => onDone?.(), 1500);
          es.close();
        }
      } catch {}
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [repoId, onDone]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  const stageStatus: Record<string, "pending" | "active" | "done" | "error"> = {};
  for (const s of STAGE_ORDER) stageStatus[s] = "pending";
  for (const e of events) {
    if (e.level === "stage-start") stageStatus[e.stage] = "active";
    if (e.level === "stage-done") stageStatus[e.stage] = "done";
    if (e.level === "error") stageStatus[e.stage] = "error";
  }
  if (stageStatus[activeStage] === "pending") stageStatus[activeStage] = "active";

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-6">
      <ol className="space-y-2 text-sm">
        {STAGE_ORDER.slice(0, -1).map((s) => {
          const status = stageStatus[s];
          return (
            <li
              key={s}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md border",
                status === "active" && "border-amber-500/40 bg-amber-500/5",
                status === "done" && "border-emerald-500/30 bg-emerald-500/5",
                status === "error" && "border-red-500/40 bg-red-500/5",
                status === "pending" && "border-border/40 bg-muted/20 text-muted-foreground",
              )}
            >
              <StageDot status={status} />
              <div className="flex-1 font-mono text-xs">{STAGE_LABEL[s]}</div>
            </li>
          );
        })}
      </ol>

      <div
        ref={scrollRef}
        className="rounded-xl border border-border bg-card/30 p-4 font-mono text-xs h-[440px] overflow-auto"
      >
        {events.length === 0 ? (
          <div className="text-muted-foreground">waiting for events…</div>
        ) : (
          events.map((e, i) => (
            <div key={i} className="flex gap-3 py-0.5">
              <span className="text-muted-foreground shrink-0">
                {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              <span
                className={cn(
                  "shrink-0 w-20 truncate",
                  e.level === "error" ? "text-red-400" : "text-amber-300",
                )}
              >
                [{e.stage}]
              </span>
              <span
                className={cn(
                  e.level === "error" && "text-red-400",
                  e.level === "warn" && "text-amber-300",
                  e.level === "stage-done" && "text-emerald-300",
                )}
              >
                {e.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StageDot({ status }: { status: "pending" | "active" | "done" | "error" }) {
  if (status === "active") {
    return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  }
  if (status === "done") {
    return <span className="w-2 h-2 rounded-full bg-emerald-400" />;
  }
  if (status === "error") {
    return <span className="w-2 h-2 rounded-full bg-red-400" />;
  }
  return <span className="w-2 h-2 rounded-full bg-zinc-600" />;
}
