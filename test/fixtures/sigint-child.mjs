// Subprocess for testing that writeAtomic's onAbort temp-file cleanup runs
// when the process receives SIGINT mid-write.
import { writeAtomic } from '../../src/atomic.ts';
import { writeFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const ready = process.env.SIGTEST_READY;
if (!ready) throw new Error('SIGTEST_READY env not set');
writeFileSync(ready, 'ready', 'utf8');

// The .current heartbeat file always holds the path of the tmp currently
// being written. On a SIGINT hit, the onAbort handler unlinks it. On a miss,
// the orphaned tmp remains on disk and the child exits 130 via Node's default.
const tmpdir = process.env.SIGTEST_TMPDIR || '/tmp';
const deadline = Date.now() + 2000;
while (Date.now() < deadline) {
  const tmp = join(tmpdir, 'envcheck-' + randomBytes(6).toString('hex') + '.tmp');
  writeFileSync(ready + '.current', tmp, 'utf8');
  // Don't catch: if the handler cleaned the tmp, renameSync throws ENOENT and
  // this process crashes (the orphan-proof is that the current tmp is gone).
  writeAtomic(tmp, 'A=1\n', undefined);
}

// Only reached if SIGINT never landed mid-write.
writeFileSync(ready + '.done', 'done', 'utf8');
