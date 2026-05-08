#!/usr/bin/env bun
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { CommitMetaSchema } from '../lib/types.ts';
import { fail } from './_util.ts';

const program = new Command()
  .requiredOption('--msg-file <path>')
  .requiredOption('--meta-file <path>');
program.parse(process.argv);
const opts = program.opts();

try {
  const msg = await readFile(opts.msgFile, 'utf8');
  const meta = CommitMetaSchema.parse(JSON.parse(await readFile(opts.metaFile, 'utf8')));
  const first = msg.split('\n')[0];
  const re = /^\[(main|paper|formalism|exp-\d{3})\](\[(INFRA-FIX|SCOPE-DRIFT|CODE|RESULT|NOTE|FORMALISM|PAPER|MAIN)\])?\s+.+$/;
  if (!re.test(first)) throw new Error('First line must match [scope][TAG] message.');
  const trailer = msg.match(/^LabLock-Change:\s*(chg-[0-9A-Z]{8})$/m)?.[1];
  if (!trailer) throw new Error('Missing LabLock-Change trailer.');
  if (trailer !== meta.change_id) throw new Error(`LabLock-Change ${trailer} does not match meta ${meta.change_id}.`);
  if (/^\[exp-\d{3}\]/.test(first) && !/^\[exp-\d{3}\]\[[A-Z-]+\]/.test(first)) {
    throw new Error('Experiment commit messages must include [TAG].');
  }
} catch (error) {
  fail(error);
}
