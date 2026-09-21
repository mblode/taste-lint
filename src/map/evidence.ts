import type { Rule, Unit } from "../types.js";
import { buildState } from "./state.js";

/** Evidence needed to interpret a question must not silently disappear. */
export const missingEvidence = (unit: Unit, rule: Rule): string | undefined => {
  if (!rule.question) {
    return undefined;
  }
  const keys = rule.question.context ?? [];
  if (keys.includes("section")) {
    if (!unit.context.section) {
      return "Missing section context";
    }
    if (
      unit.context.dynamic &&
      ["jsx-text", "attr-string"].includes(unit.kind)
    ) {
      return "Dynamic text may supply the missing explanation or action";
    }
  }
  if (keys.includes("neighbours") && !unit.neighbours?.next) {
    return "Missing comparison neighbour";
  }
  if (buildState(unit, [rule]).truncated) {
    return keys.includes("section")
      ? "Section comparison exceeds the context budget"
      : unit.kind === "source"
        ? "Source exceeds the semantic context budget"
        : "Text comparison exceeds the context budget";
  }
  return undefined;
};
