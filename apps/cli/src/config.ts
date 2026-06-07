import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import dotenv from "dotenv";

export type CliConfig = {
  apiUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return false;
  }

  dotenv.config({
    path,
    override: false,
    quiet: true,
  });

  return true;
}

function loadEnvFiles() {
  const globalConfigPath = join(homedir(), ".commit-scribe", ".env");
  const projectConfigPath = resolve(process.cwd(), ".commit-scribe.env");

  if (process.env.COMMIT_SCRIBE_CONFIG_PATH) {
    loadEnvFile(process.env.COMMIT_SCRIBE_CONFIG_PATH);
  }

  loadEnvFile(globalConfigPath);

  // Optional per-project override file.
  // Jangan baca .env biasa, karena repo lain biasanya punya .env sendiri.
  loadEnvFile(projectConfigPath);
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required env: ${name}. Create ~/.commit-scribe/.env or set ${name} manually.`
    );
  }

  return value;
}

function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number env: ${name}`);
  }

  return parsed;
}

export function loadConfig(): CliConfig {
  loadEnvFiles();

  return {
    apiUrl: normalizeApiUrl(readRequiredEnv("COMMIT_SCRIBE_API_URL")),
    apiKey: readRequiredEnv("COMMIT_SCRIBE_API_KEY"),
    requestTimeoutMs: readNumberEnv("COMMIT_SCRIBE_TIMEOUT_MS", 30000),
  };
}

function normalizeApiUrl(value: string): string {
  return value.replace(/\/+$/, "");
}