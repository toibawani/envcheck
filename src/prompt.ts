import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { EnvcheckError } from './errors.ts';
import { Exit } from './exit.ts';

type ConfirmFn = (question: string) => Promise<boolean>;
type AskFn = (question: string) => Promise<string>;

// PRIVATE: test hooks that allow injecting prompt behavior.
let testConfirm: ConfirmFn | undefined;
let testAsk: AskFn | undefined;

export function assertInteractive(): void {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new EnvcheckError(
      Exit.Usage,
      'envcheck fix needs a terminal.',
      'stdin is not a TTY, so a prompt would hang forever waiting for input that CI will never send.',
      'Run envcheck fix in a terminal, or use envcheck check --json in CI.',
    );
  }
}

export async function ask(question: string): Promise<string> {
  if (testAsk) {
    return testAsk(question);
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(question);
    return answer;
  } finally {
    rl.close();
  }
}

export async function confirm(question: string): Promise<boolean> {
  if (testConfirm) {
    return testConfirm(question);
  }
  const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

// PRIVATE: override the prompts used by fixFile during tests.
export function _setPrompts(confirmFn: ConfirmFn | undefined, askFn: AskFn | undefined): void {
  testConfirm = confirmFn;
  testAsk = askFn;
}
