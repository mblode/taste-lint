// Deterministic fixes applied to the source slice of a unit.

export type FixFunction = (slice: string) => string;

// Curl straight quotes in a prose slice. Opening marks follow whitespace,
// an opening bracket or the start; everything else closes. Apostrophes are
// always the right single quote.
export const smartQuotes: FixFunction = (slice) =>
  slice
    .replaceAll(/(^|[\s([{\u2014\u2013-])"/gu, "$1“")
    .replaceAll('"', "”")
    .replaceAll(/(^|[\s([{])'(?=\S)/gu, "$1‘")
    .replaceAll("'", "’");

// Three periods to an ellipsis character.
export const ellipsis: FixFunction = (slice) => slice.replaceAll("...", "…");

// A lowercase x between digits to a multiplication sign.
export const multiplicationSign: FixFunction = (slice) =>
  slice
    .replaceAll(/(?<=\d)\s?x\s?(?=\d)/gu, " × ")
    .replaceAll(/\s+×\s+/gu, "×");

// Insert a no-break space between a number and its unit.
export const nbspValueUnit: FixFunction = (slice) =>
  slice.replaceAll(
    /(\d) (?=(?:px|pt|em|rem|ms|s|min|h|KB|MB|GB|TB|%|kg|g|km|m|cm|mm|fps)\b)/gu,
    "$1 "
  );

export const FIXES: Record<string, FixFunction> = {
  ellipsis,
  multiplicationSign,
  nbspValueUnit,
  smartQuotes,
};
