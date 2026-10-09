import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirm, ask, _setPrompts } from '../src/prompt.ts';

test('confirm uses the injected confirm function', async () => {
  const answers: string[] = [];
  try {
    _setPrompts(
      async (q) => {
        answers.push(q);
        return true;
      },
      async (q) => {
        throw new Error('ask should not be called when testConfirm is set');
      },
    );
    assert.equal(await confirm('hello'), true);
    assert.deepEqual(answers, ['hello']);
  } finally {
    _setPrompts(undefined, undefined);
  }
});

test('confirm returns false when the answer is not y/yes', async () => {
  const answers: string[] = [];
  try {
    _setPrompts(undefined, async (q) => {
      answers.push(q);
      return 'n';
    });
    assert.equal(await confirm('hello'), false);
    assert.deepEqual(answers, ['hello [y/N] ']);
  } finally {
    _setPrompts(undefined, undefined);
  }
});

test('confirm returns true for yes', async () => {
  const answers: string[] = [];
  try {
    _setPrompts(undefined, async (q) => {
      answers.push(q);
      return 'yes';
    });
    assert.equal(await confirm('hello'), true);
    assert.deepEqual(answers, ['hello [y/N] ']);
  } finally {
    _setPrompts(undefined, undefined);
  }
});

test('ask returns the question text', async () => {
  const answers: string[] = [];
  try {
    _setPrompts(undefined, async (q) => {
      answers.push(q);
      return 'answered';
    });
    assert.equal(await ask('what?'), 'answered');
    assert.deepEqual(answers, ['what?']);
  } finally {
    _setPrompts(undefined, undefined);
  }
});
