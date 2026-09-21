import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// Vercel's uploaded source has no Git directory; hooks only belong in checkouts.
if (
  !process.env.CI &&
  !process.env.VERCEL &&
  existsSync(new URL("../.git", import.meta.url))
) {
  execFileSync("lefthook", ["install"], { stdio: "inherit" });
}
