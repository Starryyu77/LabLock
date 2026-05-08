import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const lablock = join(repoRoot, 'bin/lablock.ts');
const tmpRoot = join(repoRoot, 'tests/.tmp');

async function run(
  args: string[],
  cwd: string,
  options: { expectCode?: number | null; env?: Record<string, string> } = {},
) {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, LABLOCK_HOME: repoRoot, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (options.expectCode !== null && code !== (options.expectCode ?? 0)) {
    throw new Error(`${args.join(' ')} exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return { stdout, stderr, code };
}

async function git(cwd: string, args: string[], expectCode = 0) {
  return run(['git', ...args], cwd, { expectCode });
}

let cwd = '';

beforeEach(async () => {
  await mkdir(tmpRoot, { recursive: true });
  cwd = await mkdtemp(join(tmpRoot, 'e2e-'));
  await git(cwd, ['init']);
  await git(cwd, ['config', 'user.email', 'lablock@example.com']);
  await git(cwd, ['config', 'user.name', 'LabLock Test']);
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('LabLock E2E lifecycle', () => {
  test('init, drift block, override, fork, and drift audit', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'E2E', '--modules', 'gpu,data,lit', '--ci-mode', 'warn-only'], cwd);
    await writeFile(join(cwd, 'src-model.txt'), 'base\n');
    await git(cwd, ['add', '.']);
    await git(cwd, ['commit', '-m', 'init']);

    await run([
      process.execPath,
      lablock,
      'exp-init',
      'baseline',
      '--hypothesis',
      'Baseline locks the optimizer learning rate.',
      '--config',
      'optimizer.lr=0.001,seed=1',
      '--control-modified',
      'baseline config',
      '--file-invariant',
      'src-model.txt:base model must stay fixed',
      '--kill',
      'loss diverges',
      '--success',
      'baseline runs',
      '--stage',
    ], cwd);
    await git(cwd, ['commit', '-m', 'create baseline']);
    await writeFile(join(cwd, '.lablock/state/current-exp'), 'exp-001\n');

    const configPath = join(cwd, 'experiments/exp-001-baseline/config.yaml');
    await writeFile(configPath, 'optimizer:\n  lr: 0.002\nseed: 1\n');
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
      'Need to test the scheduler at a lower learning rate.',
    ], cwd);
    expect(override.stdout).toContain('Override recorded: chg-');
    await git(cwd, ['commit', '-m', 'accept lr drift']);
    const lastOverrideCommit = await git(cwd, ['log', '-1', '--format=%B']);
    expect(lastOverrideCommit.stdout).toContain('LabLock-Override: chg-');

    await writeFile(join(cwd, 'src-model.txt'), 'changed\n');
    await git(cwd, ['add', 'src-model.txt']);
    const fork = await run([
      process.execPath,
      lablock,
      'fork',
      '--from',
      'exp-001',
      '--shortname',
      'model-fork',
      '--reason',
      'Model invariant changed and should become a new baseline.',
      '--stage',
    ], cwd);
    expect(fork.stdout).toContain('Experiment forked: exp-001 -> exp-002');
    await git(cwd, ['commit', '-m', 'fork model drift']);

    const audit = await run([process.execPath, join(repoRoot, 'bin/lablock-drift-audit.ts'), '--strict', '--json'], cwd);
    expect(audit.stdout).toContain('"unaccounted": []');
  });
});
