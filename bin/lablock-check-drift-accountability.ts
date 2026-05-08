#!/usr/bin/env bun
import { Command } from 'commander';
import matter from 'gray-matter';
import { stagedBlob, stagedFiles } from '../lib/git.ts';

const program = new Command().requiredOption('--exp <id>').requiredOption('--change-id <id>');
program.parse(process.argv);
const opts = program.opts();
const files = await stagedFiles().catch(() => []);

async function frontmatter(path: string): Promise<Record<string, any> | null> {
  try {
    return matter(await stagedBlob(path), { language: 'yaml' }).data ?? {};
  } catch {
    return null;
  }
}

async function hasMatchingDecision(type: 'override' | 'scope-update'): Promise<boolean> {
  for (const file of files.filter((f) => f.startsWith('decisions/') && f.endsWith('.md'))) {
    const fm = await frontmatter(file);
    if (fm?.type === type && fm?.exp_id === opts.exp && fm?.change_id === opts.changeId) return true;
  }
  return false;
}

async function hasMatchingFork(): Promise<boolean> {
  const forkFiles = files.filter((f) => /^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(f));
  for (const file of forkFiles) {
    const fm = await frontmatter(file);
    if (fm?.forked_from === opts.exp && fm?.fork_reason === 'scope-drift') {
      return await hasMatchingDecision('scope-update');
    }
  }
  return false;
}

const hasLockUpdate = files.some((f) => f === `.lablock/locks/${opts.exp}.scope.lock`);
const ok = await hasMatchingFork()
  || await hasMatchingDecision('override')
  || (hasLockUpdate && await hasMatchingDecision('scope-update'));
console.log(ok ? 'ok' : 'missing');
