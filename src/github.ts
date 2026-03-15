import { Octokit } from "octokit";
import { config } from "./config";

let _octokit: Octokit | null = null;

export function getOctokit(): Octokit | null {
  if (_octokit) return _octokit;
  if (!config.GH_TOKEN) return null;
  _octokit = new Octokit({ auth: config.GH_TOKEN });
  return _octokit;
}

export async function repoExists(name: string): Promise<boolean> {
  const ok = getOctokit();
  if (!ok) return false;

  try {
    const { data: user } = await ok.rest.users.getAuthenticated();
    await ok.rest.repos.get({ owner: user.login, repo: name });
    return true;
  } catch {
    return false;
  }
}

export async function createRepo(name: string): Promise<{ url: string; cloneUrl: string }> {
  const ok = getOctokit();
  if (!ok) throw new Error("GH_TOKEN not configured");

  const { data } = await ok.rest.repos.createForAuthenticatedUser({
    name,
    private: true,
    auto_init: false,
  });

  return {
    url: data.html_url,
    cloneUrl: data.clone_url,
  };
}

export async function listPRsByHead(
  owner: string,
  repo: string,
  branch: string,
  headOwner?: string,
): Promise<Array<{ number: number; title: string; url: string }>> {
  const ok = getOctokit();
  if (!ok) throw new Error("GH_TOKEN not configured");

  const { data } = await ok.rest.pulls.list({
    owner,
    repo,
    head: `${headOwner ?? owner}:${branch}`,
    state: "open",
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
  }));
}

export async function getPRComments(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Array<{ author: string; body: string; path?: string; line?: number }>> {
  const ok = getOctokit();
  if (!ok) throw new Error("GH_TOKEN not configured");

  const [{ data: issueComments }, { data: reviewComments }] = await Promise.all([
    ok.rest.issues.listComments({ owner, repo, issue_number: prNumber }),
    ok.rest.pulls.listReviewComments({ owner, repo, pull_number: prNumber }),
  ]);

  const comments: Array<{ author: string; body: string; path?: string; line?: number }> = [];

  for (const c of issueComments) {
    if (c.body) comments.push({ author: c.user?.login ?? "unknown", body: c.body });
  }
  for (const c of reviewComments) {
    if (c.body) {
      comments.push({
        author: c.user?.login ?? "unknown",
        body: c.body,
        path: c.path,
        line: c.line ?? undefined,
      });
    }
  }

  return comments;
}

export async function verifyRepoAccess(owner: string, repo: string): Promise<{ accessible: boolean; reason?: string }> {
  const ok = getOctokit();
  if (!ok) return { accessible: false, reason: "GH_TOKEN not configured" };

  try {
    await ok.rest.repos.get({ owner, repo });
    return { accessible: true };
  } catch (err: any) {
    if (err.status === 404) return { accessible: false, reason: "not_found" };
    if (err.status === 403) return { accessible: false, reason: "forbidden" };
    return { accessible: false, reason: `GitHub API error: ${err.status}` };
  }
}

export async function getAuthenticatedUser(): Promise<string | null> {
  const ok = getOctokit();
  if (!ok) return null;
  try {
    const { data } = await ok.rest.users.getAuthenticated();
    return data.login;
  } catch {
    return null;
  }
}

export async function forkRepo(owner: string, repo: string): Promise<{ cloneUrl: string; fullName: string }> {
  const ok = getOctokit();
  if (!ok) throw new Error("GH_TOKEN not configured");

  const { data } = await ok.rest.repos.createFork({ owner, repo });

  // GitHub forks are async — poll until ready (up to 30s)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const { data: fork } = await ok.rest.repos.get({ owner: data.owner.login, repo: data.name });
      if (fork.size > 0 || fork.pushed_at !== fork.created_at) break;
    } catch { /* not ready yet */ }
  }

  return { cloneUrl: data.clone_url, fullName: data.full_name };
}

export function parseRepoFromRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // Handle HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return null;
}

export function tokenizeUrl(url: string): string {
  if (!config.GH_TOKEN) return url;
  if (url.startsWith("https://github.com")) {
    return url.replace("https://", `https://${config.GH_TOKEN}@`);
  }
  // Already tokenized
  if (url.includes("@github.com")) return url;
  return url;
}
