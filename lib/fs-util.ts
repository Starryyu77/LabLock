import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error: any) {
    if (error?.code === 'EISDIR') return true;
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function atomicWrite(path: string, content: string): Promise<void> {
  await ensureParent(path);
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, content);
  await rename(tmp, path);
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
