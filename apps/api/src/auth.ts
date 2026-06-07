import { timingSafeEqual } from "node:crypto";

export function isAuthorized(headers: Headers, expectedApiKey: string): boolean {
  const providedApiKey = headers.get("x-api-key")?.trim() || "";

  if (!providedApiKey || !expectedApiKey) {
    return false;
  }

  return safeEqual(providedApiKey, expectedApiKey);
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}