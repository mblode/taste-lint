import { llmsTxt } from "../../lib/llms.js";

// Nothing here reads the request, so Cache Components prerenders it at build
// time like robots.txt and sitemap.xml.

export const GET = () =>
  new Response(llmsTxt(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
