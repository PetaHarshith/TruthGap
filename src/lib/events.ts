import { EventEmitter } from "node:events";

export type PipelineEvent = {
  ts: number;
  stage: string;
  level: "info" | "warn" | "error" | "stage-start" | "stage-done";
  message: string;
  data?: Record<string, unknown>;
};

const globalKey = "__truthgap_bus__";
type Bus = Map<string, { emitter: EventEmitter; backlog: PipelineEvent[] }>;

function getBus(): Bus {
  const g = globalThis as unknown as { [k: string]: unknown };
  if (!g[globalKey]) g[globalKey] = new Map();
  return g[globalKey] as Bus;
}

function channel(repoId: string) {
  const bus = getBus();
  let c = bus.get(repoId);
  if (!c) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    c = { emitter, backlog: [] };
    bus.set(repoId, c);
  }
  return c;
}

export function emitEvent(repoId: string, ev: Omit<PipelineEvent, "ts">) {
  const full: PipelineEvent = { ...ev, ts: Date.now() };
  const c = channel(repoId);
  c.backlog.push(full);
  if (c.backlog.length > 500) c.backlog.shift();
  c.emitter.emit("event", full);
}

export function subscribe(
  repoId: string,
  cb: (ev: PipelineEvent) => void,
): () => void {
  const c = channel(repoId);
  for (const ev of c.backlog) cb(ev);
  c.emitter.on("event", cb);
  return () => c.emitter.off("event", cb);
}

export function closeChannel(repoId: string) {
  const bus = getBus();
  const c = bus.get(repoId);
  if (c) c.emitter.removeAllListeners();
}
