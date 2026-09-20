import { none, UnresolvedError } from "../../reduce/mechanical.js";
import { codeRule } from "./rule.js";

export const IMAGE_RULES = [
  {
    categoryId: "focus-and-a11y",
    hint: 'Add an alt attribute. Use alt="" for decorative images.',
    id: "interaction-a11y-image-alt-text",
    required: ["alt"],
    source: "a11y-image-alt-text",
    title: "Image is missing an alt attribute",
  },
  {
    categoryId: "resilience",
    hint: "Declare dimensions or an aspect ratio to reserve image space. Verify external CSS before changing the image.",
    id: "craft-image-dimensions-and-priority",
    required: ["width", "height"],
    source: "perf-image-dimensions-and-priority",
    title: "Image has no declared dimensions or style",
  },
].map((spec) =>
  codeRule(
    {
      categoryId: spec.categoryId,
      check: (unit) => {
        if (!unit.facts?.images) {
          throw new UnresolvedError("Needs parsed JSX image attributes");
        }
        for (const img of unit.facts.images) {
          if (spec.required.every((name) => img.attributes.includes(name))) {
            continue;
          }
          if (
            img.spread ||
            (spec.required.includes("width") &&
              img.attributes.some((name) =>
                ["style", "className"].includes(name)
              ))
          ) {
            throw new UnresolvedError(
              "Image attributes or dimensions require resolved props and styles"
            );
          }
          return { evidence: spec.title, fired: true, offset: img.offset };
        }
        return none;
      },
      hint: spec.hint,
      id: spec.id,
      scope: { include: ["**/*.tsx", "**/*.jsx", "**/*.html"] },
      source: {
        line: 9,
        path: `skills/ui-design/rules/${spec.source}.md`,
        repo: "mblode/agent-skills",
        ruleId: spec.source,
      },
      status: "review-only",
      title: spec.title,
      unit: ["source"],
    },
    "src/rules/code/images.ts"
  )
);
