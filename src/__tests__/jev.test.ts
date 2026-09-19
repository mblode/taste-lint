import { expect, it } from "vitest";

import {
  evaluateFromEnv,
  makeFetchEvaluate,
  ProviderError,
  validateResponse,
} from "../map/jev.js";
import { Limiter } from "../map/limiter.js";
import type { SystemOneRequest } from "../types.js";

const request: SystemOneRequest = {
  model: "jev-latest",
  questions: { a: { instructions: "?", type: "noul" } },
  state: "TEXT: x",
};

it("validates responses fail-closed", () => {
  expect(
    validateResponse(
      { answers: { a: { noul: 0.4 } }, usage: { input_tokens: 5 } },
      request
    )
  ).toMatchObject({
    answers: { a: { noul: 0.4 } },
    usage: { input_tokens: 5 },
  });
  // The gateway's answer shape maps onto the same result.
  expect(
    validateResponse(
      {
        answers: { a: { probability: 0.7, type: "boolean" } },
        usage: { inputTokens: 7, outputTokens: 0 },
      },
      request
    )
  ).toMatchObject({
    answers: { a: { noul: 0.7 } },
    usage: { input_tokens: 7 },
  });
  expect(() =>
    validateResponse({ answers: { a: { noul: 1.4 } } }, request)
  ).toThrow(ProviderError);
  expect(() => validateResponse({ answers: {} }, request)).toThrow(
    /invalid_response/
  );
  expect(() => validateResponse("nope", request)).toThrow(/invalid_response/);
  for (const noul of [-0.1, Number.NaN, "0.5"]) {
    expect(() =>
      validateResponse({ answers: { a: { noul } } }, request)
    ).toThrow(/invalid_response/);
  }
});

it("retries 429 and 5xx, fails fast on 401 and sends the bearer header", async () => {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  let attempt = 0;
  const fetch = ((url: string, init: RequestInit) => {
    attempt += 1;
    seen.push({ headers: init.headers as Record<string, string>, url });
    if (attempt === 1) {
      return Promise.resolve(new Response("busy", { status: 429 }));
    }
    if (attempt === 2) {
      return Promise.resolve(new Response("down", { status: 503 }));
    }
    return Promise.resolve(
      Response.json({
        answers: { a: { noul: 0.2 } },
        model: "jev-1.13.0",
        usage: { input_tokens: 9, output_tokens: 0 },
      })
    );
  }) as unknown as typeof globalThis.fetch;
  const evaluate = makeFetchEvaluate({
    apiKey: "k",
    fetch,
    sleep: () => Promise.resolve(),
  });
  const response = await evaluate(request);
  expect(response.answers.a.noul).toBe(0.2);
  expect(seen).toHaveLength(3);
  expect(seen[0].url).toBe("https://api.typesafe.ai/v1/systemone");
  expect(seen[0].headers.Authorization).toBe("Bearer k");
  const unauthorized = makeFetchEvaluate({
    apiKey: "k",
    fetch: (() =>
      Promise.resolve(
        new Response("no", { status: 401 })
      )) as unknown as typeof globalThis.fetch,
    sleep: () => Promise.resolve(),
  });
  await expect(unauthorized(request)).rejects.toMatchObject({
    category: "auth",
  });
});

it("speaks the gateway route when told to: header model, boolean questions", async () => {
  let seen:
    | { url: string; headers: Record<string, string>; body: string }
    | undefined;
  const fetch = ((url: string, init: RequestInit) => {
    seen = {
      body: init.body as string,
      headers: init.headers as Record<string, string>,
      url,
    };
    return Promise.resolve(
      Response.json({
        answers: { a: { probability: 0.9, type: "boolean" } },
        usage: { inputTokens: 3, outputTokens: 0 },
      })
    );
  }) as unknown as typeof globalThis.fetch;
  const evaluate = makeFetchEvaluate({
    apiKey: "g",
    fetch,
    sleep: () => Promise.resolve(),
    transport: "gateway",
  });
  const response = await evaluate(request);
  expect(response.answers.a.noul).toBe(0.9);
  expect(response.usage.input_tokens).toBe(3);
  expect(seen?.url).toBe("https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
  expect(seen?.headers).toMatchObject({
    Authorization: "Bearer g",
    "ai-evaluation-model-specification-version": "4",
    "ai-gateway-protocol-version": "0.0.1",
    "ai-model-id": "typesafe-ai/jev",
  });
  expect(JSON.parse(seen?.body ?? "{}")).toEqual({
    questions: { a: { instructions: "?", type: "boolean" } },
    state: "TEXT: x",
  });
  expect(evaluateFromEnv(undefined, { AI_GATEWAY_API_KEY: "g" })).toBeTypeOf(
    "function"
  );
  expect(evaluateFromEnv(undefined, {})).toBeUndefined();
});

it("limits concurrency and rate", async () => {
  let clock = 0;
  const limiter = new Limiter(
    2,
    1,
    () => clock,
    (ms) => {
      clock += ms;
      return Promise.resolve();
    }
  );
  const releaseA = await limiter.acquire();
  let bAcquired = false;
  const pendingB = limiter.acquire().then((release) => {
    bAcquired = true;
    return release;
  });
  await Promise.resolve();
  expect(bAcquired).toBe(false);
  releaseA();
  const releaseB = await pendingB;
  expect(bAcquired).toBe(true);
  releaseB();
  // Two tokens are spent; the third acquire must wait for a refill.
  const before = clock;
  const releaseC = await limiter.acquire();
  releaseC();
  expect(clock).toBeGreaterThan(before);
});
