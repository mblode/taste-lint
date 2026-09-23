import type { ReactNode } from "react";

export interface CtaCloseProps {
  title: ReactNode;
  description?: ReactNode;
  action: ReactNode;
  command?: ReactNode;
}

export function CtaClose({
  title,
  description,
  action,
  command,
}: CtaCloseProps) {
  return (
    <section
      aria-labelledby="cta-close-title"
      className="border-t px-(--row-padding) py-16 sm:py-24"
    >
      <h2
        className="max-w-[20ch] text-4xl font-medium tracking-tight text-balance sm:text-6xl"
        id="cta-close-title"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-[56ch] text-lg leading-7 text-pretty">
          {description}
        </p>
      )}
      <div className="mt-8">{action}</div>
      {command && <div className="mt-4">{command}</div>}
    </section>
  );
}
