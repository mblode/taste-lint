// Extract only explicitly mapped course judgments. Broad category labels are
// insufficient: an empty-state exercise is not also a confirmation-label test.
import fs from "node:fs";
import path from "node:path";

import { parseSync } from "oxc-parser";

import { extractTsx, loadRules } from "../dist/index.js";

const course = path.resolve("../taste-training/apps/web/content/judgements");
const cases = [
  [
    "make-words-earn-their-place",
    "adjective-stack",
    "copywriting-claim-without-evidence",
    "dev",
  ],
  [
    "make-words-earn-their-place",
    "evidence-adjective-exception",
    "copywriting-claim-without-evidence",
    "dev",
  ],
  [
    "make-words-earn-their-place",
    "microcopy-failed-save",
    "copywriting-vague-error",
    "dev",
  ],
  [
    "decide-what-it-does",
    "states-empty-first-action",
    "copywriting-empty-state-no-action",
    "holdout",
  ],
  [
    "make-every-interaction-feel-considered",
    "forms-error-recovery",
    "copywriting-vague-error",
    "holdout",
  ],
];
const rules = loadRules(path.resolve("data/rules"));
const config = {
  components: { skip: [], unwrap: [] },
  docTypes: [],
  exclude: [],
  root: course,
  smartQuotesAtBuild: false,
  tailwind: { theme: {} },
};
const properties = (node) =>
  new Map(
    (node.properties ?? [])
      .filter((p) => p.type === "Property")
      .map((p) => [p.key.name ?? p.key.value, p.value])
  );
const find = (node, id) => {
  if (!node || typeof node !== "object") {
    return;
  }
  if (
    node.type === "ObjectExpression" &&
    properties(node).get("id")?.value === id
  ) {
    return node;
  }
  for (const child of Object.values(node)) {
    if (child && typeof child === "object") {
      const found = find(child, id);
      if (found) {
        return found;
      }
    }
  }
};
const items = [];
for (const [file, id, ruleId, split] of cases) {
  const source = fs.readFileSync(path.join(course, `${file}.tsx`), "utf-8");
  const parsed = parseSync(`${file}.tsx`, source, { lang: "tsx" });
  if (parsed.errors.length) {
    throw new Error(`Cannot parse ${file}`);
  }
  const node = find(parsed.program, id);
  if (!node) {
    throw new Error(`Missing course example ${id}`);
  }
  const props = properties(node);
  const correct = props.get("correctAnswer").value;
  const rule = rules.find((r) => r.id === ruleId);
  for (const option of ["a", "b"]) {
    const jsx = props.get(option === "a" ? "optionA" : "optionB");
    const text = `export const Example = () => (${source.slice(jsx.start, jsx.end)});`;
    const units = extractTsx("example.tsx", text, {
      config,
      docType: "ui",
    }).filter((u) => u.kind === "jsx-text");
    if (!units.length) {
      throw new Error(`No literal copy in ${id}/${option}`);
    }
    // These selected exercises put the message being judged first. Nearby
    // explanations and buttons remain in its production section evidence.
    const unit = units[0];
    items.push({
      categoryId: rule.categoryId,
      context: unit.context,
      id: `product-${id}-${option}`,
      kind: unit.kind,
      labelSource: "manifest",
      labels: { [ruleId]: option !== correct },
      source: {
        id,
        option,
        path: `apps/web/content/judgements/${file}.tsx`,
        repo: "mblode/taste-training",
      },
      split,
      text: unit.text,
    });
  }
}
const out = "data/benchmarks/product/course.jsonl";
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${items.map((i) => JSON.stringify(i)).join("\n")}\n`);
process.stdout.write(
  `${items.length} rule-specific course variants written to ${out}\n`
);
