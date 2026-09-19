import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: [...core.ignorePatterns, "src/__tests__/fixtures/**"],
  // Enforcement ladder, rung 3: the cap is on, and the three files already
  // over it are listed by path so the list can only grow in a reviewed diff.
  overrides: [
    {
      files: [
        "src/extract/tsx.ts",
        "scripts/port-rules.ts",
        "scripts/seed-corpus.ts",
      ],
      rules: { "max-lines": "off" },
    },
  ],
  rules: {
    // Complexity: runLint, the extractors and the Tailwind resolver are long
    // but linear pipelines; splitting them hides the order of operations.
    complexity: "off",
    // func-style: closures and hoisted helpers are used where they read best.
    "func-style": "off",
    // Files over 400 lines cost an agent chunked reads and revisits. The
    // rule emits a fixed message: the fix is to split along the file's
    // natural seams (extractor per input, one reporter per format).
    "max-lines": [
      "error",
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
    // Sequential await in the request loop is intentional: each response is
    // recorded before the next batch starts so a crash leaves a usable log.
    "no-await-in-loop": "off",
    // Bitwise operators are required for the mulberry32 PRNG used by the
    // deterministic bootstrap and corpus split.
    "no-bitwise": "off",
    // Inline comments annotate regexes and the Tailwind value table.
    "no-inline-comments": "off",
    // Early-exit `if (!x)` guards are the house style for fail-closed loaders.
    "no-negated-condition": "off",
    // Short role and label lookups read better as a ternary chain than as
    // three if blocks; each chain is under four branches.
    "no-nested-ternary": "off",
    // Helpers are defined after the exported function that reads best first;
    // module-level const functions are initialised before any call runs.
    "no-use-before-define": "off",
    // Bitwise compound operations in the PRNG are clearer written out.
    "operator-assignment": "off",
    // `const x = obj.x` is used where the destructured form would shadow a
    // module import or lose the type narrowing.
    "prefer-destructuring": "off",
    // Positional capture groups are readable for short punctuation patterns.
    "prefer-named-capture-group": "off",
    // The fetch client and spawn wrapper need new Promise.
    "promise/avoid-new": "off",
    // Rule regexes come from YAML files and are compiled with their own flags;
    // the source patterns here are ASCII-range.
    "require-unicode-regexp": "off",
    // Maps are pre-populated in the same function before the assertion.
    "typescript/no-non-null-assertion": "off",
    // Constructor parameter properties keep the small cache and limiter
    // classes to a screen each.
    "typescript/parameter-properties": "off",
    // Unicorn variant of no-negated-condition.
    "unicorn/no-negated-condition": "off",
    // Unicorn variant of no-nested-ternary.
    "unicorn/no-nested-ternary": "off",
    // Bitwise >>> 0 in the PRNG is intentional.
    "unicorn/prefer-math-trunc": "off",
  },
});
