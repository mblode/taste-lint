# Skill pack implementation status

This is an implementation ledger, not a claim that every sentence in every skill is now a lint rule. The [source discovery snapshot](skill-source-discovery.json) records each discovered entrypoint, rule, reference, and guideline with source headings and rule citations. Uncited sources remain `needs-triage`; a citation does not mean full semantic coverage.

## Delivered in this expansion

39 additional review-only rules: 24 deterministic checks and 15 contextual questions. The catalog now contains 161 rules, including the earlier four documentation ports.

| Pack | Implemented evidence and checks |
| --- | --- |
| README and documents | Scaffold text, missing description, quickstart elisions, empty headings, heading order, local links, license links, published install name |
| AGENTS.md and skills | Missing npm scripts, skill frontmatter, generic verification, blanket approval demands, fixed agent quotas, generic coding advice |
| Planning | Vague acceptance criteria |
| Package and architecture | Package entry targets, bin shebangs, mixed export keys, undeclared imports, cross-package relative imports, missing project references and config extensions |
| Declared architecture policy | Import boundaries, deprecated imports, generated-file regeneration hints |
| Product copy | Success messages, permission benefit, confirmshaming, visual-direction instructions |
| Personal writing | Announced honesty, unraised objections, vague requests, supplied-fact changes, explicit profile mismatch, drafting-instruction leakage |
| Typography and motion | Explicit disabled hyphenation with justification, disabled kerning, glyph stretching, layout-property transitions |

Source analysis shares cached repository reads, Markdown structure, and parsed import facts. TypeScript aliases and JSONC configurations that cannot be resolved are unknown. Architecture policy checks require declared conventions. Personal comparison questions require explicitly supplied context; no private profile is loaded implicitly.

## Verification

`npm run verify:full` passed: 142 tests, formatting, build, typecheck, packed CLI smoke, and all 161 rule definitions. Source-port verification checked 79 rules with zero drift.

Regression tests cover positive/negative examples, missing context, oversized context, scope, unresolved evidence, filesystem containment, import parsing, package lookup, reports, and recorder failure classification. Mocked probabilities verify routing and review-only behavior, not semantic accuracy.

An offline scan of 1,210 `blode-co` files using the 24 new deterministic rules produced four review candidates and zero model requests. It reported 120 unknowns: 117 unresolved dependency checks and three private-package install checks. These are smoke-test observations, not precision measurements or confirmed defects.

## Remaining evidence adapters and evaluation

| Work | Required evidence before shipping reliable checks |
| --- | --- |
| Complete graph policies and cycles | Alias/workspace resolution, type-only edge policy, explicit public entries; integrate an existing graph tool |
| Environment and registry contracts | Declared schemas, eligible implementation sets, and dynamic-loading policy |
| Generated artifact freshness | Authorized generator and controlled output comparison |
| Parent/child instruction conflicts | Actual instruction loading scope and both instruction documents |
| Skill routing and completion quality | Whole workflow, adjacent skills, canonical validator, behavioral evaluation |
| Product action/verb fidelity | Component state, action contract, and product glossary |
| Runtime and accessibility flows | Rendered DOM, interaction traces, and browser evidence |
| Distributed correctness | Schema/transaction boundaries and retry, duplicate-delivery, interruption fixtures |
| Semantic promotion | Human-labeled held-out evaluations; personal voice needs blind preference evaluation |

The architecture and writing candidate audits preserve the individual remaining proposals and their false-positive boundaries. Other discovered skill sources are inventoried but have not all been converted. These pending items are not completed by adding generic model questions or missing-keyword checks.
