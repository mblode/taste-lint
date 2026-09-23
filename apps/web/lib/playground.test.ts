import assert from "node:assert/strict";
import { test } from "node:test";

import { runMechanical } from "../../../src/reduce/mechanical.js";
import type { Unit } from "../../../src/types.js";
import {
  BEFORE_AFTER,
  PLAYGROUND_SAMPLES,
} from "../fixtures/playground-samples.js";
import { lintCopy, PLAYGROUND_RULES, splitMatches } from "./playground.js";

const unit = (text: string) => ({ codeSpans: [], text }) as unknown as Unit;

test("the browser port agrees with the CLI matcher on every sample line", () => {
  const lines = PLAYGROUND_SAMPLES.flatMap((sample) => sample.text.split("\n"));
  for (const line of lines) {
    for (const rule of PLAYGROUND_RULES) {
      const cli = runMechanical(rule.mechanical, unit(line));
      const [web] = lintCopy(line, [rule]);
      assert.equal(Boolean(web), cli.fired, `${rule.id} on ${line}`);
      if (web) {
        assert.equal(web.evidence, cli.evidence);
      }
    }
  }
});

test("each bad sample trips at least one rule and the clean one none", () => {
  for (const sample of PLAYGROUND_SAMPLES) {
    const count = lintCopy(sample.text).length;
    if (sample.id === "clean") {
      assert.equal(count, 0);
    } else {
      assert.ok(count > 0, sample.id);
    }
  }
  assert.ok(lintCopy(BEFORE_AFTER.before).length > 0);
  assert.equal(lintCopy(BEFORE_AFTER.after).length, 0);
});

test("splitMatches marks only the matched ranges", () => {
  assert.deepEqual(splitMatches("abcdef", [{ end: 4, start: 2 }]), [
    { marked: false, text: "ab" },
    { marked: true, text: "cd" },
    { marked: false, text: "ef" },
  ]);
});
