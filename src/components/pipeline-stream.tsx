"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const STAGE_SUB: Record<string, string> = {
  ingest: "git clone · file walk",
  index: "tree-sitter · pgvector · tsvector",
  scrape: "cheerio · dep CHANGELOGs",
  extract: "Claude · strict JSON schema",
  verify: "code · history · web → consolidator",
  synthesize: "unified diff",
  kpi: "Doc Health · Drift · Friction",
  done: "complete",
};

export function PipelineStream({ repoId, onDone }: { repoId: string; onDone?: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeStage, setActiveStage] = useState<string>("ingest");
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedAt = useMemo(() => Date.now(), []);

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

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-6">
      <ol className="space-y-1.5 text-sm">
        {STAGE_ORDER.slice(0, -1).map((s, idx) => {
          const status = stageStatus[s];
          return (
            <li
              key={s}
              className={cn(
                "group relative flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all duration-300",
                status === "active" &&
                  "border-amber-500/40 bg-amber-500/[0.04] shadow-[0_0_24px_-12px_oklch(0.78_0.18_70/0.6)]",
                status === "done" && "border-emerald-500/25 bg-emerald-500/[0.03]",
                status === "error" && "border-red-500/40 bg-red-500/[0.04]",
                status === "pending" && "border-border/40 bg-muted/10",
              )}
            >
              {idx < STAGE_ORDER.length - 2 && (
                <span className="absolute left-[15px] top-[36px] bottom-[-6px] w-px bg-border/40" />
              )}
              <div className="relative shrink-0 mt-0.5 z-10">
                <StageDot status={status} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-mono text-[12px]",
                    status === "pending" && "text-muted-foreground/70",
                  )}
                >
                  {STAGE_LABEL[s]}
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-muted-foreground/60">
                  {STAGE_SUB[s]}
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0 mt-0.5">
                0{idx + 1}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="terminal flex flex-col">
        <div className="terminal-bar">
          <span style={{ background: "oklch(0.7 0.19 22)" }} />
          <span style={{ background: "oklch(0.78 0.18 70)" }} />
          <span style={{ background: "oklch(0.7 0.18 162)" }} />
          <span className="ml-3 text-[11px] text-muted-foreground/70 font-mono tracking-[0.05em]">
            truthgap pipeline · {events.length} events · {elapsed}s
          </span>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 p-4 text-[11.5px] h-[480px] overflow-auto leading-relaxed"
        >
          {events.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <span className="spinner" />
              waiting for first event…
            </div>
          ) : (
            events.map((e, i) => (
              <div key={i} className="slide-in flex gap-3 py-0.5">
                <span className="text-muted-foreground/50 shrink-0 tabular-nums">
                  {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span
                  className={cn(
                    "shrink-0 w-[88px] truncate font-medium",
                    e.level === "error" ? "text-red-400" : "text-sky-300",
                  )}
                >
                  [{e.stage}]
                </span>
                <span
                  className={cn(
                    "flex-1",
                    e.level === "error" && "text-red-400",
                    e.level === "warn" && "text-amber-300",
                    e.level === "stage-done" && "text-emerald-300",
                    e.level === "stage-start" && "text-foreground",
                    e.level === "info" && "text-foreground/70",
                  )}
                >
                  {e.level === "stage-start" && "▶ "}
                  {e.level === "stage-done" && "✓ "}
                  {e.level === "error" && "✗ "}
                  {e.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StageDot({ status }: { status: "pending" | "active" | "done" | "error" }) {
  if (status === "active") {
    return (
      <span className="relative flex items-center justify-center w-[14px] h-[14px]">
        <span className="absolute w-[14px] h-[14px] rounded-full bg-amber-400/30 animate-ping" />
        <span className="relative w-[8px] h-[8px] rounded-full bg-amber-400" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex items-center justify-center w-[14px] h-[14px] rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
        <svg viewBox="0 0 10 10" className="w-2 h-2 text-emerald-300" aria-hidden>
          <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
    );
  }
  if (status === "error") {
    return <span className="block w-[10px] h-[10px] rounded-full bg-red-400" />;
  }
  return <span className="block w-[10px] h-[10px] rounded-full bg-zinc-600/60 ring-1 ring-zinc-500/30" />;
}
