#!/usr/bin/env bun
import { stat } from 'node:fs/promises';
import { readProjectConfig } from '../lib/config.ts';
import { rawGit, stagedFiles } from '../lib/git.ts';
import { fail } from './_util.ts';

try {
  const config = await readProjectConfig();
  const threshold = config.git.lfs_threshold_mb * 1024 * 1024;
  const offenders: string[] = [];
  for (const file of await stagedFiles()) {
    const size = await stat(file).then((s) => s.size).catch(() => 0);
    if (size <= threshold) continue;
    const attr = await rawGit(['check-attr', 'filter', '--', file]).catch(() => '');
    if (!attr.includes('filter: lfs')) offenders.push(`${file} (${Math.round(size / 1024 / 1024)} MB)`);
  }
  if (offenders.length) throw new Error(`Large staged files are not tracked by Git LFS:\n${offenders.join('\n')}`);
} catch (error) {
  fail(error);
}
