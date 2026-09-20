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
  const colour: Colour = f.severity === "major" ? "red" : "yellow";
  return paint(f.band === "review" ? "cyan" : colour, `[${label}]`);
};

export const formatFinding = (f: Finding): string => {
  const confidence =
    f.assessment === "candidate"
      ? "candidate; verification required"
      : `p=${f.probability.toFixed(2)}`;
  const head = `${severityTag(f)} ${f.ruleId} (${confidence}) ${f.file}:${f.line}:${f.column}`;
  const lines = [
    head,
    `    ${f.message}${f.also ? ` (also ${f.also.join(", ")})` : ""}`,
  ];
  if (f.evidence) {
    lines.push(`    ${f.evidence}`);
  }
  if (f.fixHint) {
    lines.push(`    Fix: ${f.fixHint}`);
  }
  if (f.review) {
    lines.push(
      `    Requires: ${f.review.evidence}`,
      `    Verify: ${f.review.verification}`
    );
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
  const candidates = result.findings.filter(
    (f) => options.verbose || !f.suppressed
  );
  const actExamples = candidates.filter((f) => f.band === "act").slice(0, 20);
  const reviewExamples = candidates
    .filter((f) => f.band === "review")
    .slice(0, 10);
  const visible = options.verbose
    ? candidates
    : [...actExamples, ...reviewExamples];
  if (result.summary) {
    out.push(
      `Summary: ${result.summary.act} act, ${result.summary.review} review, ${result.summary.unknown} unknown; ${result.summary.failing} failing rule findings (fail-on ${result.summary.failOn}).`
    );
  }
  if (result.scope) {
    out.push(
      `Scope: ${result.scope.files} files; ${Object.entries(
        result.scope.byDocType
      )
        .map(([type, n]) => `${type}: ${n}`)
        .join(", ")}; ${result.scope.excluded} excluded paths.`,
      ...result.scope.diagnostics
    );
  }
  const counts = new Map<string, number>();
  for (const f of result.ruleFindings ?? candidates) {
    if (!f.suppressed) {
      counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
    }
  }
  out.push(
    `Top rules: ${[...counts]
      .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([id, n]) => `${id}: ${n}`)
      .join(", ")}`
  );
  if (visible.length < candidates.length) {
    out.push(
      `${candidates.length - visible.length} findings omitted from this view; use --verbose for every finding.`
    );
  }
  if (result.reportPath) {
    out.push(`Complete report: ${result.reportPath}`);
  }
  if (result.rerun) {
    out.push(`Retry unresolved work: ${result.rerun}`);
  }
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
  if (result.scope?.files === 0 && result.units === 0) {
    out.push("NO SCAN - no supported units selected");
  } else if (result.status === "incomplete") {
    out.push(
      paint(
        "red",
        "INCOMPLETE - analysis did not finish; see diagnostics and unknowns"
      )
    );
  } else if (result.exitCode === 1) {
    out.push(
      paint(
        "red",
        `FAIL - ${result.summary?.failing ?? act} rule findings meet the failure threshold`
      )
    );
  } else {
    out.push(
      paint(
        "green",
        act > 0
          ? "PASS - act findings are below the configured failure threshold"
          : "PASS - no act-band findings"
      )
    );
  }
  return `${out.join("\n")}\n`;
};
