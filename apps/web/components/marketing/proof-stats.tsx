export interface ProofStat {
  label: string;
  value: number | null;
  href?: string;
}

const format = new Intl.NumberFormat("en-AU");

// Hides every null stat and renders nothing when none are left: a missing
// number is never replaced with a guess.
export function ProofStats({ stats }: { stats: ProofStat[] }) {
  const shown = stats.filter(
    (stat): stat is ProofStat & { value: number } => stat.value !== null
  );
  if (shown.length === 0) {
    return null;
  }
  return (
    <dl className="flex flex-wrap gap-x-12 gap-y-6">
      {shown.map((stat) => (
        <div className="flex flex-col-reverse gap-1" key={stat.label}>
          <dt className="text-sm text-muted-foreground">
            {stat.href ? (
              <a
                className="underline underline-offset-4 hover:decoration-2"
                href={stat.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {stat.label}
              </a>
            ) : (
              stat.label
            )}
          </dt>
          <dd className="text-4xl font-medium tracking-tight tabular-figures sm:text-5xl">
            {format.format(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
