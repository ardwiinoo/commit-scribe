import { execFileSync } from "node:child_process";

export function isInsideGitRepository(): boolean {
  try {
    const output = runGit(["rev-parse", "--is-inside-work-tree"]);
    return output.trim() === "true";
  } catch {
    return false;
  }
}

export function getRepositoryRoot(): string {
  return runGit(["rev-parse", "--show-toplevel"]).trim();
}

export function getStagedFiles(repositoryRoot: string): string[] {
  const output = runGit(["diff", "--cached", "--name-only"], {
    cwd: repositoryRoot,
  });

  return output
    .split("\n")
    .map((line) => normalizeGitPath(line.trim()))
    .filter(Boolean);
}

export function getStagedDiff(repositoryRoot: string, files?: string[]): string {
  const args = ["diff", "--cached", "--diff-algorithm=minimal"];

  if (files && files.length > 0) {
    args.push("--", ...files);
  }

  return runGit(args, {
    cwd: repositoryRoot,
  });
}

export function commitStagedChanges(repositoryRoot: string, message: string): void {
  runGit(["commit", "-m", message], {
    cwd: repositoryRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function runGit(
  args: string[],
  options?: {
    cwd?: string;
    stdio?: ["ignore", "pipe" | "inherit", "pipe" | "inherit"];
  }
): string {
  return execFileSync("git", args, {
    cwd: options?.cwd,
    encoding: "utf8",
    stdio: options?.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function normalizeGitPath(file: string): string {
  return file.replace(/\\/g, "/");
}