// Search visibility in Next.js App Router source: pages with no metadata of
// their own, a root layout without metadataBase, and no sitemap or robots.
// From the seo skill.

import path from "node:path";

import { hit, none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { skillSource } from "./engineering-shared.js";
import { codeRule } from "./rule.js";

const MODULE = "src/rules/code/seo.ts";

// Next.js App Router pages and layouts.
const METADATA =
  /\bexport\s+(?:const|let|var)\s+metadata\b|\bexport\s+(?:async\s+)?function\s+generateMetadata\b|\bexport\s+const\s+generateMetadata\b|\bexport\s*\{[^}]*\b(?:metadata|generateMetadata)\b[^}]*\}/u;
const PAGE = /(?:^|\/)app\/(?:.*\/)?page\.[jt]sx?$/u;
const LAYOUT_NAMES = ["layout.tsx", "layout.jsx", "layout.ts", "layout.js"];
// A segment that is not a public page: private folders, API-like segments
// and the usual signed-in shells.
const NOT_PUBLIC =
  /\/(?:_[^/]+|api|admin|dashboard|settings|account|studio|internal|preview|draft)\//u;

export const pageWithoutMetadata = (unit: Unit): MechanicalHit => {
  if (!PAGE.test(unit.file) || NOT_PUBLIC.test(`/${unit.file}`)) {
    return none;
  }
  if (METADATA.test(unit.text)) {
    return none;
  }
  // A page that only redirects or 404s renders nothing to index.
  if (
    /\b(?:redirect|permanentRedirect|notFound)\s*\(/u.test(unit.text) &&
    unit.text.split("\n").length < 40
  ) {
    return none;
  }
  const repository = unit.facts?.repository;
  if (!repository) {
    throw new UnresolvedError(
      "Needs the repository to read the segment layout"
    );
  }
  const dir = path.posix.dirname(unit.file);
  const layout = LAYOUT_NAMES.map((name) =>
    repository.read(`${dir}/${name}`)
  ).find((text) => text !== undefined);
  if (layout && METADATA.test(layout)) {
    return none;
  }
  return {
    ...hit("neither the page nor its segment layout exports metadata"),
    offset: 0,
  };
};

const ROOT_LAYOUT = /(?:^|\/)app\/layout\.[jt]sx?$/u;

export const noMetadataBase = (unit: Unit): MechanicalHit => {
  if (!ROOT_LAYOUT.test(unit.file) || !METADATA.test(unit.text)) {
    return none;
  }
  if (/\bmetadataBase\b/u.test(unit.text)) {
    return none;
  }
  const relative = /\b(?:openGraph|twitter|alternates|canonical)\b/u.exec(
    unit.text
  );
  return relative
    ? {
        ...hit(`metadata sets ${relative[0]} with no metadataBase`),
        offset: relative.index,
      }
    : none;
};

export const missingCrawlFiles = (unit: Unit): MechanicalHit => {
  if (!ROOT_LAYOUT.test(unit.file)) {
    return none;
  }
  const repository = unit.facts?.repository;
  if (!repository) {
    throw new UnresolvedError(
      "Needs the repository to look for sitemap and robots"
    );
  }
  const app = path.posix.dirname(unit.file);
  const pkg = path.posix.dirname(
    app.endsWith("/src/app") || app === "src/app"
      ? path.posix.dirname(app)
      : app
  );
  const base = pkg === "." ? "" : `${pkg}/`;
  const has = (names: string[]): boolean =>
    names.some((name) => repository.exists(name));
  const missing: string[] = [];
  if (
    !has([
      ...["ts", "js", "xml"].map((ext) => `${app}/sitemap.${ext}`),
      `${base}public/sitemap.xml`,
      `${base}next-sitemap.config.js`,
      `${base}next-sitemap.config.cjs`,
      `${base}next-sitemap.config.mjs`,
    ])
  ) {
    missing.push("sitemap");
  }
  if (
    !has([
      ...["ts", "js", "txt"].map((ext) => `${app}/robots.${ext}`),
      `${base}public/robots.txt`,
    ])
  ) {
    missing.push("robots");
  }
  return missing.length
    ? { ...hit(`no ${missing.join(" or ")} for this app`), offset: 0 }
    : none;
};

export const SEO_RULES = [
  codeRule(
    {
      categoryId: "search-visibility",
      check: pageWithoutMetadata,
      hint: "Export metadata (or generateMetadata for a dynamic route) with a title and description for this page. Without it the page inherits its parent's title, and search shows the same title for different pages.",
      id: "seo-page-missing-metadata",
      preconditions: { notGenerated: true },
      scope: { include: ["**/app/**/page.{tsx,jsx,ts,js}"] },
      source: skillSource("skills/seo/references/audit.md", 12),
      status: "review-only",
      title: "Page inherits its parent's title and description",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "search-visibility",
      check: noMetadataBase,
      hint: "Set metadataBase to the production origin in the root layout, so canonical and Open Graph URLs resolve to absolute URLs on the right host.",
      id: "seo-missing-metadata-base",
      preconditions: { notGenerated: true },
      scope: { include: ["**/app/layout.{tsx,jsx,ts,js}"] },
      source: skillSource("skills/seo/references/nextjs-implementation.md", 7),
      status: "review-only",
      title: "Root metadata has URLs but no metadataBase",
      unit: ["source"],
    },
    MODULE
  ),
  codeRule(
    {
      categoryId: "search-visibility",
      check: missingCrawlFiles,
      hint: "Add app/sitemap.ts from the public route inventory and app/robots.ts that points at it. Skip this for an app that is never public.",
      id: "seo-missing-crawl-files",
      preconditions: { notGenerated: true },
      scope: { include: ["**/app/layout.{tsx,jsx,ts,js}"] },
      source: skillSource("skills/seo/references/nextjs-implementation.md", 16),
      status: "review-only",
      title: "App has no sitemap or robots file",
      unit: ["source"],
    },
    MODULE
  ),
];
