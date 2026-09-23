import type { Metadata } from "next";

import { CtaClose } from "../components/marketing/cta-close.js";
import { MarketingHero } from "../components/marketing/marketing-hero.js";
import { ProofStats } from "../components/marketing/proof-stats.js";
import { BeforeAfter } from "../components/playground/before-after.js";
import { CopyPlayground } from "../components/playground/copy-playground.js";
import { RuleList } from "../components/rule-list.js";
import { SectionViews } from "../components/section-views.js";
import { SiteFaq, SiteInstallCommand } from "../components/site-actions.js";
import { TrackedCta } from "../components/tracked-cta.js";
import { ZoneBreadcrumb } from "../components/zone-breadcrumb.js";
import { asset, siteConfig } from "../lib/config.js";
import { FAQ_ITEMS } from "../lib/faq.js";
import { HOME_COPY } from "../lib/home-copy.js";
import {
  fetchGithubStars,
  fetchNpmWeeklyDownloads,
} from "../lib/live-stats.js";
import { RULES } from "../lib/rules.js";
import { siteGraph } from "../lib/schema.js";

export const metadata: Metadata = {
  alternates: { canonical: siteConfig.url },
  openGraph: {
    description: siteConfig.description,
    siteName: siteConfig.author.name,
    title: siteConfig.title,
    type: "website",
    url: siteConfig.url,
  },
};

// The landing sections with ids, in page order. Each sends section_viewed
// once per page view.
const TRACKED_SECTIONS = ["try", "rules", "faq"] as const;

const linkClass =
  "inline-flex min-h-12 items-center underline underline-offset-4 hover:decoration-2";

export default async function Home() {
  const [downloads, stars] = await Promise.all([
    fetchNpmWeeklyDownloads("taste-lint"),
    fetchGithubStars("mblode/taste-lint"),
  ]);
  const proof = [
    {
      href: siteConfig.links.npm,
      label: "npm downloads last week",
      value: downloads,
    },
    { href: siteConfig.links.github, label: "GitHub stars", value: stars },
  ];
  const hasProof = proof.some((stat) => stat.value !== null);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(siteGraph).replaceAll("<", "\\u003c"),
        }}
        type="application/ld+json"
      />
      <header className="px-(--row-padding) pt-2 sm:pt-4">
        <ZoneBreadcrumb />
      </header>
      <main id="main-content">
        <MarketingHero
          action={<SiteInstallCommand />}
          description={HOME_COPY.hero.description}
          eyebrow={HOME_COPY.hero.eyebrow}
          secondary={
            <TrackedCta
              className={linkClass}
              href={siteConfig.links.docs}
              label={HOME_COPY.setupLabel}
              location="hero"
            />
          }
          title={HOME_COPY.hero.title}
        />

        <section
          aria-labelledby="try-heading"
          className="border-t px-(--row-padding) py-12 sm:py-20"
          id="try"
        >
          <h2
            className="text-3xl font-medium tracking-tight sm:text-4xl"
            id="try-heading"
          >
            {HOME_COPY.try.heading}
          </h2>
          <p className="mt-4 mb-8 max-w-[60ch] leading-7 text-pretty">
            {HOME_COPY.try.body}
          </p>
          <CopyPlayground totalRules={RULES.total} />
          <BeforeAfter />
        </section>

        <section
          aria-labelledby="rules-heading"
          className="border-t px-(--row-padding) py-12 sm:py-20"
          id="rules"
        >
          <h2
            className="max-w-[24ch] text-3xl font-medium tracking-tight text-balance sm:text-4xl"
            id="rules-heading"
          >
            {HOME_COPY.rules.heading}
          </h2>
          <p className="mt-4 max-w-[60ch] leading-7 text-pretty">
            {HOME_COPY.rules.body}
          </p>
          <a
            className={linkClass}
            href={`${siteConfig.links.docs}${HOME_COPY.rules.promotePath}`}
          >
            {HOME_COPY.rules.promoteLabel}
          </a>
          <div className="mt-8">
            <RuleList />
          </div>
        </section>

        {hasProof && (
          <section
            aria-labelledby="proof-heading"
            className="border-t px-(--row-padding) py-12 sm:py-16"
          >
            <h2
              className="mb-6 text-sm text-muted-foreground"
              id="proof-heading"
            >
              {HOME_COPY.proof.heading}
            </h2>
            <ProofStats stats={proof} />
          </section>
        )}

        <section
          aria-labelledby="faq-heading"
          className="border-t px-(--row-padding) py-12 sm:py-20"
          id="faq"
        >
          <h2
            className="mb-8 text-3xl font-medium tracking-tight sm:text-4xl"
            id="faq-heading"
          >
            {HOME_COPY.faq.heading}
          </h2>
          <SiteFaq items={FAQ_ITEMS} />
        </section>

        <CtaClose
          action={<SiteInstallCommand />}
          command={
            <TrackedCta
              className={linkClass}
              href={siteConfig.links.docs}
              label={HOME_COPY.setupLabel}
              location="cta-close"
            />
          }
          description={HOME_COPY.close.description}
          title={HOME_COPY.close.title}
        />
      </main>
      <SectionViews ids={TRACKED_SECTIONS} />
      <footer className="flex flex-col items-center justify-center gap-2 px-(--row-padding) pt-16 pb-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          Crafted by
          <a
            className="flex min-h-12 items-center gap-2 rounded-full py-1.5 ps-1.5 pe-2.5 transition-colors hover:text-foreground"
            href={siteConfig.links.author}
            rel="author"
          >
            <img
              alt=""
              className="rounded-full"
              decoding="async"
              height={20}
              loading="lazy"
              src={asset("/avatar-sm.png")}
              width={20}
            />
            Matthew Blode
          </a>
        </div>
        <nav aria-label="Related projects">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 text-muted-foreground/30">
            {[
              {
                href: "https://blode.co/taste-training",
                label: "Taste Training",
              },
              {
                href: "https://github.com/mblode/agent-skills",
                label: "Agent Skills",
              },
              { href: siteConfig.links.github, label: "GitHub" },
              { href: siteConfig.links.npm, label: "npm" },
            ].map((link, index) => (
              <li className="flex items-center gap-3" key={link.label}>
                {index > 0 && <span aria-hidden="true">·</span>}
                <a
                  className="inline-flex min-h-12 items-center text-muted-foreground transition-colors hover:text-foreground"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </>
  );
}
