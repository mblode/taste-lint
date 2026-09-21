import type { MetadataRoute } from "next";

import { siteConfig } from "../lib/config.js";

export default function robots(): MetadataRoute.Robots {
  return {
    host: "https://blode.co",
    rules: { allow: "/", userAgent: "*" },
    sitemap: [
      `${siteConfig.url}/sitemap.xml`,
      `${siteConfig.url}/docs/sitemap.xml`,
    ],
  };
}
