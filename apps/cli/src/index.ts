#!/usr/bin/env node

import { createRequire } from "node:module";
import { relative, resolve } from "node:path";

import { generateCommitMessage } from "./api.js";
import { copyToClipboard } from "./clipboard.js";
import { loadConfig } from "./config.js";
import {
  commitStagedChanges,
  getRepositoryRoot,
  getStagedDiff,
  getStagedFiles,
  isInsideGitRepository,
} from "./git.js";

type CliArgs = {
  json: boolean;
  debug: boolean;
  help: boolean;
  version: boolean;
  copy: boolean;
  commit: boolean;
  files: string[];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(getVersion());
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (!isInsideGitRepository()) {
    fail("Not inside a Git repository.");
  }

  const repositoryRoot = getRepositoryRoot();
  const allStagedFiles = getStagedFiles(repositoryRoot);

  if (allStagedFiles.length === 0) {
    fail("No staged changes found. Stage files first.");
  }

  const selectedFiles = resolveSelectedFiles({
    requestedFiles: args.files,
    stagedFiles: allStagedFiles,
    repositoryRoot,
    currentDirectory: process.cwd(),
  });

  if (selectedFiles.length === 0) {
    fail("No selected staged files found.");
  }

  if (args.commit && args.files.length > 0 && !sameFileSet(selectedFiles, allStagedFiles)) {
    fail(
      "--commit with --file is only allowed when selected files are the only staged files. Unstage other files first or run without --commit."
    );
  }

  const diff = getStagedDiff(repositoryRoot, selectedFiles);

  if (!diff.trim()) {
    fail("No staged diff found for selected files.");
  }

  const config = loadConfig();

  if (args.debug) {
    console.error(`Repository: ${repositoryRoot}`);
    console.error(`Files: ${selectedFiles.length}`);
    console.error(`Diff chars: ${diff.length}`);
    console.error(`API: ${config.apiUrl}`);

    if (args.files.length > 0) {
      console.error("Selected files:");
      for (const file of selectedFiles) {
        console.error(`- ${file}`);
      }
    }
  }

  const result = await generateCommitMessage(
    {
      files: selectedFiles,
      diff,
      include_body: false,
    },
    config
  );

  if (args.copy) {
    copyToClipboard(result.message);
  }

  if (args.commit) {
    commitStagedChanges(repositoryRoot, result.message);
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ...result,
          copied: args.copy,
          committed: args.commit,
          selected_files: selectedFiles,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(result.message);

  if (args.copy) {
    console.error("\nCopied to clipboard.");
  }

  if (args.commit) {
    console.error("\nCommitted staged changes.");
  }

  if (result.fallback) {
    console.error(`\nFallback: ${result.reason ?? "unknown"}`);
  }

  if (args.debug && result.usage) {
    console.error(
      `Usage: files=${result.usage.file_count}, diff_chars=${result.usage.diff_chars}, prompt_chars=${result.usage.prompt_chars}`
    );
  }
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        json: false,
        debug: false,
        help: false,
        version: false,
        copy: false,
        commit: false,
        files: [],
    };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--debug") {
      args.debug = true;
      continue;
    }

    if (arg === "--copy") {
      args.copy = true;
      continue;
    }

    if (arg === "--commit") {
      args.commit = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
        args.version = true;
        continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--file" || arg === "-f") {
      const file = argv[i + 1];

      if (!file || file.startsWith("-")) {
        fail(`Missing value for ${arg}`);
      }

      args.files.push(file);
      i++;
      continue;
    }

    if (arg.startsWith("--file=")) {
      const file = arg.slice("--file=".length).trim();

      if (!file) {
        fail("Missing value for --file");
      }

      args.files.push(file);
      continue;
    }

    fail(`Unknown option: ${arg}`);
  }

  return args;
}

function resolveSelectedFiles(params: {
  requestedFiles: string[];
  stagedFiles: string[];
  repositoryRoot: string;
  currentDirectory: string;
}): string[] {
  const { requestedFiles, stagedFiles, repositoryRoot, currentDirectory } = params;

  if (requestedFiles.length === 0) {
    return stagedFiles;
  }

  const stagedSet = new Set(stagedFiles.map(normalizePath));
  const resolvedRequestedFiles = requestedFiles.map((file) =>
    resolveRequestedFile({
      file,
      stagedSet,
      repositoryRoot,
      currentDirectory,
    })
  );

  const missingFiles = resolvedRequestedFiles.filter((file) => !stagedSet.has(file));

  if (missingFiles.length > 0) {
    fail(
      `File is not staged: ${missingFiles.join(
        ", "
      )}. Stage it first or check the path from repository root.`
    );
  }

  const requestedSet = new Set(resolvedRequestedFiles);

  return stagedFiles.filter((file) => requestedSet.has(normalizePath(file)));
}

function resolveRequestedFile(params: {
  file: string;
  stagedSet: Set<string>;
  repositoryRoot: string;
  currentDirectory: string;
}): string {
  const { file, stagedSet, repositoryRoot, currentDirectory } = params;

  const direct = normalizePath(file);

  if (stagedSet.has(direct)) {
    return direct;
  }

  const fromCurrentDirectory = normalizePath(
    relative(repositoryRoot, resolve(currentDirectory, file))
  );

  if (stagedSet.has(fromCurrentDirectory)) {
    return fromCurrentDirectory;
  }

  return fromCurrentDirectory;
}

function sameFileSet(a: string[], b: string[]): boolean {
  const aSet = new Set(a.map(normalizePath));
  const bSet = new Set(b.map(normalizePath));

  if (aSet.size !== bSet.size) {
    return false;
  }

  for (const item of aSet) {
    if (!bSet.has(item)) {
      return false;
    }
  }

  return true;
}

function normalizePath(file: string): string {
  return file.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function printHelp() {
  console.log(`
Commit Scribe CLI

Usage:
  commit-scribe [options]

Options:
  --copy              Copy generated message to clipboard
  --commit            Commit staged changes with generated message
  --file, -f <path>   Generate from a specific staged file. Can be repeated
  --json              Print full API response as JSON
  --debug             Print debug information
  -v, --version       Show CLI version
  -h, --help          Show help

Examples:
  git add .
  commit-scribe

  git add .
  commit-scribe --copy

  git add .
  commit-scribe --commit

  git add apps/api/src/index.ts
  commit-scribe --file apps/api/src/index.ts

  git add apps/api/src/index.ts apps/api/src/vertex.ts
  commit-scribe --file apps/api/src/index.ts --file apps/api/src/vertex.ts --copy
`.trim());
}

function getVersion(): string {
  const require = createRequire(import.meta.url);
  const packageJson = require("../package.json") as { version?: string };

  return packageJson.version ?? "0.0.0";
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});