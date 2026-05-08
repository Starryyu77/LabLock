#!/usr/bin/env bun
import { Command } from 'commander';
import matter from 'gray-matter';
import { rawGit } from '../lib/git.ts';
import { jsonOut } from './_util.ts';

const program = new Command().option('--since <rev>').option('--strict').option('--json');
program.parse(process.argv);
const opts = program.opts();

const args = ['log', opts.since ? `${opts.since}..HEAD` : '--all', '--format=%H%x1f%s%x1f%b%x1e'];
const out = await rawGit(args).catch(() => '');
const unaccounted: Array<{ commit: string; subject: string; change_id: string | null }> = [];

async function commitFrontmatter(commit: string, path: string): Promise<Record<string, any> | null> {
  const content = await rawGit(['show', `${commit}:${path}`]).catch(() => '');
  if (!content) return null;
  return matter(content, { language: 'yaml' }).data ?? {};
}

for (const rec of out.split('\x1e')) {
  if (!rec.trim()) continue;
  const [commit, subject, body] = rec.trim().split('\x1f');
  if (!subject.includes('[SCOPE-DRIFT]')) continue;
  const exp = subject.match(/^\[(exp-\d{3})\]/)?.[1] ?? null;
  const change = `${subject}\n${body}`.match(/LabLock-Change:\s*(chg-[0-9A-Z]{8})/)?.[1] ?? null;
  const override = `${subject}\n${body}`.match(/LabLock-Override:\s*(chg-[0-9A-Z]{8})/)?.[1] ?? null;
  const changedPaths = await rawGit(['show', '--name-only', '--format=', commit]).catch(() => '');
  const paths = changedPaths.split('\n').map((p) => p.trim()).filter(Boolean);
  const decisions = paths.filter((p) => p.startsWith('decisions/') && p.endsWith('.md'));
  const hasDecision = async (type: 'override' | 'scope-update') => {
    for (const path of decisions) {
      const fm = await commitFrontmatter(commit, path);
      if (fm?.type === type && fm?.exp_id === exp && fm?.change_id === change) return true;
    }
    return false;
  };
  const changedHypotheses = changedPaths.split('\n').filter((p) => /^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(p));
  let hasFork = false;
  for (const path of changedHypotheses) {
    const fm = await commitFrontmatter(commit, path);
    if (fm?.forked_from === exp && fm?.fork_reason === 'scope-drift') hasFork = true;
  }
  const hasLockUpdate = exp ? paths.some((p) => p === `.lablock/locks/${exp}.scope.lock`) : false;
  const accounted = Boolean(exp && change) && (
    (override === change && await hasDecision('override'))
    || (hasFork && await hasDecision('scope-update'))
    || (hasLockUpdate && await hasDecision('scope-update'))
  );
  if (!accounted) unaccounted.push({ commit, subject, change_id: change });
}
if (opts.json) jsonOut({ unaccounted });
else for (const item of unaccounted) console.warn(`${item.commit.slice(0, 12)} ${item.subject}`);
process.exit(opts.strict && unaccounted.length ? 1 : 0);
