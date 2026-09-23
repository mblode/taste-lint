import type { MetadataRoute } from "next";

import docsConfig from "../../../docs/docs.json" with { type: "json" };
import { siteConfig } from "../lib/config.js";

// The landing page plus every public docs page in the docs navigation (served
// under /docs by the zone proxy). No lastModified: a build timestamp is not a
// content date, and the docs sitemap carries its own.
export default function sitemap(): MetadataRoute.Sitemap {
  const docs = docsConfig.navigation.groups.flatMap((group) =>
    group.pages.map((page) => ({
      url: `${siteConfig.url}/docs${page === "index" ? "" : `/${page}`}`,
    }))
  );
  return [{ url: siteConfig.url }, ...docs];
}
