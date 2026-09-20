import type { ReviewProcedure, Rule } from "../types.js";
import {
  fail,
  isRecord,
  knownKeys,
  noEmDash,
  str,
} from "./validate-sections.js";

/** A raw source search nominates a review; it does not prove runtime behavior. */
export const isCandidateRule = (rule: Rule): boolean =>
  rule.tier === "mechanical" && rule.unit.includes("source") && !rule.check;

export const reviewProcedure = (
  raw: unknown,
  file: string
): ReviewProcedure | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (!isRecord(raw)) {
    return fail(file, "review must be an object");
  }
  const fields = [
    "applicability",
    "exceptions",
    "evidence",
    "verification",
  ] as const;
  knownKeys(file, "review", raw, [...fields, "sourceHash"]);
  const result = {} as ReviewProcedure;
  for (const key of fields) {
    result[key] = str(file, raw, key);
    noEmDash(file, `review.${key}`, result[key]);
  }
  if (raw.sourceHash !== undefined) {
    const hash = str(file, raw, "sourceHash");
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      fail(file, "review.sourceHash must be a SHA-256 digest");
    }
    result.sourceHash = hash;
  }
  return result;
};
