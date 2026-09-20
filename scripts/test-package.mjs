import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "taste-lint-package-"));
const run = (command, args, cwd = root, env = process.env) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
  });
try {
  // npm runs `prepare` even with --ignore-scripts, and lefthook's hook sync
  // prints to stdout ahead of the JSON, so parse from the first bracket.
  const packOutput = run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    temporary,
  ]);
  const [packed] = JSON.parse(packOutput.slice(packOutput.indexOf("[")));
  assert.ok(
    packed.files.some(
      (file) =>
        file.path.startsWith("data/rules/") && file.path.endsWith(".yaml")
    )
  );
  assert.ok(
    packed.files.some(
      (file) => file.path === "data/rules/schema/rule.schema.json"
    )
  );
  assert.ok(!packed.files.some((file) => file.path.startsWith("src/")));
  const consumer = path.join(temporary, "consumer");
  fs.mkdirSync(consumer);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf-8")
  );
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf-8")
  );
  const tarball = `file:${path.join(temporary, packed.filename)}`;
  const consumerManifest = {
    dependencies: { "taste-lint": tarball },
    name: "package-smoke-consumer",
    version: "1.0.0",
  };
  const packages = Object.fromEntries(
    Object.entries(lock.packages).filter(
      ([name, metadata]) => name && !metadata.dev
    )
  );
  packages[""] = consumerManifest;
  packages["node_modules/taste-lint"] = {
    bin: manifest.bin,
    dependencies: manifest.dependencies,
    engines: manifest.engines,
    integrity: packed.integrity,
    resolved: tarball,
    version: manifest.version,
  };
  fs.writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify(consumerManifest)
  );
  fs.writeFileSync(
    path.join(consumer, "package-lock.json"),
    JSON.stringify({
      ...consumerManifest,
      lockfileVersion: 3,
      packages,
      requires: true,
    })
  );
  run(
    "npm",
    ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"],
    consumer
  );
  const installed = path.join(consumer, "node_modules/taste-lint");
  const cli = path.join(installed, "dist/cli.js");
  assert.match(
    run(process.execPath, [cli, "rules", "check"], consumer),
    /PASS:/
  );
  const project = path.join(temporary, "project");
  fs.mkdirSync(project);
  fs.writeFileSync(
    path.join(project, "copy.md"),
    "# Hi\n\nA powerful tool for teams.\n"
  );
  const env = { ...process.env };
  delete env.TYPESAFE_API_KEY;
  delete env.AI_GATEWAY_API_KEY;
  const dry = run(
    process.execPath,
    [
      cli,
      "lint",
      ".",
      "--dry-run",
      "--root",
      project,
      "--results-dir",
      path.join(temporary, "results"),
    ],
    consumer,
    env
  );
  assert.match(dry, /No calls were made/);
  assert.match(dry, /2 requests would be sent/);
  const scan = JSON.parse(
    run(
      process.execPath,
      [
        cli,
        "scan",
        ".",
        "--profile",
        "all",
        "--root",
        project,
        "--dry-run",
        "--output",
        "json",
        "--results-dir",
        path.join(temporary, "results"),
      ],
      consumer,
      env
    )
  );
  assert.equal(scan.kind, "taste-lint-scan");
  assert.equal(scan.status, "dry-run");
  assert.equal(scan.files.length, 1);
  let failed;
  try {
    execFileSync(
      process.execPath,
      [
        cli,
        "lint",
        ".",
        "--root",
        project,
        "--results-dir",
        path.join(temporary, "results"),
      ],
      {
        cwd: consumer,
        encoding: "utf-8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      }
    );
  } catch (error) {
    failed = error;
  }
  assert.equal(failed?.status, 1, "A Jev run without a key must exit nonzero");
  assert.match(String(failed.stderr), /AI_GATEWAY_API_KEY/);
  console.log(
    "Packed artifact passed: rules, dry-run lint and key guard verified offline."
  );
} finally {
  fs.rmSync(temporary, { force: true, recursive: true });
}
