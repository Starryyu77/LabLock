#!/usr/bin/env bun
import { Command } from 'commander';
import { listLocks } from '../lib/lock.ts';
import { runAndReportProbes } from '../lib/probes.ts';

const program = new Command().option('--run-on <context>', 'local | ci-exp | ci-main | manual', 'local');
program.parse(process.argv);
const opts = program.opts();
const locks = (await listLocks()).filter((l) => l.status === 'active');
let ok = true;
for (const lock of locks) {
  ok = (await runAndReportProbes(lock, opts.runOn)) && ok;
}
process.exit(ok ? 0 : 1);
