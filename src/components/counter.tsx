"use client";

import { useEffect, useRef, useState } from "react";

export function Counter({
  value,
  duration = 700,
  format = (n: number) => n.toFixed(0),
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  suffix?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);
  const start = useRef<number | null>(null);
  const initial = useRef(0);

  useEffect(() => {
    start.current = null;
    initial.current = current;
    let raf = 0;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const elapsed = ts - start.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setCurrent(initial.current + (value - initial.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span className={className}>
      {format(current)}
      {suffix}
    </span>
  );
}
