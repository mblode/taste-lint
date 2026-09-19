// Rough token estimate for budgeting. Jev bills input tokens; 3.5 characters
// per token is conservative for English prose and Tailwind class lists.
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 3.5);

export const PRICE_PER_MILLION_INPUT_USD = 0.042;

export const costUsd = (inputTokens: number): number =>
  (inputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT_USD;
