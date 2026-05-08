import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  if (code !== expectCode) throw new Error(`${args.join(' ')} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  return { stdout, stderr, code };
}

async function git(cwd: string, args: string[], expectCode = 0) {
  return run(['git', ...args], cwd, expectCode);
}

let cwd = '';

beforeEach(async () => {
  await mkdir(tmpRoot, { recursive: true });
  cwd = await mkdtemp(join(tmpRoot, 'dogfood-'));
  await git(cwd, ['init']);
  await git(cwd, ['branch', '-M', 'main']);
  await git(cwd, ['config', 'user.email', 'lablock@example.com']);
  await git(cwd, ['config', 'user.name', 'LabLock Test']);
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('controlled dogfood rehearsal', () => {
  test('init, exp-start, drift override, finalize, postmortem, and audit', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'Dogfood', '--modules', 'gpu,data,lit'], cwd);
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src/model.py'), 'BASE = True\n');
    await git(cwd, ['add', '.']);
    await git(cwd, ['commit', '-m', 'init lablock']);

    await run([
      process.execPath,
      lablock,
      'exp-init',
      'baseline',
      '--hypothesis',
      'Baseline keeps optimizer and source invariant.',
      '--config',
      'optimizer.lr=0.001,seed=1',
      '--control-modified',
      'baseline config',
      '--file-invariant',
      'src/model.py:model source must stay fixed',
      '--stage',
    ], cwd);
    await git(cwd, ['commit', '-m', 'create baseline']);

    await run([process.execPath, lablock, 'exp-start', '--exp', 'exp-001', '--base', 'main'], cwd);
    expect((await git(cwd, ['branch', '--show-current'])).stdout.trim()).toBe('exp/exp-001-baseline');
    expect(await readFile(join(cwd, '.lablock/state/current-exp'), 'utf8')).toBe('exp-001\n');

    await writeFile(join(cwd, 'experiments/exp-001-baseline/config.yaml'), 'optimizer:\n  lr: 0.002\nseed: 1\n');
    await git(cwd, ['add', 'experiments/exp-001-baseline/config.yaml']);
    const blocked = await git(cwd, ['commit', '-m', 'change lr'], 1);
    expect(`${blocked.stdout}\n${blocked.stderr}`).toContain('SCOPE-DRIFT detected');

    const override = await run([
      process.execPath,
      lablock,
      'override',
      '--exp',
      'exp-001',
      '--reason',
      'Dogfood rehearsal accepts this learning-rate drift.',
    ], cwd);
    expect(override.stdout).toContain('Override recorded: chg-');
    await git(cwd, ['commit', '-m', 'accept lr drift']);
    expect((await git(cwd, ['log', '-1', '--format=%B'])).stdout).toContain('LabLock-Override: chg-');

    await run([process.execPath, lablock, 'exp-finalize', '--exp', 'exp-001', '--status', 'killed'], cwd);
    await run([process.execPath, lablock, 'postmortem', '--exp', 'exp-001'], cwd);
    await git(cwd, ['add', 'experiments/exp-001-baseline', '.lablock/locks/exp-001.scope.lock']);
    await git(cwd, ['commit', '-m', 'finalize exp-001']);

    const audit = await run([process.execPath, join(repoRoot, 'bin/lablock-drift-audit.ts'), '--strict', '--json'], cwd);
    expect(audit.stdout).toContain('"unaccounted": []');
    const frontmatter = await run([process.execPath, join(repoRoot, 'bin/lablock-frontmatter-check.ts'), '--strict'], cwd);
    expect(frontmatter.code).toBe(0);
  });
});
