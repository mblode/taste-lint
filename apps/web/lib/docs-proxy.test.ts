import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { NextRequest } from "next/server.js";

import { proxy } from "../proxy.js";
import {
  buildUpstreamUrl,
  rewriteDocsHtml,
  rewriteDocsLocation,
  rewriteDocsSitemap,
  stripZoneBasePath,
} from "./docs-proxy.js";

const publicRoot = "https://blode.co/taste-lint/docs";

test("maps docs, queries and assets without losing the tenant", () => {
  assert.equal(
    stripZoneBasePath("/taste-lint/docs/quickstart"),
    "/docs/quickstart"
  );
  assert.equal(
    buildUpstreamUrl("/docs", "").href,
    "https://taste-lint.blode.md/"
  );
  assert.equal(
    buildUpstreamUrl("/docs/quickstart", "?ref=example").href,
    "https://taste-lint.blode.md/quickstart?ref=example"
  );
  assert.equal(
    buildUpstreamUrl("/_docs/_next/a.js", "").pathname,
    "/_docs/_next/a.js"
  );
});

test("rewrites every navigation page in HTML and RSC, preserving external links", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../../docs/docs.json", import.meta.url), "utf-8")
  );
  for (const { pages } of config.navigation.groups) {
    for (const page of pages) {
      const target =
        page === "index" ? "/taste-lint/docs" : `/taste-lint/docs/${page}`;
      assert.equal(
        rewriteDocsHtml(`<a href="/${page}">Page</a>`),
        `<a href="${target}">Page</a>`
      );
      assert.equal(
        rewriteDocsHtml(JSON.stringify({ href: `/${page}` })),
        JSON.stringify({ href: target })
      );
    }
  }
  const external = '<a href="https://example.com/quickstart">External</a>';
  assert.equal(rewriteDocsHtml(external), external);
  assert.match(
    rewriteDocsHtml('<script src="/_docs/_next/a.js"></script>'),
    /src="\/taste-lint\/_docs\/_next\/a.js"/
  );
  assert.match(
    rewriteDocsHtml("https://taste-lint.blode.md/quickstart.md"),
    /https:\/\/blode.co\/taste-lint\/docs\/quickstart.md/
  );
});

test("canonicalizes redirects, including relative redirects, once", () => {
  const request = new URL(`${publicRoot}/quickstart`);
  assert.equal(rewriteDocsLocation("/index", request), publicRoot);
  assert.equal(
    rewriteDocsLocation("usage?ref=docs#scan", request),
    `${publicRoot}/usage?ref=docs#scan`
  );
  assert.equal(
    rewriteDocsLocation(`${publicRoot}/usage`, request),
    `${publicRoot}/usage`
  );
  assert.equal(rewriteDocsLocation("https://example.com/login", request), null);
});

test("deduplicates the entry page and adds zone share metadata", () => {
  const xml = `<urlset><url><loc>${publicRoot}</loc></url><url><loc>${publicRoot}/index</loc></url></urlset>`;
  assert.equal(
    rewriteDocsSitemap(xml),
    `<urlset><url><loc>${publicRoot}</loc></url></urlset>`
  );
  const html = rewriteDocsHtml(
    '<head><meta property="og:site_name" content="Taste Lint"/></head>'
  );
  assert.match(html, /content="Matthew Blode"/);
  assert.match(html, /name="twitter:creator"/);
  assert.match(html, /https:\/\/blode.co\/taste-lint\/opengraph-image/);
});

const request = (path = "/docs/missing", method = "GET") =>
  new NextRequest(`https://blode.co/taste-lint${path}`, { method });

test("proxy preserves 404, binary and HEAD responses and sanitizes failures", async (t) => {
  const mocked = t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response("Not found", { status: 404 }))
  );
  const missing = await proxy(request());
  assert.equal(missing.status, 404);
  mocked.mock.mockImplementation(() =>
    Promise.resolve(
      new Response(new Uint8Array([0, 1, 255]), {
        headers: { "Content-Type": "application/octet-stream" },
      })
    )
  );
  const binary = await proxy(request("/_docs/a.woff2"));
  assert.deepEqual(
    new Uint8Array(await binary.arrayBuffer()),
    new Uint8Array([0, 1, 255])
  );
  const head = await proxy(request("/docs", "HEAD"));
  assert.equal(await head.text(), "");
  mocked.mock.mockImplementation(() =>
    Promise.resolve(
      new Response(null, {
        headers: { Location: "https://taste-lint.blode.md/quickstart" },
        status: 307,
      })
    )
  );
  const redirect = await proxy(request("/docs", "HEAD"));
  assert.equal(redirect.headers.get("location"), `${publicRoot}/quickstart`);
  assert.equal(redirect.status, 307);
  mocked.mock.mockImplementation(() =>
    Promise.reject(new Error("private provider body"))
  );
  const failed = await proxy(request());
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(await failed.text(), /private provider/);
  mocked.mock.mockImplementation(() =>
    Promise.reject(new DOMException("timed out", "TimeoutError"))
  );
  const timedOut = await proxy(request());
  assert.equal(timedOut.status, 504);
});

test("keeps serialized React children valid when a Blob preconnect is present", () => {
  const flight = JSON.stringify([
    "$",
    "head",
    null,
    {
      children: [
        [
          "$",
          "link",
          null,
          { href: "https://public.blob.vercel-storage.com", rel: "preconnect" },
        ],
        ["$", "a", null, { href: "/quickstart" }],
      ],
    },
  ]);
  assert.doesNotThrow(() => JSON.parse(rewriteDocsHtml(flight)));
  assert.match(
    rewriteDocsHtml("<head></head>"),
    /TURBOPACK_CHUNK_BASE_PATH="\/taste-lint\/_docs\/_next\/"/
  );
});

test("maps discovery headers to the public docs mount", async (t) => {
  t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      new Response("<head></head>", {
        headers: {
          "Content-Type": "text/html",
          Link: '</quickstart.md>; rel="alternate", </.well-known/skills/index.json>; rel="index", </_docs/_next/font.woff2>; rel="preload", <https://example.com/help>; rel="help"',
          "X-Llms-Txt": "/llms.txt",
        },
      })
    )
  );
  const response = await proxy(request("/docs/quickstart"));
  const links = response.headers.get("link") ?? "";
  assert.ok(links.includes(`<${publicRoot}/quickstart.md>`));
  assert.ok(links.includes(`<${publicRoot}/.well-known/skills/index.json>`));
  assert.ok(
    links.includes("<https://blode.co/taste-lint/_docs/_next/font.woff2>")
  );
  assert.ok(links.includes("<https://example.com/help>"));
  assert.equal(response.headers.get("x-llms-txt"), "/taste-lint/docs/llms.txt");
});
