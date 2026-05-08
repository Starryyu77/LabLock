#!/usr/bin/env bun
import { Command } from 'commander';
import { appendChange } from '../lib/changes.ts';
import { readMeta } from '../lib/meta.ts';
import { stagedDiff } from '../lib/git.ts';
import { classifyDiff } from '../lib/classify.ts';
import { fail } from './_util.ts';

const program = new Command()
  .requiredOption('--exp <id>')
  .option('--change-id <id>')
  .option('--tag <tag>');
program.parse(process.argv);
const opts = program.opts();

try {
  const meta = await readMeta();
  const change_id = opts.changeId ?? meta?.change_id;
  const tag = opts.tag ?? meta?.tag;
  if (!change_id || !tag) throw new Error('missing change id or tag');
  const files = classifyDiff(await stagedDiff());
  let message = 'no staged files';
  if (files.length === 1) message = `${files[0].path}: ${files[0].category}`;
  else if (files.length > 1) message = `${files.length} files modified (${[...new Set(files.map((f) => f.category))].join(', ')})`;
  await appendChange(opts.exp, { timestamp: new Date().toISOString(), tag, change_id, message } as any);
} catch (error) {
  fail(error);
}
