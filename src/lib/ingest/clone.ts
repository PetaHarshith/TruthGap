import simpleGit from "simple-git";
import { mkdir, rm } from "node:fs/promises";
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
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function cloneRepo(url: string): Promise<CloneResult> {
  await mkdir(env.TRUTHGAP_WORKDIR, { recursive: true });
  const dir = path.join(env.TRUTHGAP_WORKDIR, repoSlug(url) + "_" + Date.now());
  await rm(dir, { recursive: true, force: true });
  const git = simpleGit();
  await git.clone(url, dir, ["--depth", "200"]);
  const repoGit = simpleGit(dir);
  const log = await repoGit.log({ maxCount: 1 });
  const head = log.latest?.hash ?? "";
  let defaultBranch = "main";
  try {
    const remote = await repoGit.raw([
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    defaultBranch = remote.trim().split("/").pop() ?? "main";
  } catch {}
  return { dir, commitSha: head, defaultBranch };
}
