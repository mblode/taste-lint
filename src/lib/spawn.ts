import { spawn } from "node:child_process";

export function spawnCapture(
  cmd: string,
  argv: string[],
  options: { input?: string; timeoutMs?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, {
      cwd: options.cwd,
      killSignal: "SIGKILL",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: options.timeoutMs ?? 120_000,
    });
    let stdout = "";
    let stderr = "";
    // Decode as a stream so a multi-byte character split across chunks
    // (curly quotes in page text) never becomes U+FFFD.
    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (d: string) => {
      stdout += d;
    });
    child.stderr.on("data", (d: string) => {
      stderr += d;
    });
    child.on("error", (err: Error) => reject(err));
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} did not complete successfully (exit ${code ?? "signal"}).`
          )
        );
        return;
      }
      resolve({ stderr, stdout });
    });
    if (options.input !== undefined) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}
