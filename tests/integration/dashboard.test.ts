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

let cwd = '';

beforeEach(async () => {
  await mkdir(tmpRoot, { recursive: true });
  cwd = await mkdtemp(join(tmpRoot, 'dashboard-'));
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('experiment dashboard', () => {
  test('migrated legacy nodes appear in dashboard data', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'Migrated Lab'], cwd);
    await mkdir(join(cwd, 'legacy-runs/run-a'), { recursive: true });
    await writeFile(join(cwd, 'legacy-runs/run-a/summary.md'), '# Run A\n\nAccuracy improved in the old run.\n');

    await run([
      process.execPath,
      lablock,
      'migrate-node',
      'legacy-run-a',
      '--source',
      'legacy-runs/run-a',
      '--source-type',
      'run',
      '--status',
      'done',
      '--confidence',
      'high',
      '--hypothesis',
      'Legacy run A improved downstream accuracy.',
    ], cwd);

    const data = JSON.parse((await run([process.execPath, lablock, 'dashboard', '--json'], cwd)).stdout);
    expect(data.summary.total).toBe(1);
    expect(data.summary.done).toBe(1);
    expect(data.experiments[0].shortname).toBe('legacy-run-a');
    expect(data.experiments[0].lock_status).toBe('finalized');
    expect(data.experiments[0].progress.summary).toContain('Imported from legacy run');
    expect(data.experiments[0].config.some((row: any) => row.key === 'migration.source_path' && row.value === 'legacy-runs/run-a')).toBe(true);
  });

  test('generates static HTML and JSON from experiment files', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'Dashboard Lab', '--goal', 'Track several experiment lines'], cwd);
    await run([
      process.execPath,
      lablock,
      'exp-init',
      'baseline',
      '--hypothesis',
      'Baseline establishes the first reliable score.',
      '--config',
      'optimizer.lr=0.001,seed=1',
      '--control-modified',
      'baseline training loop',
      '--matrix-id',
      'mat-001',
      '--variable-id',
      'var-001',
      '--canonical-variable',
      'training_loop_variant',
      '--variant-value',
      'baseline',
      '--paper-label',
      'Baseline training loop',
      '--success',
      'baseline score is reproduced',
      '--kill',
      'loss diverges',
    ], cwd);
    await run([
      process.execPath,
      lablock,
      'exp-init',
      'lr-sweep',
      '--parent',
      'exp-001',
      '--hypothesis',
      'Lower learning rate improves stability.',
      '--config',
      'optimizer.lr=0.0005,seed=1',
      '--control-modified',
      'learning rate schedule',
    ], cwd);
    await writeFile(
      join(cwd, 'experiments/exp-001-baseline/results.md'),
      '# Results: exp-001\n\n## Progress\n\n- queued first training run\n\n## Next sub-experiments\n\n- exp-003 seed sweep after baseline\n',
    );

    const runResult = await run([process.execPath, lablock, 'dashboard'], cwd);
    expect(runResult.stdout).toContain('.lablock/dashboard/data.json');
    expect(runResult.stdout).toContain('.lablock/dashboard/index.html');

    const data = JSON.parse(await readFile(join(cwd, '.lablock/dashboard/data.json'), 'utf8'));
    expect(data.project.name).toBe('Dashboard Lab');
    expect(data.summary.total).toBe(2);
    expect(data.summary.planned).toBe(2);
    expect(data.experiments[0].children).toContain('exp-002');
    expect(data.experiments[0].naming.matrix_id).toBe('mat-001');
    expect(data.experiments[0].naming.canonical_variable).toBe('training_loop_variant');
    expect(data.experiments[0].next_subexperiments.join('\n')).toContain('exp-002 lr-sweep');
    expect(data.experiments[0].next_subexperiments.join('\n')).toContain('exp-003 seed sweep');
    expect(data.experiments[0].progress.summary).toContain('queued first training run');

    const html = await readFile(join(cwd, '.lablock/dashboard/index.html'), 'utf8');
    expect(html).toContain('Dashboard Lab Experiment Board');
    expect(html).toContain('Search experiments');
    expect(html).toContain('Baseline training loop');
    expect(html).toContain('class="lanes"');
    expect(html).toContain('data-exp-nav="exp-001"');
    expect(html).toContain('exp-002');

    const jsonOnly = await run([process.execPath, lablock, 'dashboard', '--json'], cwd);
    expect(JSON.parse(jsonOnly.stdout).summary.total).toBe(2);

    const openWithoutHtml = await run([process.execPath, lablock, 'dashboard', '--no-html', '--open'], cwd, 1);
    expect(openWithoutHtml.stderr).toContain('--open requires HTML output');
  });
});
