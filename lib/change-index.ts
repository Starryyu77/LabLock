import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PATHS } from './paths.ts';
import type { ChangeIndexEntry } from './types.ts';
import { grepCommits, rawGit } from './git.ts';

async function readIndex(): Promise<ChangeIndexEntry[]> {
  let text = '';
  try {
    text = await readFile(PATHS.STATE_CHANGE_INDEX, 'utf8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ChangeIndexEntry);
}

export async function appendChangeIndex(entry: ChangeIndexEntry): Promise<void> {
  await mkdir(dirname(PATHS.STATE_CHANGE_INDEX), { recursive: true });
  let prev = '';
  try {
    prev = await readFile(PATHS.STATE_CHANGE_INDEX, 'utf8');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await writeFile(PATHS.STATE_CHANGE_INDEX, `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${JSON.stringify(entry)}\n`);
}

export async function lookupCommit(changeId: string): Promise<string | null> {
  const found = (await readIndex()).find((entry) => entry.change_id === changeId);
  if (found) return found.commit;

  const commits = await grepCommits(`LabLock-Change: ${changeId}`);
  const commit = commits[0] ?? null;
  if (!commit) return null;

  await appendChangeIndex({
    change_id: changeId,
    commit,
    exp: null,
    tag: 'UNKNOWN',
    files_changed: 0,
    time: new Date().toISOString(),
  });
  return commit;
}

export async function changesForExp(expId: string): Promise<ChangeIndexEntry[]> {
  return (await readIndex()).filter((entry) => entry.exp === expId);
}

export async function rebuildIndex(): Promise<{ rebuilt: number }> {
  let out = '';
  try {
    out = await rawGit(['log', '--all', '--format=%H%x1f%cI%x1f%s%n%b%x1e']);
  } catch {
    return { rebuilt: 0 };
  }
  const rows: ChangeIndexEntry[] = [];
  for (const rec of out.split('\x1e')) {
    const trimmed = rec.trim();
    if (!trimmed) continue;
    const [header, ...bodyParts] = trimmed.split('\n');
    const [commit, time, subject] = header.split('\x1f');
    const body = bodyParts.join('\n');
    const changeIds = [...`${subject}\n${body}`.matchAll(/LabLock-Change:\s*(chg-[0-9A-Z]{8})/g)].map((m) => m[1]);
    for (const change_id of changeIds) {
      const tag = subject.match(/\]\[([A-Z-]+)\]/)?.[1] ?? 'UNKNOWN';
      const exp = subject.match(/^\[(exp-\d{3})\]/)?.[1] ?? null;
      rows.push({ change_id, commit, exp, tag, files_changed: 0, time });
    }
  }
  await mkdir(dirname(PATHS.STATE_CHANGE_INDEX), { recursive: true });
  await writeFile(PATHS.STATE_CHANGE_INDEX, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
  return { rebuilt: rows.length };
}
