import { describe, expect, test } from 'bun:test';
import { classifyDiff, suggestTag } from '../../lib/classify.ts';

describe('classify', () => {
  test('formalism file is formalism', () => {
    const files = classifyDiff('diff --git a/formalism.md b/formalism.md\n+new\n');
    expect(files[0].category).toBe('formalism');
  });

  test('debug print in utility is debug-noise', () => {
    const files = classifyDiff('diff --git a/tools/train.py b/tools/train.py\n+print("x")\n');
    expect(files[0].category).toBe('debug-noise');
  });

  test('experiment results suggest result tag', () => {
    const files = classifyDiff('diff --git a/experiments/exp-007-foo/results.md b/experiments/exp-007-foo/results.md\n+acc: 1\n');
    expect(files[0].reasons).toContain('results');
    expect(suggestTag(files, null)).toBe('RESULT');
  });
});
