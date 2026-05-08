#!/usr/bin/env bun
import { Command } from 'commander';
import { readMeta, writeMeta } from '../lib/meta.ts';
import { CommitMetaSchema } from '../lib/types.ts';
import { fail } from './_util.ts';

const program = new Command()
  .option('--exp <id>')
  .requiredOption('--change-id <id>')
  .requiredOption('--tag <tag>')
  .requiredOption('--classified <json>')
  .option('--drift <json>', 'drift layers json');
program.parse(process.argv);
const opts = program.opts();

try {
  const existing = await readMeta();
  const classified = JSON.parse(opts.classified).files ?? JSON.parse(opts.classified);
  const drift = opts.drift ? JSON.parse(opts.drift) : { config: [], files: [] };
  await writeMeta(CommitMetaSchema.parse({
    schema_version: 1,
    exp_id: opts.exp || null,
    change_id: opts.changeId,
    tag: opts.tag,
    classified_files: classified.map((f: any) => ({
      path: f.path,
      category: f.category,
      lines_added: f.lines_added,
      lines_removed: f.lines_removed,
    })),
    drift_layers: drift,
    override_decision: existing?.override_decision ?? null,
    override_reason: existing?.override_reason ?? null,
    created_at: new Date().toISOString(),
  }));
} catch (error) {
  fail(error);
}
