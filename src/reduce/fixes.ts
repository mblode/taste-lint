// Deterministic fixes. Each runs over one prose range of a unit (see
// `Unit.fixRanges`), never over quotes, braces or inline code, and each
// matches exactly what its rule's `mechanical.regex` flags.

export type FixFunction = (prose: string) => string;

// Curl straight quotes. Opening marks follow whitespace, an opening bracket,
// a dash or the start; everything else closes. A single quote before a digit
// (the '90s) or a letter run is an apostrophe, always the right single quote.
const EM_DASH = String.fromCodePoint(0x20_14);
const EN_DASH = String.fromCodePoint(0x20_13);
const OPENING_DOUBLE = new RegExp(
  String.raw`(^|[\s([{${EM_DASH}${EN_DASH}-])"`,
  "gu"
);
const OPENING_SINGLE = /(^|[\s([{])'(?=[^\s\d])/gu;

export const smartQuotes: FixFunction = (prose) =>
  prose
    .replaceAll(OPENING_DOUBLE, "$1\u201C")
    .replaceAll('"', "\u201D")
    .replaceAll(OPENING_SINGLE, "$1\u2018")
    .replaceAll("'", "\u2019");

// Three periods to an ellipsis character (typography-ellipsis).
export const ellipsis: FixFunction = (prose) => prose.replaceAll("...", "…");

// A lowercase x between whole numbers to a multiplication sign, with the same
// guards as typography-multiplication-sign so `0x1F` and `3.5x` stay put.
export const multiplicationSign: FixFunction = (prose) =>
  prose.replaceAll(/(?<![\w.])([1-9]\d*)\s?x\s?(\d+)(?![\w.%])/gu, "$1×$2");

// A no-break space between a number and its unit; the unit list mirrors
// typography-nbsp-value-unit.
export const nbspValueUnit: FixFunction = (prose) =>
  prose.replaceAll(
    /(\d) (?=(?:px|pt|em|rem|ms|min|KB|MB|GB|TB|kg|km|cm|mm|fps|%)(?![\p{L}\d]))/gu,
    "$1 "
  );

export const FIXES: Record<string, FixFunction> = {
  ellipsis,
  multiplicationSign,
  nbspValueUnit,
  smartQuotes,
};
