import * as vscode from "vscode";

import { generateCommitMessage } from "./api";
import { loadConfig } from "./config";
import { getActiveRepository, getStagedDiff, getStagedFiles } from "./git";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "commitScribe.generateCommitMessage",
    async () => {
      await handleGenerateCommitMessage();
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Nothing to clean up.
}

async function handleGenerateCommitMessage() {
  try {
    const repository = await getActiveRepository();

    if (!repository) {
      vscode.window.showWarningMessage("Commit Scribe: No Git repository found.");
      return;
    }

    const files = getStagedFiles(repository);

    if (files.length === 0) {
      vscode.window.showWarningMessage(
        "Commit Scribe: No staged changes found. Stage files first."
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.SourceControl,
        title: "Commit Scribe: Generating commit message...",
        cancellable: false,
      },
      async () => {
        const diff = await getStagedDiff(repository);

        if (!diff.trim()) {
          vscode.window.showWarningMessage(
            "Commit Scribe: No staged diff found. Stage files first."
          );
          return;
        }

        const config = loadConfig();

        const result = await generateCommitMessage(
          {
            files,
            diff,
            include_body: false,
          },
          config
        );

        repository.inputBox.value = result.message;

        if (result.fallback) {
          vscode.window.showInformationMessage(
            `Commit Scribe: Used fallback message (${result.reason ?? "unknown"}).`
          );
          return;
        }

        vscode.window.showInformationMessage(
          "Commit Scribe: Commit message generated."
        );
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Missing setting: commitScribe.apiKey")) {
      const action = await vscode.window.showErrorMessage(
        "Commit Scribe: API key is missing.",
        "Open Settings"
      );

      if (action === "Open Settings") {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "commitScribe.apiKey"
        );
      }

      return;
    }

    vscode.window.showErrorMessage(`Commit Scribe: ${message}`);
  }
}