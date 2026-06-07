import { execFileSync } from "node:child_process";

export function copyToClipboard(text: string): void {
  const value = text.trim();

  if (!value) {
    throw new Error("Cannot copy empty text to clipboard");
  }

  const commands = getClipboardCommands();

  for (const command of commands) {
    try {
      execFileSync(command.command, command.args, {
        input: value,
        stdio: ["pipe", "ignore", "ignore"],
      });

      return;
    } catch {
      // Try next clipboard command.
    }
  }

  throw new Error("No supported clipboard command found");
}

function getClipboardCommands(): Array<{ command: string; args: string[] }> {
  if (process.platform === "win32") {
    return [
      {
        command: "clip.exe",
        args: [],
      },
      {
        command: "powershell.exe",
        args: [
          "-NoProfile",
          "-Command",
          "Set-Clipboard -Value ([Console]::In.ReadToEnd())",
        ],
      },
    ];
  }

  if (process.platform === "darwin") {
    return [
      {
        command: "pbcopy",
        args: [],
      },
    ];
  }

  return [
    {
      command: "wl-copy",
      args: [],
    },
    {
      command: "xclip",
      args: ["-selection", "clipboard"],
    },
    {
      command: "xsel",
      args: ["--clipboard", "--input"],
    },
  ];
}