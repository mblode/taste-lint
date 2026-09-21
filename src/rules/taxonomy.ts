// The 33 failure-mode categories, copied from
// mblode/taste-training apps/web/content/categories.ts. Every rule carries one
// of these ids so a finding links back to the lesson that teaches the fix.

import type { Domain } from "../types.js";

export interface Category {
  id: string;
  domain: Domain;
  label: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    domain: "authoring",
    id: "instruction-quality",
    label: "Instruction quality",
  },
  { domain: "typography", id: "type-quality", label: "Type quality" },
  {
    domain: "typography",
    id: "typographic-detail",
    label: "Typographic detail",
  },
  { domain: "typography", id: "reading-comfort", label: "Reading comfort" },
  { domain: "typography", id: "type-hierarchy", label: "Type hierarchy" },
  { domain: "typography", id: "type-voice", label: "Type voice" },
  { domain: "typography", id: "type-pairing", label: "Type pairing" },
  {
    domain: "craft",
    id: "grouping-proximity",
    label: "Grouping and proximity",
  },
  { domain: "craft", id: "elevation-and-edges", label: "Elevation and edges" },
  { domain: "craft", id: "colour-system", label: "Colour system" },
  { domain: "craft", id: "visual-hierarchy", label: "Visual hierarchy" },
  { domain: "craft", id: "generic-decoration", label: "Generic decoration" },
  { domain: "craft", id: "look-constraints", label: "Look constraints" },
  { domain: "craft", id: "optical-adjustment", label: "Optical adjustment" },
  { domain: "craft", id: "resilience", label: "Resilience" },
  { domain: "craft", id: "last-mile-polish", label: "Last-mile polish" },
  {
    domain: "copywriting",
    id: "reader-first-framing",
    label: "Reader-first framing",
  },
  {
    domain: "copywriting",
    id: "evidence-over-claims",
    label: "Evidence over claims",
  },
  { domain: "copywriting", id: "actionable-cta", label: "Actionable CTA" },
  {
    domain: "copywriting",
    id: "actionable-microcopy",
    label: "Actionable microcopy",
  },
  { domain: "copywriting", id: "page-structure", label: "Page structure" },
  {
    domain: "copywriting",
    id: "reference-reading",
    label: "Reference reading",
  },
  { domain: "copywriting", id: "machine-prose", label: "Machine prose" },
  { domain: "interaction", id: "form-usability", label: "Form usability" },
  { domain: "interaction", id: "state-coverage", label: "State coverage" },
  {
    domain: "interaction",
    id: "focus-and-a11y",
    label: "Focus and accessibility",
  },
  { domain: "motion", id: "easing-and-duration", label: "Easing and duration" },
  { domain: "motion", id: "spatial-continuity", label: "Spatial continuity" },
  {
    domain: "motion",
    id: "stagger-and-orchestration",
    label: "Stagger and orchestration",
  },
  { domain: "motion", id: "motion-restraint", label: "Motion restraint" },
  { domain: "product", id: "control-choice", label: "Control choice" },
  {
    domain: "product",
    id: "consequence-scoping",
    label: "Consequence scoping",
  },
  { domain: "product", id: "design-decisions", label: "Design decisions" },
  { domain: "product", id: "agent-trust", label: "Agent trust" },
];

export const CATEGORY_BY_ID: ReadonlyMap<string, Category> = new Map(
  CATEGORIES.map((c) => [c.id, c])
);
