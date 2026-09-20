// Fetch client for Jev. Two transports speak the same request: TypeSafe's own
// POST /v1/systemone, and Vercel AI Gateway's evaluation route (the wire
// call the AI SDK's experimental_evaluate makes; it is an SDK contract, not a
// documented API, so it is pinned here in one place). Responses are validated
// fail-closed and never logged; errors surface as a short category plus HTTP
// status.

import type {
  Evaluate,
  SystemOneRequest,
  SystemOneResponse,
} from "../types.js";

export type Transport = "typesafe" | "gateway";
export const DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v4/ai";
export const DEFAULT_MODEL = "jev-latest";
/** The gateway's id for Jev; a `--model` with a slash in it is passed through. */
export const GATEWAY_MODEL = "typesafe-ai/jev";
export const KEY_HINT =
  "Set AI_GATEWAY_API_KEY to your Vercel AI Gateway key, then rerun. Create a key at https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys.";
const MAX_RETRY_AFTER_MS = 30_000;

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
        ? `The provider rejected the API key (HTTP ${status ?? 401}). Check AI_GATEWAY_API_KEY (or TYPESAFE_API_KEY when using the direct transport).`
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
    // TypeSafe answers `noul`; the gateway answers `probability`.
    const answer = a as Record<string, unknown>;
    if (
      answer.type !== undefined &&
      answer.type !== "noul" &&
      answer.type !== "boolean"
    ) {
      throw new ProviderError("invalid_response");
    }
    const noul = answer.noul ?? answer.probability;
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
  const count = (snake: string, camel: string): number => {
    const v = usage[snake] ?? usage[camel];
    if (v === undefined) {
      return 0;
    }
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
      throw new ProviderError("invalid_response");
    }
    return v;
  };
  const inputTokens = count("input_tokens", "inputTokens");
  const outputTokens = count("output_tokens", "outputTokens");
  return {
    answers: out,
    model: typeof r.model === "string" ? r.model : request.model,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
};

export interface FetchEvaluateOptions {
  apiKey: string;
  transport?: Transport;
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

// An explicit API option retains its direct-TypeSafe contract. Otherwise prefer
// the user's Gateway key; the legacy TypeSafe environment key remains a fallback.
export const evaluateFromEnv = (
  apiKey?: string,
  env: NodeJS.ProcessEnv = process.env
): Evaluate | undefined => {
  if (apiKey) {
    return makeFetchEvaluate({ apiKey });
  }
  if (env.AI_GATEWAY_API_KEY) {
    return makeFetchEvaluate({
      apiKey: env.AI_GATEWAY_API_KEY,
      transport: "gateway",
    });
  }
  return env.TYPESAFE_API_KEY
    ? makeFetchEvaluate({ apiKey: env.TYPESAFE_API_KEY })
    : undefined;
};

// The gateway takes the model in a header and calls the noul primitive
// `boolean`; everything else in the request is the same.
const gatewayCall = (
  request: SystemOneRequest
): { body: string; headers: Record<string, string> } => ({
  body: JSON.stringify({
    questions: Object.fromEntries(
      Object.entries(request.questions).map(([id, q]) => [
        id,
        { ...q, type: "boolean" },
      ])
    ),
    state: request.state,
  }),
  headers: {
    "ai-evaluation-model-specification-version": "4",
    "ai-gateway-protocol-version": "0.0.1",
    "ai-model-id": request.model.includes("/") ? request.model : GATEWAY_MODEL,
  },
});

export const makeFetchEvaluate = (options: FetchEvaluateOptions): Evaluate => {
  const {
    apiKey,
    transport = "typesafe",
    baseUrl = transport === "gateway" ? GATEWAY_BASE_URL : DEFAULT_BASE_URL,
    fetch: doFetch = globalThis.fetch,
    timeoutMs = 10_000,
    retries = 3,
    sleep = defaultSleep,
  } = options;
  const url = `${baseUrl.replace(/\/$/, "")}${transport === "gateway" ? "/evaluation-model" : "/v1/systemone"}`;
  return async (request, onAttempt) => {
    const call =
      transport === "gateway"
        ? gatewayCall(request)
        : { body: JSON.stringify(request), headers: {} };
    let attempt = 0;
    for (;;) {
      attempt += 1;
      onAttempt?.();
      let response: Response;
      try {
        response = await doFetch(url, {
          body: call.body,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...call.headers,
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
          // Honour Retry-After up to a ceiling so one header cannot park a run.
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS)
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
      return { ...validateResponse(body, request), attempts: attempt };
    }
  };
};

const backoff = (attempt: number): number =>
  Math.min(8000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100);
