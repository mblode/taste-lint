// Per (question, state) answer cache under results/cache. Changing one rule's
// wording invalidates only that rule's entries.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { SystemOneNoul } from "../types.js";

export interface CacheEntry {
  noul: number;
  model: string;
  ts: string;
}

export const cacheKey = (
  question: SystemOneNoul,
  state: string,
  model: string
): string =>
  createHash("sha256")
    .update(JSON.stringify(question))
    .update("\n")
    .update(model)
    .update("\n")
    .update(state)
    .digest("hex");

export class AnswerCache {
  constructor(
    private readonly dir: string,
    private readonly enabled = true
  ) {}

  private file(key: string): string {
    return path.join(this.dir, key.slice(0, 2), `${key}.json`);
  }

  get(key: string): CacheEntry | null {
    if (!this.enabled) {
      return null;
    }
    try {
      const raw = JSON.parse(
        fs.readFileSync(this.file(key), "utf-8")
      ) as CacheEntry;
      if (typeof raw.noul !== "number") {
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  }

  set(key: string, entry: CacheEntry): void {
    const file = this.file(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(entry));
  }

  prune(olderThanMs: number): number {
    if (!fs.existsSync(this.dir)) {
      return 0;
    }
    let removed = 0;
    const cutoff = Date.now() - olderThanMs;
    for (const shard of fs.readdirSync(this.dir)) {
      const shardDir = path.join(this.dir, shard);
      for (const name of fs.readdirSync(shardDir)) {
        const file = path.join(shardDir, name);
        if (fs.statSync(file).mtimeMs < cutoff) {
          fs.unlinkSync(file);
          removed += 1;
        }
      }
    }
    return removed;
  }
}
