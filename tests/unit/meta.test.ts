import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearMeta, readMeta, writeMeta } from '../../lib/meta.ts';

describe('meta', () => {
  test('write read clear', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lablock-meta-'));
    const prev = process.cwd();
    try {
      process.chdir(dir);
      await mkdir('.git');
      await writeMeta({
        schema_version: 1,
        exp_id: null,
        change_id: 'chg-A12F3B9C',
        tag: 'MAIN',
        classified_files: [],
        drift_layers: { config: [], files: [] },
        override_decision: null,
        override_reason: null,
        created_at: new Date().toISOString(),
      });
      expect((await readMeta())?.change_id).toBe('chg-A12F3B9C');
      await clearMeta();
      expect(await readMeta()).toBeNull();
    } finally {
      process.chdir(prev);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
