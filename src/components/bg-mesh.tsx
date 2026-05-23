export function BackgroundMesh() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-dot-grid opacity-60" />
      <div className="bg-mesh" />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.1) 50%, transparent 100%)",
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, transparent 0%, oklch(0.115 0.005 285) 80%)",
        }}
      />
    </div>
  );
}
