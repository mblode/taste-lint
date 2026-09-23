import type { FaqItem } from "../components/marketing/faq-json-ld.js";
import { RULES } from "./rules.js";

// One array feeds the visible FAQ and the FAQPage JSON-LD. Each answer opens
// with the direct answer and stays under 60 words.
export const FAQ_ITEMS: FaqItem[] = [
  {
    answer:
      "Copy, typography, interaction and motion in JSX, TSX and CSS. Add --profile writing for Markdown, MDX and READMEs, or --profile instructions for AGENTS.md, skills and plans. Each finding names the rule, quotes the source and suggests a fix.",
    question: "What does Taste Lint check?",
  },
  {
    answer:
      "No. Every mechanical check runs without a key and makes no model calls. Add a Vercel AI Gateway key only if you want Jev review notes on judgement calls. Those calls bill your own account, and repeat runs reuse cached answers.",
    question: "Do I need an API key?",
  },
  {
    answer: `Only on the ${RULES.active} active rules, and each of those is mechanical: a regex or a measured value decides. The other ${RULES.total - RULES.active} leave review notes that never fail a run. A Jev rule can block only after tune --write proves its precision on a labelled holdout.`,
    question: "Will it fail my CI build?",
  },
  {
    answer:
      "Yes. Taste Lint is MIT licensed and the mechanical checks cost nothing to run. The one optional cost is uncached Jev checks, billed to your Vercel AI Gateway key. Run with --dry-run first to see the requests and the estimated cost.",
    question: "Is Taste Lint free?",
  },
  {
    answer:
      "Node.js 24.11 or later. Run npx taste-lint@latest init in your project folder. It installs Taste Lint locally and adds a taste script, so npm run taste lints the repo from then on.",
    question: "What do I need to run it?",
  },
  {
    answer:
      "From Agent Skills and Taste Training, both by Matthew Blode. Each rule file names the source file and line it came from, and port-rules --check confirms every ported rule still matches that source.",
    question: "Where do the rules come from?",
  },
];
