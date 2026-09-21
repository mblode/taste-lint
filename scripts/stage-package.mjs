import { cpSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const target = new URL("packages/cli/", root);

// Keep the existing source paths while publishing a self-contained workspace.
for (const name of ["dist", "data", "README.md", "LICENSE.md"]) {
  const destination = new URL(name, target);
  rmSync(destination, { force: true, recursive: true });
  cpSync(new URL(name, root), destination, { recursive: true });
}
