import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const lablock = join(repoRoot, 'bin/lablock.ts');
const tmpRoot = join(repoRoot, 'tests/.tmp');

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

let cwd = '';

beforeEach(async () => {
  await mkdir(tmpRoot, { recursive: true });
  cwd = await mkdtemp(join(tmpRoot, 'update-skills-'));
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('update-skills', () => {
  test('update dry-run plans pull install and skill refresh without writing', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'update',
      '--source',
      repoRoot,
      '--host',
      'codex',
      '--scope',
      'project',
      '--dry-run',
      '--json',
    ], cwd);
    const payload = JSON.parse(out.stdout);
    expect(payload.steps.git_pull).toBe('would-run');
    expect(payload.steps.bun_install).toBe('would-run');
    expect(payload.skill_update.results.some((r: any) => r.skill === 'lab-update' && r.result === 'would-create:symlink')).toBe(true);
    await expect(lstat(join(cwd, '.agents/skills/lab-update'))).rejects.toThrow();
  });

  test('update can refresh skills without pull or install', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'update',
      '--source',
      repoRoot,
      '--host',
      'codex',
      '--scope',
      'project',
      '--no-pull',
      '--no-install',
      '--json',
    ], cwd);
    const payload = JSON.parse(out.stdout);
    expect(payload.steps.git_pull).toBe('skipped');
    expect(payload.steps.bun_install).toBe('skipped');
    const labUpdate = payload.skill_update.results.find((r: any) => r.skill === 'lab-update');
    expect(labUpdate.result).toBe('symlinked');
    expect((await lstat(join(cwd, '.agents/skills/lab-update'))).isSymbolicLink()).toBe(true);
  });

  test('creates project-local codex symlinks for individual lab skills', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'update-skills',
      '--source',
      repoRoot,
      '--host',
      'codex',
      '--scope',
      'project',
      '--mode',
      'symlink',
      '--json',
    ], cwd);
    const payload = JSON.parse(out.stdout);
    const labInit = payload.results.find((r: any) => r.skill === 'lab-init');
    expect(labInit.result).toBe('symlinked');
    const target = join(cwd, '.agents/skills/lab-init');
    expect((await lstat(target)).isSymbolicLink()).toBe(true);
    expect(await realpath(target)).toBe(await realpath(join(repoRoot, 'lab-init')));
  });

  test('dry-run reports without writing', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'update-skills',
      '--source',
      repoRoot,
      '--host',
      'claude',
      '--scope',
      'project',
      '--dry-run',
      '--json',
    ], cwd);
    const payload = JSON.parse(out.stdout);
    expect(payload.results.some((r: any) => r.skill === 'lab-update' && r.result === 'would-create:symlink')).toBe(true);
  });
});
