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

// Drop the referral tag ChatGPT appends to links it cites
// (voice packs from ghostwriter-config flag it).
export const stripUtm: FixFunction = (prose) =>
  prose
    .replaceAll(/\?utm_source=chatgpt\.com(?![\w&=-])/gu, "")
    .replaceAll(/([?&])utm_source=chatgpt\.com&/gu, "$1")
    .replaceAll("&utm_source=chatgpt.com", "");

// US to Australian/British spelling for a voice that asks for it. Keys are
// whole lowercase words; a leading capital is kept. A voice pack's rule regex
// must equal AU_SPELLING_PATTERN (fixes.test.ts checks the fixture pack).
export const AU_SPELLING: Record<string, string> = {
  analyze: "analyse",
  analyzed: "analysed",
  apologize: "apologise",
  behavior: "behaviour",
  behaviors: "behaviours",
  canceled: "cancelled",
  canceling: "cancelling",
  catalog: "catalogue",
  color: "colour",
  colored: "coloured",
  colors: "colours",
  customize: "customise",
  customized: "customised",
  favorite: "favourite",
  favorites: "favourites",
  gray: "grey",
  honor: "honour",
  labeled: "labelled",
  labeling: "labelling",
  modeling: "modelling",
  neighbor: "neighbour",
  optimize: "optimise",
  optimized: "optimised",
  organization: "organisation",
  organizations: "organisations",
  organize: "organise",
  organized: "organised",
  prioritize: "prioritise",
  realize: "realise",
  realized: "realised",
  recognize: "recognise",
  traveling: "travelling",
};
// A token holding a slash is a URL or path; rewriting it breaks the link.
export const AU_SPELLING_PATTERN = String.raw`(?<!\S*/\S*)\b(?:${Object.keys(AU_SPELLING).join("|")})\b(?!\S*/)`;

export const auSpelling: FixFunction = (prose) =>
  prose.replaceAll(new RegExp(AU_SPELLING_PATTERN, "giu"), (word) => {
    const au = AU_SPELLING[word.toLowerCase()];
    if (
      !au ||
      (word !== word.toLowerCase() &&
        word !== `${word[0]}${word.slice(1).toLowerCase()}`)
    ) {
      return word;
    }
    return word[0] === word[0].toUpperCase()
      ? `${au[0].toUpperCase()}${au.slice(1)}`
      : au;
  });

export const FIXES: Record<string, FixFunction> = {
  auSpelling,
  ellipsis,
  multiplicationSign,
  nbspValueUnit,
  smartQuotes,
  stripUtm,
};
