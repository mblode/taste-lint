import type { HtmlElement } from "../../analysis/html.js";
import { descendants } from "../../analysis/repository.js";
import { none, UnresolvedError } from "../../reduce/mechanical.js";
import type { MechanicalHit, Unit } from "../../types.js";
import { codeRule } from "./rule.js";

const at = (evidence: string, offset = 0): MechanicalHit => ({
  evidence,
  fired: true,
  offset,
});
const html = (u: Unit): HtmlElement[] => {
  if (!u.facts?.html || !/<!doctype\s+html\b|<html(?:\s|>)/i.test(u.text)) {
    throw new UnresolvedError(
      "Needs a complete HTML document; framework metadata and fragments require rendered evidence"
    );
  }
  return u.facts.html;
};
const make = (
  id: string,
  title: string,
  include: string[],
  source: string,
  check: (u: Unit) => MechanicalHit,
  hint: string
) =>
  codeRule(
    {
      categoryId: id.startsWith("seo-")
        ? "search-discovery"
        : "instruction-quality",
      check,
      hint,
      id,
      scope: {
        exclude: ["**/supabase/templates/**", "**/emails/**", "**/email/**"],
        include,
      },
      source: {
        line: 1,
        path: `skills/${source}`,
        repo: "mblode/agent-skills",
      },
      status: "review-only",
      title,
      unit: ["source"],
    },
    "src/rules/code/discovery.ts"
  );
const HTML = ["**/*.html", "**/*.htm"];
const SEO = "seo/references/audit.md";
const LLM = "agent-ready/references/docs-afdocs.md";
const canonical = (u: Unit) =>
  html(u).filter(
    (n) =>
      n.inHead &&
      n.tag === "link" &&
      n.attrs.rel?.toLowerCase().split(/\s+/).includes("canonical")
  );

export const DISCOVERY_RULES = [
  make(
    "seo-document-title",
    "HTML document needs one nonempty title",
    HTML,
    SEO,
    (u) => {
      const titles = html(u).filter((n) => n.inHead && n.tag === "title");
      return titles.length !== 1 || !titles[0].text.trim()
        ? at(
            `Found ${titles.length} HTML head titles${titles.length === 1 ? "; title is empty" : ""}`,
            titles[0]?.offset
          )
        : none;
    },
    "Provide one meaningful title in the HTML head. SVG titles do not name the page."
  ),
  make(
    "seo-empty-description",
    "Declared meta description is empty",
    HTML,
    SEO,
    (u) => {
      const empty = html(u).find(
        (n) =>
          n.inHead &&
          n.tag === "meta" &&
          n.attrs.name?.toLowerCase() === "description" &&
          !n.attrs.content?.trim()
      );
      return empty ? at("Empty meta description", empty.offset) : none;
    },
    "Write a page-specific description, or omit a deliberately unspecified description."
  ),
  make(
    "seo-conflicting-canonicals",
    "HTML declares conflicting canonical destinations",
    HTML,
    SEO,
    (u) => {
      const links = canonical(u);
      return new Set(links.map((n) => n.attrs.href?.trim()).filter(Boolean))
        .size > 1
        ? at("Multiple distinct canonical destinations", links[1].offset)
        : none;
    },
    "Declare a single intended canonical destination; verify the deployed URL and HTTP headers."
  ),
  make(
    "seo-empty-canonical",
    "Canonical link has no destination",
    HTML,
    SEO,
    (u) => {
      const empty = canonical(u).find((n) => !n.attrs.href?.trim());
      return empty
        ? at("Canonical link has an empty or missing href", empty.offset)
        : none;
    },
    "Set the intended canonical URL or remove an unintended canonical declaration."
  ),
  make(
    "seo-jsonld-syntax",
    "JSON-LD script is not valid JSON",
    HTML,
    SEO,
    (u) => {
      for (const node of html(u).filter(
        (n) =>
          n.tag === "script" &&
          n.attrs.type?.trim().toLowerCase() === "application/ld+json"
      )) {
        try {
          JSON.parse(node.text);
        } catch {
          return at("JSON-LD cannot be parsed as JSON", node.offset);
        }
      }
      return none;
    },
    "Fix the JSON syntax. Valid JSON alone does not establish schema validity or rich-result eligibility."
  ),
  make(
    "seo-robots-sitemap-url",
    "Robots sitemap directive needs an absolute HTTP URL",
    ["**/robots.txt"],
    "seo/references/indexing-policy.md",
    (u) => {
      for (const match of u.text.matchAll(/^\s*sitemap\s*:\s*([^\r\n]*)/gim)) {
        const value = match[1].split("#")[0].trim();
        try {
          const url = new URL(value);
          if (
            ["http:", "https:"].includes(url.protocol) &&
            url.hostname &&
            !/\s/.test(value)
          ) {
            continue;
          }
        } catch {
          /* Report malformed declarations, not absent optional ones. */
        }
        return at(
          "Sitemap directive is not an absolute HTTP(S) URL",
          match.index
        );
      }
      return none;
    },
    "Use the deployed sitemap's absolute URL. Fetch it separately to verify status and content."
  ),
  make(
    "authoring-llms-title",
    "Agent index must start with an H1",
    ["**/llms.txt"],
    LLM,
    (u) => {
      const document = u.facts?.document;
      if (!document) {
        throw new UnresolvedError("Markdown structure unavailable");
      }
      const first = document.children?.[0];
      return first?.type === "heading" && first.depth === 1
        ? none
        : at("llms.txt does not begin with an H1");
    },
    "Start llms.txt with the site's name as an H1, then describe and link its real documentation."
  ),
  make(
    "authoring-llms-links",
    "Agent index has no documentation links",
    ["**/llms.txt"],
    LLM,
    (u) => {
      if (!u.facts?.document) {
        throw new UnresolvedError("Markdown structure unavailable");
      }
      const nodes = descendants(u.facts.document);
      return nodes.some(
        (n) => ["link", "definition"].includes(n.type) && n.url?.trim()
      )
        ? none
        : at("No Markdown link destinations in llms.txt");
    },
    "Link the existing documentation pages that an agent should read."
  ),
  make(
    "authoring-llms-size",
    "Agent index exceeds the recommended character budget",
    ["**/llms.txt"],
    LLM,
    (u) => {
      const count = [...u.text].length;
      return count > 50_000
        ? at(
            `llms.txt contains ${count} characters; recommended maximum is 50000`
          )
        : none;
    },
    "Keep the index small and link separate documents or nested indexes."
  ),
];
