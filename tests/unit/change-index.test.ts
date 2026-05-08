import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendChangeIndex, changesForExp } from '../../lib/change-index.ts';

describe('change index', () => {
  test('append and query by experiment', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lablock-index-'));
    const prev = process.cwd();
    try {
      process.chdir(dir);
      await mkdir('.lablock/state', { recursive: true });
      await appendChangeIndex({
        change_id: 'chg-A12F3B9C',
        commit: 'a'.repeat(40),
        exp: 'exp-001',
        tag: 'CODE',
        files_changed: 1,
        time: '2026-05-08T00:00:00Z',
      });
      expect(await changesForExp('exp-001')).toHaveLength(1);
    } finally {
      process.chdir(prev);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
