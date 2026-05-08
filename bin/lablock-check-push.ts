#!/usr/bin/env bun
import { Command } from 'commander';
import { readProjectConfig } from '../lib/config.ts';
import { isFastForward } from '../lib/git.ts';

const program = new Command()
  .requiredOption('--local-ref <ref>')
  .requiredOption('--local-sha <sha>')
  .requiredOption('--remote-ref <ref>')
  .requiredOption('--remote-sha <sha>');
program.parse(process.argv);
const opts = program.opts();

function globToRe(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const marker = '\u0000';
  return new RegExp(`^${escaped.replaceAll('**', marker).replaceAll('*', '[^/]*').replaceAll(marker, '.*')}$`);
}

const zero = /^0+$/;
try {
  const config = await readProjectConfig();
  const branch = opts.remoteRef.replace(/^refs\/heads\//, '');
  const tag = opts.localRef.replace(/^refs\/tags\//, '');
  if (opts.remoteRef.startsWith('refs/heads/') && config.git.protected_branches.some((p) => globToRe(p).test(branch))) {
    if (zero.test(opts.localSha)) throw new Error(`protected branch deletion denied: ${branch}`);
    if (!zero.test(opts.remoteSha) && !(await isFastForward(opts.localSha, opts.remoteSha))) throw new Error(`non-fast-forward push denied: ${branch}`);
  }
  if (opts.localRef.startsWith('refs/tags/') && config.git.protected_tags.some((p) => globToRe(p).test(tag))) {
    if (zero.test(opts.localSha)) throw new Error(`protected tag deletion denied: ${tag}`);
  }
  console.log('ok');
} catch (error: any) {
  console.log(error?.message ?? String(error));
  process.exit(1);
}
