// `--fix` may rewrite prose only: never attribute quotes, expression braces,
// inline code or string delimiters. Each case here corrupted a file before
// fix ranges existed.
import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";
import { parse } from "yaml";

import { extractMarkdown } from "../extract/markdown.js";
import { extractTsx } from "../extract/tsx.js";
import { runLint } from "../lint.js";
import {
  AU_SPELLING_PATTERN,
  auSpelling,
  ellipsis,
  multiplicationSign,
  nbspValueUnit,
  smartQuotes,
  stripUtm,
} from "../reduce/fixes.js";
import { config, FIXTURES, temporary } from "./helpers.js";

const folders: string[] = [];
afterEach(() => {
  for (const root of folders.splice(0)) {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

const fixRoot = (files: Record<string, string>) => {
  const root = temporary();
  folders.push(root);
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
};

const lintFix = (root: string) =>
  runLint(
    {
      fix: true,
      resultsDir: path.join(root, "results"),
      root,
      rulesDir: path.join(FIXTURES, "rules"),
      targets: ["."],
    },
    { stderr() {}, stdout() {} }
  );

it("curls quotes inside JSX text, attributes and copy maps without touching delimiters", async () => {
  const root = fixRoot({
    "note.tsx": [
      'const COPY = { message: "It\'s done." };',
      "export const N = () => (",
      "  <>",
      '    <input placeholder="It\'s your turn" />',
      '    <p>It\'s a "quoted" line with {"an expression string"}.</p>',
      '    <p>Hello <b>"world"</b> again</p>',
      "  </>",
      ");",
      "",
    ].join("\n"),
  });
  const result = await lintFix(root);
  expect(result.findings.length).toBeGreaterThan(0);
  const out = fs.readFileSync(path.join(root, "note.tsx"), "utf-8");
  expect(out).toContain('const COPY = { message: "It’s done." };');
  expect(out).toContain('placeholder="It’s your turn"');
  expect(out).toContain(
    '<p>It’s a “quoted” line with {"an expression string"}.</p>'
  );
  expect(out).toContain("<b>“world”</b>");
  // The rewritten file still parses.
  const units = extractTsx("note.tsx", out, {
    config: config(root),
    docType: "ui",
  });
  expect(units.some((u) => u.kind === "file")).toBe(false);
});

it("leaves inline code alone when fixing the prose around it", async () => {
  const root = fixRoot({
    "doc.md": 'Use "real" quotes, not `"x"` in code.\n',
  });
  await lintFix(root);
  expect(fs.readFileSync(path.join(root, "doc.md"), "utf-8")).toBe(
    'Use “real” quotes, not `"x"` in code.\n'
  );
});

it("gives every unit kind a fix range that excludes its delimiters", () => {
  const tsx = extractTsx(
    "x.tsx",
    'const C = { title: "a" };\nexport const X = () => <p title="t">text {"e"}</p>;\n',
    { config: config("/"), docType: "ui" }
  );
  const source =
    'const C = { title: "a" };\nexport const X = () => <p title="t">text {"e"}</p>;\n';
  const slices = tsx.flatMap((u) =>
    (u.fixRanges ?? []).map(([s, e]) => source.slice(s, e))
  );
  expect(slices).toEqual(["a", "text", "e", "t"]);
  const md = extractMarkdown("x.mdx", 'Plain *em* `code` <Kbd label="k" />\n', {
    config: config("/"),
    docType: "lesson",
  });
  const mdSource = 'Plain *em* `code` <Kbd label="k" />\n';
  expect(
    md.flatMap((u) => (u.fixRanges ?? []).map(([s, e]) => mdSource.slice(s, e)))
  ).toEqual(["k", "Plain ", "em"]);
});

it("fix functions match exactly what their rules flag", () => {
  expect(smartQuotes(`"It's" the '90s`)).toBe("“It’s” the ’90s");
  expect(ellipsis("Wait...")).toBe("Wait…");
  expect(multiplicationSign("Use 3 x 4 tiles at 0x1F, 1920x1080")).toBe(
    "Use 3×4 tiles at 0x1F, 1920×1080"
  );
  expect(nbspValueUnit("wait 3 s for 16 px at 5 %.")).toBe(
    "wait 3 s for 16 px at 5 %."
  );
});

it("strips the ChatGPT referral tag and keeps other query parameters", () => {
  expect(stripUtm("See https://a.com/x?utm_source=chatgpt.com for more.")).toBe(
    "See https://a.com/x for more."
  );
  expect(stripUtm("https://a.com/?id=2&utm_source=chatgpt.com")).toBe(
    "https://a.com/?id=2"
  );
  expect(stripUtm("https://a.com/?utm_source=chatgpt.com&id=2")).toBe(
    "https://a.com/?id=2"
  );
  expect(stripUtm("https://a.com/y?utm_source=chatgpt.com#top")).toBe(
    "https://a.com/y#top"
  );
  expect(stripUtm("https://a.com/?utm_source=newsletter")).toBe(
    "https://a.com/?utm_source=newsletter"
  );
});

it("converts US spelling to Australian and keeps a leading capital", () => {
  expect(auSpelling("Color the favorite labeled rows gray.")).toBe(
    "Colour the favourite labelled rows grey."
  );
  expect(auSpelling("colorful discoloration stays")).toBe(
    "colorful discoloration stays"
  );
  expect(auSpelling("COLOR stays shouting")).toBe("COLOR stays shouting");
  expect(new RegExp(AU_SPELLING_PATTERN, "iu").test("Organize it")).toBe(true);
});

it("never rewrites spelling inside a URL or path", () => {
  const text = "See https://a.com/color-picker and src/color.ts for color.";
  expect(auSpelling(text)).toBe(
    "See https://a.com/color-picker and src/color.ts for colour."
  );
});

it("keeps the voice pack rule and the spelling fix on one word list", () => {
  const rule = parse(
    fs.readFileSync(
      path.join(
        FIXTURES,
        "voice-pack/copywriting/copywriting-voice-au-spelling.yaml"
      ),
      "utf-8"
    )
  ) as { mechanical: { regex: string } };
  expect(rule.mechanical.regex).toBe(AU_SPELLING_PATTERN);
});
