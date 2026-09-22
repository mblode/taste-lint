import { describe, expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { runMechanical } from "../reduce/mechanical.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { check, config } from "./helpers.js";

const rules = loadRules(resolveRulesDir());
const source = (file: string, text: string) =>
  extractSource(
    config(process.cwd()),
    file,
    text,
    new Repository(process.cwd())
  ).find((u) => u.kind === "source")!;
const fires = (id: string, file: string, text: string): boolean => {
  const rule = rules.find((r) => r.id === id);
  if (!rule) {
    throw new Error(`No rule ${id}`);
  }
  const unit = source(file, text);
  return rule.check
    ? rule.check(unit).fired
    : runMechanical(rule.mechanical!, { ...unit, codeSpans: [], text }).fired;
};

// [rule, file, fires, clean]
describe.each([
  [
    "copywriting-participle-tail",
    "a.md",
    "Tests run on every push, ensuring quality stays high.",
    "Tests run on every push. Ensuring quality is the reviewer's job.",
  ],
  [
    "copywriting-participle-tail",
    "a.md",
    "We refactored the parser, highlighting the gaps.",
    "Participle tails (“, ensuring…”) are a structure tell.",
  ],
  [
    "copywriting-antithesis-frame",
    "a.md",
    "It's not a tool, it's a workflow.",
    "The tells list \"it's not X, it's Y\" as a structure tell.",
  ],
  [
    "copywriting-antithesis-frame",
    "a.md",
    "The fix improves not just speed but trust.",
    "The fix is not ready. Ship it next week.",
  ],
  [
    "copywriting-tee-up",
    "a.md",
    "Here's the thing: nobody reads the docs.",
    'Cut tee-ups like "Here\'s the thing" and say it.',
  ],
  [
    "copywriting-copula-avoidance",
    "a.md",
    "The index serves as a cache for lookups.",
    "The index is a cache for lookups.",
  ],
  [
    "motion-will-change-misuse",
    "a.css",
    ".card { will-change: top; }",
    ".card { will-change: transform; }",
  ],
  [
    "craft-default-indigo",
    "a.tsx",
    'const b = <button className="bg-indigo-600 text-white">Go</button>;',
    'const b = <button className="bg-primary text-white">Go</button>;',
  ],
  [
    "craft-atmosphere-gradient",
    "a.tsx",
    'const h = <div className="bg-gradient-to-r from-purple-500 to-cyan-400" />;',
    'const h = <div className="bg-gradient-to-r from-stone-100 to-stone-200" />;',
  ],
  [
    "motion-css-transition-all",
    "a.css",
    ".btn { transition: all 200ms ease-out; }",
    ".btn { transition: transform 200ms ease-out; } /* transition: all */",
  ],
  [
    "motion-css-transition-all",
    "a.tsx",
    'const s = { transition: "all 0.2s" };',
    'const s = { transition: "opacity 0.2s" };',
  ],
  [
    "motion-framer-motion-import",
    "a.tsx",
    'import { motion } from "framer-motion";',
    'import { motion } from "motion/react";\n// was: import { motion } from "framer-motion";',
  ],
  [
    "copywriting-document-code-fence-language",
    "a.md",
    "# Demo\n\n```\nnpm test\n```\n",
    "# Demo\n\n```bash\nnpm test\n```\n",
  ],
])("%s", (id, file, bad, good) => {
  it("fires on the tell", () => {
    expect(fires(id, file, bad)).toBe(true);
  });
  it("stays quiet on the clean or quoted form", () => {
    expect(fires(id, file, good)).toBe(false);
  });
});

it("lets only deterministic checks among the new skill rules block", () => {
  const status = (id: string) => rules.find((r) => r.id === id)?.status;
  expect(status("motion-framer-motion-import")).toBe("active");
  expect(status("copywriting-document-broken-local-link")).toBe("active");
  expect(status("interaction-a11y-image-alt-text")).toBe("active");
  expect(status("craft-default-indigo")).toBe("review-only");
  expect(check("motion-css-transition-all")).toBeTypeOf("function");
});
