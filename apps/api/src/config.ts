export type AppConfig = {
  port: number;
  apiKey: string;

  gcpProjectId: string;
  vertexLocation: string;
  geminiModel: string;

  maxFiles: number;
  maxDiffChars: number;
  maxPromptChars: number;
  maxOutputTokens: number;
  maxMessageWords: number;
  thinkingBudget: number;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid number env: ${name}`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: readNumberEnv("PORT", 8080),
    apiKey: readRequiredEnv("COMMIT_SCRIBE_API_KEY"),

    gcpProjectId: readRequiredEnv("GCP_PROJECT_ID"),
    vertexLocation: process.env.VERTEX_LOCATION?.trim() || "us-central1",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",

    maxFiles: readNumberEnv("MAX_FILES", 15),
    maxDiffChars: readNumberEnv("MAX_DIFF_CHARS", 20000),
    maxPromptChars: readNumberEnv("MAX_PROMPT_CHARS", 25000),
    maxOutputTokens: readNumberEnv("MAX_OUTPUT_TOKENS", 40),
    maxMessageWords: readNumberEnv("MAX_MESSAGE_WORDS", 18),
    thinkingBudget: readNumberEnv("THINKING_BUDGET", 0),
  };
}