// Class-list checks for motion and design-system hygiene, and whole-file
// source rules, each on the input the rule names.
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { resolveTypography } from "../extract/tailwind.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import { runScan } from "../scan/run.js";
import type { Unit } from "../types.js";
import { config, copyFixtures, FIXTURES, temporary, check } from "./helpers.js";

it("compares complete pixel utilities with an explicitly declared font scale", () => {
  const defaultScale = { body: "16px" };
  const inspect = (
    cls: string,
    fontScale: Record<string, string> = defaultScale
  ) =>
    check("craft-near-duplicate-scale")(
      unit([cls], { context: { docType: "ui", fontScale, role: "body" } })
    );
  expect(inspect("text-[16px]")).toMatchObject({
    evidence: expect.stringContaining("text-body (16px)"),
    fired: true,
  });
  expect(inspect("md:text-[15px]")).toMatchObject({
    evidence: expect.stringContaining("1px"),
    fired: true,
  });
  expect(inspect("text-[13px]").fired).toBe(false);
  expect(inspect("text-[15px]", { body: "20px" }).fired).toBe(false);
  for (const cls of [
    "max-w-[900px]",
    "max-w-[65ch]",
    "text-[1rem]",
    "text-[var(--size)]",
    "text-[calc(1rem+1px)]",
    "translate-x-[1px]",
    "[&>svg]:size-4",
  ]) {
    expect(inspect(cls).fired).toBe(false);
  }
  for (const cls of ["text-[15px]", "p-[13px]", "rounded-[7px]", "w-[187px]"]) {
    expect(() => inspect(cls, {})).toThrow(/scale|theme|family/);
  }
  expect(() => inspect("text-[15px]", { body: "var(--font-size)" })).toThrow(
    /unresolved/
  );
});

it("keeps proven font matches beside unsupported families without guessing dynamic overrides", () => {
  const mixed = unit(["text-[15px]", "p-[13px]"], {
    context: { docType: "ui", fontScale: { body: "16px" }, role: "body" },
  });
  expect(check("craft-near-duplicate-scale")(mixed)).toMatchObject({
    evidence: "text-[15px] is 1px from text-body (16px)",
    fired: true,
  });
  expect(() =>
    check("craft-near-duplicate-scale")({
      ...mixed,
      context: { ...mixed.context, dynamic: true },
    })
  ).toThrow(/Dynamic classes/);
});

it("uses parsed JSX classes, ignores comments, and carries declared scale values", () => {
  const source =
    '// <p className="text-[15px]" />\nconst example = \'text-[15px]\';\nexport const X = () => <p className="text-[15px]">Body</p>;';
  const units = extractTsx("x.tsx", source, {
    config: config("/", { tailwind: { theme: { body: "16px" } } }),
    docType: "ui",
  });
  const classes = units.filter((u) => u.kind === "class-list");
  expect(classes).toHaveLength(1);
  expect(classes[0].context.fontScale).toEqual({ body: "16px" });
  expect(check("craft-near-duplicate-scale")(classes[0]).fired).toBe(true);
});

it("keeps missing scale evidence unknown and rejects baselines after theme changes", async () => {
  const root = temporary();
  folders.push(root);
  fs.writeFileSync(
    path.join(root, "app.tsx"),
    'export const X = () => <p className="text-[15px]">Body</p>;'
  );
  const options = {
    only: ["craft-near-duplicate-scale"],
    resultsDir: path.join(root, "results"),
    root,
    targets: ["app.tsx"],
  };
  const missing = await runScan(options);
  expect(missing.report.findings).toEqual([]);
  expect(missing.report.unknowns).toMatchObject([
    { reason: expect.stringContaining("no explicitly declared font scale") },
  ]);
  const configFile = path.join(root, "taste-lint.config.json");
  fs.writeFileSync(
    configFile,
    JSON.stringify({ tailwind: { theme: { body: "16px" } } })
  );
  const known = await runScan(options);
  expect(known.report.unknowns).toEqual([]);
  expect(known.report.findings).toMatchObject([
    {
      band: "review",
      evidence: expect.stringContaining("text-body (16px)"),
      line: 1,
      ruleId: "craft-near-duplicate-scale",
    },
  ]);
  const baseline = path.join(root, "baseline.json");
  fs.writeFileSync(baseline, JSON.stringify(known.report));
  const warm = await runScan({ ...options, baseline });
  expect(warm.report.usage.requests).toBe(0);
  expect(warm.report.findings[0].lifecycle).toBe("existing");
  fs.writeFileSync(
    configFile,
    JSON.stringify({ tailwind: { theme: { body: "20px" } } })
  );
  await expect(runScan({ ...options, baseline })).rejects.toMatchObject({
    code: "INCOMPATIBLE_BASELINE",
  });
  const changed = await runScan(options);
  expect(changed.report.findings).toEqual([]);
});

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
    check("motion-ease-in-on-transition")(unit(["transition", "ease-in"])).fired
  ).toBe(true);
  expect(
    check("motion-ease-in-on-transition")(unit(["transition", "ease-in-out"]))
      .fired
  ).toBe(false);
  expect(
    check("motion-ease-in-on-transition")(
      unit(["hover:ease-in", "duration-200"])
    ).fired
  ).toBe(true);
  expect(
    check("motion-linear-easing-on-transition")(
      unit(["transition", "ease-linear"])
    ).fired
  ).toBe(true);
  expect(
    check("motion-linear-easing-on-transition")(
      unit(["animate-spin", "ease-linear"])
    ).fired
  ).toBe(false);
  expect(
    check("motion-duration-over-300ms")(unit(["transition", "duration-500"]))
      .fired
  ).toBe(true);
  expect(
    check("motion-duration-over-300ms")(unit(["transition", "duration-[0.4s]"]))
      .fired
  ).toBe(true);
  expect(
    check("motion-duration-over-300ms")(unit(["transition", "duration-200"]))
      .fired
  ).toBe(false);
  expect(
    check("motion-duration-over-300ms")(unit(["duration-500"])).fired
  ).toBe(false);
  expect(check("motion-transition-all")(unit(["transition-all"])).fired).toBe(
    true
  );
  expect(
    check("motion-scale-from-zero")(unit(["transition", "scale-0"])).fired
  ).toBe(true);
  expect(check("motion-scale-from-zero")(unit(["scale-0"])).fired).toBe(false);
  expect(
    check("motion-animate-without-reduced-motion")(unit(["animate-bounce"]))
      .fired
  ).toBe(true);
  expect(
    check("motion-animate-without-reduced-motion")(
      unit(["motion-safe:animate-bounce"])
    ).fired
  ).toBe(false);
});

it("flags raw palette colours, arbitrary values and interpolated class strings", () => {
  expect(
    check("craft-raw-colour-class")(
      unit(["bg-pink-500", "text-muted-foreground"])
    )
  ).toMatchObject({ evidence: "bg-pink-500", fired: true });
  expect(
    check("craft-raw-colour-class")(unit(["bg-primary", "dark:text-white"]))
      .fired
  ).toBe(false);
  expect(
    check("craft-arbitrary-value-class")(unit(["p-[13px]", "[&>svg]:size-4"]))
  ).toMatchObject({
    evidence: "p-[13px]",
    fired: true,
  });
  expect(
    check("craft-interpolated-class-string")(
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
  expect(
    check("typography-uppercase-without-tracking")(unit(["uppercase"])).fired
  ).toBe(false);
  expect(
    check("typography-uppercase-without-tracking")(
      unit(["uppercase"], { text: "Label" })
    ).fired
  ).toBe(true);
});

it("runs whole-file source rules and points the finding at the first match", async () => {
  const root = temporary();
  folders.push(root);
  copyFixtures(root, ["card.tsx"]);
  const result = await runLint(
    {
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
