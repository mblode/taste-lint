import type { ReactNode } from "react";

export interface MarketingHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
  secondary?: ReactNode;
}

// Server-rendered and static: nothing in the first viewport animates on mount.
// The subhead keeps its desktop size on phones so it, not the playground
// intro below it, is the largest text in the first viewport (the LCP).
export function MarketingHero({
  eyebrow,
  title,
  description,
  action,
  secondary,
}: MarketingHeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="px-(--row-padding) pt-12 pb-16 sm:pt-24 sm:pb-24"
    >
      {eyebrow && (
        <p className="mb-4 text-base font-medium text-muted-foreground sm:mb-6 sm:text-lg">
          {eyebrow}
        </p>
      )}
      <h1
        className="max-w-[14ch] text-5xl leading-[0.95] font-semibold tracking-tight text-balance sm:text-7xl lg:text-8xl"
        id="hero-title"
      >
        {title}
      </h1>
      <p className="mt-6 max-w-[44ch] text-xl leading-8 text-pretty text-muted-foreground sm:mt-8">
        {description}
      </p>
      <div className="mt-8 sm:mt-10">{action}</div>
      {secondary && <div className="mt-1">{secondary}</div>}
    </section>
  );
}
