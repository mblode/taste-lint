import { PLAYGROUND_RULES } from "./playground.js";
import { RULES } from "./rules.js";

// Every string the home page shows outside its components. The page renders
// these and lib/home-markdown.ts writes the Markdown mirror from them, so the
// two cannot say different things.
export const HOME_COPY = {
  close: {
    description:
      "Mechanical checks need no key and make no model calls. Add --dry-run to preview Jev requests and their cost first.",
    title: "Lint your next pull request",
  },
  faq: { heading: "Questions" },
  hero: {
    description:
      "For developers shipping UI an agent helped write. Taste Lint flags the copy, type and motion a design reviewer would send back.",
    eyebrow: "Taste Lint",
    title: "Catch AI slop before you ship",
  },
  proof: { heading: "Live from npm and GitHub" },
  rules: {
    body: `Taste Lint never fails a build on a model’s opinion. Only a regex or a measured value can block a run. The other ${RULES.total - RULES.active} rules leave review notes, and the judgement calls among them go to Jev, which answers with a probability.`,
    heading: `${RULES.total} rules. ${RULES.active} can fail your build.`,
    promoteLabel: "How a rule gets promoted",
    promotePath: "/usage#promoting-a-rule",
  },
  setupLabel: "Read the setup guide",
  try: {
    body: `Pick a sample or paste your own. These ${PLAYGROUND_RULES.length} copy rules load from the CLI’s own rule files and check each line as you type.`,
    heading: "Try it on your copy",
  },
} as const;
