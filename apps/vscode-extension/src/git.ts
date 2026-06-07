import * as path from "node:path";
import * as vscode from "vscode";

export type GitExtension = {
  getAPI(version: 1): GitAPI;
};

export type GitAPI = {
  repositories: Repository[];
};

export type Repository = {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
  state: {
    indexChanges: GitChange[];
  };
  diffIndexWithHEAD(path: string): Promise<string>;
};

export type GitChange = {
  uri: vscode.Uri;
};

export async function getActiveRepository(): Promise<Repository | undefined> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");

  if (!gitExtension) {
    return undefined;
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const git = gitExtension.exports.getAPI(1);

  if (git.repositories.length === 0) {
    return undefined;
  }

  if (git.repositories.length === 1) {
    return git.repositories[0];
  }

  const activeFile = vscode.window.activeTextEditor?.document.uri;

  if (activeFile) {
    const matchedRepository = git.repositories.find((repo) =>
      isInsidePath(activeFile.fsPath, repo.rootUri.fsPath)
    );

    if (matchedRepository) {
      return matchedRepository;
    }
  }

  const pickedRoot = await vscode.window.showQuickPick(
    git.repositories.map((repo) => ({
      label: vscode.workspace.asRelativePath(repo.rootUri),
      repository: repo,
    })),
    {
      placeHolder: "Select Git repository",
    }
  );

  return pickedRoot?.repository;
}

export function getStagedFiles(repository: Repository): string[] {
  return repository.state.indexChanges.map((change) =>
    toRepositoryRelativePath(repository.rootUri.fsPath, change.uri.fsPath)
  );
}

export async function getStagedDiff(repository: Repository): Promise<string> {
  const diffs: string[] = [];

  for (const change of repository.state.indexChanges) {
    const absolutePath = change.uri.fsPath;
    const relativePath = toRepositoryRelativePath(
      repository.rootUri.fsPath,
      absolutePath
    );

    const diff = await getStagedFileDiff(repository, absolutePath, relativePath);

    if (diff.trim()) {
      diffs.push(diff.trimEnd());
    }
  }

  return diffs.join("\n\n");
}

async function getStagedFileDiff(
  repository: Repository,
  absolutePath: string,
  relativePath: string
): Promise<string> {
  try {
    return await repository.diffIndexWithHEAD(absolutePath);
  } catch {
    return await repository.diffIndexWithHEAD(relativePath);
  }
}

function toRepositoryRelativePath(repositoryRoot: string, filePath: string): string {
  return path.relative(repositoryRoot, filePath).replace(/\\/g, "/");
}

function isInsidePath(filePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, filePath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}