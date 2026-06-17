import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

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
  test('init, drift warning, fork, and drift audit', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'E2E', '--modules', 'gpu,data,lit', '--ci-mode', 'warn-only'], cwd);
    const namingConfig = yaml.load(await readFile(join(cwd, '.lablock/naming.yaml'), 'utf8')) as any;
    expect(namingConfig.profile).toBe('paper-aligned');
    expect(await readFile(join(cwd, '.lablock/variables.yaml'), 'utf8')).toContain('variables: []');
    expect(await readFile(join(cwd, '.lablock/matrices.yaml'), 'utf8')).toContain('matrices: []');
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
      '--matrix-id',
      'mat-001',
      '--variable-id',
      'var-001',
      '--canonical-variable',
      'optimizer_lr',
      '--variant-value',
      '0.001',
      '--paper-label',
      'Baseline learning rate',
      '--file-invariant',
      'src-model.txt:base model must stay fixed',
      '--kill',
      'loss diverges',
      '--success',
      'baseline runs',
      '--stage',
    ], cwd);
    await git(cwd, ['commit', '-m', 'create baseline']);
    const lock = yaml.load(await readFile(join(cwd, '.lablock/locks/exp-001.scope.lock'), 'utf8')) as any;
    expect(lock.naming.matrix_id).toBe('mat-001');
    expect(lock.naming.canonical_variable).toBe('optimizer_lr');
    const hypothesis = yaml.load((await readFile(join(cwd, 'experiments/exp-001-baseline/hypothesis.md'), 'utf8')).split('---')[1]) as any;
    expect(hypothesis.naming.paper_label).toBe('Baseline learning rate');
    const matrix = await readFile(join(cwd, 'experiments/matrix.md'), 'utf8');
    expect(matrix).toContain('exp-001');
    expect(matrix).not.toContain('No experiments yet');
    await writeFile(join(cwd, '.lablock/state/current-exp'), 'exp-001\n');

    const researchDebug = await run([
      process.execPath,
      lablock,
      'research-debug',
      '--topic',
      'loss-spike',
      '--symptom',
      'loss diverges after step 800',
    ], cwd);
    const reportPath = researchDebug.stdout.trim();
    expect(reportPath).toContain('reviews/');
    const report = await readFile(join(cwd, reportPath), 'utf8');
    expect(report).toContain('# Research Debug: loss spike');
    expect(report).toContain('loss diverges after step 800');
    expect(report).toContain('Baseline locks the optimizer learning rate.');
    expect(report).toContain('## External Research Plan');
    expect(report).toContain('## Local Code Analysis');

    const configPath = join(cwd, 'experiments/exp-001-baseline/config.yaml');
    await writeFile(configPath, 'optimizer:\n  lr: 0.002\nseed: 1\n');
    await git(cwd, ['add', 'experiments/exp-001-baseline/config.yaml']);
    const drift = await git(cwd, ['commit', '-m', 'change lr']);
    expect(`${drift.stdout}\n${drift.stderr}`).toContain('SCOPE-DRIFT warning');
    const lastDriftCommit = await git(cwd, ['log', '-1', '--format=%B']);
    expect(lastDriftCommit.stdout).toContain('[exp-001][SCOPE-DRIFT] change lr');
    expect(await readFile(join(cwd, '.lablock/changes/exp-001.changes.log'), 'utf8')).toContain('[SCOPE-DRIFT]');

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

    const audit = await run([process.execPath, join(repoRoot, 'bin/lablock-drift-audit.ts'), '--json'], cwd);
    expect(audit.stdout).toContain('"unaccounted": [');
  });

  test('pre-commit runs local probes when project config enables them', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'Probe E2E', '--modules', 'gpu,data,lit', '--ci-mode', 'warn-only'], cwd);
    await git(cwd, ['add', '.']);
    await git(cwd, ['commit', '-m', 'init']);

    await run([
      process.execPath,
      lablock,
      'exp-init',
      'probe-baseline',
      '--hypothesis',
      'Local probes are part of the experiment validity boundary.',
      '--config',
      'optimizer.lr=0.001',
      '--control-modified',
      'probe config',
      '--stage',
    ], cwd);
    await git(cwd, ['commit', '-m', 'create probe baseline']);

    await run([process.execPath, lablock, 'config', 'set', 'drift.layers.probes', 'local'], cwd);
    const lockPath = join(cwd, '.lablock/locks/exp-001.scope.lock');
    const lock = yaml.load(await readFile(lockPath, 'utf8')) as any;
    lock.locked_invariants.probes = [{
      name: 'always_fails_local',
      command: 'bun -e "process.exit(3)"',
      requires: ['cpu'],
      timeout_sec: 5,
      run_on: ['local'],
      reason: 'Regression test proving pre-commit honors drift.layers.probes=local.',
    }];
    await writeFile(lockPath, yaml.dump(lock, { lineWidth: 120, noRefs: true, sortKeys: false }));
    await git(cwd, ['add', '.lablock/config.yaml', '.lablock/locks/exp-001.scope.lock']);
    await git(cwd, ['commit', '-m', 'enable local probe']);

    await writeFile(join(cwd, '.lablock/state/current-exp'), 'exp-001\n');
    await writeFile(join(cwd, 'notes.md'), '# Notes\n\nNo scope changes.\n');
    await git(cwd, ['add', 'notes.md']);
    const drift = await git(cwd, ['commit', '-m', 'probe-gated note']);
    expect(`${drift.stdout}\n${drift.stderr}`).toContain('SCOPE-DRIFT warning');
    expect((await git(cwd, ['log', '-1', '--format=%B'])).stdout).toContain('[exp-001][SCOPE-DRIFT] probe-gated note');
  });
});
