import type { AppConfig } from "./config.js";

export type LimitReason =
  | "empty_files"
  | "empty_diff"
  | "too_many_files"
  | "diff_too_large"
  | "prompt_too_large"
  | "model_error";

export type LimitResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: LimitReason;
    };

export function checkInputLimits(
  params: {
    files: string[];
    diff: string;
  },
  config: AppConfig
): LimitResult {
  if (params.files.length === 0) {
    return {
      ok: false,
      reason: "empty_files",
    };
  }

  if (!params.diff.trim()) {
    return {
      ok: false,
      reason: "empty_diff",
    };
  }

  if (params.files.length > config.maxFiles) {
    return {
      ok: false,
      reason: "too_many_files",
    };
  }

  if (params.diff.length > config.maxDiffChars) {
    return {
      ok: false,
      reason: "diff_too_large",
    };
  }

  return {
    ok: true,
  };
}

export function checkPromptLimit(prompt: string, config: AppConfig): LimitResult {
  if (prompt.length > config.maxPromptChars) {
    return {
      ok: false,
      reason: "prompt_too_large",
    };
  }

  return {
    ok: true,
  };
}