#!/usr/bin/env bun
import { Command } from 'commander';
import { classifyDiff, suggestTag } from '../lib/classify.ts';
import { stagedDiff, rawGit } from '../lib/git.ts';
import { readLock } from '../lib/lock.ts';
import { PATHS } from '../lib/paths.ts';
import { readTextIfExists } from '../lib/fs-util.ts';
import { fail, jsonOut } from './_util.ts';

const program = new Command()
  .option('--staged', 'classify staged diff')
  .option('--range <range>', 'classify rev range diff')
  .option('--exp <id>', 'experiment lock context')
  .option('--json', 'json output');

program.parse(process.argv);
const opts = program.opts();

try {
  let diff = '';
  if (opts.range) {
    diff = await rawGit(['diff', opts.range]);
  } else {
    diff = await stagedDiff();
  }
  const files = classifyDiff(diff);
  let lock = null;
  const exp = opts.exp ?? (await readTextIfExists(PATHS.STATE_CURRENT_EXP))?.trim();
  if (exp) lock = await readLock(exp).catch(() => null);
  const payload = { files, suggested_tag: suggestTag(files, lock) };
  if (opts.json) jsonOut(payload);
  else {
    for (const file of files) console.log(`${file.path}\t${file.category}\t+${file.lines_added}/-${file.lines_removed}`);
    console.log(payload.suggested_tag);
  }
} catch (error) {
  fail(error);
}
