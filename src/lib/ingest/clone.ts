import simpleGit from "simple-git";
import { mkdir, rm, cp, rename, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export type CloneResult = {
  dir: string;
  commitSha: string;
  defaultBranch: string;
};

function repoSlug(url: string): string {
  return url
    .replace(/\.git$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^file:\/\//, "local_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function cloneRepo(url: string): Promise<CloneResult> {
  await mkdir(env.TRUTHGAP_WORKDIR, { recursive: true });
  const dir = path.join(env.TRUTHGAP_WORKDIR, repoSlug(url) + "_" + Date.now());
  await rm(dir, { recursive: true, force: true });

  // Local file:// path → copy the tree, then restore .git from _seed_git if present
  // so the parent project can ship the benchmark without nesting real git repos.
  if (url.startsWith("file://")) {
    const src = url.replace(/^file:\/\//, "");
    await cp(src, dir, { recursive: true });
    const seedGit = path.join(dir, "_seed_git");
    const realGit = path.join(dir, ".git");
    if (!(await exists(realGit)) && (await exists(seedGit))) {
      await rename(seedGit, realGit);
    }
    let commitSha = "local";
    let defaultBranch = "main";
    if (await exists(realGit)) {
      try {
        const repoGit = simpleGit(dir);
        const log = await repoGit.log({ maxCount: 1 });
        commitSha = log.latest?.hash ?? "local";
      } catch {}
    }
    return { dir, commitSha, defaultBranch };
  }

  // Remote clone
  const git = simpleGit();
  await git.clone(url, dir, ["--depth", "200"]);
  const repoGit = simpleGit(dir);
  const log = await repoGit.log({ maxCount: 1 });
  const head = log.latest?.hash ?? "";
  let defaultBranch = "main";
  try {
    const remote = await repoGit.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    defaultBranch = remote.trim().split("/").pop() ?? "main";
  } catch {}
  return { dir, commitSha: head, defaultBranch };
}
