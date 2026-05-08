import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileHash, verifyFilesLayer } from '../../lib/lock.ts';

describe('lock', () => {
  test('working file invariant detects drift', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lablock-lock-'));
    const prev = process.cwd();
    try {
      process.chdir(dir);
      await mkdir('src');
      await writeFile('src/a.txt', 'a');
      const hash = await fileHash('src/a.txt');
      await writeFile('src/a.txt', 'b');
      const drift = await verifyFilesLayer({
        exp_id: 'exp-001',
        shortname: 'baseline',
        hypothesis: 'x',
        parent: null,
        created: '2026-05-08',
        status: 'active',
        locked_invariants: { files: [{ path: 'src/a.txt', hash, reason: 'test' }] },
        controlled_changes: { modified: ['x'] },
        kill_criteria: ['bad'],
        success_criteria: ['good'],
      }, 'working');
      expect(drift).toHaveLength(1);
    } finally {
      process.chdir(prev);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
