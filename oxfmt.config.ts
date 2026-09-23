import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Sort Tailwind classes against the web app's theme, so tokens such as
  // text-muted-foreground sort as colours instead of unknown classes.
  sortTailwindcss: {
    ...ultracite.sortTailwindcss,
    stylesheet: "./apps/web/app/globals.css",
  },
});
