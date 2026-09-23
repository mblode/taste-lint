import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server.js";

import { GET as indexMd } from "../app/index.md/route.js";
import { GET as llms } from "../app/llms.txt/route.js";
import { proxy } from "../proxy.js";
import docsPages from "./docs-pages.generated.json" with { type: "json" };
import { FAQ_ITEMS } from "./faq.js";
import { HOME_COPY } from "./home-copy.js";
import { homeMarkdown, prefersMarkdown } from "./home-markdown.js";

test("the Markdown mirror carries the H1 and every FAQ question", () => {
  const markdown = homeMarkdown();
  assert.ok(markdown.startsWith(`# ${HOME_COPY.hero.title}\n`));
  for (const { answer, question } of FAQ_ITEMS) {
    assert.ok(markdown.includes(`### ${question}\n\n${answer}`), question);
  }
});

test("/index.md serves the mirror as Markdown", async () => {
  const response = indexMd();
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8"
  );
  assert.equal(await response.text(), homeMarkdown());
});

const rootRequest = (accept: string) =>
  new NextRequest("https://blode.co/taste-lint", { headers: { accept } });

test("the zone root negotiates Markdown and leaves browsers on HTML", async () => {
  const agent = await proxy(rootRequest("text/markdown"));
  assert.equal(agent.headers.get("vary"), "Accept");
  assert.equal(await agent.text(), homeMarkdown());

  const browser = await proxy(
    rootRequest("text/html,application/xhtml+xml,*/*;q=0.8")
  );
  assert.equal(browser.headers.get("x-middleware-next"), "1");

  assert.equal(prefersMarkdown("text/markdown;q=0.5, text/html"), false);
  assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
  assert.equal(prefersMarkdown(null), false);
});

test("llms.txt lists the home page and every docs page with its description", async () => {
  const text = await llms().text();
  assert.ok(text.includes("(https://blode.co/taste-lint): "));
  assert.ok(text.includes("https://blode.co/taste-lint/index.md"));
  assert.ok(docsPages.length > 0);
  for (const page of docsPages) {
    assert.ok(
      text.includes(
        `- [${page.title}](https://blode.co/taste-lint/docs${page.path}): ${page.description}`
      ),
      page.title
    );
  }
  assert.ok(text.includes("https://blode.co/taste-lint/docs/llms.txt"));
});
