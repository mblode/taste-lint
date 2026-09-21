import type { MetadataRoute } from "next";

import { basePath } from "../lib/config.js";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#fbb6cd",
    display: "browser",
    icons: [
      {
        sizes: "any",
        src: `${basePath}/logo/favicon.svg`,
        type: "image/svg+xml",
      },
    ],
    name: "Taste Lint",
    short_name: "Taste Lint",
    start_url: basePath,
    theme_color: "#fbb6cd",
  };
}
