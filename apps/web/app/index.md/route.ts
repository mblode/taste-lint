import { homeMarkdownResponse } from "../../lib/home-markdown.js";

// The home page as Markdown. proxy.ts serves the same body for
// `Accept: text/markdown` on the zone root.
export const dynamic = "force-static";

export const GET = () => homeMarkdownResponse();
