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
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
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
