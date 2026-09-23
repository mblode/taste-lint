// Prose judgments that need evidence a single unit does not carry: what the
// file already said (context.earlier) and what the product actually does
// (context.brief, from `lint --brief`). The check fires only when that
// evidence exists, so Jev never guesses at a comparison it cannot see.

import { hit, none } from "../../reduce/mechanical.js";
import type { MechanicalHit, Role, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const PROSE_ROLES: Role[] = [
  "body",
  "list-item",
  "cell",
  "caption",
  "literal-copy",
  "unknown",
];

export const echoesEarlier = (unit: Unit): MechanicalHit =>
  unit.context.earlier
    ? hit(
        `shares content words with ${unit.context.earlier.split("\n").length} earlier sentence(s)`
      )
    : none;

export const hasBrief = (unit: Unit): MechanicalHit =>
  unit.context.brief ? hit("checked against the brief") : none;

export const PROSE_RULES = [
  // One of the 21 AI-writing checks Every ran with Jev (Mike Taylor, 15 Sep
  // 2026), rebuilt on context.earlier after it flagged first mentions, headings
  // and parallel entries: 1 in 5 findings was right on the 2026-09-23 corpus.
  codeRule(
    {
      categoryId: "machine-prose",
      check: echoesEarlier,
      hint: "Cut the restatement or replace it with the evidence it was standing in for.",
      id: "copywriting-idea-repetition",
      preconditions: { minWords: 5, notInCode: true, role: PROSE_ROLES },
      question: {
        context: ["docType", "earlier"],
        criteria: {
          false: {
            examples: [
              "EARLIER: Northwind keeps both versions side by side. TEXT: Open the conflict and pick the lines you want from each version.",
              "EARLIER: Relay unreachable. Check your connection and try again. TEXT: Disk full. Free up space on this laptop and Northwind will resume.",
              "EARLIER: Speed matters to users. TEXT: A 400ms dropdown loses a click one time in five in our logs.",
            ],
            what: "TEXT adds a fact, example, step or consequence, or is a parallel entry for a different case.",
          },
          true: {
            examples: [
              "EARLIER: When two people edit the same file, Northwind keeps both versions side by side. TEXT: Conflicting edits are never overwritten: you get both versions, side by side.",
              "EARLIER: It costs $8 per seat per month, with a 14-day free trial. TEXT: Just $8 per seat per month, and your first 14 days are free.",
            ],
            what: "TEXT says again what an EARLIER sentence already said, with nothing new.",
          },
        },
        instructions:
          "EARLIER lists sentences said before TEXT in the same document that share words with it. Does TEXT restate one of them without adding a new fact, example, step or consequence? Return false for parallel entries that share a structure but cover different cases (one error message, FAQ answer or step each), for a deliberate one-sentence summary closing a long section, and for a fact repeated where the reader acts on it (the price on the plan's button).",
      },
      source: {
        line: 1,
        path: "https://typesafe-parallel-judgment-lab.every-4573.chatgpt.site/downloads/typesafe-lab-source.zip (scripts/run-ai-checker.mjs)",
        repo: "every.to",
        ruleId: "idea_repetition",
      },
      thresholds: { act: 0.75, review: 0.4 },
      title: "Repeats the same idea without adding new evidence",
      unit: ["paragraph", "jsx-text"],
    },
    "src/rules/code/prose.ts"
  ),
  codeRule(
    {
      categoryId: "evidence-over-claims",
      check: hasBrief,
      hint: "Cut the setting, mode, policy or comparison, or add it to the brief if the product really does it.",
      id: "copywriting-invented-capability",
      preconditions: { notInCode: true },
      question: {
        context: ["docType", "element", "brief"],
        criteria: {
          false: {
            examples: [
              "BRIEF: keeps both versions when edits conflict. TEXT: Keep both versions",
              "BRIEF: 14-day free trial, no card required. TEXT: Start your free trial",
              "BRIEF: a desktop sync app. TEXT: Email address",
              "BRIEF: 14-day free trial, no card required; $8 per seat per month. TEXT: 14 days. No card. $8 per seat after that.",
              "BRIEF: keeps both versions when edits conflict. TEXT: Nobody’s work gets thrown away, even when two people edit the same file offline.",
            ],
            what: "Every claim in TEXT rewords, summarises or directly follows from the brief, or TEXT is ordinary interface chrome or an instruction to the reader.",
          },
          true: {
            examples: [
              "BRIEF: local network first, falls back to an encrypted relay. TEXT: Relay only",
              "BRIEF: 14-day free trial, no card required. TEXT: Cancel anytime during the trial",
              "BRIEF: keeps both versions side by side. TEXT: Most sync tools pick a winner and silently overwrite the other.",
            ],
            what: "TEXT offers or asserts a capability, setting, mode, role, policy, integration or comparison the brief never states.",
          },
        },
        instructions:
          "BRIEF is everything known about the product. Does TEXT offer or assert a capability, setting, mode, role, policy, integration, page, or claim about other products that BRIEF neither states nor directly implies? Return false for rewording, shortening or drawing a direct consequence from BRIEF, for ordinary interface chrome every app has (Save, Cancel, Email, Password, Settings, Sign in), and for instructions to the reader.",
      },
      source: {
        line: 10,
        path: "skills/ui-design/rules/slop-invented-behaviour.md",
        repo: "mblode/agent-skills",
        ruleId: "slop-invented-behaviour",
      },
      thresholds: { act: 0.75, review: 0.4 },
      title: "States a capability the brief never gave",
      unit: ["paragraph", "heading", "jsx-text", "attr-string"],
    },
    "src/rules/code/prose.ts"
  ),
];
