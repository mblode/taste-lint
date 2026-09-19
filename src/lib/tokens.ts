// SIMPLIFIED: 3.5 characters per token, conservative for English prose and
// Tailwind class lists. Used only for budgeting and dry-run estimates; the
// summary line reports the provider's real usage.input_tokens after a run.
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 3.5);

export const PRICE_PER_MILLION_INPUT_USD = 0.042;

export const costUsd = (inputTokens: number): number =>
  (inputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT_USD;
