import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { InputError } from "../lib/errors.js";

export const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    throw new InputError(
      "INVALID_SCAN_INPUT",
      `Cannot read JSON input: ${file}`
    );
  }
};
export const writeJson = (file: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
    });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
};
