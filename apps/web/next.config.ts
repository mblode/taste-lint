import path from "node:path";

import type { NextConfig } from "next";

import { basePath, siteConfig } from "./lib/config.js";

const config: NextConfig = {
  assetPrefix: basePath,
  basePath,
  headers() {
    return Promise.resolve([
      {
        headers: [
          { key: "X-Llms-Txt", value: `${siteConfig.url}/docs/llms.txt` },
          {
            key: "Link",
            value: `<${siteConfig.url}/docs/llms.txt>; rel="describedby"; type="text/plain", <${siteConfig.url}/docs/llms-full.txt>; rel="alternate"; type="text/plain"`,
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
