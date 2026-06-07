import type { CliConfig } from "./config.js";

export type GenerateCommitMessageRequest = {
  files: string[];
  diff: string;
  include_body?: boolean;
};

export type GenerateCommitMessageResponse = {
  message: string;
  fallback: boolean;
  reason: string | null;
  usage?: {
    file_count: number;
    diff_chars: number;
    prompt_chars: number;
  };
};

export async function generateCommitMessage(
  request: GenerateCommitMessageRequest,
  config: CliConfig
): Promise<GenerateCommitMessageResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${config.apiUrl}/v1/commit-message/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${text}`);
    }

    const parsed = parseJsonResponse(text);

    if (!parsed.message) {
      throw new Error("API returned empty commit message");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonResponse(text: string): GenerateCommitMessageResponse {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }

  if (!isGenerateCommitMessageResponse(value)) {
    throw new Error(`Unexpected API response: ${text}`);
  }

  return value;
}

function isGenerateCommitMessageResponse(
  value: unknown
): value is GenerateCommitMessageResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.message === "string" &&
    typeof data.fallback === "boolean" &&
    (typeof data.reason === "string" || data.reason === null)
  );
}