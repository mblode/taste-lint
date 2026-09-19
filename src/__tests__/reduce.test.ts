import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { runRequests } from "../map/batch.js";
import { AnswerCache } from "../map/cache.js";
import { ProviderError } from "../map/jev.js";
import type { JevJob } from "../map/plan.js";
import { dedupe } from "../reduce/dedupe.js";
import type { Finding, Unit } from "../types.js";
import { rule, temporary } from "./helpers.js";

const finding = (overrides: Partial<Finding>): Finding => ({
  band: "act",
  categoryId: "typographic-detail",
  column: 1,
  domain: "typography",
  endColumn: 1,
  endLine: 1,
  evidence: "",
  file: "a.md",
  fixHint: "",
  line: 1,
  message: "",
  probability: 1,
  ruleId: "r",
  severity: "minor",
  suppressed: false,
  tier: "mechanical",
  unitId: "u1",
  ...overrides,
});

it("never lets a suppressed finding hide a live one from the same category", () => {
  const out = dedupe([
    finding({ ruleId: "typography-ellipsis", suppressed: true }),
    finding({ ruleId: "typography-straight-quotes" }),
  ]);
  expect(
    out
      .map((f) => [f.ruleId, f.suppressed])
      .toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))
  ).toEqual([
    ["typography-ellipsis", true],
    ["typography-straight-quotes", false],
  ]);
  const merged = dedupe([
    finding({ probability: 0.8, ruleId: "typography-ellipsis" }),
    finding({ ruleId: "typography-straight-quotes" }),
  ]);
  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({
    also: ["typography-ellipsis"],
    ruleId: "typography-straight-quotes",
  });
});

const unit = (id: string): Unit => ({
  codeSpans: [],
  column: 1,
  context: { docType: "ui", role: "body" },
  endColumn: 1,
  endLine: 1,
  file: "x.tsx",
  id,
  inCode: false,
  kind: "jsx-text",
  line: 1,
  sourceEnd: 1,
  sourceStart: 0,
  text: `text ${id}`,
});

it("stops sending requests after the first auth failure", async () => {
  const jobs: JevJob[] = Array.from({ length: 40 }, (_, i) => ({
    rules: [{ rule: rule({ id: `copywriting-r${i}` }) }],
    unit: unit(`u${i}`),
  }));
  const { prepareRequests } = await import("../map/batch.js");
  const cache = new AnswerCache(temporary(), false);
  const prepared = prepareRequests(jobs, cache, "jev-latest");
  let calls = 0;
  await expect(
    runRequests(prepared, {
      cache,
      evaluate: () => {
        calls += 1;
        return Promise.reject(new ProviderError("auth", 401));
      },
      model: "jev-latest",
    })
  ).rejects.toMatchObject({ category: "auth" });
  // At most the concurrency bound (8) is in flight when the first 401 lands.
  expect(calls).toBeLessThanOrEqual(8);
});

it("keeps the answer when only the cache write fails", async () => {
  const jobs: JevJob[] = [
    { rules: [{ rule: rule({ id: "copywriting-r" }) }], unit: unit("u1") },
  ];
  const { prepareRequests } = await import("../map/batch.js");
  // A regular file where the cache directory should be: every write fails.
  const blocker = path.join(temporary(), "cache-is-a-file");
  fs.writeFileSync(blocker, "");
  const cache = new AnswerCache(blocker, true);
  const prepared = prepareRequests(jobs, cache, "jev-latest");
  const outcome = await runRequests(prepared, {
    cache,
    evaluate: (request) =>
      Promise.resolve({
        answers: Object.fromEntries(
          Object.keys(request.questions).map((k) => [k, { noul: 0.9 }])
        ),
        model: "jev-latest",
        usage: { input_tokens: 1, output_tokens: 0 },
      }),
    model: "jev-latest",
  });
  expect(outcome.errors).toBe(0);
  expect(outcome.answers.get("u1")).toEqual({ "copywriting-r": 0.9 });
});
