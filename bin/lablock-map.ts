#!/usr/bin/env bun
import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { readFrontmatter, walkMarkdown } from '../lib/frontmatter.ts';
import { listLocks } from '../lib/lock.ts';
import { PATHS } from '../lib/paths.ts';
import { rawGit } from '../lib/git.ts';
import { pathExists } from '../lib/fs-util.ts';
import { fail } from './_util.ts';

const program = new Command().option('--dry-run');
program.parse(process.argv);
const opts = program.opts();

async function writeIfChanged(path: string, content: string): Promise<void> {
  if (opts.dryRun) {
    console.log(`--- ${path} ---\n${content}`);
    return;
  }
  const prev = await readFile(path, 'utf8').catch(() => null);
  if (prev !== content) await writeFile(path, content);
}

try {
  const experiments: Array<{ id: string; status: string; hypothesis: string; parent: string | null; path: string }> = [];
  for await (const { path, doc } of walkMarkdown(PATHS.EXPERIMENTS)) {
    const rel = relative('.', path).replaceAll('\\', '/');
    if (!rel.endsWith('/hypothesis.md')) continue;
    const fm: any = doc.frontmatter;
    if (fm.id) experiments.push({ id: fm.id, status: fm.status ?? 'unknown', hypothesis: fm.hypothesis ?? '', parent: fm.parent ?? null, path: rel });
  }
  const locks = await listLocks();
  const activeLocks = locks.filter((l) => l.status === 'active').map((l) => l.exp_id);
  const recent = await rawGit(['log', "--since=7 days ago", '--name-only', '--format=']).catch(() => '');
  const formalism = await readFrontmatter(PATHS.FORMALISM_MD).then((d) => (d.frontmatter as any).version ?? 'unknown').catch(() => 'unknown');
  const claimsExists = await pathExists(PATHS.CLAIMS_MD);

  const matrix = [
    '<!-- GENERATED FILE - DO NOT EDIT -->',
    '<!-- Source of truth: experiments/*/hypothesis.md frontmatter + .lablock/locks/ -->',
    '<!-- Regenerate: lablock-map -->',
    `<!-- Last generated: ${new Date().toISOString()} -->`,
    '',
    '# Experiment Matrix',
    '',
    ...experiments.map((e) => `- ${e.parent ? `  ${e.parent} -> ` : ''}${e.id} [${e.status}] ${e.hypothesis}`),
    experiments.length ? '' : '(No experiments yet. Run `/lab-exp-init` to start.)',
    '',
  ].join('\n');

  const map = [
    '<!-- GENERATED FILE - DO NOT EDIT -->',
    `<!-- Last generated: ${new Date().toISOString()} -->`,
    '',
    '# Project Map',
    '',
    '## Active Experiments',
    '',
    ...(activeLocks.length ? activeLocks.map((id) => `- ${id}`) : ['(None)']),
    '',
    '## Formalism',
    '',
    `- Current version: ${formalism}`,
    '',
    '## Claims',
    '',
    claimsExists ? '- See [claims.md](claims.md)' : '- claims.md missing',
    '',
    '## Recent Files',
    '',
    ...([...new Set(recent.split('\n').map((s) => s.trim()).filter(Boolean))].slice(0, 50).map((f) => `- ${f}`)),
    '',
  ].join('\n');

  await writeIfChanged(PATHS.EXPERIMENTS_MATRIX, matrix);
  await writeIfChanged(PATHS.MAP_MD, map);
} catch (error) {
  fail(error);
}
