import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { lockPath, PATHS } from './paths.ts';
import { ScopeLockSchema, type ScopeLock } from './types.ts';
import { ensureParent, pathExists } from './fs-util.ts';
import { headBlob, rawGit, stagedBlob } from './git.ts';

function dumpYaml(data: unknown): string {
  return yaml.dump(data, { lineWidth: 120, noRefs: true, sortKeys: false });
}

export async function readLock(expId: string): Promise<ScopeLock> {
  const path = lockPath(expId);
  const data = yaml.load(await readFile(path, 'utf8'));
  return ScopeLockSchema.parse(data);
}

export async function writeLock(lock: ScopeLock): Promise<void> {
  const parsed = ScopeLockSchema.parse(lock);
  const path = lockPath(lock.exp_id);
  await ensureParent(path);
  await writeFile(path, dumpYaml(parsed));
}

export async function listLocks(): Promise<ScopeLock[]> {
  let entries;
  try {
    entries = await readdir(PATHS.LOCKS_DIR);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const locks: ScopeLock[] = [];
  for (const entry of entries) {
    if (entry.endsWith('.scope.lock')) {
      locks.push(await readLock(entry.replace(/\.scope\.lock$/, '')));
    }
  }
  return locks;
}

export async function fileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
  });
}

export async function stagedFileHash(filePath: string): Promise<string> {
  const blob = await rawGit(['show', `:${filePath}`]);
  return `sha256:${createHash('sha256').update(blob).digest('hex')}`;
}

function getDotted(obj: any, dotted: string): unknown {
  return dotted.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

function flattenKeys(obj: Record<string, any>, prefix = ''): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenKeys(value, full));
    } else {
      rows.push({ key: full, value });
    }
  }
  return rows;
}

async function findExperimentConfig(expId: string): Promise<string | null> {
  const fromGit = await rawGit(['ls-files']).catch(() => '');
  const candidates = fromGit
    .split('\n')
    .filter((p) => new RegExp(`^experiments/${expId}-[^/]+/config\\.ya?ml$`).test(p));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) throw new Error(`${expId}: multiple config files found: ${candidates.join(', ')}`);

  let entries = [];
  try {
    entries = await readdir(PATHS.EXPERIMENTS, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const working = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(`${expId}-`)) continue;
    for (const name of ['config.yaml', 'config.yml']) {
      const rel = join(PATHS.EXPERIMENTS, entry.name, name).replaceAll('\\', '/');
      if (await pathExists(rel)) working.push(rel);
    }
  }
  if (working.length > 1) throw new Error(`${expId}: multiple config files found: ${working.join(', ')}`);
  return working[0] ?? null;
}

async function readTextForSource(path: string, source: 'staged' | 'working' | 'head'): Promise<string> {
  if (source === 'working') return readFile(path, 'utf8');
  if (source === 'staged') return stagedBlob(path);
  return headBlob(path);
}

export async function verifyConfigLayer(
  lock: ScopeLock,
  source: 'staged' | 'working' | 'head',
): Promise<Array<{ key: string; expected: any; actual: any }>> {
  const expected = lock.locked_invariants.config;
  if (!expected || Object.keys(expected).length === 0) return [];
  const path = await findExperimentConfig(lock.exp_id);
  if (!path) {
    return flattenKeys(expected).map(({ key, value }) => ({ key, expected: value, actual: undefined }));
  }
  const actualYaml = yaml.load(await readTextForSource(path, source)) ?? {};
  const drift = [];
  for (const { key, value } of flattenKeys(expected)) {
    const actual = getDotted(actualYaml, key);
    if (JSON.stringify(actual) !== JSON.stringify(value)) drift.push({ key, expected: value, actual });
  }
  return drift;
}

export async function verifyFilesLayer(
  lock: ScopeLock,
  source: 'staged' | 'working' | 'head',
): Promise<Array<{ path: string; expected_hash: string; actual_hash: string }>> {
  const invariants = lock.locked_invariants.files ?? [];
  const drift = [];
  for (const invariant of invariants) {
    let actual_hash: string;
    try {
      if (source === 'working') {
        actual_hash = await fileHash(invariant.path);
      } else if (source === 'staged') {
        actual_hash = await stagedFileHash(invariant.path);
      } else {
        const blob = await headBlob(invariant.path);
        actual_hash = `sha256:${createHash('sha256').update(blob).digest('hex')}`;
      }
    } catch {
      actual_hash = 'missing';
    }
    if (actual_hash !== invariant.hash) {
      drift.push({ path: invariant.path, expected_hash: invariant.hash, actual_hash });
    }
  }
  return drift;
}

export async function runProbes(
  lock: ScopeLock,
  runOn: 'local' | 'ci-exp' | 'ci-main' | 'manual',
  options?: { onlyNames?: string[]; abortSignal?: AbortSignal },
): Promise<Map<string, { passed: boolean; output: string; duration_ms: number; skipped?: boolean }>> {
  const result = new Map<string, { passed: boolean; output: string; duration_ms: number; skipped?: boolean }>();
  const probes = lock.locked_invariants.probes ?? [];
  for (const probe of probes) {
    if (options?.onlyNames && !options.onlyNames.includes(probe.name)) continue;
    if (!probe.run_on.includes(runOn)) {
      result.set(probe.name, { passed: true, output: '', duration_ms: 0, skipped: true });
      continue;
    }
    const started = Date.now();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options?.abortSignal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), probe.timeout_sec * 1000);
    try {
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(probe.command, { shell: true, signal: controller.signal });
        const chunks: Buffer[] = [];
        child.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
        child.stderr.on('data', (d) => chunks.push(Buffer.from(d)));
        child.on('error', reject);
        child.on('close', (code) => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (code === 0) resolve(text);
          else reject(new Error(text || `probe exited ${code}`));
        });
      });
      result.set(probe.name, { passed: true, output, duration_ms: Date.now() - started });
    } catch (error: any) {
      result.set(probe.name, { passed: false, output: error?.message ?? String(error), duration_ms: Date.now() - started });
    } finally {
      clearTimeout(timer);
      options?.abortSignal?.removeEventListener('abort', onAbort);
    }
  }
  return result;
}
