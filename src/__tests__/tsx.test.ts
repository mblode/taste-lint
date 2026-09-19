import fs from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { extractTsx } from "../extract/tsx.js";
import { config, FIXTURES } from "./helpers.js";

const units = () => {
  const source = fs.readFileSync(path.join(FIXTURES, "card.tsx"), "utf-8");
  return extractTsx("card.tsx", source, {
    config: config(FIXTURES),
    docType: "ui",
  });
};

it("extracts jsx text with roles, elements and exact lines", () => {
  const all = units();
  const button = all.find((u) => u.kind === "jsx-text" && u.text === "Submit");
  // The unit starts at the word, not the newline after the opening tag.
  expect(button).toMatchObject({
    column: 9,
    context: { element: "button", role: "button" },
    line: 26,
  });
  const quoted = all.find((u) => u.text.startsWith("It's a"));
  expect(quoted?.text).toBe('It\'s a "quoted" line with an expression string.');
});

it("extracts attribute strings and copy maps but skips console, throw and t()", () => {
  const all = units();
  const aria = all.find(
    (u) => u.kind === "attr-string" && u.context.attr === "aria-label"
  );
  expect(aria).toMatchObject({
    context: { role: "aria" },
    text: "Delete invoice",
  });
  const placeholder = all.find((u) => u.context.attr === "placeholder");
  expect(placeholder).toMatchObject({
    context: { role: "placeholder" },
    text: "Enter your email",
  });
  expect(
    all.filter((u) => u.context.role === "literal-copy").map((u) => u.text)
  ).toEqual(["Email already in use.", "Something went wrong"]);
  expect(all.some((u) => u.text.includes("in the card"))).toBe(false);
  expect(all.some((u) => u.text.includes("try again"))).toBe(false);
  expect(all.some((u) => u.text.includes("some.key"))).toBe(false);
});

it("visits JSX passed through props and decodes character references once", () => {
  const all = extractTsx(
    "x.tsx",
    'export const X = () => (\n  <Dialog footer={<p>Copy in a "prop" element</p>} render={() => <span aria-label="Inside render">x</span>}>\n    <p>Entities: &amp;lt; and it&#8217;s and it&rsquo;s</p>\n  </Dialog>\n);\n',
    { config: config(FIXTURES), docType: "ui" }
  );
  expect(all.some((u) => u.text === 'Copy in a "prop" element')).toBe(true);
  expect(all.some((u) => u.text === "Inside render")).toBe(true);
  expect(all.find((u) => u.text.startsWith("Entities"))?.text).toBe(
    "Entities: &lt; and it\u2019s and it\u2019s"
  );
});

it("resolves class lists, flags dynamic className and pairs neighbours", () => {
  const all = units();
  const rules = all.find(
    (u) => u.kind === "class-list" && u.text === "Notification rules"
  );
  expect(rules?.typography).toMatchObject({ fontSizePx: 17, fontWeight: 600 });
  expect(rules?.neighbours?.next).toMatchObject({
    text: "Choose which sync events reach your inbox.",
  });
  expect(rules?.neighbours?.next?.typography).toMatchObject({
    fontSizePx: 15,
    fontWeight: 600,
  });
  const button = all.find(
    (u) => u.kind === "class-list" && u.text === "Submit"
  );
  expect(button?.context.dynamic).toBe(true);
  expect(button?.classes).toEqual(["rounded-md", "px-3"]);
});
