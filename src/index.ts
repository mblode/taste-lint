// Public API. The CLI is the primary surface; these exports exist for scripts
// (scripts/seed-corpus.ts) and for embedding the lint in another tool.
export { runLint } from "./lint.js";
export type { LintContext, LintOptions } from "./lint.js";
export { loadRules, resolveRulesDir } from "./rules/load.js";
export { validateRule } from "./rules/validate.js";
export { CATEGORIES, CATEGORY_BY_ID } from "./rules/taxonomy.js";
export { extractFile } from "./extract/index.js";
export { extractTsx } from "./extract/tsx.js";
export { extractCapture, runStyleCapture } from "./extract/rendered.js";
export { parseCaptureInput } from "./extract/style-capture-text.js";
export { makeFetchEvaluate, ProviderError } from "./map/jev.js";
export { renderJson } from "./report/json.js";
export { renderSarif } from "./report/sarif.js";
export { renderTty } from "./report/tty.js";
export { loadConfig } from "./lib/config.js";
export { runEval } from "./eval/metrics.js";
export { splitFor } from "./eval/corpus.js";
export { runTune, runTuneAb } from "./eval/tune.js";
// oxlint-disable-next-line oxc/no-barrel-file -- Stable package entry; tsdown bundles runtime exports and erases this type-only export.
export type * from "./types.js";
