// Fetch client for POST /v1/systemone. Responses are validated fail-closed and
// never logged; errors surface as a short category plus HTTP status.

import type {
  Evaluate,
  SystemOneRequest,
  SystemOneResponse,
} from "../types.js";

export const DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const DEFAULT_MODEL = "jev-latest";

export class ProviderError extends Error {
  constructor(
    public readonly category:
      | "provider_error"
      | "invalid_response"
      | "timeout"
      | "auth",
    public readonly status?: number
  ) {
    super(
      category === "auth"
        ? "TypeSafe rejected the API key (HTTP 401). Check TYPESAFE_API_KEY."
        : `Jev request failed: ${category}${status ? ` (HTTP ${status})` : ""}`
    );
    this.name = "ProviderError";
  }
}

export const validateResponse = (
  raw: unknown,
  request: SystemOneRequest
): SystemOneResponse => {
  if (typeof raw !== "object" || raw === null) {
    throw new ProviderError("invalid_response");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.answers !== "object" || r.answers === null) {
    throw new ProviderError("invalid_response");
  }
  const answers = r.answers as Record<string, unknown>;
  const out: SystemOneResponse["answers"] = {};
  for (const id of Object.keys(request.questions)) {
    const a = answers[id];
    if (typeof a !== "object" || a === null) {
      throw new ProviderError("invalid_response");
    }
    const noul = (a as Record<string, unknown>).noul;
    if (
      typeof noul !== "number" ||
      !Number.isFinite(noul) ||
      noul < 0 ||
      noul > 1
    ) {
      throw new ProviderError("invalid_response");
    }
    out[id] = { noul, type: "noul" };
  }
  const usage = (r.usage as Record<string, unknown> | undefined) ?? {};
  const inputTokens =
    typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const outputTokens =
    typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  return {
    answers: out,
    model: typeof r.model === "string" ? r.model : request.model,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
};

export interface FetchEvaluateOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  retries?: number;
  /** Sleep hook so tests can run without waiting. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const makeFetchEvaluate = (options: FetchEvaluateOptions): Evaluate => {
  const {
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    fetch: doFetch = globalThis.fetch,
    timeoutMs = 10_000,
    retries = 3,
    sleep = defaultSleep,
  } = options;
  const url = `${baseUrl.replace(/\/$/, "")}/v1/systemone`;
  return async (request) => {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let response: Response;
      try {
        response = await doFetch(url, {
          body: JSON.stringify(request),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const isTimeout =
          (error as Error).name === "TimeoutError" ||
          (error as Error).name === "AbortError";
        if (attempt <= retries) {
          await sleep(backoff(attempt));
          continue;
        }
        throw new ProviderError(isTimeout ? "timeout" : "provider_error");
      }
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError("auth", response.status);
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt <= retries) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : backoff(attempt)
          );
          continue;
        }
        throw new ProviderError("provider_error", response.status);
      }
      if (!response.ok) {
        throw new ProviderError("provider_error", response.status);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ProviderError("invalid_response", response.status);
      }
      return validateResponse(body, request);
    }
  };
};

const backoff = (attempt: number): number =>
  Math.min(8000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100);
