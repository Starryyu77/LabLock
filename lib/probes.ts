import type { ScopeLock } from './types.ts';
import { runProbes } from './lock.ts';
import { log } from './log.ts';

export async function runAndReportProbes(
  lock: ScopeLock,
  context: 'local' | 'ci-exp' | 'ci-main' | 'manual',
): Promise<boolean> {
  const results = await runProbes(lock, context);
  let ok = true;
  for (const [name, result] of results) {
    if (result.skipped) {
      log.info(`${name}: skipped`);
    } else if (result.passed) {
      log.success(`${name}: passed (${result.duration_ms} ms)`);
    } else {
      ok = false;
      log.error(`${name}: failed (${result.duration_ms} ms)\n${result.output}`);
    }
  }
  return ok;
}
