#!/usr/bin/env bun
import { classifyDiff, suggestTag } from '../lib/classify.ts';
import { readTextIfExists } from '../lib/fs-util.ts';
import { stagedDiff } from '../lib/git.ts';
import { readLock } from '../lib/lock.ts';
import { PATHS } from '../lib/paths.ts';

try {
  const files = classifyDiff(await stagedDiff());
  const exp = (await readTextIfExists(PATHS.STATE_CURRENT_EXP))?.trim();
  const lock = exp ? await readLock(exp).catch(() => null) : null;
  console.log(suggestTag(files, lock));
} catch {
  console.log('CODE');
}
