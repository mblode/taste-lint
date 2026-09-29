// A static, offline HTML report for one eval run: one row per (item, rule)
// case, linking to the item's own text and label. No network dependencies
// (inline CSS, no CDN fonts or scripts) so it opens from a file:// URL.
// See docs/eval.mdx.

import type { CorpusItem } from "../types.js";
import type { RuleEval } from "./metrics.js";

const escapeHtml = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderHtmlReport = (
  evals: RuleEval[],
  items: CorpusItem[]
): string => {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const sections = evals
    .filter((e) => e.pairs.length > 0)
    .map((e) => {
      const rows = e.pairs
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map((pair) => {
          const item = itemById.get(pair.id);
          const correct = pair.label === pair.probability >= 0.5;
          return `<tr id="${escapeHtml(`${e.ruleId}--${pair.id}`)}" class="${correct ? "ok" : "bad"}">
  <td>${escapeHtml(pair.id)}</td>
  <td>${pair.label ? "positive" : "negative"}</td>
  <td>${pair.probability.toFixed(2)}</td>
  <td>${correct ? "correct" : "wrong"}</td>
  <td>${escapeHtml(item?.split ?? "")}</td>
  <td><details><summary>text</summary><pre>${escapeHtml(item?.text ?? "")}</pre></details></td>
</tr>`;
        })
        .join("\n");
      return `<section>
<h2>${escapeHtml(e.ruleId)}</h2>
<p>n=${e.n} precision ${(e.metrics.precision * 100).toFixed(0)}% recall ${(e.metrics.recall * 100).toFixed(0)}% unknown ${e.unknown}</p>
<table>
<thead><tr><th>item</th><th>label</th><th>probability</th><th>outcome</th><th>split</th><th>text</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>taste-lint eval report</title>
<style>
body { font: 14px/1.4 -apple-system, system-ui, sans-serif; margin: 2rem; color: #111; }
table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; vertical-align: top; }
tr.bad { background: #fdecea; }
tr.ok { background: #eafaf0; }
pre { white-space: pre-wrap; max-width: 60ch; }
h1 { font-size: 1.4rem; }
h2 { font-size: 1.1rem; margin-top: 2rem; }
</style>
</head>
<body>
<h1>taste-lint eval report</h1>
<p>Generated offline; no network calls. Rows in red are the rule's disagreements with the label at the 0.5 midpoint (the report threshold, not necessarily the rule's act threshold).</p>
${sections}
</body>
</html>
`;
};
