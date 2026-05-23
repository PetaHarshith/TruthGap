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
}: {
  children?: React.ReactNode;
  text: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">
            {children ?? (
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border/60 text-[8px] font-mono text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                ?
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs bg-card border-border/60 text-foreground/95 text-[12px] leading-relaxed font-normal"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
