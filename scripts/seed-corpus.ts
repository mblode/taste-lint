// Seed data/corpus from the taste-training judgement and exercise registries.
//
//   npm run seed-corpus -- --taste-training ../taste-training [--out data/corpus]
//
// The registries are TSX, so they are read statically with the slop-cop TSX
// extractor rather than imported. Each item's options are located by source
// range; the losing option is labelled true for the rules mapped to the
// item's category and the winning option false. Categories that map to more
// than one rule are marked manifest-weak until a person confirms them.

import fs from "node:fs";
import path from "node:path";

import { parseSync } from "oxc-parser";

// Import from the built package so `.js` specifiers resolve; run `npm run build` first.
import { extractTsx } from "../dist/index.js";
import type { Config, CorpusItem, Unit, UnitKind } from "../src/types.ts";

const a = process.argv.slice(2);
const get = (flag: string): string | undefined => {
  const i = a.indexOf(flag);
  return i === -1 ? undefined : a[i + 1];
};
const tasteDir = path.resolve(get("--taste-training") ?? "../taste-training");
const outDir = path.resolve(get("--out") ?? "data/corpus");
const web = path.join(tasteDir, "apps/web");

// Category -> slop-cop rule ids whose truth the losing option demonstrates.
const CATEGORY_RULES: Record<string, string[]> = {
  "actionable-cta": [
    "copywriting-cta-names-outcome",
    "copywriting-friction-cta",
  ],
  "actionable-microcopy": [
    "copywriting-vague-error",
    "copywriting-empty-state-no-action",
    "copywriting-bare-confirm-label",
  ],
  "evidence-over-claims": ["copywriting-claim-without-evidence"],
  "machine-prose": ["copywriting-machine-prose"],
  "reader-first-framing": ["copywriting-reader-first"],
  "reading-comfort": [
    "typography-letterspaced-body",
    "typography-body-below-15px",
    "typography-line-height-out-of-band",
  ],
  "type-hierarchy": [
    "typography-hierarchy-size-only",
    "typography-stacked-emphasis",
  ],
  "typographic-detail": [
    "typography-straight-quotes",
    "typography-dashes",
    "typography-ellipsis",
    "typography-nbsp-value-unit",
  ],
};

const TYPOGRAPHY_CATEGORIES = new Set(["reading-comfort", "type-hierarchy"]);

const config: Config = {
  components: { skip: [], unwrap: [] },
  docTypes: [],
  exclude: [],
  root: web,
  smartQuotesAtBuild: false,
  tailwind: { theme: {} },
};

type Node = Record<string, unknown> & {
  type: string;
  start: number;
  end: number;
};
const isNode = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && typeof (v as Node).type === "string";

const literal = (node: Node | undefined): string | undefined =>
  node && node.type === "Literal" && typeof node.value === "string"
    ? node.value
    : undefined;

const propertyMap = (obj: Node): Map<string, Node> => {
  const map = new Map<string, Node>();
  for (const prop of (obj.properties as Node[]) ?? []) {
    if (prop.type !== "Property") {
      continue;
    }
    const key = prop.key as Node;
    const name =
      key.type === "Identifier" ? (key.name as string) : literal(key);
    if (name) {
      map.set(name, prop.value as Node);
    }
  }
  return map;
};

const unwrapParens = (node: Node): Node =>
  node.type === "ParenthesizedExpression"
    ? unwrapParens(node.expression as Node)
    : node;

// Find `export const <name> = { ... }` object literals in a module.
const exportedObjects = (program: Node): Node[] => {
  const out: Node[] = [];
  for (const stmt of program.body as Node[]) {
    const decl =
      stmt.type === "ExportNamedDeclaration"
        ? (stmt.declaration as Node | null)
        : null;
    if (!decl || decl.type !== "VariableDeclaration") {
      continue;
    }
    for (const d of decl.declarations as Node[]) {
      const init = d.init ? unwrapParens(d.init as Node) : null;
      if (
        init &&
        (init.type === "ObjectExpression" ||
          init.type === "TSSatisfiesExpression" ||
          init.type === "TSAsExpression")
      ) {
        const obj =
          init.type === "ObjectExpression"
            ? init
            : unwrapParens(init.expression as Node);
        if (obj.type === "ObjectExpression") {
          out.push(obj);
        }
      }
    }
  }
  return out;
};

const within = (unit: Unit, node: Node): boolean =>
  unit.sourceStart >= node.start && unit.sourceEnd <= node.end;

const textOf = (units: Unit[], node: Node): string =>
  units
    .filter((u) => u.kind === "jsx-text" && within(u, node))
    .map((u) => u.text)
    .join(" ")
    .trim();

const classUnitOf = (units: Unit[], node: Node): Unit | undefined => {
  const candidates = units.filter(
    (u) => u.kind === "class-list" && within(u, node)
  );
  return (
    candidates.find((u) => u.neighbours?.next) ??
    candidates.find((u) => u.typography?.fontSizePx !== undefined) ??
    candidates[0]
  );
};

const items: CorpusItem[] = [];
const seen = new Set<string>();

const addItem = (
  id: string,
  categoryId: string,
  kind: UnitKind,
  text: string,
  label: boolean,
  source: CorpusItem["source"],
  extra: Partial<CorpusItem> = {}
): void => {
  const rules = CATEGORY_RULES[categoryId];
  if (!rules || text.length === 0 || seen.has(id)) {
    return;
  }
  seen.add(id);
  const labels: Record<string, boolean> = {};
  for (const rule of rules) {
    labels[rule] = label;
  }
  items.push({
    categoryId,
    id,
    kind,
    labelSource: rules.length > 1 ? "manifest-weak" : "manifest",
    labels,
    source,
    split: "dev",
    text,
    ...extra,
  });
};

const kindFor = (categoryId: string): UnitKind =>
  TYPOGRAPHY_CATEGORIES.has(categoryId) ? "class-list" : "jsx-text";

const contextFor = (categoryId: string, kind: UnitKind): Partial<CorpusItem> =>
  kind === "class-list"
    ? {}
    : {
        context: {
          docType: "ui",
          role: categoryId === "reader-first-framing" ? "heading" : "body",
        },
      };

const optionItem = (
  units: Unit[],
  node: Node,
  id: string,
  categoryId: string,
  label: boolean,
  source: CorpusItem["source"]
): void => {
  const kind = kindFor(categoryId);
  if (kind === "class-list") {
    const unit = classUnitOf(units, node);
    if (!unit) {
      return;
    }
    addItem(id, categoryId, kind, unit.text, label, source, {
      classes: unit.classes,
      context: { docType: "ui", role: unit.context.role },
      neighbours: unit.neighbours,
    });
    return;
  }
  addItem(
    id,
    categoryId,
    kind,
    textOf(units, node),
    label,
    source,
    contextFor(categoryId, kind)
  );
};

const seedRegistry = (
  relFile: string,
  kind: "judgements" | "exercises"
): void => {
  const abs = path.join(web, relFile);
  const source = fs.readFileSync(abs, "utf-8");
  const program = parseSync(abs, source, { lang: "tsx", sourceType: "module" })
    .program as unknown as Node;
  const units = extractTsx(relFile, source, { config, docType: "ui" });
  for (const registry of exportedObjects(program)) {
    for (const [itemId, value] of propertyMap(registry)) {
      const node = unwrapParens(value);
      if (node.type !== "ObjectExpression") {
        continue;
      }
      const props = propertyMap(node);
      const categoryId = literal(props.get("categoryId"));
      if (!categoryId || !CATEGORY_RULES[categoryId]) {
        continue;
      }
      const src = {
        id: itemId,
        path: `apps/web/${relFile}`,
        repo: "mblode/taste-training",
      };
      if (kind === "judgements") {
        const correct = literal(props.get("correctAnswer"));
        const optionA = props.get("optionA");
        const optionB = props.get("optionB");
        if (!correct || !optionA || !optionB) {
          continue;
        }
        optionItem(
          units,
          unwrapParens(optionA),
          `tt-j-${itemId}-a`,
          categoryId,
          correct !== "a",
          { ...src, option: "a" }
        );
        optionItem(
          units,
          unwrapParens(optionB),
          `tt-j-${itemId}-b`,
          categoryId,
          correct !== "b",
          { ...src, option: "b" }
        );
        continue;
      }
      // Exercises: locate, rank, repair.
      const before = props.get("before");
      const stimulus = props.get("stimulus");
      const options = props.get("options");
      const answer = props.get("answer");
      if (before) {
        optionItem(
          units,
          unwrapParens(before),
          `tt-x-${itemId}-before`,
          categoryId,
          true,
          { ...src, option: "before" }
        );
        const answerId = literal(answer);
        if (
          options &&
          answerId &&
          unwrapParens(options).type === "ArrayExpression"
        ) {
          for (const opt of (unwrapParens(options).elements as Node[]) ?? []) {
            const optProps = propertyMap(unwrapParens(opt));
            if (
              literal(optProps.get("id")) === answerId &&
              optProps.get("content")
            ) {
              optionItem(
                units,
                unwrapParens(optProps.get("content") as Node),
                `tt-x-${itemId}-fixed`,
                categoryId,
                false,
                { ...src, option: answerId }
              );
            }
          }
        }
        continue;
      }
      if (stimulus && answer) {
        // Locate: regions are <LocateRegion id="..."> elements inside the stimulus.
        const stim = unwrapParens(stimulus);
        const answerId = literal(answer);
        const regions: Node[] = [];
        const walk = (n: unknown): void => {
          if (Array.isArray(n)) {
            for (const item of n) {
              walk(item);
            }
            return;
          }
          if (!isNode(n)) {
            return;
          }
          if (n.type === "JSXElement") {
            const opening = n.openingElement as Node;
            const name = (opening.name as Node).name;
            if (name === "LocateRegion") {
              regions.push(n);
            }
          }
          for (const [key, v] of Object.entries(n)) {
            if (key !== "type" && (Array.isArray(v) || isNode(v))) {
              walk(v);
            }
          }
        };
        walk(stim);
        for (const region of regions) {
          const opening = region.openingElement as Node;
          const idAttr = (opening.attributes as Node[]).find(
            (attr) =>
              attr.type === "JSXAttribute" &&
              ((attr.name as Node).name as string) === "id"
          );
          const regionId = idAttr ? literal(idAttr.value as Node) : undefined;
          if (!regionId) {
            continue;
          }
          optionItem(
            units,
            region,
            `tt-x-${itemId}-${regionId}`,
            categoryId,
            regionId === answerId,
            { ...src, option: regionId }
          );
        }
        continue;
      }
      if (
        options &&
        answer &&
        unwrapParens(answer).type === "ArrayExpression"
      ) {
        // Rank: answer lists option ids strongest first.
        const order = ((unwrapParens(answer).elements as Node[]) ?? [])
          .map((e) => literal(e))
          .filter((s): s is string => Boolean(s));
        const optionNodes = new Map<string, Node>();
        for (const opt of (unwrapParens(options).elements as Node[]) ?? []) {
          const optProps = propertyMap(unwrapParens(opt));
          const id = literal(optProps.get("id"));
          const content = optProps.get("content");
          if (id && content) {
            optionNodes.set(id, unwrapParens(content));
          }
        }
        const best = order[0];
        const worst = order.at(-1);
        if (best && optionNodes.has(best)) {
          optionItem(
            units,
            optionNodes.get(best) as Node,
            `tt-x-${itemId}-${best}`,
            categoryId,
            false,
            { ...src, option: best }
          );
        }
        if (worst && worst !== best && optionNodes.has(worst)) {
          optionItem(
            units,
            optionNodes.get(worst) as Node,
            `tt-x-${itemId}-${worst}`,
            categoryId,
            true,
            { ...src, option: worst }
          );
        }
      }
    }
  }
};

for (const name of fs
  .readdirSync(path.join(web, "content/judgements"))
  .toSorted()) {
  if (name.endsWith(".tsx")) {
    seedRegistry(`content/judgements/${name}`, "judgements");
  }
}
for (const name of fs
  .readdirSync(path.join(web, "content/exercises"))
  .toSorted()) {
  if (name.endsWith(".tsx")) {
    seedRegistry(`content/exercises/${name}`, "exercises");
  }
}

// The deliberately bad SAMPLE_COPY in sweep-runner.tsx: every paragraph is a
// positive for the sweep-derived rules.
const sweepSource = fs.readFileSync(
  path.join(web, "components/demos/copywriting/sweep-runner.tsx"),
  "utf-8"
);
const sample =
  sweepSource.match(/const SAMPLE_COPY = `([\s\S]*?)`;/)?.[1] ?? "";
const SWEEP_RULES = [
  "copywriting-dead-weight-hedges",
  "copywriting-generic-audience",
  "copywriting-claim-without-evidence",
  "copywriting-register-shift",
  "copywriting-machine-prose",
];
for (const [i, paragraph] of sample
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter(Boolean)
  .entries()) {
  const labels: Record<string, boolean> = {};
  for (const rule of SWEEP_RULES) {
    labels[rule] = true;
  }
  items.push({
    categoryId: "evidence-over-claims",
    context: { docType: "marketing", role: "body" },
    id: `tt-sweep-sample-${i + 1}`,
    kind: "paragraph",
    labelSource: "sweep",
    labels,
    source: {
      id: "SAMPLE_COPY",
      path: "apps/web/components/demos/copywriting/sweep-runner.tsx",
      repo: "mblode/taste-training",
    },
    split: "dev",
    text: paragraph,
  });
}

// Deterministic 80/20 split by id hash (same function as the loader).
const splitFor = (id: string): "dev" | "holdout" => {
  let h = 2_166_136_261;
  for (const ch of id) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h % 5 === 0 ? "holdout" : "dev";
};
for (const item of items) {
  item.split = splitFor(item.id);
}

fs.mkdirSync(outDir, { recursive: true });
const byDomain = new Map<string, CorpusItem[]>();
for (const item of items) {
  const domain =
    item.categoryId.startsWith("type") || item.categoryId === "reading-comfort"
      ? "typography"
      : "copywriting";
  byDomain.set(domain, [...(byDomain.get(domain) ?? []), item]);
}
for (const [domain, list] of byDomain) {
  fs.writeFileSync(
    path.join(outDir, `${domain}.jsonl`),
    `${list.map((i) => JSON.stringify(i)).join("\n")}\n`
  );
}
const weak = items.filter((i) => i.labelSource === "manifest-weak").length;
process.stdout.write(
  `${items.length} items (${weak} manifest-weak) written to ${outDir}\n`
);
