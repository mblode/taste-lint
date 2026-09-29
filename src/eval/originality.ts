// Guard against a rule rewrite that quotes or names one corpus item instead
// of stating general policy (docs/eval.mdx, "overfitting / leakage guards").
// A rewrite from dev disagreements must generalise past the row that
// triggered it; a shared run of words with a corpus text is the mechanical
// smell of a patch for one case instead of a policy for the rule.

import type { CorpusItem, Question } from "../types.js";

const NGRAM = 6;

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const ngrams = (tokens: string[], n: number): Set<string> => {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i += 1) {
    out.add(tokens.slice(i, i + n).join(" "));
  }
  return out;
};

export interface OriginalityHit {
  ngram: string;
  itemId: string;
}

/** Every string a question exposes to a rewrite: instructions and examples. */
export const questionStrings = (question: Question): string[] => {
  const out: string[] = [question.instructions];
  for (const side of [question.criteria?.true, question.criteria?.false]) {
    if (!side) {
      continue;
    }
    out.push(side.what, ...(side.examples ?? []));
  }
  return out;
};

// Cheap, deterministic, no model call: flag any shared 6-gram between the
// candidate text and a corpus item's text. A real quote or close paraphrase
// shares a run this long; a coincidental overlap this long is very unlikely
// in ordinary prose.
export const checkGeneralPolicy = (
  candidateTexts: string[],
  corpusItems: Pick<CorpusItem, "id" | "text">[],
  n = NGRAM
): OriginalityHit[] => {
  const candidateGrams = new Set(
    candidateTexts.flatMap((text) => [...ngrams(words(text), n)])
  );
  if (candidateGrams.size === 0) {
    return [];
  }
  const hits: OriginalityHit[] = [];
  for (const item of corpusItems) {
    for (const gram of ngrams(words(item.text), n)) {
      if (candidateGrams.has(gram)) {
        hits.push({ itemId: item.id, ngram: gram });
      }
    }
  }
  return hits;
};

export const renderOriginalityHits = (hits: OriginalityHit[]): string =>
  hits.length === 0
    ? ""
    : `${[
        "General-policy guard failed: the candidate text shares wording with corpus items instead of stating policy generally.",
        ...hits
          .slice(0, 10)
          .map((h) => `  "${h.ngram}" also appears in corpus item ${h.itemId}`),
        hits.length > 10 ? `  ...and ${hits.length - 10} more` : "",
      ]
        .filter(Boolean)
        .join("\n")}\n`;
