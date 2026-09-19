// JSONL result recorder. Writes results/<layer>-<ISO8601>.jsonl, one JSON
// object per line, plus a final {kind:'summary'} line. Every record carries
// ts, eval=layer, git_sha, and whatever the caller adds.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { RecorderHandle } from "../types.js";

const gitSha = (repoDir?: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoDir,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
};

const isoStamp = (): string =>
  // Filesystem-safe ISO 8601: replace ':' so the filename is portable.
  new Date().toISOString().replaceAll(":", "-");

export const makeRecorder = (
  layer: string,
  options: { resultsDir?: string; skillsDir?: string } = {}
): RecorderHandle => {
  // Results live under the current working directory (the scanned repo or taste-lint).
  const resultsDir = options.resultsDir ?? path.join(process.cwd(), "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const file = path.join(resultsDir, `${layer}-${isoStamp()}.jsonl`);
  // Stamp SHA from skills repo if provided.
  const sha = gitSha(options.skillsDir);

  const writeLine = (obj: Record<string, unknown>): void => {
    fs.appendFileSync(file, `${JSON.stringify(obj)}\n`);
  };

  const append = (record: Record<string, unknown>): Record<string, unknown> => {
    const line: Record<string, unknown> = {
      eval: layer,
      git_sha: sha,
      ts: new Date().toISOString(),
      ...record,
    };
    writeLine(line);
    return line;
  };

  const summary = (obj: Record<string, unknown>): Record<string, unknown> => {
    const line: Record<string, unknown> = {
      eval: layer,
      git_sha: sha,
      kind: "summary",
      ts: new Date().toISOString(),
      ...obj,
    };
    writeLine(line);
    return line;
  };

  return { append, file, summary };
};
