#!/usr/bin/env bun
import { Command } from 'commander';
import { relative } from 'node:path';
import {
  ClaimSchema,
  DecisionFrontmatterSchema,
  DerivationFrontmatterSchema,
  ExperimentFrontmatterSchema,
} from '../lib/types.ts';
import { readFrontmatter, validateFrontmatter, walkMarkdown } from '../lib/frontmatter.ts';
import { fail } from './_util.ts';

const program = new Command()
  .option('--strict', 'exit nonzero on failures')
  .option('--paths <glob>', 'reserved for future path filtering');
program.parse(process.argv);
const opts = program.opts();

function extractClaims(body: string): unknown[] {
  const claims: unknown[] = [];
  const sections = body.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const id = section.match(/^(C\d+)/)?.[1] ?? section.match(/id:\s*(C\d+)/)?.[1];
    if (!id) continue;
    const statement = section.match(/statement:\s*(.+)/)?.[1] ?? section.split('\n')[0].replace(/^C\d+[:\s-]*/, '').trim();
    const strength = section.match(/strength:\s*(hypothesis|empirical|derived|assumed)/)?.[1] ?? 'hypothesis';
    const evidenceRaw = section.match(/evidence:\s*\[([^\]]*)\]/)?.[1] ?? '';
    const evidence = evidenceRaw.split(',').map((s) => s.trim()).filter(Boolean);
    claims.push({ id, statement, strength, evidence });
  }
  return claims;
}

const failures: string[] = [];
try {
  for await (const { path, doc } of walkMarkdown('.')) {
    const rel = relative('.', path).replaceAll('\\', '/');
    try {
      if (/^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(rel)) {
        validateFrontmatter(doc.frontmatter, ExperimentFrontmatterSchema, rel);
      } else if (/^derivations\/.+\.md$/.test(rel)) {
        validateFrontmatter(doc.frontmatter, DerivationFrontmatterSchema, rel);
      } else if (/^decisions\/.+\.md$/.test(rel)) {
        validateFrontmatter(doc.frontmatter, DecisionFrontmatterSchema, rel);
      } else if (rel === 'claims.md') {
        for (const claim of extractClaims((await readFrontmatter(rel)).body)) ClaimSchema.parse(claim);
      }
    } catch (error: any) {
      failures.push(error?.message ?? String(error));
    }
  }
  if (failures.length) {
    for (const f of failures) console.error(f);
    process.exit(opts.strict ? 1 : 0);
  }
} catch (error) {
  fail(error);
}
