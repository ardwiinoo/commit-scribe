export type BuildCommitPromptParams = {
  files: string[];
  diff: string;
  maxMessageWords: number;
};

export function buildCommitPrompt(params: BuildCommitPromptParams): string {
  const symbols = extractSymbolsFromDiff(params.diff);

  const detectedSymbolsText =
    symbols.length > 0
      ? `\nDetected symbols:\n${symbols.map((symbol) => `- ${symbol}`).join("\n")}\n`
      : "";

  return `
You are a senior software engineer.

Generate one clear git commit message from the staged git diff.

Message style:
- Use simple English.
- Start with Add, Update, Fix, Remove, Refactor, Improve, or Rename.
- Prefer mentioning the changed function, method, class, struct, component, or module when visible.
- If a method belongs to a struct/class, use this style: "Add methodName in StructName for purpose".
- Keep it under ${params.maxMessageWords} words.
- Do not use Conventional Commit format.
- Do not include markdown.
- Do not explain.
- Output only the commit message.
- Do not invent names that are not shown in the diff.

Good examples:
Add GenerateCommitMessage in CommitService for staged diff summaries
Update BannerCard validation for deleted uploaded images
Fix GetDealOrderOptions in productService for active deal sorting
Improve CVEditor preview for application kit editing
Refactor upload handler for cleaner PDF extraction

Files:
${params.files.map((file) => `- ${file}`).join("\n")}
${detectedSymbolsText}
Diff:
${params.diff}
`.trim();
}

export function extractSymbolsFromDiff(diff: string): string[] {
  const symbols = new Set<string>();
  const lines = diff.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    const content = line.startsWith("+") || line.startsWith(" ") ? line.slice(1).trim() : line;

    collectGoSymbols(content, symbols);
    collectTypeScriptSymbols(content, symbols);
  }

  return Array.from(symbols).slice(0, 20);
}

function collectGoSymbols(line: string, symbols: Set<string>): void {
  const methodMatch = line.match(/^func\s+\([a-zA-Z_]\w*\s+\*?([a-zA-Z_]\w*)\)\s+([a-zA-Z_]\w*)\s*\(/);
  if (methodMatch) {
    const [, structName, methodName] = methodMatch;
    symbols.add(`${methodName} in ${structName}`);
    return;
  }

  const functionMatch = line.match(/^func\s+([a-zA-Z_]\w*)\s*\(/);
  if (functionMatch) {
    symbols.add(functionMatch[1]);
    return;
  }

  const structMatch = line.match(/^type\s+([a-zA-Z_]\w*)\s+struct\b/);
  if (structMatch) {
    symbols.add(structMatch[1]);
  }
}

function collectTypeScriptSymbols(line: string, symbols: Set<string>): void {
  const functionMatch = line.match(/^(export\s+)?(async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/);
  if (functionMatch) {
    symbols.add(functionMatch[3]);
    return;
  }

  const constFunctionMatch = line.match(/^(export\s+)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*(async\s*)?(\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/);
  if (constFunctionMatch) {
    symbols.add(constFunctionMatch[2]);
    return;
  }

  const classMatch = line.match(/^(export\s+)?class\s+([a-zA-Z_$][\w$]*)\b/);
  if (classMatch) {
    symbols.add(classMatch[2]);
    return;
  }

  const interfaceMatch = line.match(/^(export\s+)?interface\s+([a-zA-Z_$][\w$]*)\b/);
  if (interfaceMatch) {
    symbols.add(interfaceMatch[2]);
  }
}