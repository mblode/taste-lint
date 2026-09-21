import { ArrowRightIcon } from "blode-icons-react";
import type { Metadata } from "next";

import { InstallCommand } from "../components/install-command.js";
import { ZoneBreadcrumb } from "../components/zone-breadcrumb.js";
import { asset, siteConfig } from "../lib/config.js";
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

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(siteGraph).replaceAll("<", "\\u003c"),
        }}
        type="application/ld+json"
      />
      <header className="px-(--row-padding) pt-4">
        <ZoneBreadcrumb />
      </header>
      <main id="main-content">
        <section className="px-(--row-padding) pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="mb-8 flex items-center gap-4 sm:gap-6">
            <h1 className="text-5xl font-medium tracking-tight sm:text-7xl lg:text-8xl">
              Taste Lint
            </h1>
          </div>
          <h2 className="max-w-[30ch] text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Catch AI slop before you ship.
          </h2>
          <p className="mt-5 max-w-[56ch] text-base leading-7 text-pretty">
            A CLI for reviewing AI-generated UI, copy, typography and motion.
          </p>
          <div className="mt-8">
            <InstallCommand />
          </div>
          <a
            className="inline-flex min-h-12 items-center gap-2 underline underline-offset-4 hover:decoration-2"
            href={siteConfig.links.docs}
          >
            Read the docs <ArrowRightIcon aria-hidden="true" size={16} />
          </a>
        </section>
        <section
          aria-label="Example lint result"
          className="border-t px-(--row-padding) py-12 sm:py-16"
        >
          <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
            <pre
              aria-label="Source code example"
              tabIndex={0}
              className="min-w-0 overflow-x-auto rounded-lg border p-5 font-mono text-sm leading-7"
            >
              <code>
                {
                  '<button className="transition-all" type="button">\n  Save changes\n</button>'
                }
              </code>
            </pre>
            <div className="border-l-2 border-foreground pl-4">
              <p className="font-medium">
                transition-all animates every property, layout included
              </p>
              <p className="mt-2 max-w-[56ch] text-base leading-7">
                Name the properties: transition-transform, transition-opacity or
                transition-colors.
              </p>
            </div>
          </div>
        </section>
        <section
          aria-labelledby="checks-heading"
          className="border-t px-(--row-padding) py-12 sm:py-16"
        >
          <h2
            id="checks-heading"
            className="text-3xl font-medium tracking-tight"
          >
            What Taste Lint checks
          </h2>
          <p className="mt-5 max-w-[56ch] leading-7">
            Vague errors, empty states, generic labels, type and animation
            choices. Each finding includes source evidence and a suggested fix.
          </p>
          <a
            className="mt-6 inline-flex min-h-12 items-center underline underline-offset-4"
            href="/taste-lint/docs/usage"
          >
            See rules and examples
          </a>
        </section>
        <section
          aria-labelledby="setup-heading"
          className="border-t px-(--row-padding) py-12 sm:py-16"
        >
          <h2
            id="setup-heading"
            className="text-3xl font-medium tracking-tight"
          >
            Run your first review
          </h2>
          <p className="mt-5 max-w-[56ch] leading-7">
            Requires Node.js 24.11+. Run the install command in your project,
            then <code className="font-mono">npm run taste</code>.
          </p>
          <p className="mt-4 max-w-[56ch] leading-7">
            MIT licensed. Uncached Jev checks bill your Vercel AI Gateway key.
            Preview scope and cost with{" "}
            <code className="font-mono">--dry-run</code>.
          </p>
          <p className="mt-4 max-w-[56ch] leading-7">
            Review suggestions and test the page before applying fixes.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-8">
            <a
              className="inline-flex min-h-12 items-center underline underline-offset-4"
              href="/taste-lint/docs/quickstart"
            >
              Setup guide
            </a>
            <a
              className="inline-flex min-h-12 items-center underline underline-offset-4"
              href="/taste-lint/docs/scans"
            >
              Profiles and findings
            </a>
            <a
              className="inline-flex min-h-12 items-center underline underline-offset-4"
              href="/taste-lint/docs/page-audits"
            >
              Page audits
            </a>
          </div>
        </section>
      </main>
      <footer className="flex flex-col items-center justify-center gap-2 pt-16 pb-8 text-muted-foreground text-sm">
        <div className="flex items-center gap-1">
          Crafted by
          <a
            className="flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-1.5 transition-colors hover:text-foreground"
            href={siteConfig.links.author}
            rel="author"
          >
            <img
              alt=""
              className="rounded-full"
              height={20}
              loading="lazy"
              decoding="async"
              src={asset("/avatar-sm.png")}
              width={20}
            />
            Matthew Blode
          </a>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground/30">
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="https://blode.co/taste-training"
          >
            Taste Training
          </a>
          <span aria-hidden="true">·</span>
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="https://github.com/mblode/agent-skills"
          >
            Agent Skills
          </a>
          <span aria-hidden="true">·</span>
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="https://docs.typesafe.ai/concepts/system-one"
          >
            Jev
          </a>
          <span aria-hidden="true">·</span>
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href={siteConfig.links.github}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href={siteConfig.links.npm}
            rel="noopener noreferrer"
            target="_blank"
          >
            npm
          </a>
        </div>
      </footer>
    </>
  );
}
