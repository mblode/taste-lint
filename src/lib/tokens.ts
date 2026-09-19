// SIMPLIFIED: 3.5 characters per token. Conservative for English prose (about
// 4 per token) and optimistic for hyphen-dense class lists (nearer 2 to 3),
// which is why STATE_TOKEN_CAP and REQUEST_TOKEN_CAP leave headroom under the
// provider limits. Used only for budgeting and dry-run estimates; the summary
// line reports the provider's real usage.input_tokens after a run.
export const estimateTokens = (text: string, charsPerToken = 3.5): number =>
  Math.ceil(text.length / charsPerToken);

/** Class-list and element states are hyphen-dense and tokenise shorter. */
export const charsPerTokenFor = (kind: string): number =>
  kind === "class-list" || kind === "element" ? 3 : 3.5;

const PRICE_PER_MILLION_INPUT_USD = 0.042;

export const costUsd = (inputTokens: number): number =>
  (inputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT_USD;
