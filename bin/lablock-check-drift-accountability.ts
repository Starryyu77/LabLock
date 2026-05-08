#!/usr/bin/env bun
import { Command } from 'commander';
import { stagedFiles } from '../lib/git.ts';

const program = new Command().requiredOption('--exp <id>').requiredOption('--change-id <id>');
program.parse(process.argv);
const opts = program.opts();
const files = await stagedFiles().catch(() => []);
const ok = files.some((f) => f.startsWith('decisions/') || f.startsWith(`.lablock/locks/${opts.exp}.`) || /^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(f));
console.log(ok ? 'ok' : 'missing');
