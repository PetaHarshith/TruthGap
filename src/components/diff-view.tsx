import { cn } from "@/lib/utils";

export function DiffView({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  return (
    <pre className="rounded-md border border-border bg-background/60 p-3 text-[11px] font-mono overflow-auto max-h-96">
      {lines.map((line, i) => {
        let cls = "text-foreground/80";
        if (line.startsWith("+++") || line.startsWith("---")) cls = "text-muted-foreground";
        else if (line.startsWith("@@")) cls = "text-sky-300";
        else if (line.startsWith("+")) cls = "text-emerald-300 bg-emerald-500/5";
        else if (line.startsWith("-")) cls = "text-red-300 bg-red-500/5";
        return (
          <div key={i} className={cn("px-1", cls)}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}
