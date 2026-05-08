#!/usr/bin/env bun
import { Command } from 'commander';
import { rawGit } from '../lib/git.ts';
import { jsonOut } from './_util.ts';

const program = new Command().option('--since <rev>').option('--strict').option('--json');
program.parse(process.argv);
const opts = program.opts();

const args = ['log', opts.since ? `${opts.since}..HEAD` : '--all', '--format=%H%x1f%s%x1f%b%x1e'];
const out = await rawGit(args).catch(() => '');
const unaccounted: Array<{ commit: string; subject: string; change_id: string | null }> = [];
for (const rec of out.split('\x1e')) {
  if (!rec.trim()) continue;
  const [commit, subject, body] = rec.trim().split('\x1f');
  if (!subject.includes('[SCOPE-DRIFT]')) continue;
  const change = `${subject}\n${body}`.match(/LabLock-Change:\s*(chg-[0-9A-Z]{8})/)?.[1] ?? null;
  const changedPaths = await rawGit(['show', '--name-only', '--format=', commit]).catch(() => '');
  const hasDecision = changedPaths.split('\n').some((p) => p.startsWith('decisions/'));
  const changedHypotheses = changedPaths.split('\n').filter((p) => /^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(p));
  let hasFork = /forked_from/.test(body ?? '');
  for (const path of changedHypotheses) {
    const content = await rawGit(['show', `${commit}:${path}`]).catch(() => '');
    if (/forked_from:\s*exp-\d{3}/.test(content)) hasFork = true;
  }
  const accounted = /LabLock-Override:\s*chg-[0-9A-Z]{8}/.test(body ?? '') || hasDecision || hasFork;
  if (!accounted) unaccounted.push({ commit, subject, change_id: change });
}
if (opts.json) jsonOut({ unaccounted });
else for (const item of unaccounted) console.warn(`${item.commit.slice(0, 12)} ${item.subject}`);
process.exit(opts.strict && unaccounted.length ? 1 : 0);
