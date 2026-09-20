// Per (question, state) answer cache under results/cache. Changing one rule's
// wording invalidates only that rule's entries.

import { createHash, randomUUID } from "node:crypto";
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
      // A hand-edited or corrupt entry must not reach the bands.
      if (
        typeof raw.noul !== "number" ||
        !Number.isFinite(raw.noul) ||
        raw.noul < 0 ||
        raw.noul > 1
      ) {
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
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(entry));
      fs.renameSync(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
}
