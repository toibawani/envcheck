import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(testDir, '..');

const marker = join(tmpdir(), 'envcheck-sig-child-ready-' + process.pid);
const child = spawn(
  'node',
  ['--experimental-strip-types', join(projectRoot, 'test/fixtures/sigint-child.mjs')],
  {
    cwd: projectRoot,
    env: { ...process.env, FORCE_NO_COLOR: '1', SIGTEST_READY: marker, SIGTEST_TMPDIR: tmpdir() },
  },
);
child.stderr.on('data', (d) => console.log('ERR:', d.toString().slice(0, 400)));
child.on('exit', (c) => console.log('EXIT:', c));
child.on('error', (e) => console.log('ERRONEOUS:', e.message));
let waited = 0;
const poll = setInterval(() => {
  if (existsSync(marker)) {
    console.log('READY FOUND');
    clearInterval(poll);
  }
  waited++;
  if (waited > 100) {
    console.log('TIMEOUT');
    child.kill('SIGKILL');
    clearInterval(poll);
  }
}, 10);
await new Promise(() => {});
