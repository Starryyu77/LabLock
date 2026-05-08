#!/usr/bin/env bun
import { Command } from 'commander';
import { pathExists } from '../lib/fs-util.ts';
import { readFrontmatter } from '../lib/frontmatter.ts';
import { jsonOut } from './_util.ts';

const program = new Command().option('--strict').option('--json');
program.parse(process.argv);
const opts = program.opts();

function parseClaims(body: string) {
  return body.split(/^##\s+/m).slice(1).map((section) => {
    const id = section.match(/^(C\d+)/)?.[1] ?? section.match(/id:\s*(C\d+)/)?.[1];
    if (!id) return null;
    const strength = section.match(/strength:\s*(hypothesis|empirical|derived|assumed)/)?.[1] ?? 'hypothesis';
    const evidenceRaw = section.match(/evidence:\s*\[([^\]]*)\]/)?.[1] ?? '';
    return { id, strength, evidence: evidenceRaw.split(',').map((s) => s.trim()).filter(Boolean) };
  }).filter(Boolean) as Array<{ id: string; strength: string; evidence: string[] }>;
}

const gaps: string[] = [];
if (await pathExists('claims.md')) {
  const claims = parseClaims((await readFrontmatter('claims.md')).body);
  for (const claim of claims) {
    if (claim.strength === 'empirical' && claim.evidence.length === 0) gaps.push(`${claim.id}: empirical claim has no evidence`);
    for (const ev of claim.evidence) {
      const exists = ev.startsWith('exp-')
        ? await pathExists('experiments').then(async () => true).catch(() => false)
        : await pathExists(`derivations/${ev}.md`);
      if (!exists) gaps.push(`${claim.id}: missing evidence ${ev}`);
    }
  }
}
if (opts.json) jsonOut({ gaps });
else for (const gap of gaps) console.warn(gap);
process.exit(opts.strict && gaps.length ? 1 : 0);
