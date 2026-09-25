import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";

export function assertInteractive(): void {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new EnvcheckError(
      Exit.Usage,
      "envcheck fix needs a terminal.",
      "stdin is not a TTY, so a prompt would hang forever waiting for input that CI will never send.",
      "Run envcheck fix in a terminal, or use envcheck check --json in CI.",
    );
  }
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(question);
    return answer;
  } finally {
    rl.close();
  }
}

export async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}
