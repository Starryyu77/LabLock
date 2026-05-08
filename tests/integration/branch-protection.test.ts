import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const lablock = join(repoRoot, 'bin/lablock.ts');
const checkPush = join(repoRoot, 'bin/lablock-check-push.ts');
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

async function runWithInput(args: string[], cwd: string, input: string, expectCode = 0) {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, LABLOCK_HOME: repoRoot },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  proc.stdin.write(input);
  proc.stdin.end();
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
  cwd = await mkdtemp(join(tmpRoot, 'push-'));
  await run(['git', 'init'], cwd);
  await run(['git', 'config', 'user.email', 'lablock@example.com'], cwd);
  await run(['git', 'config', 'user.name', 'LabLock Test'], cwd);
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('branch protection checks', () => {
  test('rejects protected branch deletion, force push, and tag deletion', async () => {
    await run([process.execPath, lablock, 'init-project', '--name', 'Push', '--ci-mode', 'enforce'], cwd);
    await run(['git', 'add', '.'], cwd);
    await run(['git', 'commit', '-m', 'init'], cwd);
    const first = (await run(['git', 'rev-parse', 'HEAD'], cwd)).stdout.trim();
    await writeFile(join(cwd, 'README-extra.md'), 'extra\n');
    await run(['git', 'add', 'README-extra.md'], cwd);
    await run(['git', 'commit', '-m', 'second'], cwd);
    const second = (await run(['git', 'rev-parse', 'HEAD'], cwd)).stdout.trim();
    const zero = '0'.repeat(40);

    expect((await run([
      process.execPath,
      checkPush,
      '--local-ref',
      'refs/heads/main',
      '--local-sha',
      second,
      '--remote-ref',
      'refs/heads/main',
      '--remote-sha',
      first,
    ], cwd)).stdout.trim()).toBe('ok');

    const force = await run([
      process.execPath,
      checkPush,
      '--local-ref',
      'refs/heads/main',
      '--local-sha',
      first,
      '--remote-ref',
      'refs/heads/main',
      '--remote-sha',
      second,
    ], cwd, 1);
    expect(force.stdout).toContain('non-fast-forward push denied');

    const branchDelete = await run([
      process.execPath,
      checkPush,
      '--local-ref',
      'refs/heads/main',
      '--local-sha',
      zero,
      '--remote-ref',
      'refs/heads/main',
      '--remote-sha',
      second,
    ], cwd, 1);
    expect(branchDelete.stdout).toContain('protected branch deletion denied');

    const tagDelete = await run([
      process.execPath,
      checkPush,
      '--local-ref',
      'refs/tags/formalism-v1',
      '--local-sha',
      zero,
      '--remote-ref',
      'refs/tags/formalism-v1',
      '--remote-sha',
      second,
    ], cwd, 1);
    expect(tagDelete.stdout).toContain('protected tag deletion denied');

    const hookDelete = await runWithInput(
      ['bash', '.git/hooks/pre-push', 'origin', 'file:///tmp/remote.git'],
      cwd,
      `refs/heads/main ${zero} refs/heads/main ${second}\n`,
      1,
    );
    expect(`${hookDelete.stdout}\n${hookDelete.stderr}`).toContain('Push rejected by LabLock');
  });
});
