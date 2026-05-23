import { cn } from "@/lib/utils";

export function LiveDot({
  color = "emerald",
  className,
}: {
  color?: "emerald" | "amber" | "red" | "zinc";
  className?: string;
}) {
  const c = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    zinc: "text-zinc-500",
  }[color];
  return <span className={cn("live-dot", c, className)} />;
}
