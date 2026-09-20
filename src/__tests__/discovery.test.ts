import { expect, it } from "vitest";

import { Repository } from "../analysis/repository.js";
import { extractSource } from "../extract/index.js";
import { runMechanical, UnresolvedError } from "../reduce/mechanical.js";
import { loadRules, resolveRulesDir } from "../rules/load.js";
import { profileFor, profileIncludes, profileRules } from "../scan/profiles.js";
import { check, config } from "./helpers.js";

const unit = (file: string, text: string) =>
  extractSource(
    config(process.cwd()),
    file,
    text,
    new Repository(process.cwd())
  ).find((u) => u.kind === "source")!;
const page = (head: string, body = "") =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

it.each([
  [
    "seo-document-title",
    "index.html",
    page("", "<svg><title>Icon</title></svg>"),
    page("<title>Docs</title>"),
  ],
  [
    "seo-empty-description",
    "index.html",
    page('<meta name="description" content=" ">'),
    page('<meta name="description" content="API reference">'),
  ],
  [
    "seo-conflicting-canonicals",
    "index.html",
    page('<link rel="canonical" href="/a"><link rel="canonical" href="/b">'),
    page('<link rel="canonical" href="/a">'),
  ],
  [
    "seo-empty-canonical",
    "index.html",
    page('<link rel="canonical" href="">'),
    page('<link rel="canonical" href="/a">'),
  ],
  [
    "seo-jsonld-syntax",
    "index.html",
    page('<script type="application/ld+json">{broken}</script>'),
    page('<script type="application/ld+json">{"@type":"WebPage"}</script>'),
  ],
  [
    "seo-robots-sitemap-url",
    "robots.txt",
    "User-agent: *\nSitemap: /sitemap.xml",
    "User-agent: *\nSitemap: https://blode.co/sitemap.xml",
  ],
  ["authoring-llms-title", "llms.txt", "## Docs", "# Docs\n\n> Reference"],
  [
    "authoring-llms-links",
    "llms.txt",
    "# Docs\n\nNo links",
    "# Docs\n\n- [API](https://blode.co/api.md)",
  ],
  ["authoring-llms-size", "llms.txt", "x".repeat(50_001), "x".repeat(50_000)],
])("%s distinguishes positive and negative evidence", (id, file, bad, good) => {
  expect(check(id)(unit(file, bad)).fired).toBe(true);
  expect(check(id)(unit(file, good)).fired).toBe(false);
});

it("ignores script strings, comments and fragment metadata", () => {
  expect(
    check("seo-document-title")(
      unit(
        "index.html",
        page(
          '<title>Docs</title><script>const html = "<title>Fake</title>";</script><!-- <title>Fake</title> -->'
        )
      )
    ).fired
  ).toBe(false);
  expect(() =>
    check("seo-document-title")(unit("fragment.html", "<p>Fragment</p>"))
  ).toThrow(UnresolvedError);
  expect(
    check("seo-jsonld-syntax")(
      unit(
        "index.html",
        page("", '<script type="application/ld+json">{}</script>')
      )
    ).fired
  ).toBe(false);
});

it("keeps speculative source patterns out of default scans", () => {
  const rules = loadRules(resolveRulesDir());
  expect(
    rules.some((r) =>
      ["craft-affordance-mismatch", "craft-virtualize-large-lists"].includes(
        r.id
      )
    )
  ).toBe(false);
  const discovery = profileFor("discovery");
  expect(profileIncludes(discovery, "public/llms.txt")).toBe(true);
  expect(profileIncludes(discovery, "app/page.tsx")).toBe(false);
  expect(
    profileIncludes(discovery, "packages/supabase/templates/magic-link.html")
  ).toBe(false);
  expect(profileRules(discovery, rules)).toHaveLength(9);
});

it("checks actual motion guards and explicit reduced-motion animations", () => {
  const u = unit("page.tsx", "export const x = 1");
  const guarded = check("motion-animate-without-reduced-motion");
  expect(guarded({ ...u, classes: ["motion-safe:animate-spin"] }).fired).toBe(
    false
  );
  expect(
    guarded({ ...u, classes: ["animate-spin", "motion-reduce:bg-red-500"] })
      .fired
  ).toBe(true);
  expect(
    guarded({ ...u, classes: ["animate-spin", "motion-safe:animate-pulse"] })
      .fired
  ).toBe(true);
  expect(
    check("motion-reduced-motion-animation")({
      ...u,
      classes: ["motion-reduce:animate-spin"],
    }).fired
  ).toBe(true);
  expect(
    check("motion-reduced-motion-animation")({
      ...u,
      classes: ["motion-reduce:animate-none"],
    }).fired
  ).toBe(false);
  expect(
    check("motion-layout-property-transition")({
      ...u,
      classes: ["hover:transition-[width,opacity]"],
    }).fired
  ).toBe(true);
});

it("does not send embedded product names in ordinary sentences to the title-case judge", () => {
  const rule = loadRules(resolveRulesDir(), {
    only: ["typography-title-case-heading"],
  })[0];
  const u = unit("page.tsx", "");
  for (const text of [
    "What the Done Bear CLI does",
    "Copy the Things folder path",
    "Interpret with AI",
  ]) {
    expect(runMechanical(rule.mechanical!, { ...u, text }).fired).toBe(false);
  }
  expect(
    runMechanical(rule.mechanical!, { ...u, text: "Copy Task Number" }).fired
  ).toBe(true);
});

it("checks actual images rather than tags inside comments and strings", () => {
  const image = check("interaction-a11y-image-alt-text");
  expect(
    image(
      unit(
        "image.tsx",
        '/* <img> */ const example = "<img>"; const view = <img alt="" width={100} height={100} />;'
      )
    ).fired
  ).toBe(false);
  expect(
    image(unit("image.tsx", "const view = <img src='photo.jpg' />;")).fired
  ).toBe(true);
  expect(
    image(unit("image.html", '<!-- <img> --><img alt="" src="photo.jpg">'))
      .fired
  ).toBe(false);
  expect(() =>
    image(unit("image.tsx", "const view = <img {...props} />;"))
  ).toThrow(UnresolvedError);
  expect(
    check("craft-image-dimensions-and-priority")(
      unit(
        "image.tsx",
        "/* <img> */ const view = <img width={1200} height={630} />;"
      )
    ).fired
  ).toBe(false);
});
