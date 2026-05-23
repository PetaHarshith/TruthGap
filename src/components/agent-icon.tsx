import { cn } from "@/lib/utils";

export function AgentIcon({
  agent,
  className,
}: {
  agent: "code" | "history" | "web" | string;
  className?: string;
}) {
  const common = cn("w-3.5 h-3.5", className);
  if (agent === "code") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden>
        <path
          d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (agent === "history") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 4.5V8l2.5 1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (agent === "web") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M2 8h12M8 2c2.5 2.5 2.5 9.5 0 12-2.5-2.5-2.5-9.5 0-12z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  }
  return null;
}
