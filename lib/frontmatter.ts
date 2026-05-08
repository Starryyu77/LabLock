import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { z } from 'zod';
import { ensureParent } from './fs-util.ts';

export interface ParsedDoc<T = Record<string, any>> {
  frontmatter: T;
  body: string;
  raw: string;
}

const DEFAULT_EXCLUDES = ['node_modules/', '.git/', '.lablock/cache/', 'paper/drafts/.history/'];

export async function readFrontmatter<T = Record<string, any>>(path: string): Promise<ParsedDoc<T>> {
  const raw = await readFile(path, 'utf8');
  const parsed = matter(raw, { language: 'yaml' });
  return {
    frontmatter: (parsed.data ?? {}) as T,
    body: parsed.content,
    raw,
  };
}

export async function writeFrontmatter<T extends Record<string, any>>(
  path: string,
  frontmatter: T,
  body: string,
): Promise<void> {
  await ensureParent(path);
  const rendered = matter.stringify(body, frontmatter, { language: 'yaml' });
  const wantsFinalNewline = body.endsWith('\n') || body.length === 0;
  await writeFile(path, wantsFinalNewline && !rendered.endsWith('\n') ? `${rendered}\n` : rendered);
}

export async function updateFrontmatter<T extends Record<string, any>>(
  path: string,
  updates: Partial<T>,
): Promise<void> {
  const doc = await readFrontmatter<T>(path);
  await writeFrontmatter(path, { ...doc.frontmatter, ...updates }, doc.body);
}

export function validateFrontmatter<T>(data: unknown, schema: z.ZodSchema<T>, contextPath: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
    throw new Error(`${contextPath}: invalid frontmatter: ${detail}`);
  }
  return parsed.data;
}

function shouldExclude(path: string, patterns: string[]): boolean {
  const normalized = path.replaceAll('\\', '/');
  return patterns.some((pattern) => normalized.includes(pattern));
}

export async function* walkMarkdown(
  rootDir: string,
  options?: { excludePatterns?: string[] },
): AsyncGenerator<{ path: string; doc: ParsedDoc }> {
  const excludes = [...DEFAULT_EXCLUDES, ...(options?.excludePatterns ?? [])];

  async function* walk(dir: string): AsyncGenerator<string> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = full.replaceAll('\\', '/');
      if (shouldExclude(rel, excludes)) continue;
      if (entry.isDirectory()) {
        yield* walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        yield full;
      }
    }
  }

  for await (const path of walk(rootDir)) {
    yield { path, doc: await readFrontmatter(path) };
  }
}
