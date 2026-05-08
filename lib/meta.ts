import { unlink } from 'node:fs/promises';
import { PATHS } from './paths.ts';
import { CommitMetaSchema, type CommitMeta } from './types.ts';
import { atomicWrite, readTextIfExists } from './fs-util.ts';

export async function writeMeta(meta: CommitMeta): Promise<void> {
  await atomicWrite(PATHS.GIT_COMMIT_META, `${JSON.stringify(CommitMetaSchema.parse(meta), null, 2)}\n`);
}

export async function readMeta(): Promise<CommitMeta | null> {
  const text = await readTextIfExists(PATHS.GIT_COMMIT_META);
  if (text === null) return null;
  return CommitMetaSchema.parse(JSON.parse(text));
}

export async function clearMeta(): Promise<void> {
  try {
    await unlink(PATHS.GIT_COMMIT_META);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
