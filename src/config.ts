function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
}

export const config = {
  BOT_TOKEN: env("BOT_TOKEN"),
  ALLOWED_USER_ID: Number(env("ALLOWED_USER_ID")),
  DEFAULT_CWD: env("DEFAULT_CWD", "~"),
  GH_TOKEN: process.env.GH_TOKEN ?? null,
  DAILY_HOUR: Number(env("DAILY_HOUR", "8")),
  DAILY_PROMPT: env("DAILY_PROMPT", "Run the /start-my-day skill"),
};

const HOME = process.env.HOME ?? "/root";

export function resolvePath(path: string): string {
  return path.replace(/^~/, HOME);
}
