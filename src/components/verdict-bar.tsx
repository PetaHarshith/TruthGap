export function VerdictBar({
  counts,
  className,
}: {
  counts: { supported?: number; partial?: number; contradicted?: number; unverifiable?: number };
  className?: string;
}) {
  const total =
    (counts.supported ?? 0) + (counts.partial ?? 0) + (counts.contradicted ?? 0) + (counts.unverifiable ?? 0);
  if (total === 0) return null;
  const seg = (k: keyof typeof counts, color: string) => {
    const n = counts[k] ?? 0;
    if (n === 0) return null;
    const pct = (n / total) * 100;
    return (
      <div
        key={k}
        className="h-full first:rounded-l-full last:rounded-r-full"
        style={{ width: `${pct}%`, background: color }}
        title={`${k}: ${n} (${pct.toFixed(0)}%)`}
      />
    );
  };
  return (
    <div className={className}>
      <div className="h-1.5 flex w-full rounded-full overflow-hidden bg-muted/40">
        {seg("supported", "oklch(0.7 0.18 162)")}
        {seg("partial", "oklch(0.78 0.18 70)")}
        {seg("contradicted", "oklch(0.7 0.19 22)")}
        {seg("unverifiable", "oklch(0.5 0.005 285)")}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] font-mono text-muted-foreground">
        <Legend dot="oklch(0.7 0.18 162)" label={`supported ${counts.supported ?? 0}`} />
        <Legend dot="oklch(0.78 0.18 70)" label={`partial ${counts.partial ?? 0}`} />
        <Legend dot="oklch(0.7 0.19 22)" label={`contradicted ${counts.contradicted ?? 0}`} />
        <Legend dot="oklch(0.5 0.005 285)" label={`unverifiable ${counts.unverifiable ?? 0}`} />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}
