import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFrontmatter, writeFrontmatter, updateFrontmatter } from '../../lib/frontmatter.ts';

describe('frontmatter', () => {
  test('round trip with update', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lablock-frontmatter-'));
    const path = join(dir, 'doc.md');
    try {
      await writeFrontmatter(path, { id: 'exp-001', status: 'planned' }, '# Body\n');
      await updateFrontmatter(path, { status: 'done' });
      const doc = await readFrontmatter(path);
      expect(doc.frontmatter).toEqual({ id: 'exp-001', status: 'done' });
      expect(doc.body).toBe('# Body\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
