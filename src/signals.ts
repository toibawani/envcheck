import { Exit } from "./exit.ts";

type Cleanup = () => void | Promise<void>;

const cleanups: Cleanup[] = [];
let armed = false;
let tripped = false;

export function onAbort(fn: Cleanup): () => void {
  cleanups.push(fn);
  return () => {
    const i = cleanups.indexOf(fn);
    if (i >= 0) cleanups.splice(i, 1);
  };
}

export function aborted(): boolean {
  return tripped;
}

export function armSignals(): void {
  if (armed) return;
  armed = true;
  process.on("SIGINT", () => {
    if (tripped) {
      process.exit(Exit.Interrupted);
    }
    tripped = true;
    void (async () => {
      for (const fn of [...cleanups].reverse()) {
        try {
          await fn();
        } catch {
          // cleanup must not mask the interrupt
        }
      }
      process.exit(Exit.Interrupted);
    })();
  });
}
