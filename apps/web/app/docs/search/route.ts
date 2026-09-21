import { readFileSync } from "node:fs";
import path from "node:path";

import docsConfig from "../../../../../docs/docs.json" with { type: "json" };

export const dynamic = "force-static";

// Blode.md's published tenant does not expose /search yet. Build the same
// title/path index from our public navigation until that endpoint is available.
export function GET() {
  const items = docsConfig.navigation.groups.flatMap((group) =>
    group.pages.map((page) => {
      const source = readFileSync(
        path.resolve(process.cwd(), "../../docs", `${page}.mdx`),
        "utf-8"
      );
      const title = source.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? page;
      return { path: page === "index" ? "" : page, title };
    })
  );
  return Response.json({ items });
}
