import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-6">
        <Link href="/" className="font-mono text-sm tracking-tight">
          <span className="text-foreground">truth</span>
          <span className="text-muted-foreground">gap</span>
          <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-muted text-[10px] text-muted-foreground uppercase">demo</span>
        </Link>
        <nav className="ml-auto flex items-center gap-5 text-xs text-muted-foreground font-mono">
          <Link href="/" className="hover:text-foreground transition-colors">analyze</Link>
          <Link href="/eval" className="hover:text-foreground transition-colors">eval</Link>
          <a href="https://github.com" className="hover:text-foreground transition-colors" target="_blank" rel="noreferrer">about</a>
        </nav>
      </div>
    </header>
  );
}
