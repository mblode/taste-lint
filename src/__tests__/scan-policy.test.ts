import fs from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { runScan } from "../scan/run.js";
import { writeJson } from "../scan/storage.js";
import { temporary } from "./helpers.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

it("keeps product style preferences visible without letting them block real motion findings", async () => {
  const root = temporary();
  dirs.push(root);
  fs.writeFileSync(
    path.join(root, "card.tsx"),
    `export const Card = () => <>
    <p className="text-sm leading-6">It's a longer piece of running text that should stay readable...</p>
    <button className="transition-all duration-500">Open</button>
  </>`
  );
  const only = [
    "typography-straight-quotes",
    "typography-ellipsis",
    "typography-line-height-out-of-band",
    "motion-transition-all",
    "motion-duration-over-300ms",
  ];
  const options = {
    only,
    resultsDir: path.join(root, "results"),
    root,
    targets: ["card.tsx"],
  };
  const { report } = await runScan({ ...options, profile: "product" });
  expect(report.summary.failing).toBe(2);
  expect(report.summary.review).toBe(3);
  expect(
    report.findings
      .filter((f) => f.band === "act")
      .map((f) => f.ruleId)
      .toSorted()
  ).toEqual(["motion-duration-over-300ms", "motion-transition-all"]);
  const strict = await runScan({ ...options, profile: "all" });
  expect(strict.report.summary.failing).toBe(5);
  const baseline = path.join(root, "results/strict.json");
  writeJson(baseline, strict.report);
  await expect(
    runScan({ ...options, baseline, profile: "product" })
  ).rejects.toThrow("Baseline");
});
