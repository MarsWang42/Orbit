export function toBranchName(task: string): string {
  return task.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const retryAfter = err?.parameters?.retry_after ?? err?.payload?.retry_after;
      if (err?.error_code === 429 && retryAfter && attempt < maxRetries) {
        console.warn(`Rate limited, retrying after ${retryAfter}s (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
