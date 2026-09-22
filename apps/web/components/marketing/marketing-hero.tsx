import type { ReactNode } from "react";

export interface MarketingHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
  secondary?: ReactNode;
}

// Server-rendered and static: nothing in the first viewport animates on mount.
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
      className="px-(--row-padding) pt-8 pb-12 sm:pt-16 sm:pb-20"
    >
      {eyebrow && (
        <p className="mb-4 text-base font-medium sm:mb-6 sm:text-lg">
          {eyebrow}
        </p>
      )}
      <h1
        className="max-w-[14ch] text-[clamp(2.75rem,9vw,6.5rem)] leading-[0.95] font-medium tracking-tight text-balance"
        id="hero-title"
      >
        {title}
      </h1>
      <p className="mt-5 max-w-[48ch] text-lg leading-7 text-pretty sm:mt-6 sm:text-xl sm:leading-8">
        {description}
      </p>
      <div className="mt-6 sm:mt-8">{action}</div>
      {secondary && <div className="mt-1">{secondary}</div>}
    </section>
  );
}
