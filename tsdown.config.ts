import { defineConfig } from "tsdown";

export default defineConfig([
  {
    banner: { js: "#!/usr/bin/env node" },
    clean: true,
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    outputOptions: {
      chunkFileNames: "[name]-[hash].js",
      entryFileNames: "[name].js",
    },
    sourcemap: true,
    target: "node24",
  },
  {
    dts: true,
    entry: { index: "src/index.ts" },
    format: ["esm"],
    outputOptions: {
      chunkFileNames: "[name]-[hash].js",
      entryFileNames: "[name].js",
    },
    sourcemap: true,
    target: "node24",
  },
]);
