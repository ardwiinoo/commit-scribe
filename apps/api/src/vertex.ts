import { GoogleGenAI } from "@google/genai";
import type { AppConfig } from "./config.js";

let cachedClient: GoogleGenAI | null = null;

export async function generateCommitMessageWithVertex(
  prompt: string,
  config: AppConfig
): Promise<string> {
  const client = getClient(config);

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      temperature: 0.2,
      candidateCount: 1,
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: {
        thinkingBudget: config.thinkingBudget,
      },
    },
  });

  const text = extractText(response);

  if (!text) {
    throw new Error("Empty model response");
  }

  return sanitizeCommitMessage(text, config.maxMessageWords);
}

function getClient(config: AppConfig): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new GoogleGenAI({
    vertexai: true,
    project: config.gcpProjectId,
    location: config.vertexLocation,
  });

  return cachedClient;
}

function extractText(response: unknown): string {
  const directText = (response as { text?: unknown }).text;

  if (typeof directText === "string") {
    return directText;
  }

  const candidates = (response as { candidates?: Array<unknown> }).candidates;

  if (!Array.isArray(candidates)) {
    return "";
  }

  const parts = candidates.flatMap((candidate) => {
    const content = (candidate as { content?: { parts?: Array<{ text?: string }> } }).content;
    return content?.parts || [];
  });

  return parts
    .map((part) => part.text || "")
    .join("")
    .trim();
}

export function sanitizeCommitMessage(message: string, maxWords: number): string {
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "";
  }

  const cleaned = firstLine
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);

  if (words.length <= maxWords) {
    return cleaned;
  }

  return words.slice(0, maxWords).join(" ");
}