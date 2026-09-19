import { styleText } from "node:util";

import type { Finding, LintResult, Scorecard } from "../types.js";

type Colour = Parameters<typeof styleText>[0];

const paint = (colour: Colour, text: string): string => {
  try {
    return styleText(colour, text);
  } catch {
    return text;
  }
};

const severityTag = (f: Finding): string => {
  const label = f.severity.toUpperCase() + (f.band === "review" ? "?" : "");
  const colour: Colour =
    f.severity === "critical" || f.severity === "major" ? "red" : "yellow";
  return paint(f.band === "review" ? "cyan" : colour, `[${label}]`);
};

export const formatFinding = (f: Finding): string => {
  const head = `${severityTag(f)} ${f.ruleId} (p=${f.probability.toFixed(2)}) ${f.file}:${f.line}:${f.column}`;
  const lines = [
    head,
    `    ${f.message}${f.also ? ` (also ${f.also.join(", ")})` : ""}`,
  ];
  if (f.evidence) {
    lines.push(`    ${f.evidence}`);
  }
  if (f.fixHint && f.fixMode !== "none") {
    lines.push(`    Fix: ${f.fixHint}`);
  }
  if (f.suppressed) {
    lines.push("    (suppressed)");
  }
  return lines.join("\n");
};

const scorecardTable = (scorecard: Scorecard): string => {
  const rows = Object.entries(scorecard.byCategory).map(
    ([id, c]) =>
      `  ${id.padEnd(26)} ${String(c.act).padStart(4)} act ${String(c.review).padStart(4)} review ${String(c.suppressed).padStart(3)} suppressed ${String(c.unknown).padStart(4)} unknown`
  );
  return ["Scorecard", ...rows].join("\n");
};

export const renderTty = (
  result: LintResult,
  options: { verbose?: boolean } = {}
): string => {
  const out: string[] = [];
  const visible = result.findings.filter(
    (f) => options.verbose || !f.suppressed
  );
  let currentFile = "";
  for (const f of visible) {
    if (f.file !== currentFile) {
      currentFile = f.file;
      out.push("", paint("bold", f.file));
    }
    out.push(formatFinding(f));
  }
  if (result.unknowns.length > 0) {
    out.push(
      "",
      `${result.unknowns.length} unknown (unresolved value or precondition); use --verbose to list`
    );
    if (options.verbose) {
      for (const u of result.unknowns) {
        out.push(`  ${u.ruleId} ${u.file}:${u.line}: ${u.reason}`);
      }
    }
  }
  out.push("", scorecardTable(result.scorecard));
  const act = result.findings.filter(
    (f) => f.band === "act" && !f.suppressed
  ).length;
  const review = result.findings.filter(
    (f) => f.band === "review" && !f.suppressed
  ).length;
  out.push(
    "",
    `Units: ${result.units}  |  Rules: ${result.rules.length}  |  Act: ${act}  |  Review: ${review}  |  Unknown: ${result.unknowns.length}`
  );
  if (result.status === "dry-run" && result.estimated) {
    out.push(
      `Dry run: ${result.estimated.requests} request${result.estimated.requests === 1 ? "" : "s"} would be sent, about ${result.estimated.inputTokens} input tokens, about $${result.estimated.costUsd.toFixed(4)}. No calls were made.`
    );
  } else {
    out.push(
      `Jev: ${result.usage.requests} request${result.usage.requests === 1 ? "" : "s"}, ${result.usage.cached} cached answers, ${result.usage.inputTokens} input tokens, $${result.usage.costUsd.toFixed(4)}${result.usage.errors ? `, ${result.usage.errors} errors` : ""}`
    );
  }
  if (result.status === "incomplete") {
    out.push(
      paint("red", "INCOMPLETE - some requests failed; findings are partial")
    );
  } else if (act > 0) {
    out.push(
      paint(
        "red",
        `FAIL - ${act} finding${act === 1 ? "" : "s"} in the act band`
      )
    );
  } else {
    out.push(paint("green", "PASS - no act-band findings"));
  }
  return `${out.join("\n")}\n`;
};
