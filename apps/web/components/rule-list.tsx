import { ChevronDownIcon } from "blode-icons-react";

import { DOMAIN_LABELS, RULES } from "../lib/rules.js";

// The full registry, grouped by domain. Native <details> keeps all rule
// names in the server HTML and works from the keyboard without script.
export function RuleList() {
  return (
    <div className="max-w-3xl divide-y border-y">
      {RULES.domains.map(({ domain, rules }) => {
        const blocking = rules.filter((rule) => rule.status === "active");
        return (
          <details className="group" key={domain}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="text-lg font-medium">
                  {DOMAIN_LABELS[domain] ?? domain}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {rules.length} rules, {blocking.length} blocking
                </span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <ul className="flex flex-col gap-3 pb-6">
              {rules.map((rule) => (
                <li
                  className="grid gap-x-6 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem]"
                  key={rule.id}
                >
                  <code className="font-mono text-sm break-all">{rule.id}</code>
                  <span className="text-sm">{rule.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {rule.status === "active" ? "Blocks a run" : "Review note"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
