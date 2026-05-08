import { describe, expect, test } from 'bun:test';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');

async function run(args: string[], cwd: string, expectCode = 0) {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, LABLOCK_HOME: repoRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== expectCode) throw new Error(`${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`);
  return { stdout, stderr, code };
}

describe('skill lint', () => {
  test('all LabLock skills satisfy frontmatter and description limits', async () => {
    const result = await run([process.execPath, join(repoRoot, 'bin/lablock-skill-lint.ts'), '--json'], repoRoot);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('ok');
    expect(payload.checked).toBeGreaterThanOrEqual(23);
    expect(payload.issues).toEqual([]);
  });
});
