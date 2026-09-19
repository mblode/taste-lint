// Token bucket (requests per second) plus a concurrency gate.

export class Limiter {
  private tokens: number;
  private last = Date.now();
  private inFlight = 0;
  private readonly waiters: (() => void)[] = [];

  constructor(
    private readonly perSecond: number,
    private readonly concurrency: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
  ) {
    this.tokens = perSecond;
    this.last = now();
  }

  private refill(): void {
    const t = this.now();
    const elapsed = (t - this.last) / 1000;
    this.tokens = Math.min(
      this.perSecond,
      this.tokens + elapsed * this.perSecond
    );
    this.last = t;
  }

  async acquire(): Promise<() => void> {
    while (this.inFlight >= this.concurrency) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    this.inFlight += 1;
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        break;
      }
      await this.sleep(Math.ceil(((1 - this.tokens) / this.perSecond) * 1000));
    }
    return () => {
      this.inFlight -= 1;
      const next = this.waiters.shift();
      next?.();
    };
  }
}
