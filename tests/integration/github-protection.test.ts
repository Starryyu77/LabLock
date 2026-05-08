import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const lablock = join(repoRoot, 'bin/lablock.ts');
const tmpRoot = join(repoRoot, 'tests/.tmp');

async function run(args: string[], cwd: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, ...env, LABLOCK_HOME: repoRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`);
  return { stdout, stderr, code };
}

let cwd = '';
let binDir = '';

beforeEach(async () => {
  await mkdir(tmpRoot, { recursive: true });
  cwd = await mkdtemp(join(tmpRoot, 'github-protection-'));
  binDir = join(cwd, 'bin');
  await mkdir(binDir);
  const gh = `#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  "--version")
    echo "gh version 2.0.0"
    ;;
  "auth status")
    exit 0
    ;;
  "api repos/Starryyu77/LabLock/branches/main/protection")
    echo "gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)" >&2
    echo '{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","status":"403"}' >&2
    exit 1
    ;;
  *)
    echo "unexpected gh call: $*" >&2
    exit 2
    ;;
esac
`;
  await writeFile(join(binDir, 'gh'), gh);
  await chmod(join(binDir, 'gh'), 0o755);
});

afterEach(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

describe('github-protection', () => {
  test('reports branch protection API 403 as unavailable', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'check',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'main',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` });
    const payload = JSON.parse(out.stdout);
    expect(payload.repo).toBe('Starryyu77/LabLock');
    expect(payload.results[0].status).toBe('unavailable');
    expect(payload.results[0].api_status).toBe(403);
  });
});
