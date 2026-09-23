import path from "node:path";

import type { NextConfig } from "next";

import { basePath, siteConfig } from "./lib/config.js";

const config: NextConfig = {
  assetPrefix: basePath,
  basePath,
  // Cache Components plus Partial Prefetching: the landing page prerenders to
  // a static shell and `instant` on app/page.tsx validates it in dev.
  cacheComponents: true,
  experimental: {
    // Only the instant() e2e build (npm run test:instant) exposes the testing
    // API; production builds never set this variable.
    exposeTestingApiInProductionBuild: process.env.NEXT_INSTANT_TEST === "1",
  },
  headers() {
    return Promise.resolve([
      {
        headers: [
          // The zone index lists the home page and every docs page; the docs
          // site's own llms.txt and llms-full.txt stay linked as before.
          { key: "X-Llms-Txt", value: `${siteConfig.url}/llms.txt` },
          {
            key: "Link",
            value: `<${siteConfig.url}/llms.txt>; rel="describedby"; type="text/plain", <${siteConfig.url}/index.md>; rel="alternate"; type="text/markdown", <${siteConfig.url}/docs/llms.txt>; rel="describedby"; type="text/plain", <${siteConfig.url}/docs/llms-full.txt>; rel="alternate"; type="text/plain"`,
          },
        ],
        source: "/",
      },
      {
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
        source: "/:path*",
      },
    ]);
  },
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return webpackConfig;
  },
};
export default config;
