// Class-list checks for motion and design-system hygiene, and whole-file
// source rules, each on the input the rule names.
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { resolveTypography } from "../extract/tailwind.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import { FUNCTIONS } from "../reduce/mechanical.js";
import type { Unit } from "../types.js";
import { config, copyFixtures, FIXTURES, temporary } from "./helpers.js";

const folders: string[] = [];
afterEach(() => {
  for (const root of folders.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

const unit = (classes: string[], extra: Partial<Unit> = {}): Unit => ({
  classes,
  codeSpans: [],
  column: 1,
  context: { docType: "ui", role: "body" },
  endColumn: 1,
  endLine: 1,
  file: "x.tsx",
  id: "u",
  inCode: false,
  kind: "class-list",
  line: 1,
  sourceEnd: 1,
  sourceStart: 0,
  text: "",
  typography: resolveTypography(classes),
  ...extra,
});

it("judges motion utilities on the element's own classes, variants stripped", () => {
  expect(
    FUNCTIONS.easeInOnTransition(unit(["transition", "ease-in"])).fired
  ).toBe(true);
  expect(
    FUNCTIONS.easeInOnTransition(unit(["transition", "ease-in-out"])).fired
  ).toBe(false);
  expect(
    FUNCTIONS.easeInOnTransition(unit(["hover:ease-in", "duration-200"])).fired
  ).toBe(true);
  expect(
    FUNCTIONS.linearEasingOnTransition(unit(["transition", "ease-linear"]))
      .fired
  ).toBe(true);
  expect(
    FUNCTIONS.linearEasingOnTransition(unit(["animate-spin", "ease-linear"]))
      .fired
  ).toBe(false);
  expect(
    FUNCTIONS.durationOver300(unit(["transition", "duration-500"])).fired
  ).toBe(true);
  expect(
    FUNCTIONS.durationOver300(unit(["transition", "duration-[0.4s]"])).fired
  ).toBe(true);
  expect(
    FUNCTIONS.durationOver300(unit(["transition", "duration-200"])).fired
  ).toBe(false);
  expect(FUNCTIONS.durationOver300(unit(["duration-500"])).fired).toBe(false);
  expect(FUNCTIONS.transitionAll(unit(["transition-all"])).fired).toBe(true);
  expect(FUNCTIONS.scaleFromZero(unit(["transition", "scale-0"])).fired).toBe(
    true
  );
  expect(FUNCTIONS.scaleFromZero(unit(["scale-0"])).fired).toBe(false);
  expect(
    FUNCTIONS.animateWithoutMotionPreference(unit(["animate-bounce"])).fired
  ).toBe(true);
  expect(
    FUNCTIONS.animateWithoutMotionPreference(
      unit(["motion-safe:animate-bounce"])
    ).fired
  ).toBe(false);
});

it("flags raw palette colours, arbitrary values and interpolated class strings", () => {
  expect(
    FUNCTIONS.rawColourClass(unit(["bg-pink-500", "text-muted-foreground"]))
  ).toMatchObject({ evidence: "bg-pink-500", fired: true });
  expect(
    FUNCTIONS.rawColourClass(unit(["bg-primary", "dark:text-white"])).fired
  ).toBe(false);
  expect(
    FUNCTIONS.arbitraryValueClass(unit(["p-[13px]", "[&>svg]:size-4"]))
  ).toMatchObject({
    evidence: "p-[13px]",
    fired: true,
  });
  expect(
    FUNCTIONS.interpolatedClassString(
      unit([], { context: { docType: "ui", interpolated: true, role: "body" } })
    ).fired
  ).toBe(true);
  const units = extractTsx(
    "x.tsx",
    [
      "export const X = ({ c }: { c: string }) => <div className={`bg-$",
      "{c}-500 p-2`} />;\n",
    ].join(""),
    { config: config("/"), docType: "ui" }
  );
  const list = units.find((u) => u.kind === "class-list");
  expect(list?.context.interpolated).toBe(true);
  expect(list?.classes).toEqual(["p-2"]);
});

it("typography functions decline a class-list unit with no text of its own", () => {
  expect(FUNCTIONS.uppercaseWithoutTracking(unit(["uppercase"])).fired).toBe(
    false
  );
  expect(
    FUNCTIONS.uppercaseWithoutTracking(unit(["uppercase"], { text: "Label" }))
      .fired
  ).toBe(true);
});

it("runs whole-file source rules and points the finding at the first match", async () => {
  const root = temporary();
  folders.push(root);
  copyFixtures(root, ["card.tsx"]);
  const result = await runLint(
    {
      mechanicalOnly: true,
      only: ["interaction-labels-and-autocomplete"],
      resultsDir: path.join(root, "results"),
      root,
      rulesDir: path.resolve(FIXTURES, "../../../data/rules"),
      targets: ["."],
    },
    { stderr() {}, stdout() {} }
  );
  const [finding] = result.findings;
  // The unlabelled <input placeholder=...> sits on line 28 of card.tsx.
  expect(finding).toMatchObject({
    band: "review",
    file: "card.tsx",
    line: 28,
    ruleId: "interaction-labels-and-autocomplete",
  });
  expect(result.units).toBeGreaterThan(0);
});
