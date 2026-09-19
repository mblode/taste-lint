import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { extractCapture } from "../extract/rendered.js";
import { parseCaptureInput } from "../extract/style-capture-text.js";
import { FUNCTIONS } from "../reduce/mechanical.js";
import { FIXTURES } from "./helpers.js";

it("turns a style-capture result into element units with real values", () => {
  const capture = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "capture.json"), "utf-8")
  );
  const units = extractCapture(capture, "fixture");
  expect(units.map((u) => u.text)).toEqual([
    "Notification rules",
    "Choose which sync events reach your inbox and which stay in the feed.",
    "Body copy that is set small and spaced out for no reason at all here.",
    "Submit",
  ]);
  const heading = units[0];
  expect(heading).toMatchObject({
    context: { element: "h2", role: "heading" },
    kind: "element",
    line: 2,
  });
  expect(heading.typography).toMatchObject({
    fontSizePx: 17,
    fontWeight: 600,
    letterSpacingEm: 0,
  });
  expect(heading.neighbours?.next?.typography).toMatchObject({
    fontSizePx: 15,
    fontWeight: 600,
  });
  expect(FUNCTIONS.nearEqualSizeSameWeight(heading).fired).toBe(true);
  const body = units[2];
  expect(body.typography).toMatchObject({
    fontSizePx: 13,
    letterSpacingEm: 0.05,
  });
  expect(FUNCTIONS.letterSpacedLowercaseBody(body).fired).toBe(true);
  expect(FUNCTIONS.bodyBelow15px(body).fired).toBe(true);
});

it("parses the style-capture CLI text block into elements with text and styles", () => {
  const capture = parseCaptureInput(
    fs.readFileSync(path.join(FIXTURES, "capture.txt"), "utf-8")
  );
  expect(capture.order).toHaveLength(6);
  expect(capture.metadata.url).toBe("http://127.0.0.1:8765/");
  const units = extractCapture(capture, "fixture-text");
  expect(units.map((u) => u.text)).toEqual([
    "Notification rules",
    "Choose which sync events reach your inbox and which stay in the feed.",
    "Body copy that is set small and spaced out for no reason at all here, running on for a while.",
    "Section label",
    "Submit",
  ]);
  const heading = units[0];
  expect(heading.context.element).toBe("h2");
  expect(heading.typography).toMatchObject({ fontSizePx: 17, fontWeight: 600 });
  expect(heading.neighbours?.next?.typography).toMatchObject({
    fontSizePx: 15,
    fontWeight: 600,
  });
  expect(FUNCTIONS.nearEqualSizeSameWeight(heading).fired).toBe(true);
  expect(units[3].typography?.uppercase).toBe(true);
  expect(FUNCTIONS.uppercaseWithoutTracking(units[3]).fired).toBe(true);
});
