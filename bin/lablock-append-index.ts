#!/usr/bin/env bun
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { appendChangeIndex } from '../lib/change-index.ts';
import { CommitMetaSchema } from '../lib/types.ts';
import { fail } from './_util.ts';

const program = new Command()
  .requiredOption('--commit <sha>')
  .requiredOption('--meta-file <path>');
program.parse(process.argv);
const opts = program.opts();

try {
  const meta = CommitMetaSchema.parse(JSON.parse(await readFile(opts.metaFile, 'utf8')));
  await appendChangeIndex({
    change_id: meta.change_id,
    commit: opts.commit,
    exp: meta.exp_id,
    tag: meta.tag,
    files_changed: meta.classified_files.length,
    time: new Date().toISOString(),
  });
} catch (error) {
  fail(error);
}
