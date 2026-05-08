#!/usr/bin/env bun
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { walkMarkdown } from '../lib/frontmatter.ts';
import { pathExists } from '../lib/fs-util.ts';
import { jsonOut } from './_util.ts';

const program = new Command().option('--json');
program.parse(process.argv);
const opts = program.opts();

const indexFiles = ['INDEX.md', 'MAP.md', 'experiments/matrix.md'];
let indexText = '';
for (const path of indexFiles) {
  if (await pathExists(path)) indexText += await readFile(path, 'utf8') + '\n';
}
const linked = new Set([...indexText.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1].replace(/^\.\//, '')));
const whitelist = [/^templates\//, /^tests\/fixtures\//, /^paper\/drafts\/\.history\//, /^memory\//];
const orphans: string[] = [];
for await (const { path } of walkMarkdown('.')) {
  const rel = relative('.', path).replaceAll('\\', '/');
  if (indexFiles.includes(rel) || whitelist.some((re) => re.test(rel))) continue;
  if (!linked.has(rel)) orphans.push(rel);
}
if (opts.json) jsonOut({ orphans });
else console.log(orphans.join('\n'));
