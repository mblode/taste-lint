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
            <a
              className="font-medium underline underline-offset-4 hover:decoration-2"
              href="https://docs.typesafe.ai/concepts/system-one"
            >
              Jev by TypeSafe AI
            </a>{" "}
            checks your UI, copy, and agent instructions in context. Catch
            canned phrasing and vague praise, with a probability for each AI
            finding.
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
              alt="Avatar of Matthew Blode"
              className="rounded-full"
              height={20}
              src={asset("/avatar-sm.png")}
              width={20}
            />
            Matthew Blode
          </a>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground/30">
          <a
            className="text-muted-foreground transition-colors hover:text-foreground"
            href="https://blode.co/projects"
          >
            All projects
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
