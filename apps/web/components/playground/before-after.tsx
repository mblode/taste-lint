import { BEFORE_AFTER } from "../../fixtures/playground-samples.js";
import { lintCopy, ruleSourceUrl } from "../../lib/playground.js";
import { Reveal } from "../reveal.js";
import { MarkedLine } from "./copy-playground.js";

// Both sides run through the same rules as the playground at build time, so
// the findings shown here are the real result, not a mock.
export function BeforeAfter() {
  const before = lintCopy(BEFORE_AFTER.before);
  const after = lintCopy(BEFORE_AFTER.after);
  const [first] = before;
  if (!first) {
    return null;
  }
  return (
    <figure className="mt-12 grid min-w-0 gap-8 border-t pt-10 sm:mt-16 md:grid-cols-2 md:gap-16">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">Before</p>
        <p className="mt-2 font-mono text-lg break-words">
          <MarkedLine
            matches={before
              .flatMap((finding) => finding.matches)
              .toSorted((a, b) => a.start - b.start)}
            text={first.text}
          />
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {before.map((finding) => (
            <li key={finding.rule.id}>
              <a
                className="font-mono underline underline-offset-4 hover:decoration-2"
                href={ruleSourceUrl(finding.rule.id)}
              >
                {finding.rule.id}
              </a>{" "}
              {finding.rule.title}
            </li>
          ))}
        </ul>
      </div>
      <Reveal>
        <p className="text-sm text-muted-foreground">After</p>
        <p className="mt-2 font-mono text-lg break-words">
          {BEFORE_AFTER.after}
        </p>
        <p className="mt-4 text-sm">
          {after.length === 0
            ? "No findings."
            : `${after.length} finding${after.length === 1 ? "" : "s"}.`}{" "}
          {first.rule.fix}
        </p>
      </Reveal>
      <figcaption className="sr-only">
        The same toast before and after applying the fix
      </figcaption>
    </figure>
  );
}
