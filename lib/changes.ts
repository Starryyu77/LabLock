import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CommitTag } from './types.ts';
import { changesPath } from './paths.ts';

export interface ChangeEntry {
  timestamp: string;
  tag: CommitTag;
  change_id: string;
  message: string;
}

const LINE_RE = /^(\S+)\s+\[([A-Z-]+)\]\s+change:(chg-[0-9A-Z]{8})\s+(.+)$/u;

export async function readChanges(expId: string): Promise<ChangeEntry[]> {
  const path = changesPath(expId);
  let text = '';
  try {
    text = await readFile(path, 'utf8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return text.split('\n').map(parseLine).filter((entry): entry is ChangeEntry => entry !== null);
}

export async function appendChange(expId: string, entry: ChangeEntry): Promise<void> {
  const path = changesPath(expId);
  await mkdir(dirname(path), { recursive: true });
  let prev = '';
  try {
    prev = await readFile(path, 'utf8');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const prefix = prev && !prev.endsWith('\n') ? '\n' : '';
  await writeFile(path, `${prev}${prefix}${formatEntry(entry)}\n`);
}

export function formatEntry(entry: ChangeEntry): string {
  const message = entry.message.replaceAll('\n', ' ');
  return `${entry.timestamp} [${entry.tag}] change:${entry.change_id} ${message}`;
}

export function parseLine(line: string): ChangeEntry | null {
  const match = line.match(LINE_RE);
  if (!match) return null;
  return {
    timestamp: match[1],
    tag: match[2] as CommitTag,
    change_id: match[3],
    message: match[4],
  };
}
