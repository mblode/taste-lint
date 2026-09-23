import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { basePath } from "./lib/config.js";
import {
  buildUpstreamUrl,
  isDocsAssetPath,
  isDocsMountPath,
  PUBLIC_DOCS_BASE,
  rewriteDocsHtml,
  rewriteDocsLocation,
  rewriteDocsSitemap,
  stripZoneBasePath,
} from "./lib/docs-proxy.js";
import { homeMarkdownResponse, prefersMarkdown } from "./lib/home-markdown.js";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
]);

const toPassthroughHeaders = (
  upstream: Headers,
  { isHtml }: { isHtml: boolean }
): Headers => {
  const headers = new Headers();
  for (const [key, value] of upstream.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) {
      continue;
    }
    // Drop upstream routing breadcrumbs; they describe the tenant app, not us.
    if (lower === "x-matched-path" || lower.startsWith("x-vercel-")) {
      continue;
    }
    // Drop upstream CSP and long-lived HTML cache. Tenant policies can
    // otherwise block the rewritten asset URLs on the public host.
    if (
      lower === "content-security-policy" ||
      lower === "content-security-policy-report-only" ||
      (isHtml &&
        (lower === "age" ||
          lower === "cdn-cache-control" ||
          lower === "cache-control" ||
          lower === "expires" ||
          lower === "etag" ||
          lower === "last-modified"))
    ) {
      continue;
    }
    if (lower === "link") {
      headers.set(
        key,
        value.replaceAll(/<([^>]+)>/g, (_match, href: string) => {
          if (href.startsWith(`${basePath}/`)) {
            return `<${href}>`;
          }
          const mapped = rewriteDocsLocation(
            href,
            new URL(`https://blode.co${PUBLIC_DOCS_BASE}`)
          );
          return `<${mapped ?? href}>`;
        })
      );
      continue;
    }
    if (lower === "x-llms-txt") {
      headers.set(key, `${PUBLIC_DOCS_BASE}/llms.txt`);
      continue;
    }
    headers.set(key, value);
  }

  if (isHtml) {
    headers.set("Cache-Control", "private, no-cache, must-revalidate");
  }

  return headers;
};

const proxyDocsRequest = async (
  request: NextRequest
): Promise<Response | null> => {
  const zoneRelativePath = stripZoneBasePath(request.nextUrl.pathname);
  if (zoneRelativePath === "/docs/search") {
    return null;
  }

  if (
    !(isDocsMountPath(zoneRelativePath) || isDocsAssetPath(zoneRelativePath))
  ) {
    return null;
  }

  const upstreamUrl = buildUpstreamUrl(
    zoneRelativePath,
    request.nextUrl.search
  );

  // Give zone exports their own cache key after the canonical URL cutover.
  if (
    /\/(?:llms(?:-full)?\.txt|sitemap\.xml)$|\.mdx?$/.test(zoneRelativePath)
  ) {
    upstreamUrl.searchParams.set("zone", "taste-lint");
  }

  // Ask the tenant host for content. Do not forward blode.co as
  // X-Forwarded-Host : blodemd tenancy treats that as a custom-domain lookup
  // and 404s because blode.co is not registered on this tenant.
  const proxyHeaders = new Headers();
  for (const header of [
    "accept",
    "accept-language",
    "next-router-prefetch",
    "next-router-segment-prefetch",
    "next-router-state-tree",
    "next-url",
    "range",
    "rsc",
    "user-agent",
  ]) {
    const value = request.headers.get(header);
    if (value) {
      proxyHeaders.set(header, value);
    }
  }
  if (!proxyHeaders.has("user-agent")) {
    proxyHeaders.set("User-Agent", "taste-lint-docs-proxy/1.0");
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: proxyHeaders,
    method: request.method,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  const location = upstreamResponse.headers.get("Location");
  if (location) {
    const rewrittenLocation = rewriteDocsLocation(location, request.nextUrl);
    if (rewrittenLocation) {
      const headers = toPassthroughHeaders(upstreamResponse.headers, {
        isHtml: false,
      });
      headers.set("Location", rewrittenLocation);
      return new Response(
        request.method === "HEAD" ? null : upstreamResponse.body,
        {
          headers,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
        }
      );
    }
  }

  if (
    request.method === "HEAD" ||
    [204, 304].includes(upstreamResponse.status)
  ) {
    return new Response(null, {
      headers: toPassthroughHeaders(upstreamResponse.headers, { isHtml: true }),
      status: upstreamResponse.status,
    });
  }
  const contentType = upstreamResponse.headers.get("content-type") ?? "";
  if (
    zoneRelativePath === "/docs/sitemap.xml" &&
    upstreamResponse.ok &&
    contentType.includes("xml")
  ) {
    return new Response(rewriteDocsSitemap(await upstreamResponse.text()), {
      headers: toPassthroughHeaders(upstreamResponse.headers, { isHtml: true }),
      status: upstreamResponse.status,
    });
  }
  const isRewritable =
    contentType.includes("text/html") ||
    contentType.includes("text/x-component") ||
    contentType.includes("text/markdown") ||
    contentType.includes("text/plain");
  if (!isRewritable) {
    return new Response(upstreamResponse.body, {
      headers: toPassthroughHeaders(upstreamResponse.headers, {
        isHtml: false,
      }),
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });
  }

  const rewrittenHtml = rewriteDocsHtml(await upstreamResponse.text());
  return new Response(rewrittenHtml, {
    headers: toPassthroughHeaders(upstreamResponse.headers, { isHtml: true }),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
};

export async function proxy(request: NextRequest) {
  // An agent asking for Markdown on the zone root gets the /index.md body
  // directly, with `Vary: Accept`; a rewrite would let Next replace Vary.
  if (
    stripZoneBasePath(request.nextUrl.pathname) === "/" &&
    prefersMarkdown(request.headers.get("accept"))
  ) {
    return homeMarkdownResponse(request.method);
  }
  try {
    return (await proxyDocsRequest(request)) ?? NextResponse.next();
  } catch (error) {
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return new Response(
      "Docs are temporarily unavailable. Please refresh to try again.",
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
        status: timeout ? 504 : 502,
      }
    );
  }
}

export const config = {
  matcher: ["/", "/docs", "/docs/:path*", "/_docs/:path*"],
};
