import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
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
  cwd = await mkdtemp(join(tmpRoot, 'lifecycle-'));
  await run(['git', 'init'], cwd);
  await run(['git', 'config', 'user.email', 'lablock@example.com'], cwd);
  await run(['git', 'config', 'user.name', 'LabLock Test'], cwd);
  await run([process.execPath, lablock, 'init-project', '--name', 'Lifecycle'], cwd);
  await run(['git', 'add', '.'], cwd);
  await run(['git', 'commit', '-m', 'init'], cwd);
  await run([
    process.execPath,
    lablock,
    'exp-init',
    'baseline',
    '--hypothesis',
    'Lifecycle baseline exists.',
    '--config',
    'optimizer.lr=0.001',
    '--control-modified',
    'baseline lifecycle',
    '--stage',
  ], cwd);
  await run(['git', 'commit', '-m', 'add exp'], cwd);
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('deterministic lifecycle CLI', () => {
  test('draft creates vNext objective and expert handoff skeletons', async () => {
    const objective = await run([
      process.execPath,
      lablock,
      'draft',
      'objective',
      '--exp',
      'exp-001',
      '--topic',
      'alignment',
      '--total-goal',
      'Improve agent research alignment.',
      '--stage-goal',
      'Create a monitorable objective.',
    ], cwd);
    expect(objective.stdout).toContain('experiments/exp-001-baseline/objective.md');
    const objectiveBody = await readFile(join(cwd, 'experiments/exp-001-baseline/objective.md'), 'utf8');
    expect(objectiveBody).toContain('Improve agent research alignment.');
    expect(objectiveBody).toContain('Create a monitorable objective.');
    expect(objectiveBody).toContain('Do not add broad defensive gates');

    const handoff = await run([
      process.execPath,
      lablock,
      'draft',
      'expert-consultation',
      '--topic',
      'alignment-failure',
      '--specific-ask',
      'Diagnose why the experiment drifted.',
      '--problem',
      'The agent added unrelated validators instead of testing the hypothesis.',
    ], cwd);
    expect(handoff.stdout).toContain('handoffs/outgoing/');
    const handoffPath = handoff.stdout.trim();
    const handoffBody = await readFile(join(cwd, handoffPath), 'utf8');
    expect(handoffBody).toContain('Diagnose why the experiment drifted.');
    expect(handoffBody).toContain('The agent added unrelated validators instead of testing the hypothesis.');
  });

  test('finalize, postmortem, and cleanup-pr dry-run', async () => {
    const finalize = await run([process.execPath, lablock, 'exp-finalize', '--exp', 'exp-001', '--status', 'killed'], cwd);
    expect(finalize.stderr).not.toContain('LabLock warning');
    const hypothesis = await readFile(join(cwd, 'experiments/exp-001-baseline/hypothesis.md'), 'utf8');
    expect(hypothesis).toContain('status: killed');
    const lock = await readFile(join(cwd, '.lablock/locks/exp-001.scope.lock'), 'utf8');
    expect(lock).toContain('status: superseded');

    const pm = await run([process.execPath, lablock, 'postmortem', '--exp', 'exp-001'], cwd);
    expect(pm.stdout).toContain('postmortem.md');
    expect(await readFile(join(cwd, 'experiments/exp-001-baseline/postmortem.md'), 'utf8')).toContain('Conditions to revive');

    const cleanup = await run([process.execPath, lablock, 'cleanup-pr', '--exp', 'exp-001', '--json'], cwd);
    expect(JSON.parse(cleanup.stdout).exp).toBe('exp-001');
  });
});
