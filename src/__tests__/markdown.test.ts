import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { extractMarkdown } from "../extract/markdown.js";
import { config, FIXTURES } from "./helpers.js";

const load = (name: string) => {
  const source = fs.readFileSync(path.join(FIXTURES, name), "utf-8");
  return extractMarkdown(name, source, {
    config: config(FIXTURES),
    docType: "lesson",
  });
};

it("extracts headings, paragraphs, list items, cells and attribute strings with positions", () => {
  const units = load("lesson.mdx");
  const kinds = units.map((u) => u.kind);
  expect(kinds).toContain("heading");
  expect(kinds).toContain("paragraph");
  expect(kinds).toContain("attr-string");
  const heading = units.find((u) => u.kind === "heading");
  expect(heading).toMatchObject({ line: 6, text: "Make text feel right" });
  const first = units.find((u) => u.text.startsWith('A "powerful"'));
  expect(first).toMatchObject({
    context: {
      docType: "lesson",
      headingAbove: "Make text feel right",
      role: "body",
    },
    line: 8,
  });
  const callout = units.find((u) => u.text.startsWith("Fix in order"));
  expect(callout?.context.component).toBeUndefined();
  const listItems = units.filter((u) => u.context.role === "list-item");
  expect(listItems).toHaveLength(2);
  const cells = units.filter((u) => u.context.role === "cell");
  expect(cells.map((c) => c.text)).toEqual(["Name", "Size", "Body", "18px"]);
  const caption = units.find((u) => u.kind === "attr-string");
  expect(caption).toMatchObject({
    context: { attr: "caption", component: "Figure" },
    text: "A caption with 'straight' quotes",
  });
});

it("never renders fenced code, skips configured components and masks inline code", () => {
  const units = load("lesson.mdx");
  expect(units.some((u) => u.text.includes("font-size"))).toBe(false);
  expect(units.some((u) => u.text.includes("judgements["))).toBe(false);
  const measure = units.find((u) => u.text.startsWith("Body reads well"));
  expect(measure?.codeSpans).toHaveLength(1);
  const [span] = measure?.codeSpans ?? [[0, 0]];
  expect(measure?.text.slice(span[0], span[1])).toBe('"straight"');
  const expression = units.find((u) => u.text.startsWith("Text with an"));
  expect(expression?.text).toBe("Text with an inside it.");
});

it("keeps code span offsets in UTF-16 units past an astral character", () => {
  const units = extractMarkdown(
    "x.md",
    'Smile \u{1F600} then use `"straight"` quotes here.\n',
    { config: config(FIXTURES), docType: "lesson" }
  );
  const [span] = units[0].codeSpans;
  expect(units[0].text.slice(span[0], span[1])).toBe('"straight"');
});

it("extracts attribute strings from inline MDX elements inside a paragraph", () => {
  const units = extractMarkdown(
    "x.mdx",
    "Inline <Kbd label=\"Press 'Ctrl'\" /> element with an attribute.\n",
    { config: config(FIXTURES), docType: "lesson" }
  );
  expect(units.map((u) => u.kind)).toEqual(["attr-string", "paragraph"]);
  expect(units[0].text).toBe("Press 'Ctrl'");
});

it("keeps offsets aligned when the file starts with a BOM", () => {
  const source = '\uFEFFA "bom" line here.\n';
  const [unit] = extractMarkdown("x.md", source, {
    config: config(FIXTURES),
    docType: "lesson",
  });
  expect(source.slice(unit.sourceStart, unit.sourceEnd)).toBe(
    'A "bom" line here.'
  );
});

it("falls back to plain markdown when MDX does not parse", () => {
  const units = load("broken.mdx");
  expect(units.some((u) => u.kind === "file")).toBe(false);
  const paragraph = units.find((u) => u.text === "This paragraph is fine.");
  expect(paragraph?.context.mdxFallback).toBe(true);
});
