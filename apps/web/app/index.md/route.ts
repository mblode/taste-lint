import { homeMarkdownResponse } from "../../lib/home-markdown.js";

// The home page as Markdown. proxy.ts serves the same body for
// `Accept: text/markdown` on the zone root. Nothing here reads the request,
// so Cache Components prerenders it at build time.

export const GET = () => homeMarkdownResponse();
