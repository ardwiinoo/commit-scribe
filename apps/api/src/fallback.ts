export function buildFallbackMessage(files: string[]): string {
  if (files.length === 0) {
    return "Update staged changes";
  }

  if (files.length === 1) {
    return buildSingleFileFallback(files[0]);
  }

  const lowerFiles = files.map((file) => file.toLowerCase());

  if (lowerFiles.every(isDocumentationFile)) {
    return "Update documentation";
  }

  if (lowerFiles.some(isDependencyFile)) {
    return "Update dependencies";
  }

  if (lowerFiles.every(isTestFile)) {
    return "Update tests";
  }

  return "Update staged changes";
}

function buildSingleFileFallback(file: string): string {
  const lower = file.toLowerCase();

  if (isDocumentationFile(lower)) {
    return "Update documentation";
  }

  if (isDependencyFile(lower)) {
    return "Update dependencies";
  }

  if (isTestFile(lower)) {
    return "Update tests";
  }

  if (lower.includes("migration")) {
    return "Update database migration";
  }

  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass")) {
    return "Update styles";
  }

  return `Update ${toReadableFileName(file)}`;
}

function isDocumentationFile(file: string): boolean {
  return file.endsWith(".md") || file.includes("readme") || file.includes("docs/");
}

function isDependencyFile(file: string): boolean {
  return (
    file.endsWith("package.json") ||
    file.endsWith("package-lock.json") ||
    file.endsWith("pnpm-lock.yaml") ||
    file.endsWith("yarn.lock")
  );
}

function isTestFile(file: string): boolean {
  return (
    file.includes(".test.") ||
    file.includes(".spec.") ||
    file.includes("__tests__") ||
    file.includes("/test/") ||
    file.includes("/tests/")
  );
}

function toReadableFileName(file: string): string {
  const baseName = file.split(/[\\/]/).pop() || "file";

  return baseName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}