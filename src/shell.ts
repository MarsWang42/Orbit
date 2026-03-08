export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export async function run(cmd: string[], cwd?: string): Promise<RunResult> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function runSilent(cmd: string[], cwd?: string): Promise<boolean> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await proc.exited) === 0;
}
