import { siteConfig } from "./config.js";
import docsPages from "./docs-pages.generated.json" with { type: "json" };
import { HOME_MARKDOWN_PATH } from "./home-markdown.js";

/**
 * The zone's own llms.txt at /taste-lint/llms.txt: the home page and every
 * docs page, each with the description its own metadata carries (the layout's
 * `siteConfig.description` for the home page, MDX frontmatter for the docs,
 * snapshotted by scripts/generate-rules.mjs).
 *
 * Not the same file as /taste-lint/docs/llms.txt, which the docs platform
 * serves through proxy.ts and which indexes the documentation alone. Both
 * stay; this one links to the other.
 */
export const llmsTxt = (): string => {
  const docsUrl = `${siteConfig.url}/docs`;
  const docs = docsPages.map(
    (page) => `- [${page.title}](${docsUrl}${page.path}): ${page.description}`
  );
  return `# ${siteConfig.name}

> ${siteConfig.description}

Taste Lint is an MIT-licensed CLI on npm as \`taste-lint\`. Mechanical checks
run without a key; judgement calls go to Jev, which answers with a probability.

## Pages

- [${siteConfig.title}](${siteConfig.url}): ${siteConfig.description} Markdown: ${siteConfig.url}${HOME_MARKDOWN_PATH}

## Documentation

${docs.join("\n")}

## Optional

- [Documentation llms.txt](${docsUrl}/llms.txt): the docs site's own index.
- [Documentation llms-full.txt](${docsUrl}/llms-full.txt): every docs page in one file.
- [GitHub](${siteConfig.links.github})
- [npm](${siteConfig.links.npm})
`;
};
