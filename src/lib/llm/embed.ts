import { pipeline, env as hfEnv, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Cache model files inside the project so the first run can be reused
hfEnv.allowLocalModels = true;
hfEnv.useBrowserCache = false;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

type Extractor = FeatureExtractionPipeline;

declare global {
  // eslint-disable-next-line no-var
  var __truthgap_embedder__: Promise<Extractor> | undefined;
}

function getEmbedder(): Promise<Extractor> {
  if (!globalThis.__truthgap_embedder__) {
    globalThis.__truthgap_embedder__ = pipeline("feature-extraction", MODEL_ID, {
      dtype: "fp32",
    }) as Promise<Extractor>;
  }
  return globalThis.__truthgap_embedder__;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getEmbedder();
  const out: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 6000));
    const result = await extractor(batch, { pooling: "mean", normalize: true });
    // result is a Tensor: [batch_size, EMBED_DIM]. Convert to nested arrays.
    const data = Array.from(result.data as Float32Array | number[]);
    for (let j = 0; j < batch.length; j++) {
      const start = j * EMBED_DIM;
      out.push(data.slice(start, start + EMBED_DIM));
    }
  }
  return out;
}

/** Warm the model so the first analyze request doesn't pay the download cost. */
export async function warmEmbedder(): Promise<void> {
  await getEmbedder();
}
