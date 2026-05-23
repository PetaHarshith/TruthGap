export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Warm the local embedder so the first analyze doesn't pay the model-download cost.
  try {
    const { warmEmbedder } = await import("./lib/llm/embed");
    warmEmbedder()
      .then(() => console.log("[truthgap] embedder warm"))
      .catch((e) => console.warn("[truthgap] embedder warm failed:", e.message));
  } catch (e) {
    console.warn("[truthgap] instrumentation skipped:", (e as Error).message);
  }
}
