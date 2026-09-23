import { BEFORE_AFTER } from "../fixtures/playground-samples.js";
import { siteConfig } from "./config.js";
import { FAQ_ITEMS } from "./faq.js";
import { HOME_COPY } from "./home-copy.js";
import { INSTALL_COMMANDS } from "./install.js";
import { lintCopy } from "./playground.js";
import { DOMAIN_LABELS, RULES } from "./rules.js";

// The home page as Markdown for agents, served at /index.md and for
// `Accept: text/markdown` on the zone root. Built from the constants the page
// renders (lib/home-copy.ts, lib/faq.ts, lib/install.ts, the rule snapshot),
// so the two cannot drift. The live npm and GitHub counts are left out: they
// are fetched per request and are not part of the page's argument.

export const HOME_MARKDOWN_PATH = "/index.md";

const docsUrl = `${siteConfig.url}/docs`;

const beforeAfter = (): string[] => {
  const before = lintCopy(BEFORE_AFTER.before);
  const after = lintCopy(BEFORE_AFTER.after);
  const [first] = before;
  if (!first) {
    return [];
  }
  return [
    `Before: \`${BEFORE_AFTER.before}\``,
    "",
    ...before.map(
      (finding) => `- \`${finding.rule.id}\`: ${finding.rule.title}`
    ),
    "",
    `After: \`${BEFORE_AFTER.after}\`. ${after.length === 0 ? "No findings." : `${after.length} finding${after.length === 1 ? "" : "s"}.`} ${first.rule.fix}`,
    "",
  ];
};

export const homeMarkdown = (): string => {
  const [human, ...others] = INSTALL_COMMANDS;
  const lines = [
    `# ${HOME_COPY.hero.title}`,
    "",
    `> ${siteConfig.description}`,
    "",
    HOME_COPY.hero.description,
    "",
    "```bash",
    human?.command ?? "",
    "```",
    "",
    ...others.map((item) => `${item.label}: \`${item.command}\``),
    "",
    `[${HOME_COPY.setupLabel}](${docsUrl})`,
    "",
    `## ${HOME_COPY.try.heading}`,
    "",
    HOME_COPY.try.body,
    "",
    `The playground runs in the browser at ${siteConfig.url}#try; this is the worked example below it.`,
    "",
    ...beforeAfter(),
    `## ${HOME_COPY.rules.heading}`,
    "",
    HOME_COPY.rules.body,
    "",
    ...RULES.domains.map(
      ({ domain, rules }) =>
        `- ${DOMAIN_LABELS[domain] ?? domain}: ${rules.length} rule${rules.length === 1 ? "" : "s"}`
    ),
    "",
    `[${HOME_COPY.rules.promoteLabel}](${docsUrl}${HOME_COPY.rules.promotePath})`,
    "",
    `## ${HOME_COPY.faq.heading}`,
    "",
    ...FAQ_ITEMS.flatMap((item) => [
      `### ${item.question}`,
      "",
      item.answer,
      "",
    ]),
    `## ${HOME_COPY.close.title}`,
    "",
    HOME_COPY.close.description,
    "",
    `- [Documentation](${docsUrl})`,
    `- [Documentation index for agents](${siteConfig.url}/llms.txt)`,
    `- [GitHub](${siteConfig.links.github})`,
    `- [npm](${siteConfig.links.npm})`,
    "",
  ];
  return lines.join("\n");
};

// True when the client ranks text/markdown at least as high as HTML. Browsers
// send `text/html` first and `*/*;q=0.8`, so they keep getting the page.
export const prefersMarkdown = (accept: string | null): boolean => {
  if (!accept) {
    return false;
  }
  const entries = accept.split(",").map((part) => {
    const [raw, ...params] = part.trim().split(";");
    const q = params
      .map((param) => param.trim())
      .find((param) => param.toLowerCase().startsWith("q="));
    const quality = q ? Number(q.slice(2)) : 1;
    return {
      q: Number.isFinite(quality) ? quality : 0,
      type: (raw ?? "").trim().toLowerCase(),
    };
  });
  const markdown = entries.find((entry) => entry.type === "text/markdown");
  if (!markdown || markdown.q <= 0) {
    return false;
  }
  const html = entries.find(
    (entry) => entry.type === "text/html" || entry.type === "*/*"
  );
  return !html || markdown.q >= html.q;
};

export const homeMarkdownResponse = (method = "GET"): Response =>
  new Response(method === "HEAD" ? null : homeMarkdown(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${siteConfig.url}>; rel="canonical"`,
      Vary: "Accept",
      "X-Robots-Tag": "noindex",
    },
  });
