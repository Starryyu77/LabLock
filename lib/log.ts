import chalk from 'chalk';
import type { CommitMeta } from './types.ts';

export const log = {
  info: (msg: string) => console.log(chalk.cyan(msg)),
  warn: (msg: string) => console.warn(chalk.yellow(msg)),
  error: (msg: string) => console.error(chalk.red(msg)),
  success: (msg: string) => console.log(chalk.green(msg)),
  debug: (msg: string) => {
    if (process.env.LABLOCK_DEBUG === '1') console.error(chalk.gray(msg));
  },
  bullet: (msg: string) => console.log(`- ${msg}`),
};

export function formatDriftReport(meta: CommitMeta): string {
  const lines = [`Drift report for ${meta.change_id}`];
  for (const d of meta.drift_layers.config) {
    lines.push(`config ${d.key}: expected ${JSON.stringify(d.expected)}, actual ${JSON.stringify(d.actual)}`);
  }
  for (const d of meta.drift_layers.files) {
    lines.push(`file ${d.path}: expected ${d.expected_hash}, actual ${d.actual_hash}`);
  }
  if (lines.length === 1) lines.push('no drift recorded');
  return lines.join('\n');
}
