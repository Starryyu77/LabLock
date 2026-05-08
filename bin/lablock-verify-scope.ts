#!/usr/bin/env bun
import { Command } from 'commander';
import { readLock, listLocks, runProbes, verifyConfigLayer, verifyFilesLayer } from '../lib/lock.ts';
import { fail, jsonOut } from './_util.ts';

const program = new Command()
  .option('--exp <id>', 'experiment id')
  .option('--all-active', 'verify all active locks')
  .requiredOption('--source <source>', 'staged | working | head')
  .option('--layers <list>', 'comma separated layers', 'config,files')
  .option('--json', 'json output');
program.parse(process.argv);
const opts = program.opts();

async function verifyOne(expId: string) {
  const source = opts.source as 'staged' | 'working' | 'head';
  if (!['staged', 'working', 'head'].includes(source)) throw new Error('--source must be staged, working, or head');
  const layers = String(opts.layers).split(',').map((s) => s.trim()).filter(Boolean);
  const lock = await readLock(expId);
  const config = layers.includes('config') ? await verifyConfigLayer(lock, source) : null;
  const files = layers.includes('files') ? await verifyFilesLayer(lock, source) : null;
  const probes = layers.includes('probes') ? Object.fromEntries(await runProbes(lock, 'local')) : null;
  const driftCount = (config?.length ?? 0) + (files?.length ?? 0) + Object.values(probes ?? {}).filter((p: any) => !p.passed && !p.skipped).length;
  return {
    exp_id: expId,
    source,
    status: driftCount > 0 ? 'drifted' : 'ok',
    layers: { config, files, probes },
    summary: driftCount > 0 ? `${driftCount} drift(s) detected.` : 'No drift detected.',
  };
}

try {
  if (!opts.allActive && !opts.exp) throw new Error('Either --exp=<id> or --all-active is required.');
  const locks = opts.allActive ? (await listLocks()).filter((l) => l.status === 'active') : [await readLock(opts.exp).then(() => ({ exp_id: opts.exp })) as any];
  const results = [];
  for (const lock of locks) results.push(await verifyOne(lock.exp_id));
  const drifted = results.some((r) => r.status === 'drifted');
  const payload: any = opts.allActive ? { status: drifted ? 'drifted' : 'ok', results } : results[0];
  if (opts.json) jsonOut(payload);
  else console.log(opts.allActive ? JSON.stringify(payload, null, 2) : payload.summary);
  process.exit(drifted ? 1 : 0);
} catch (error) {
  if (opts.json) jsonOut({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  else fail(error, 2);
  process.exit(2);
}
