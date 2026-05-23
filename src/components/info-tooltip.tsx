"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTooltip({
  children,
  text,
  side = "bottom",
}: {
  children?: React.ReactNode;
  text: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="group inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring align-middle"
            aria-label="More info"
          >
            {children ?? (
              <svg
                viewBox="0 0 16 16"
                width="11"
                height="11"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6.25"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                />
                <path
                  d="M6.6 6.2c.1-.9.8-1.6 1.6-1.6.9 0 1.6.7 1.6 1.5 0 .9-.7 1.3-1.3 1.7-.4.3-.5.5-.5 1"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="11.5" r="0.65" fill="currentColor" />
              </svg>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align="end"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          className="max-w-[240px] bg-popover/95 backdrop-blur border border-border text-foreground text-[12px] leading-snug font-normal px-3 py-2 shadow-xl shadow-black/50 rounded-lg"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
