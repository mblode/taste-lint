import docsConfig from "../../../docs/docs.json" with { type: "json" };
import { basePath } from "./config.js";

/** Upstream docs host (blode.md tenant). */
const DOCS_UPSTREAM_HOST = "taste-lint.blode.md";

/** Public docs mount on the blode.co zone. */
const DOCS_PREFIX = "/docs";
export const PUBLIC_DOCS_BASE = `${basePath}${DOCS_PREFIX}`;
export const PUBLIC_ASSET_PREFIX = `${basePath}/_docs`;

/**
 * Root-level docs page paths as emitted by the upstream host (no /docs prefix).
 * Read from the published docs navigation.
 */
const DOCS_PAGE_PATHS = docsConfig.navigation.groups.flatMap((group) =>
  group.pages.map((page) => `/${page}`)
);

/** Root utility files the docs HTML references without a /docs prefix. */
const DOCS_ROOT_FILES = [
  "/llms.txt",
  "/llms-full.txt",
  "/favicon.ico",
  "/manifest.json",
  "/icon0.svg",
  "/icon1.png",
  "/apple-icon.png",
] as const;

const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

const escapeRegExp = (value: string): string =>
  value.replace(REGEXP_SPECIAL_CHARS, "\\$&");

export const isDocsMountPath = (pathname: string): boolean =>
  pathname === DOCS_PREFIX || pathname.startsWith(`${DOCS_PREFIX}/`);

export const isDocsAssetPath = (pathname: string): boolean =>
  pathname.startsWith("/_docs/");

/**
 * Strip the zone basePath when present so matchers can use /docs and /_docs.
 */
export const stripZoneBasePath = (pathname: string): string => {
  if (pathname === basePath) {
    return "/";
  }
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }
  return pathname;
};

/**
 * Map a public zone docs path (/docs/...) to the upstream tenant path.
 * Upstream pages live at the tenant root; /docs is only the public mount.
 */
export const toUpstreamPath = (zoneRelativePath: string): string => {
  if (isDocsAssetPath(zoneRelativePath)) {
    return zoneRelativePath;
  }

  if (!isDocsMountPath(zoneRelativePath)) {
    return zoneRelativePath;
  }

  const remainder = zoneRelativePath.slice(DOCS_PREFIX.length);
  return remainder === "" ? "/" : remainder;
};

const toPublicDocsPath = (upstreamPath: string): string => {
  if (
    upstreamPath === "/" ||
    upstreamPath === "" ||
    upstreamPath === "/index" ||
    upstreamPath === "/docs/index"
  ) {
    return PUBLIC_DOCS_BASE;
  }
  if (isDocsAssetPath(upstreamPath)) {
    return `${basePath}${upstreamPath}`;
  }
  if (isDocsMountPath(upstreamPath)) {
    return `${basePath}${upstreamPath}`;
  }
  return `${PUBLIC_DOCS_BASE}${upstreamPath}`;
};

/** Map a path from an absolute upstream URL onto the public zone docs URL path. */
const publicPathFromUpstreamAbsolute = (path: string): string => {
  if (
    path === "" ||
    path === "/" ||
    path === "/index" ||
    path === "/docs/index"
  ) {
    return PUBLIC_DOCS_BASE;
  }
  if (isDocsAssetPath(path)) {
    return `${basePath}${path}`;
  }
  if (isDocsMountPath(path)) {
    return `${basePath}${path}`;
  }
  return `${PUBLIC_DOCS_BASE}${path}`;
};

export const rewriteDocsLocation = (
  location: string,
  requestUrl: URL
): string | null => {
  let resolvedLocation: URL;

  try {
    resolvedLocation = new URL(
      location,
      buildUpstreamUrl(
        stripZoneBasePath(requestUrl.pathname),
        requestUrl.search
      )
    );
  } catch {
    return null;
  }

  const isUpstreamRedirect =
    resolvedLocation.hostname === DOCS_UPSTREAM_HOST ||
    resolvedLocation.hostname === requestUrl.hostname ||
    resolvedLocation.hostname === "blode.co";

  if (!isUpstreamRedirect) {
    return null;
  }

  const path =
    resolvedLocation.hostname === DOCS_UPSTREAM_HOST
      ? publicPathFromUpstreamAbsolute(resolvedLocation.pathname)
      : toPublicDocsPath(stripZoneBasePath(resolvedLocation.pathname));

  return `https://blode.co${path}${resolvedLocation.search}${resolvedLocation.hash}`;
};

/**
 * `twitter:creator` is absent from the upstream entirely: blode.md has no field
 * for it, so unlike `og:site_name` there is nothing to rewrite and the tag has
 * to be added. Rule 10 wants person-level attribution on every blode.co path,
 * and these are blode.co paths.
 *
 * Inserted into `<head>` only, not into the flight payload. Social crawlers do
 * not run JavaScript, so the served HTML is what builds the card; React may
 * drop the tag on hydration since it is not in the payload it renders from.
 * Adding it there too would mean hand-forging a serialized React element, which
 * is far more likely to break the page than to help it. The upstream `seo`
 * config is the real fix.
 */
const TWITTER_CREATOR = "@mattblode";
const TWITTER_CREATOR_META = /<meta[^>]*name="twitter:creator"[^>]*>/iu;
const HEAD_OPEN = /<head\b[^>]*>/iu;

const ensureTwitterCreator = (html: string): string => {
  if (TWITTER_CREATOR_META.test(html)) {
    return html;
  }
  return html.replace(
    HEAD_OPEN,
    (tag) => `${tag}<meta name="twitter:creator" content="${TWITTER_CREATOR}"/>`
  );
};

export const rewriteDocsHtml = (html: string): string => {
  // The upstream runtime otherwise waits for chunk IDs under /_docs while
  // the browser registered them under this zone, leaving inert server HTML.
  let rewrittenHtml = html.replace(
    HEAD_OPEN,
    (tag) =>
      `${tag}<script>globalThis.TURBOPACK_CHUNK_BASE_PATH="${PUBLIC_ASSET_PREFIX}/_next/";</script>`
  );
  const hrefPaths = ["/", ...DOCS_PAGE_PATHS, ...DOCS_ROOT_FILES];

  for (const path of hrefPaths) {
    const publicPath = toPublicDocsPath(path);
    rewrittenHtml = rewrittenHtml.replaceAll(
      `href="${path}"`,
      `href="${publicPath}"`
    );
    rewrittenHtml = rewrittenHtml.replaceAll(
      `href\\":\\"${path}\\"`,
      `href\\":\\"${publicPath}\\"`
    );
    rewrittenHtml = rewrittenHtml.replaceAll(
      `"href":"${path}"`,
      `"href":"${publicPath}"`
    );
  }

  for (const path of DOCS_PAGE_PATHS) {
    for (const ext of [".md", ".mdx"] as const) {
      const mdxPath = `${path}${ext}`;
      const publicMdxPath = toPublicDocsPath(mdxPath);
      rewrittenHtml = rewrittenHtml.replaceAll(
        `href="${mdxPath}"`,
        `href="${publicMdxPath}"`
      );
      rewrittenHtml = rewrittenHtml.replaceAll(
        `contentUrl\\":\\"${mdxPath}\\"`,
        `contentUrl\\":\\"${publicMdxPath}\\"`
      );
      rewrittenHtml = rewrittenHtml.replaceAll(
        `"contentUrl":"${mdxPath}"`,
        `"contentUrl":"${publicMdxPath}"`
      );
    }
  }

  // Platform asset prefix must stay on the zone, not the blode.co root.
  rewrittenHtml = rewrittenHtml.replaceAll(
    `"/_docs/`,
    `"${PUBLIC_ASSET_PREFIX}/`
  );
  rewrittenHtml = rewrittenHtml.replaceAll(
    `\\"/_docs/`,
    `\\"${PUBLIC_ASSET_PREFIX}/`
  );
  rewrittenHtml = rewrittenHtml.replaceAll(
    `'/_docs/`,
    `'${PUBLIC_ASSET_PREFIX}/`
  );
  // Link: </_docs/...>; rel=preload
  rewrittenHtml = rewrittenHtml.replaceAll(
    `</_docs/`,
    `</${PUBLIC_ASSET_PREFIX.slice(1)}/`
  );

  // Absolute upstream URLs (canonical, og, .md exports) to public zone docs URL.
  const docsOriginPattern = new RegExp(
    `https://${escapeRegExp(DOCS_UPSTREAM_HOST)}(/[^"'\\\\\\s)]*)?`,
    "g"
  );
  rewrittenHtml = rewrittenHtml.replace(
    docsOriginPattern,
    (_match, path: string | undefined) =>
      `https://blode.co${publicPathFromUpstreamAbsolute(path ?? "")}`
  );

  // Serve brand assets from this app's public/ so img-src 'self' (or a stale
  // marketing CSP) cannot block Vercel Blob. Matches HTML attrs and RSC JSON.
  rewrittenHtml = rewrittenHtml.replaceAll(
    /https:\/\/[^"'\\\s]+\/files\/logo\/(light|dark)\.svg/g,
    `${basePath}/logo/$1.svg`
  );
  rewrittenHtml = rewrittenHtml.replaceAll(
    /https:\/\/[^"'\\\s]+\/files\/favicon\.svg/g,
    `${basePath}/logo/favicon.svg`
  );
  // The released Blode.md CLI does not accept metadata.ogImage yet.
  // Keep public share metadata on this zone until the tenant supports it.
  rewrittenHtml = rewrittenHtml.replaceAll(
    /(<meta property="og:site_name" content=")[^"]*("\/?>)/g,
    "$1Matthew Blode$2"
  );
  const imageUrl = `https://blode.co${basePath}/opengraph-image`;
  for (const property of ["og:image", "twitter:image"]) {
    const tag = new RegExp(`<meta (?:property|name)="${property}"[^>]*>`, "g");
    rewrittenHtml = rewrittenHtml.replaceAll(tag, "");
    if (rewrittenHtml.includes("</head>")) {
      const attribute = property.startsWith("og:") ? "property" : "name";
      rewrittenHtml = rewrittenHtml.replace(
        "</head>",
        `<meta ${attribute}="${property}" content="${imageUrl}"/></head>`
      );
    }
  }
  rewrittenHtml = ensureTwitterCreator(rewrittenHtml);

  return rewrittenHtml;
};

export const buildUpstreamUrl = (
  zoneRelativePath: string,
  search: string
): URL => {
  const upstreamPath = toUpstreamPath(zoneRelativePath);
  return new URL(
    `${upstreamPath === "/" ? "" : upstreamPath}${search}`,
    `https://${DOCS_UPSTREAM_HOST}/`
  );
};

/** Keep only the preferred docs root URL in the tenant's public sitemap. */
export const rewriteDocsSitemap = (xml: string): string =>
  xml.replaceAll(
    /<url>\s*<loc>https:\/\/blode\.co\/taste-lint\/docs\/index\/?<\/loc>[\s\S]*?<\/url>/g,
    ""
  );
