import Link from "next/link";
import { LiveDot } from "./live-dot";

export function Header() {
  return (
    <header className="border-b border-border/40 bg-background/60 backdrop-blur-xl sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-6">
        <Link href="/" className="group flex items-center gap-2">
          <Logo />
          <span className="font-mono text-[13px] tracking-tight">
            <span className="text-foreground font-medium">truth</span>
            <span className="text-muted-foreground">gap</span>
          </span>
          <span className="mono-pill ml-1">v0.4 · alpha</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-xs font-mono">
          <NavLink href="/">analyze</NavLink>
          <span className="mx-2 h-3 w-px bg-border" />
          <span className="flex items-center gap-1.5 text-muted-foreground px-3">
            <LiveDot color="emerald" />
            <span>live</span>
          </span>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.7 0.18 162)" />
          <stop offset="1" stopColor="oklch(0.6 0.22 250)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#lg)" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.5" fill="url(#lg)" />
    </svg>
  );
}
