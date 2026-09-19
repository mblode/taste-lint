import { expect, it } from "vitest";

import { resolveTypography } from "../extract/tailwind.js";
import type { Unit } from "../types.js";
import { check } from "./helpers.js";

it("resolves the default scale, arbitrary values and shorthand leading", () => {
  expect(resolveTypography(["text-sm"])).toMatchObject({
    fontSizePx: 14,
    lineHeight: 1.429,
  });
  expect(resolveTypography(["text-[17px]", "font-semibold"])).toMatchObject({
    fontSizePx: 17,
    fontWeight: 600,
  });
  expect(resolveTypography(["text-[1.125rem]"])).toMatchObject({
    fontSizePx: 18,
  });
  expect(resolveTypography(["text-[15px]/[22px]"])).toMatchObject({
    fontSizePx: 15,
    lineHeight: 1.467,
    lineHeightPx: 22,
  });
  expect(resolveTypography(["text-sm/6"])).toMatchObject({
    fontSizePx: 14,
    lineHeightPx: 24,
  });
  expect(
    resolveTypography(["leading-[1.2]", "tracking-[0.16em]", "uppercase"])
  ).toMatchObject({ letterSpacingEm: 0.16, lineHeight: 1.2, uppercase: true });
});

it("lets a later size class replace an earlier size's default line height", () => {
  expect(resolveTypography(["text-sm", "text-lg"])).toMatchObject({
    fontSizePx: 18,
    lineHeight: 1.556,
    lineHeightPx: 28,
  });
  expect(resolveTypography(["leading-tight", "text-lg"])).toMatchObject({
    fontSizePx: 18,
    lineHeight: 1.25,
  });
});

it("separates colours from sizes, strips variants and lists unknown tokens", () => {
  const t = resolveTypography([
    "text-muted-foreground",
    "text-[#333]",
    "md:text-lg",
    "hover:underline",
    "text-body",
    "font-heading",
  ]);
  expect(t.colourClasses).toEqual(["text-muted-foreground", "text-[#333]"]);
  expect(t.fontSizePx).toBeUndefined();
  expect(t.unresolved).toEqual(["text-body", "font-heading"]);
  expect(
    resolveTypography(["text-body"], {
      components: { skip: [], unwrap: [] },
      docTypes: [],
      exclude: [],
      root: "/",
      smartQuotesAtBuild: false,
      tailwind: { theme: { body: "17px" } },
    })
  ).toMatchObject({ fontSizePx: 17 });
});

const unit = (classes: string[], next?: string[], text = "Heading"): Unit => ({
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
  neighbours: next
    ? { next: { text: "Body", typography: resolveTypography(next) } }
    : undefined,
  sourceEnd: 1,
  sourceStart: 0,
  text,
  typography: resolveTypography(classes),
});

it("fires nearEqualSizeSameWeight only for a small step at equal weight", () => {
  expect(
    check("typography-hierarchy-size-only")(
      unit(["text-[17px]", "font-semibold"], ["text-[15px]", "font-semibold"])
    ).fired
  ).toBe(true);
  expect(
    check("typography-hierarchy-size-only")(
      unit(["text-[26px]", "font-semibold"], ["text-[15px]", "font-semibold"])
    ).fired
  ).toBe(false);
  expect(
    check("typography-hierarchy-size-only")(
      unit(["text-[17px]", "font-semibold"], ["text-[15px]"])
    ).fired
  ).toBe(false);
  expect(
    check("typography-hierarchy-size-only")(unit(["text-[17px]"])).fired
  ).toBe(false);
  expect(() =>
    check("typography-hierarchy-size-only")(
      unit(["text-body", "font-semibold"], ["text-[15px]"])
    )
  ).toThrow(/unresolved/);
  expect(
    check("typography-hierarchy-size-only")(
      unit(["font-semibold"], ["text-[15px]"])
    ).fired
  ).toBe(false);
});
