// Public API exports
export { runLint } from "./lint.js";
export type { LintContext, LintOptions } from "./lint.js";
export { loadRules, resolveRulesDir } from "./rules/load.js";
export { validateRule } from "./rules/validate.js";
export { buildQuestion } from "./rules/question.js";
export { CATEGORIES, CATEGORY_BY_ID } from "./rules/taxonomy.js";
export { extractFile } from "./extract/index.js";
export { extractMarkdown } from "./extract/markdown.js";
export { extractTsx } from "./extract/tsx.js";
export { resolveTypography, splitClasses } from "./extract/tailwind.js";
export { extractCapture, runStyleCapture } from "./extract/rendered.js";
export {
  parseCaptureInput,
  parseStyleCaptureText,
} from "./extract/style-capture-text.js";
export { planRequests } from "./map/plan.js";
export { buildState } from "./map/state.js";
export {
  makeFetchEvaluate,
  validateResponse,
  ProviderError,
} from "./map/jev.js";
export { AnswerCache, cacheKey } from "./map/cache.js";
export { Limiter } from "./map/limiter.js";
export { prepareRequests, runRequests, chunkQuestions } from "./map/batch.js";
export { band, jevFindings } from "./reduce/bands.js";
export { dedupe } from "./reduce/dedupe.js";
export { buildScorecard } from "./reduce/scorecard.js";
export { FUNCTIONS, runMechanical } from "./reduce/mechanical.js";
export { FIXES } from "./reduce/fixes.js";
export { renderTty } from "./report/tty.js";
export { renderJson } from "./report/json.js";
export { renderSarif } from "./report/sarif.js";
export { loadConfig, docTypeFor } from "./lib/config.js";
export { parseFrontmatter } from "./lib/frontmatter.js";
export {
  wilson,
  mcnemar,
  binaryMetrics,
  calibrationTable,
} from "./lib/stats.js";
export { loadCorpus } from "./eval/corpus.js";
export { runEval } from "./eval/metrics.js";
export { runTune, runTuneAb } from "./eval/tune.js";
export type * from "./types.js";
