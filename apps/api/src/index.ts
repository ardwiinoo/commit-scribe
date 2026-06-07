import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { isAuthorized } from "./auth.js";
import { loadConfig } from "./config.js";
import { buildFallbackMessage } from "./fallback.js";
import { checkInputLimits, checkPromptLimit, type LimitReason } from "./limiter.js";
import { buildCommitPrompt } from "./prompt.js";
import { generateCommitMessageWithVertex } from "./vertex.js";

type GenerateCommitMessageRequest = {
  files?: unknown;
  diff?: unknown;
  include_body?: unknown;
};

type GenerateCommitMessageResponse = {
  message: string;
  fallback: boolean;
  reason: LimitReason | null;
  usage: {
    file_count: number;
    diff_chars: number;
    prompt_chars: number;
  };
};

const config = loadConfig();
const app = new Hono();

app.get("/", (c) => {
  return c.json({
    name: "commit-scribe-api",
    status: "ok",
  });
});

app.get("/healthz", (c) => {
  return c.json({
    status: "ok",
  });
});

app.post("/v1/commit-message/generate", async (c) => {
  if (!isAuthorized(c.req.raw.headers, config.apiKey)) {
    return c.json(
      {
        error: "unauthorized",
      },
      401
    );
  }

  let body: GenerateCommitMessageRequest;

  try {
    body = await c.req.json<GenerateCommitMessageRequest>();
  } catch {
    return c.json(
      {
        error: "invalid_json",
      },
      400
    );
  }

  const files = normalizeFiles(body.files);
  const diff = typeof body.diff === "string" ? body.diff : "";

  const inputLimit = checkInputLimits(
    {
      files,
      diff,
    },
    config
  );

  if (!inputLimit.ok) {
    return c.json<GenerateCommitMessageResponse>({
      message: buildFallbackMessage(files),
      fallback: true,
      reason: inputLimit.reason,
      usage: {
        file_count: files.length,
        diff_chars: diff.length,
        prompt_chars: 0,
      },
    });
  }

  const prompt = buildCommitPrompt({
    files,
    diff,
    maxMessageWords: config.maxMessageWords,
  });

  const promptLimit = checkPromptLimit(prompt, config);

  if (!promptLimit.ok) {
    return c.json<GenerateCommitMessageResponse>({
      message: buildFallbackMessage(files),
      fallback: true,
      reason: promptLimit.reason,
      usage: {
        file_count: files.length,
        diff_chars: diff.length,
        prompt_chars: prompt.length,
      },
    });
  }

  try {
    const message = await generateCommitMessageWithVertex(prompt, config);

    return c.json<GenerateCommitMessageResponse>({
      message,
      fallback: false,
      reason: null,
      usage: {
        file_count: files.length,
        diff_chars: diff.length,
        prompt_chars: prompt.length,
      },
    });
  } catch (error) {
    console.error("[generate_commit_message_error]", error);

    return c.json<GenerateCommitMessageResponse>({
      message: buildFallbackMessage(files),
      fallback: true,
      reason: "model_error",
      usage: {
        file_count: files.length,
        diff_chars: diff.length,
        prompt_chars: prompt.length,
      },
    });
  }
});

function normalizeFiles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
}

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`commit-scribe-api listening on port ${info.port}`);
  }
);