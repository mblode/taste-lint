import { expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { check, config } from "./helpers.js";

const unit = (file: string, text: string) =>
  extractSource(
    config(process.cwd()),
    file,
    text,
    new Repository(process.cwd())
  ).find((u) => u.kind === "source")!;

it("keeps speculative source patterns out of default scans", () => {
  const rules = loadRules(resolveRulesDir());
  expect(
    rules.some((r) =>
      ["craft-affordance-mismatch", "craft-virtualize-large-lists"].includes(
        r.id
      )
    )
  ).toBe(false);
});

it("checks actual motion guards and explicit reduced-motion animations", () => {
  const u = unit("page.tsx", "export const x = 1");
  const guarded = check("motion-animate-without-reduced-motion");
  expect(guarded({ ...u, classes: ["motion-safe:animate-spin"] }).fired).toBe(
    false
  );
  expect(
    guarded({ ...u, classes: ["animate-spin", "motion-reduce:bg-red-500"] })
      .fired
  ).toBe(true);
  expect(
    guarded({ ...u, classes: ["animate-spin", "motion-safe:animate-pulse"] })
      .fired
  ).toBe(true);
  expect(
    check("motion-reduced-motion-animation")({
      ...u,
      classes: ["motion-reduce:animate-spin"],
    }).fired
  ).toBe(true);
  expect(
    check("motion-reduced-motion-animation")({
      ...u,
      classes: ["motion-reduce:animate-none"],
    }).fired
  ).toBe(false);
  expect(
    check("motion-layout-property-transition")({
      ...u,
      classes: ["hover:transition-[width,opacity]"],
    }).fired
  ).toBe(true);
});

it("does not send embedded product names in ordinary sentences to the title-case judge", () => {
  const rule = loadRules(resolveRulesDir(), {
    only: ["typography-title-case-heading"],
  })[0];
  const u = unit("page.tsx", "");
  for (const text of [
    "What the Done Bear CLI does",
    "Copy the Things folder path",
    "Interpret with AI",
  ]) {
    expect(runMechanical(rule.mechanical!, { ...u, text }).fired).toBe(false);
  }
  expect(
    runMechanical(rule.mechanical!, { ...u, text: "Copy Task Number" }).fired
  ).toBe(true);
});

it("checks actual images rather than tags inside comments and strings", () => {
  const image = check("interaction-a11y-image-alt-text");
  expect(
    image(
      unit(
        "image.tsx",
        '/* <img> */ const example = "<img>"; const view = <img alt="" width={100} height={100} />;'
      )
    ).fired
  ).toBe(false);
  expect(
    image(unit("image.tsx", "const view = <img src='photo.jpg' />;")).fired
  ).toBe(true);
  expect(() =>
    image(unit("image.tsx", "const view = <img {...props} />;"))
  ).toThrow(UnresolvedError);
  expect(
    check("craft-image-dimensions-and-priority")(
      unit(
        "image.tsx",
        "/* <img> */ const view = <img width={1200} height={630} />;"
      )
    ).fired
  ).toBe(false);
});
