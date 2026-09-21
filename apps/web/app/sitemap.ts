import type { MetadataRoute } from "next";

import { siteConfig } from "../lib/config.js";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteConfig.url }];
}
