/**
 * Anthropic tier-1 token bucket — proactively throttles so we stay under
 *   50 requests / minute  (≈ 0.833 RPS)
 *   30,000 input tokens / minute  (≈ 500 TPS)
 *
 * The Anthropic SDK retries 429s on its own, but the SDK retries add latency
 * and are bursty. Pre-throttling produces smoother, more predictable runs
 * — and lets us safely raise per-claim concurrency.
 */

class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private lastRefill: number;
  private queue: Array<{ cost: number; resolve: () => void }> = [];
  private draining = false;

  constructor(capacity: number, refillPerSec: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSec = refillPerSec;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.lastRefill = now;
    }
  }

  async acquire(cost: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ cost, resolve });
      this.drain();
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    while (this.queue.length) {
      this.refill();
      const head = this.queue[0];
      if (this.tokens >= head.cost) {
        this.tokens -= head.cost;
        this.queue.shift()!.resolve();
        continue;
      }
      const wait = ((head.cost - this.tokens) / this.refillPerSec) * 1000;
      await new Promise((r) => setTimeout(r, Math.min(Math.max(wait, 50), 1500)));
    }
    this.draining = false;
  }
}

// Singleton buckets — survive HMR via globalThis
const g = globalThis as unknown as { __truthgap_rpm__?: TokenBucket; __truthgap_tpm__?: TokenBucket };
const RPM_LIMIT = 45; // tier-1 is 50; leave a small headroom
const TPM_LIMIT = 28_000; // tier-1 is 30k; leave headroom

if (!g.__truthgap_rpm__) g.__truthgap_rpm__ = new TokenBucket(RPM_LIMIT, RPM_LIMIT / 60);
if (!g.__truthgap_tpm__) g.__truthgap_tpm__ = new TokenBucket(TPM_LIMIT, TPM_LIMIT / 60);

const rpm = g.__truthgap_rpm__;
const tpm = g.__truthgap_tpm__;

/** Acquire request + estimated input-token budget before calling Anthropic. */
export async function reserveAnthropic(estimatedInputTokens: number): Promise<void> {
  await Promise.all([
    rpm.acquire(1),
    tpm.acquire(Math.max(1, Math.min(estimatedInputTokens, TPM_LIMIT))),
  ]);
}

/** Rough token estimate: ~3.5 chars/token for English+code mix. */
export function estimateTokens(...parts: string[]): number {
  const chars = parts.reduce((s, p) => s + (p?.length ?? 0), 0);
  return Math.ceil(chars / 3.5);
}
