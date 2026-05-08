import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const lablock = join(repoRoot, 'bin/lablock.ts');
const tmpRoot = join(repoRoot, 'tests/.tmp');

async function run(args: string[], cwd: string, env: Record<string, string> = {}, expectCode = 0) {
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
  if (code !== expectCode) throw new Error(`${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`);
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
  "api repos/Starryyu77/LabLock/branches/good/protection")
    cat <<'JSON'
{"required_status_checks":{"strict":true,"contexts":["lablock-checks"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":{"required_approving_review_count":1},"allow_force_pushes":{"enabled":false},"allow_deletions":{"enabled":false}}
JSON
    ;;
  "api repos/Starryyu77/LabLock/branches/bad/protection")
    cat <<'JSON'
{"required_status_checks":{"strict":true,"contexts":["unit-tests"]},"enforce_admins":{"enabled":false},"required_pull_request_reviews":{"required_approving_review_count":0},"allow_force_pushes":{"enabled":true},"allow_deletions":{"enabled":false}}
JSON
    ;;
  "api repos/Starryyu77/LabLock/branches/merge/protection")
    cat <<'JSON'
{"required_status_checks":{"strict":true,"contexts":["unit-tests"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":{"required_approving_review_count":2,"require_code_owner_reviews":true},"allow_force_pushes":{"enabled":false},"allow_deletions":{"enabled":false}}
JSON
    ;;
  "api repos/Starryyu77/LabLock/branches/new/protection")
    echo '{"message":"Branch not protected","status":"404"}' >&2
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

  test('reports compliant protection when policy is satisfied', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'check',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'good',
      '--required-status',
      'lablock-checks',
      '--required-reviews',
      '1',
      '--strict',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` });
    const payload = JSON.parse(out.stdout);
    expect(payload.results[0].compliance).toBe('passed');
  });

  test('strict mode exits nonzero when protection is noncompliant', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'check',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'bad',
      '--required-status',
      'lablock-checks',
      '--required-reviews',
      '1',
      '--strict',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` }, 1);
    const payload = JSON.parse(out.stdout);
    expect(payload.results[0].compliance).toBe('failed');
    expect(payload.results[0].missing).toContain('required_status_checks:lablock-checks');
    expect(payload.results[0].dangerous).toContain('allow_force_pushes=true');
  });

  test('apply requires an explicit required status policy unless overridden', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'apply',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'good',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` }, 1);
    expect(out.stderr).toContain('requires --required-status');
  });

  test('apply dry-run prints planned replacement payload without writing', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'apply',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'dry',
      '--required-status',
      'lablock-checks',
      '--required-reviews',
      '1',
      '--replace',
      '--dry-run',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` });
    const payload = JSON.parse(out.stdout);
    expect(payload.results[0].status).toBe('would-apply');
    expect(payload.results[0].planned_payload.required_status_checks.contexts).toEqual(['lablock-checks']);
  });

  test('apply dry-run can plan protection for an unprotected branch', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'apply',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'new',
      '--required-status',
      'lablock-checks',
      '--dry-run',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` });
    const payload = JSON.parse(out.stdout);
    expect(payload.results[0].status).toBe('would-apply');
    expect(payload.results[0].mode).toBe('merge-existing');
    expect(payload.results[0].planned_payload.restrictions).toBeNull();
  });

  test('apply dry-run merge preserves existing stricter settings', async () => {
    const out = await run([
      process.execPath,
      lablock,
      'github-protection',
      'apply',
      '--repo',
      'Starryyu77/LabLock',
      '--branch',
      'merge',
      '--required-status',
      'lablock-checks',
      '--required-reviews',
      '1',
      '--dry-run',
      '--json',
    ], cwd, { PATH: `${binDir}:${process.env.PATH ?? ''}` });
    const planned = JSON.parse(out.stdout).results[0].planned_payload;
    expect(planned.required_status_checks.contexts).toContain('unit-tests');
    expect(planned.required_status_checks.contexts).toContain('lablock-checks');
    expect(planned.required_pull_request_reviews.required_approving_review_count).toBe(2);
    expect(planned.required_pull_request_reviews.require_code_owner_reviews).toBe(true);
  });
});
