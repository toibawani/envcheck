import { isatty } from "node:tty";

export type Tone = "red" | "yellow" | "green" | "dim" | "bold" | "cyan";

let enabled = true;

export function colorEnabled(): boolean {
  return enabled;
}

export function configureColor(opts: { noColorFlag: boolean; json: boolean }): void {
  const envOff = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
  const dumb = process.env.TERM === "dumb";
  const piped = !isatty(1);
  enabled = !(opts.noColorFlag || opts.json || envOff || dumb || piped);
}

function wrap(open: string, close: string, text: string): string {
  if (!enabled) return text;
  return `\u001b[${open}m${text}\u001b[${close}m`;
}

export const c = {
  red: (s: string) => wrap("31", "39", s),
  yellow: (s: string) => wrap("33", "39", s),
  green: (s: string) => wrap("32", "39", s),
  dim: (s: string) => wrap("2", "22", s),
  bold: (s: string) => wrap("1", "22", s),
  cyan: (s: string) => wrap("36", "39", s),
};

export function paint(tone: Tone, text: string): string {
  return c[tone](text);
}
