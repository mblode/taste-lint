// Repetition is relational: a sentence can only repeat what came before it.
// For each prose unit, collect the earlier sentences in the same file that
// share content words with it, so Jev compares against that evidence and a
// first mention never reaches the judge. Headings are left out on both sides:
// a body restating its own heading is elaboration, not repetition.

import type { Role, Unit } from "../types.js";

const NOT_PROSE = new Set<Role>([
  "heading",
  "button",
  "link",
  "label",
  "placeholder",
  "aria",
]);

const STOP = new Set(
  "about above after again also always another because been before being below between both came come could does doing done down each even every from have having here into just like made make many more most much must never only other over same should since some such than that their them then there these they this those through very want were what when where which while will with would your yours you're we're it's that's there's isn't don't can't won't".split(
    " "
  )
);

// Sentences and the content words that make them comparable.
const SENTENCE = /[^.!?\n]+[.!?]*/gu;
const WORD = /[\p{L}\p{N}$][\p{L}\p{N}$'’.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;
const MIN_SHARED = 3;
const MAX_EVIDENCE = 8;

const tokens = (sentence: string): Set<string> => {
  const out = new Set<string>();
  for (const [raw] of sentence.toLowerCase().matchAll(WORD)) {
    const word = raw.replaceAll("’", "'");
    if (/\d/u.test(word)) {
      out.add(word);
    } else if (word.length >= 4 && !STOP.has(word)) {
      out.add(word.length > 4 ? word.replace(/(?:'s|s)$/u, "") : word);
    }
  }
  return out;
};

const isProse = (unit: Unit): boolean =>
  (unit.kind === "paragraph" || unit.kind === "jsx-text") &&
  !unit.inCode &&
  !NOT_PROSE.has(unit.context.role);

export const attachEarlier = (units: Unit[]): void => {
  const prose = units
    .filter(isProse)
    .toSorted((a, b) => a.sourceStart - b.sourceStart);
  const split = prose.map((unit) =>
    [...unit.text.matchAll(SENTENCE)]
      .map(([s]) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text, words: tokens(text) }))
  );
  // A word in a third of the units is the subject of the page, not an idea.
  const spread = new Map<string, number>();
  for (const sentences of split) {
    for (const word of new Set(sentences.flatMap((s) => [...s.words]))) {
      spread.set(word, (spread.get(word) ?? 0) + 1);
    }
  }
  const subject = (word: string): boolean =>
    prose.length >= 6 && (spread.get(word) ?? 0) * 3 > prose.length;

  const seen: string[] = [];
  const index = new Map<string, number[]>();
  for (const [u, unit] of prose.entries()) {
    const matched = new Map<number, number>();
    for (const sentence of split[u] ?? []) {
      const words = [...sentence.words].filter((w) => !subject(w));
      const shared = new Map<number, number>();
      for (const word of words) {
        for (const id of index.get(word) ?? []) {
          shared.set(id, (shared.get(id) ?? 0) + 1);
        }
      }
      for (const [id, n] of shared) {
        if (n >= MIN_SHARED || (n >= 2 && n * 2 >= words.length)) {
          matched.set(id, Math.max(matched.get(id) ?? 0, n));
        }
      }
      const id = seen.push(sentence.text) - 1;
      for (const word of words) {
        index.set(word, [...(index.get(word) ?? []), id]);
      }
    }
    if (matched.size > 0) {
      unit.context.earlier = [...matched]
        .toSorted((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, MAX_EVIDENCE)
        .toSorted((a, b) => a[0] - b[0])
        .map(([id]) => seen[id])
        .join("\n");
    }
  }
};
