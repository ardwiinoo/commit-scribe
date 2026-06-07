import * as vscode from "vscode";

export type ExtensionConfig = {
  apiUrl: string;
  apiKey: string;
  timeoutMs: number;
};

export function loadConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration("commitScribe");

  const apiUrl = normalizeUrl(config.get<string>("apiUrl", ""));
  const apiKey = config.get<string>("apiKey", "").trim();
  const timeoutMs = config.get<number>("timeoutMs", 30000);

  if (!apiUrl) {
    throw new Error("Missing setting: commitScribe.apiUrl");
  }

  if (!apiKey) {
    throw new Error("Missing setting: commitScribe.apiKey");
  }

  return {
    apiUrl,
    apiKey,
    timeoutMs,
  };
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}