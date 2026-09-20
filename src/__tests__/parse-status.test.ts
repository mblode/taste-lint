import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { runLint } from "../lint.js";
import { runScan } from "../scan/run.js";
import { temporary } from "./helpers.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
it("does not report a clean scan when JSX cannot be parsed", async () => {
  const root = temporary();
  dirs.push(root);
  fs.writeFileSync(
    path.join(root, "broken.tsx"),
    "export const App = () => <div"
  );
  const options = {
    mechanicalOnly: true,
    only: ["typography-straight-quotes"],
    root,
    targets: ["broken.tsx"],
  };
  const lint = await runLint(options);
  expect(lint.status).toBe("incomplete");
  expect(lint.exitCode).toBe(2);
  expect(lint.scope?.diagnostics.join(" ")).toContain(
    "Could not fully parse broken.tsx"
  );
  const scan = await runScan(options);
  expect(scan.report.status).toBe("incomplete");
  expect(scan.report.exitCode).toBe(2);
});
it("does not report a clean lint when exclusions remove every input", async () => {
  const root = temporary();
  dirs.push(root);
  fs.writeFileSync(path.join(root, "page.md"), "Hello.");
  const result = await runLint({
    exclude: ["**/*.md"],
    mechanicalOnly: true,
    root,
    targets: ["."],
  });
  expect(result.status).toBe("incomplete");
  expect(result.exitCode).toBe(2);
});
