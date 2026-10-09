// Subprocess for testing the SIGINT trip path in src/signals.ts.
// Receives its marker path from the parent via SIGTEST_MARKER env.
import { armSignals, onAbort } from '../../src/signals.ts';
import { writeFileSync } from 'node:fs';

const marker = process.env.SIGTEST_MARKER;
if (!marker) throw new Error('SIGTEST_MARKER env not set');
// Signal we started.
writeFileSync(process.env.SIGTEST_LOG || '/tmp/sigtest-start', 'started', 'utf8');

armSignals();
// Wrap: we can\'t easily patch process.on, so instead test the tripped path differently below.

// Diagnostic: if this SIGINT trip code runs, it will be logged.
const handlerLog = () => {
  writeFileSync(process.env.SIGTEST_LOG + '.handler', 'handler-ran', 'utf8');
};

const cleanup = onAbort(async () => {
  writeFileSync(marker, 'cleanup-ran', 'utf8');
  writeFileSync(process.env.SIGTEST_LOG + '.cleanup', 'cleanup-started', 'utf8');
  // Long async cleanup so a second SIGINT can arrive while it is pending.
  await new Promise((r) => setTimeout(r, 5000));
  writeFileSync(process.env.SIGTEST_LOG + '.cleanup-done', 'cleanup-done', 'utf8');
});

// Signal readiness to the parent.
writeFileSync(marker + '.ready', 'ready', 'utf8');
// The child hangs here until the test sends SIGINT (use a timer, not top-level await,
// because a pending top-level await prevents SIGINT handlers from firing).
setInterval(() => {}, 10000);
