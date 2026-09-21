import fs from "node:fs";

import { InputError } from "./errors.js";

export interface WritingContext {
  facts?: string;
  profile?: string;
  instructions?: string;
}

export const validateWritingContext = (value: unknown): WritingContext => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError(
      "INVALID_WRITING_CONTEXT",
      "Writing context must be an object with facts, profile, or instructions strings."
    );
  }
  const record = value as Record<string, unknown>;
  for (const [key, text] of Object.entries(record)) {
    if (
      !["facts", "profile", "instructions"].includes(key) ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      throw new InputError(
        "INVALID_WRITING_CONTEXT",
        "Writing context accepts only nonempty facts, profile, and instructions strings."
      );
    }
  }
  if (Object.keys(record).length === 0) {
    throw new InputError(
      "INVALID_WRITING_CONTEXT",
      "Provide at least one writing context field."
    );
  }
  return record as WritingContext;
};

export const readWritingContext = (file: string): WritingContext => {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    throw new InputError(
      "INVALID_WRITING_CONTEXT",
      "Cannot read writing context: provide a readable JSON file."
    );
  }
  return validateWritingContext(value);
};
