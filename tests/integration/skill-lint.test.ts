import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
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

  test('implementation handoff mode has a coding-agent template', async () => {
    const skill = await readFile(join(repoRoot, 'lab-handoff/SKILL.md'), 'utf8');
    const template = await readFile(join(repoRoot, 'templates/handoff-implementation.md.tmpl'), 'utf8');
    expect(skill).toContain('implementation');
    expect(skill).toContain('coding agent');
    expect(template).toContain('## Research objective to preserve');
    expect(template).toContain('Do not add broad defensive gates');
  });
});
