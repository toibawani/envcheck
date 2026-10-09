import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(testDir, '..');

const marker = join(tmpdir(), 'envcheck-sig-child-ready-' + process.pid);
const doneMarker = marker + '.done';
const tmpMarker = marker + '.tmp';
const logFile = '/tmp/atomic-sig-child.log';

for (let attempt = 0; attempt < 6; attempt++) {
  const child = spawn(
    'node',
    ['--experimental-strip-types', join(projectRoot, 'test/fixtures/sigint-child.mjs')],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        SIGTEST_READY: marker,
        SIGTEST_TMPDIR: tmpdir(),
        SIGTEST_LOG: logFile,
      },
    },
  );
  child.stderr.on('data', (d) => console.log('CHILD ERR:', d.toString().slice(0, 300)));
  let status = null;
  child.on('exit', (c) => {
    status = c;
    console.log('CHILD EXIT:', c);
  });

  // Wait for ready
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('never ready'));
    }, 3000);
    const poll = setInterval(() => {
      if (existsSync(marker)) {
        clearInterval(poll);
        clearTimeout(to);
        resolve();
      }
    }, 5);
  });
  console.log('ready, attempt', attempt, 'sending SIGINT at', Date.now());
  child.kill('SIGINT');

  const { status: s } = await new Promise((resolve) => {
    child.once('exit', (c) => resolve({ status: c }));
  });
  console.log('attempt', attempt, 'status:', s);

  if (existsSync(logFile)) {
    const lines = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    console.log('  last tmp:', lines[lines.length - 1]);
    console.log('  last tmp exists:', existsSync(lines[lines.length - 1]));
    console.log('  doneMarker exists:', existsSync(doneMarker));
  }

  if (s === 1 && existsSync(logFile)) {
    const lines = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const lastTmp = lines[lines.length - 1];
    if (!existsSync(lastTmp) && !existsSync(doneMarker)) {
      console.log('SUCCESS');
      break;
    }
  }
  console.log('retrying...');
  await new Promise((r) => setTimeout(r, 150));
}
await new Promise(() => {});
