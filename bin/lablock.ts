#!/usr/bin/env bun
import { Command } from 'commander';
import { cp, lstat, mkdir, readdir, readFile, readlink, realpath, symlink, unlink, copyFile, chmod, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  DEFAULT_PROJECT_CONFIG,
  CanonicalVariableNameSchema,
  ExperimentNamingRefSchema,
  MatrixIdSchema,
  NamingProfileValueSchema,
  VariableIdSchema,
  type ExperimentNamingRef,
  type NamingProfileValue,
  type ScopeLock,
} from '../lib/types.ts';
import { PATHS } from '../lib/paths.ts';
import { readProjectConfig, setProjectConfigPath, getProjectConfigPath, writeProjectConfig } from '../lib/config.ts';
import { renderTemplate, renderToFile } from '../lib/templates.ts';
import { newChangeId } from '../lib/ulid.ts';
import { stage, stagedDiff, rawGit } from '../lib/git.ts';
import { classifyDiff, suggestTag } from '../lib/classify.ts';
import { writeMeta } from '../lib/meta.ts';
import { CommitMetaSchema } from '../lib/types.ts';
import { fileHash, readLock, verifyConfigLayer, verifyFilesLayer, writeLock } from '../lib/lock.ts';
import { readFrontmatter, writeFrontmatter } from '../lib/frontmatter.ts';
import { GitHubApiError, branchProtectionPayload, currentRepo, getBranchProtection, getBranchRules, isAuthenticated, isGhAvailable, putBranchProtection } from '../lib/gh.ts';
import { collectDashboardData, openDashboardFile, writeDashboard } from '../lib/dashboard.ts';
import { fail, jsonOut, parseScalar } from './_util.ts';
import { pathExists } from '../lib/fs-util.ts';

const installRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function nextExpId(): Promise<string> {
  let entries: string[] = [];
  try {
    entries = await readdir(PATHS.EXPERIMENTS);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const max = entries
    .map((e) => e.match(/^exp-(\d{3})(?:-|$)/)?.[1])
    .filter(Boolean)
    .map(Number)
    .reduce((a, b) => Math.max(a, b), 0);
  return `exp-${String(max + 1).padStart(3, '0')}`;
}

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function parseKeyValues(raw: string | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of parseCsv(raw)) {
    const idx = item.indexOf('=');
    if (idx <= 0) throw new Error(`Invalid key=value item: ${item}`);
    setDotted(out, item.slice(0, idx).trim(), parseScalar(item.slice(idx + 1).trim()));
  }
  return out;
}

function setDotted(obj: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cur[part] || typeof cur[part] !== 'object' || Array.isArray(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[parts.at(-1)!] = value;
}

function overlayDotted(obj: Record<string, any>, path: string, value: unknown): Record<string, any> {
  const next = structuredClone(obj);
  setDotted(next, path, value);
  return next;
}

function slugify(raw: string): string {
  const s = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/--+/g, '-');
  if (!/^[a-z][a-z0-9-]*$/.test(s)) throw new Error(`Invalid shortname: ${raw}`);
  return s;
}

async function findExperimentDir(expId: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(PATHS.EXPERIMENTS, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const matches = entries.filter((e) => e.isDirectory() && e.name.startsWith(`${expId}-`)).map((e) => `${PATHS.EXPERIMENTS}/${e.name}`);
  if (matches.length > 1) throw new Error(`${expId}: multiple experiment dirs found: ${matches.join(', ')}`);
  return matches[0] ?? null;
}

async function readExperimentStatus(expId: string): Promise<string | null> {
  const dir = await findExperimentDir(expId);
  if (!dir) return null;
  return (await readFrontmatter(`${dir}/hypothesis.md`).catch(() => null))?.frontmatter?.status ?? null;
}

async function parseFileInvariants(raw: string | undefined): Promise<Array<{ path: string; hash: string; reason: string }>> {
  const rows = [];
  for (const item of parseCsv(raw)) {
    const idx = item.indexOf(':');
    const path = idx >= 0 ? item.slice(0, idx).trim() : item.trim();
    const reason = idx >= 0 ? item.slice(idx + 1).trim() : 'locked invariant';
    if (!path) throw new Error(`Invalid file invariant: ${item}`);
    rows.push({ path, hash: await fileHash(path), reason: reason || 'locked invariant' });
  }
  return rows;
}

async function createExperiment(opts: {
  shortname: string;
  parent?: string;
  hypothesis: string;
  config?: string;
  controlAdded?: string;
  controlRemoved?: string;
  controlModified?: string;
  fileInvariant?: string;
  kill?: string;
  success?: string;
  stage?: boolean;
  id?: string;
  forkedFrom?: string | null;
  forkReason?: 'scope-drift' | 'parallel-exploration' | 'manual' | null;
  driftCommit?: string | null;
  matrixId?: string;
  variableId?: string;
  canonicalVariable?: string;
  variantValue?: string;
  paperLabel?: string;
}): Promise<string> {
  const shortname = slugify(opts.shortname);
  const expId = opts.id ?? await nextExpId();
  const parent = opts.parent && opts.parent !== 'null' && opts.parent !== 'none' ? opts.parent : null;
  if (parent) {
    const status = await readExperimentStatus(parent);
    if (!status) throw new Error(`Parent experiment not found: ${parent}`);
    if (status === 'superseded') throw new Error(`Parent experiment is superseded: ${parent}`);
  }
  const config = parseKeyValues(opts.config ?? 'optimizer.lr=0.001');
  const fileInvariants = await parseFileInvariants(opts.fileInvariant);
  const controlledChanges = {
    added: parseCsv(opts.controlAdded),
    removed: parseCsv(opts.controlRemoved),
    modified: parseCsv(opts.controlModified ?? shortname),
  };
  const naming = buildNamingRef(opts);
  const kill = parseCsv(opts.kill ?? 'metric regresses beyond threshold');
  const success = parseCsv(opts.success ?? 'hypothesis is supported by the chosen metric');
  const expDir = `${PATHS.EXPERIMENTS}/${expId}-${shortname}`;
  if (await pathExists(expDir)) throw new Error(`${expDir} already exists`);
  await mkdir(expDir, { recursive: true });

  const lock: ScopeLock = {
    exp_id: expId,
    shortname,
    hypothesis: opts.hypothesis,
    parent,
    created: new Date().toISOString().slice(0, 10),
    status: 'active',
    locked_invariants: {
      config,
      files: fileInvariants,
      probes: [],
    },
    controlled_changes: controlledChanges,
    naming,
    kill_criteria: kill,
    success_criteria: success,
  };
  await writeLock(lock);
  await writeFrontmatter(`${expDir}/hypothesis.md`, {
    id: expId,
    parent,
    status: 'planned',
    created: new Date().toISOString().slice(0, 10),
    hypothesis: opts.hypothesis,
    related_claims: [],
    forked_from: opts.forkedFrom ?? null,
    fork_reason: opts.forkReason ?? null,
    drift_commit: opts.driftCommit ?? null,
    ...(naming ? { naming } : {}),
  }, [
    `# ${expId}: ${shortname}`,
    '',
    '## Hypothesis',
    '',
    opts.hypothesis,
    '',
    '## What changed',
    '',
    ...controlledChanges.added.map((v) => `- Added: ${v}`),
    ...controlledChanges.removed.map((v) => `- Removed: ${v}`),
    ...controlledChanges.modified.map((v) => `- Modified: ${v}`),
    ...(naming ? [
      '',
      '## Naming',
      '',
      ...(naming.matrix_id ? [`- Matrix: ${naming.matrix_id}`] : []),
      ...(naming.variable_id ? [`- Variable ID: ${naming.variable_id}`] : []),
      ...(naming.canonical_variable ? [`- Canonical variable: ${naming.canonical_variable}`] : []),
      ...(naming.variant_value ? [`- Variant value: ${naming.variant_value}`] : []),
      ...(naming.paper_label ? [`- Paper label: ${naming.paper_label}`] : []),
    ] : []),
    '',
    '## Success criteria',
    '',
    ...success.map((v) => `- ${v}`),
    '',
    '## Kill criteria',
    '',
    ...kill.map((v) => `- ${v}`),
    '',
  ].join('\n'));
  await writeFile(`${expDir}/config.yaml`, yaml.dump(config, { lineWidth: 120, noRefs: true, sortKeys: false }));
  await writeFile(`${expDir}/results.md`, `# Results: ${expId}\n\n`);
  if (opts.stage) {
    await rawGit(['add', expDir, `.lablock/locks/${expId}.scope.lock`]);
  }
  return expId;
}

function parseNamingProfile(raw: string | undefined): NamingProfileValue {
  return NamingProfileValueSchema.parse(raw ?? 'paper-aligned');
}

function namingProfileContext(profile: NamingProfileValue): Record<string, unknown> {
  if (profile === 'minimal') {
    return {
      naming_profile: 'minimal',
      experiment_shortname_pattern: 'exp-NNN-<shortname>',
      matrix_slug_pattern: '<topic>-matrix',
      require_variable_registry: false,
      require_matrix_registry: false,
      paper_label_required: false,
    };
  }
  if (profile === 'matrix-first') {
    return {
      naming_profile: 'matrix-first',
      experiment_shortname_pattern: 'exp-NNN-m<mat>-c<cell>-<variant>',
      matrix_slug_pattern: '<research-question>-<primary-axis>',
      require_variable_registry: true,
      require_matrix_registry: true,
      paper_label_required: true,
    };
  }
  return {
    naming_profile: 'paper-aligned',
    experiment_shortname_pattern: 'exp-NNN-<axis-or-method>-<variant>',
    matrix_slug_pattern: '<topic>-<primary-axis>-ablation',
    require_variable_registry: true,
    require_matrix_registry: true,
    paper_label_required: false,
  };
}

function buildNamingRef(opts: {
  matrixId?: string;
  variableId?: string;
  canonicalVariable?: string;
  variantValue?: string;
  paperLabel?: string;
}): ExperimentNamingRef | undefined {
  const raw = {
    ...(opts.matrixId ? { matrix_id: MatrixIdSchema.parse(opts.matrixId) } : {}),
    ...(opts.variableId ? { variable_id: VariableIdSchema.parse(opts.variableId) } : {}),
    ...(opts.canonicalVariable ? { canonical_variable: CanonicalVariableNameSchema.parse(opts.canonicalVariable) } : {}),
    ...(opts.variantValue ? { variant_value: opts.variantValue.trim() } : {}),
    ...(opts.paperLabel ? { paper_label: opts.paperLabel.trim() } : {}),
  };
  return Object.keys(raw).length ? ExperimentNamingRefSchema.parse(raw) : undefined;
}

function lockStatusForExperimentStatus(status: string): ScopeLock['status'] {
  if (status === 'planned' || status === 'running') return 'active';
  if (status === 'done') return 'finalized';
  return 'superseded';
}

async function createMigratedExperimentNode(opts: {
  shortname: string;
  source: string;
  hypothesis: string;
  status?: string;
  sourceType?: string;
  parent?: string;
  confidence?: string;
  success?: string;
  kill?: string;
  stage?: boolean;
}): Promise<string> {
  const status = opts.status ?? 'planned';
  if (!['planned', 'running', 'done', 'killed', 'superseded'].includes(status)) {
    throw new Error('--status must be planned, running, done, killed, or superseded');
  }
  const sourceType = opts.sourceType ?? 'unknown';
  if (!['plan', 'experiment', 'run', 'result', 'unknown'].includes(sourceType)) {
    throw new Error('--source-type must be plan, experiment, run, result, or unknown');
  }
  const confidence = opts.confidence ?? 'medium';
  if (!['low', 'medium', 'high'].includes(confidence)) throw new Error('--confidence must be low, medium, or high');
  if (!opts.source) throw new Error('--source is required');
  if (!await pathExists(opts.source)) throw new Error(`Legacy source not found: ${opts.source}`);

  const shortname = slugify(opts.shortname);
  const expId = await nextExpId();
  const parent = opts.parent && opts.parent !== 'null' && opts.parent !== 'none' ? opts.parent : null;
  if (parent) {
    const parentStatus = await readExperimentStatus(parent);
    if (!parentStatus) throw new Error(`Parent experiment not found: ${parent}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const importedAt = new Date().toISOString();
  const sourcePath = opts.source.replaceAll('\\', '/');
  const expDir = `${PATHS.EXPERIMENTS}/${expId}-${shortname}`;
  if (await pathExists(expDir)) throw new Error(`${expDir} already exists`);
  await mkdir(expDir, { recursive: true });

  const migrationConfig = {
    migration: {
      imported: true,
      source_path: sourcePath,
      source_type: sourceType,
      confidence,
      imported_at: importedAt,
      legacy_status: status,
    },
  };
  const success = parseCsv(opts.success ?? 'legacy success criteria were not recorded during import');
  const kill = parseCsv(opts.kill ?? 'legacy kill criteria were not recorded during import');
  const controlledChanges = {
    modified: [`imported legacy ${sourceType} from ${sourcePath}`],
  };

  const lock: ScopeLock = {
    exp_id: expId,
    shortname,
    hypothesis: opts.hypothesis,
    parent,
    created: today,
    status: lockStatusForExperimentStatus(status),
    locked_invariants: {
      config: migrationConfig,
      files: [],
      probes: [],
    },
    controlled_changes: controlledChanges,
    kill_criteria: kill,
    success_criteria: success,
  };
  await writeLock(lock);
  await writeFrontmatter(`${expDir}/hypothesis.md`, {
    id: expId,
    parent,
    status,
    created: today,
    hypothesis: opts.hypothesis,
    related_claims: [],
    tags: ['imported', 'legacy', sourceType, confidence === 'low' ? 'needs-confirmation' : 'migration-reviewed'].filter(Boolean),
  }, [
    `# ${expId}: ${shortname}`,
    '',
    '## Hypothesis',
    '',
    opts.hypothesis,
    '',
    '## Migration source',
    '',
    `- Source path: \`${sourcePath}\``,
    `- Source type: ${sourceType}`,
    `- Import confidence: ${confidence}`,
    `- Imported at: ${importedAt}`,
    '',
    '## What changed',
    '',
    `- Modified: imported legacy ${sourceType} from \`${sourcePath}\``,
    '',
    '## Success criteria',
    '',
    ...success.map((v) => `- ${v}`),
    '',
    '## Kill criteria',
    '',
    ...kill.map((v) => `- ${v}`),
    '',
    '## Notes',
    '',
    'This LabLock node mirrors existing legacy material. The original files were not moved or rewritten. Treat low-confidence imports as dashboard placeholders until a human confirms the hypothesis, status, and criteria.',
    '',
  ].join('\n'));
  await writeFile(`${expDir}/config.yaml`, yaml.dump(migrationConfig, { lineWidth: 120, noRefs: true, sortKeys: false }));
  await writeFile(`${expDir}/results.md`, [
    `# Results: ${expId}`,
    '',
    '## Progress',
    '',
    `- Imported from legacy ${sourceType}: \`${sourcePath}\``,
    `- Legacy status at import: ${status}`,
    '',
    '## Legacy source',
    '',
    `Review the original material at \`${sourcePath}\`. Copy only curated summaries here; do not move or rewrite the legacy source as part of import.`,
    '',
  ].join('\n'));
  if (opts.stage) {
    await rawGit(['add', expDir, `.lablock/locks/${expId}.scope.lock`]);
  }
  return expId;
}

async function forkExperiment(opts: {
  from: string;
  shortname?: string;
  reason?: string;
  source?: 'working' | 'staged';
  stage?: boolean;
  supersede?: boolean;
}): Promise<string> {
  const source = opts.source ?? 'working';
  const parentLock = await readLock(opts.from);
  const parentDir = await findExperimentDir(opts.from);
  if (!parentDir) throw new Error(`Experiment not found: ${opts.from}`);
  const drift = {
    config: await verifyConfigLayer(parentLock, source).catch(() => []),
    files: await verifyFilesLayer(parentLock, source).catch(() => []),
  };
  const nextConfig = drift.config.reduce((acc, d) => overlayDotted(acc, d.key, d.actual), structuredClone(parentLock.locked_invariants.config ?? {}));
  const nextFiles = [];
  for (const invariant of parentLock.locked_invariants.files ?? []) {
    nextFiles.push({
      ...invariant,
      hash: await fileHash(invariant.path),
    });
  }
  const head = await rawGit(['rev-parse', '--short', 'HEAD']).then((s) => s.trim()).catch(() => null);
  const shortname = slugify(opts.shortname ?? `${parentLock.shortname}-fork`);
  const expId = await createExperiment({
    shortname,
    parent: opts.from,
    hypothesis: parentLock.hypothesis,
    config: flattenForCli(nextConfig),
    controlAdded: (parentLock.controlled_changes.added ?? []).join(','),
    controlRemoved: (parentLock.controlled_changes.removed ?? []).join(','),
    controlModified: (parentLock.controlled_changes.modified ?? []).join(',') || 'forked drift baseline',
    kill: parentLock.kill_criteria.join(','),
    success: parentLock.success_criteria.join(','),
    stage: false,
    forkedFrom: opts.from,
    forkReason: 'scope-drift',
    driftCommit: head,
  });
  const newLock = await readLock(expId);
  await writeLock({
    ...newLock,
    locked_invariants: {
      ...newLock.locked_invariants,
      config: nextConfig,
      files: nextFiles,
      probes: parentLock.locked_invariants.probes ?? [],
    },
  });
  const newDir = await findExperimentDir(expId);
  if (!newDir) throw new Error(`New experiment dir missing: ${expId}`);
  await writeFile(`${newDir}/config.yaml`, yaml.dump(nextConfig, { lineWidth: 120, noRefs: true, sortKeys: false }));
  if (opts.supersede !== false) {
    await writeLock({ ...parentLock, status: 'superseded' });
    const parentDoc = await readFrontmatter(parentDir + '/hypothesis.md');
    await writeFrontmatter(parentDir + '/hypothesis.md', { ...parentDoc.frontmatter, status: 'superseded' }, parentDoc.body);
  }
  if (opts.reason) {
    const changeId = newChangeId();
    const decisionPath = `decisions/${new Date().toISOString().slice(0, 10)}-fork-${opts.from}-to-${expId}-${changeId}.md`;
    await renderToFile('decision.md.tmpl', decisionPath, {
      type: 'scope-update',
      exp_id: opts.from,
      change_id: changeId,
      title: `Fork ${opts.from} to ${expId}`,
      context: `Scope drift was detected in ${opts.from}.`,
      decision: `Create ${expId} as the accountable fork.`,
      consequences: opts.reason,
      alternatives: 'Override the drift or revert the staged changes.',
    });
    if (opts.stage) await rawGit(['add', decisionPath]);
    if (opts.stage) {
      await writeMeta(CommitMetaSchema.parse({
        schema_version: 1,
        exp_id: opts.from,
        change_id: changeId,
        tag: 'SCOPE-DRIFT',
        classified_files: [],
        drift_layers: drift,
        override_decision: null,
        override_reason: null,
        created_at: new Date().toISOString(),
      }));
    }
  }
  if (opts.stage) await rawGit(['add', `.lablock/locks/${opts.from}.scope.lock`, `.lablock/locks/${expId}.scope.lock`, parentDir, newDir]);
  return expId;
}

function flattenForCli(obj: Record<string, any>, prefix = ''): string {
  const rows: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) rows.push(flattenForCli(value, full));
    else rows.push(`${full}=${JSON.stringify(value)}`);
  }
  return rows.filter(Boolean).join(',');
}

async function experimentShortname(expId: string): Promise<string> {
  const dir = await findExperimentDir(expId);
  if (!dir) throw new Error(`Experiment not found: ${expId}`);
  return dir.replace(/^experiments\//, '').replace(new RegExp(`^${expId}-`), '');
}

async function ensureCleanTree(): Promise<void> {
  const status = await rawGit(['status', '--porcelain']);
  if (status.trim()) throw new Error('Working tree is not clean.');
}

async function expStart(opts: { exp: string; base?: string; push?: boolean; remote?: string }): Promise<void> {
  await ensureCleanTree();
  const shortname = await experimentShortname(opts.exp);
  const branch = `exp/${opts.exp}-${shortname}`;
  await rawGit(['switch', opts.base ?? 'main']);
  await rawGit(['switch', '-c', branch]);
  await mkdir(PATHS.STATE_DIR, { recursive: true });
  await writeFile(PATHS.STATE_CURRENT_EXP, `${opts.exp}\n`);
  await rawGit(['add', PATHS.STATE_CURRENT_EXP]).catch(() => undefined);
  console.log(`Experiment branch created: ${branch}`);
  if (opts.push) {
    await rawGit(['push', '-u', opts.remote ?? 'origin', branch]);
    console.log(`Pushed: ${opts.remote ?? 'origin'}/${branch}`);
  }
}

async function expFinalize(opts: { exp: string; status: string; tag?: boolean; clearCurrent?: boolean }): Promise<void> {
  const dir = await findExperimentDir(opts.exp);
  if (!dir) throw new Error(`Experiment not found: ${opts.exp}`);
  const valid = ['done', 'killed', 'superseded'];
  if (!valid.includes(opts.status)) throw new Error(`--status must be one of: ${valid.join(', ')}`);
  const branch = await rawGit(['branch', '--show-current']).then((s) => s.trim()).catch(() => '');
  const expectedPrefix = `exp/${opts.exp}-`;
  if (branch.startsWith('exp/') && !branch.startsWith(expectedPrefix)) {
    process.stderr.write(`LabLock warning: finalizing ${opts.exp} while on different experiment branch ${branch}; expected ${expectedPrefix}*. If --tag is used, the tag will point at current HEAD.\n`);
  }
  const doc = await readFrontmatter(`${dir}/hypothesis.md`);
  await writeFrontmatter(`${dir}/hypothesis.md`, {
    ...doc.frontmatter,
    status: opts.status,
    finalized_at: new Date().toISOString(),
  }, doc.body);
  const lock = await readLock(opts.exp);
  await writeLock({ ...lock, status: opts.status === 'done' ? 'finalized' : 'superseded' });
  if (opts.clearCurrent !== false) {
    const current = await readFile(PATHS.STATE_CURRENT_EXP, 'utf8').catch(() => null);
    if (current?.trim() === opts.exp) await unlink(PATHS.STATE_CURRENT_EXP).catch(() => undefined);
  }
  if (opts.tag) await rawGit(['tag', `${opts.exp}-final`]);
  console.log(`Experiment finalized: ${opts.exp} -> ${opts.status}`);
}

async function postmortem(opts: { exp: string; status?: string; overwrite?: boolean }): Promise<void> {
  const dir = await findExperimentDir(opts.exp);
  if (!dir) throw new Error(`Experiment not found: ${opts.exp}`);
  const dest = `${dir}/postmortem.md`;
  const shortname = await experimentShortname(opts.exp);
  await renderToFile('postmortem.md.tmpl', dest, {
    exp_id: opts.exp,
    shortname,
    status: opts.status ?? 'killed',
  }, { overwrite: Boolean(opts.overwrite) });
  console.log(dest);
}

async function cleanupPr(opts: { exp: string; base?: string; json?: boolean }): Promise<void> {
  const branch = await rawGit(['branch', '--show-current']).then((s) => s.trim()).catch(() => 'HEAD');
  const base = opts.base ?? 'main';
  const diff = await rawGit(['diff', '--name-status', `${base}...HEAD`]).catch(() => '');
  const files = diff.split('\n').filter(Boolean).map((line) => {
    const [status, path] = line.split(/\s+/, 2);
    let action = 'review';
    if (/^(formalism\.md|claims\.md|decisions\/)/.test(path)) action = 'include';
    else if (/^experiments\/|debug|tmp|scratch/.test(path)) action = 'exclude';
    return { status, path, action };
  });
  const payload = { exp: opts.exp, base, branch, files };
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`Cleanup PR dry-run for ${opts.exp}: ${branch} -> ${base}`);
    for (const f of files) console.log(`${f.action}\t${f.status}\t${f.path}`);
  }
}

function hasGlobSyntax(branch: string): boolean {
  return /[*?\[\]{}]/.test(branch);
}

function boolFromProtection(value: any): boolean {
  if (typeof value === 'boolean') return value;
  return Boolean(value?.enabled);
}

function statusContexts(protection: any): string[] {
  const status = protection?.required_status_checks;
  const contexts = Array.isArray(status?.contexts) ? status.contexts : [];
  const checks = Array.isArray(status?.checks)
    ? status.checks.map((check: any) => check.context ?? check.name).filter(Boolean)
    : [];
  return [...new Set([...contexts, ...checks])];
}

function normalizeExistingStatusChecks(status: any): unknown {
  if (!status) return null;
  return {
    strict: Boolean(status.strict),
    contexts: statusContexts({ required_status_checks: status }),
  };
}

function normalizeExistingReviews(reviews: any): unknown {
  if (!reviews) return null;
  const out: Record<string, unknown> = {};
  for (const key of [
    'dismiss_stale_reviews',
    'require_code_owner_reviews',
    'required_approving_review_count',
    'require_last_push_approval',
  ]) {
    if (reviews[key] !== undefined) out[key] = reviews[key];
  }
  if (reviews.dismissal_restrictions) {
    out.dismissal_restrictions = normalizeRestrictionLike(reviews.dismissal_restrictions);
  }
  if (reviews.bypass_pull_request_allowances) {
    out.bypass_pull_request_allowances = normalizeRestrictionLike(reviews.bypass_pull_request_allowances);
  }
  return Object.keys(out).length ? out : null;
}

function normalizeRestrictionLike(value: any): unknown {
  if (!value) return null;
  const names = (items: any[]) => items.map((item) => item.slug ?? item.login ?? item.name).filter(Boolean);
  return {
    users: Array.isArray(value.users) ? names(value.users) : [],
    teams: Array.isArray(value.teams) ? names(value.teams) : [],
    apps: Array.isArray(value.apps) ? names(value.apps) : [],
  };
}

function normalizeExistingRestrictions(restrictions: any): unknown {
  return normalizeRestrictionLike(restrictions);
}

function existingProtectionPayload(protection: any): Record<string, unknown> {
  if (!protection) return {};
  const payload: Record<string, unknown> = {
    required_status_checks: normalizeExistingStatusChecks(protection.required_status_checks),
    enforce_admins: boolFromProtection(protection.enforce_admins),
    required_pull_request_reviews: normalizeExistingReviews(protection.required_pull_request_reviews),
    restrictions: normalizeExistingRestrictions(protection.restrictions),
    allow_force_pushes: boolFromProtection(protection.allow_force_pushes),
    allow_deletions: boolFromProtection(protection.allow_deletions),
  };
  for (const key of [
    'required_linear_history',
    'required_conversation_resolution',
    'block_creations',
    'lock_branch',
    'allow_fork_syncing',
  ]) {
    if (protection[key] !== undefined) payload[key] = boolFromProtection(protection[key]);
  }
  if (protection.required_deployments?.required_deployment_environments) {
    payload.required_deployments = {
      required_deployment_environments: protection.required_deployments.required_deployment_environments,
    };
  }
  return payload;
}

function mergeBranchProtectionPayload(existing: unknown, desired: Record<string, unknown>): Record<string, unknown> {
  const base = existingProtectionPayload(existing);
  const merged = { ...base, ...desired };
  const baseStatus = base.required_status_checks as any;
  const desiredStatus = desired.required_status_checks as any;
  if (baseStatus && desiredStatus) {
    merged.required_status_checks = {
      strict: Boolean(desiredStatus.strict ?? baseStatus.strict),
      contexts: [...new Set([...(baseStatus.contexts ?? []), ...(desiredStatus.contexts ?? [])])],
    };
  }
  const baseReviews = base.required_pull_request_reviews as any;
  const desiredReviews = desired.required_pull_request_reviews as any;
  if (baseReviews && desiredReviews) {
    merged.required_pull_request_reviews = {
      ...baseReviews,
      ...desiredReviews,
      required_approving_review_count: Math.max(
        Number(baseReviews.required_approving_review_count ?? 0),
        Number(desiredReviews.required_approving_review_count ?? 0),
      ),
    };
  }
  return merged;
}

function stableValue(value: unknown): string {
  return JSON.stringify(value);
}

function flattenPayload(value: unknown, prefix = ''): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      Object.assign(out, flattenPayload(child, childPath));
    }
    return out;
  }
  return prefix ? { [prefix]: value } : {};
}

function branchProtectionDelta(existingSummary: Record<string, unknown>, plannedPayload: Record<string, unknown>): {
  added: string[];
  changed: string[];
  preserved: string[];
  possibly_dropped: string[];
} {
  const existing = flattenPayload(existingSummary);
  const planned = flattenPayload(plannedPayload);
  const added = Object.keys(planned).filter((key) => !(key in existing)).sort();
  const changed = Object.keys(planned).filter((key) => key in existing && stableValue(planned[key]) !== stableValue(existing[key])).sort();
  const preserved = Object.keys(planned).filter((key) => key in existing && stableValue(planned[key]) === stableValue(existing[key])).sort();
  const possiblyDropped = Object.keys(existing).filter((key) => !(key in planned)).sort();
  return { added, changed, preserved, possibly_dropped: possiblyDropped };
}

function evaluateBranchProtection(
  protection: unknown,
  policy: {
    required_status_checks: string[];
    required_reviews: number | null;
    require_strict_status_checks: boolean;
    enforce_admins: boolean;
    allow_force_pushes: boolean;
    allow_deletions: boolean;
  },
): { compliance: 'passed' | 'failed'; missing: string[]; dangerous: string[] } {
  const p = protection as any;
  const contexts = statusContexts(p);
  const missing = [];
  const dangerous = [];
  for (const context of policy.required_status_checks) {
    if (!contexts.includes(context)) missing.push(`required_status_checks:${context}`);
  }
  if (policy.required_status_checks.length && policy.require_strict_status_checks && !Boolean(p?.required_status_checks?.strict)) {
    missing.push('required_status_checks.strict=true');
  }
  if (policy.required_reviews !== null) {
    const actual = Number(p?.required_pull_request_reviews?.required_approving_review_count ?? 0);
    if (actual < policy.required_reviews) missing.push(`required_pull_request_reviews>=${policy.required_reviews}`);
  }
  if (policy.enforce_admins && !boolFromProtection(p?.enforce_admins)) missing.push('enforce_admins=true');
  if (policy.allow_force_pushes === false && boolFromProtection(p?.allow_force_pushes)) dangerous.push('allow_force_pushes=true');
  if (policy.allow_deletions === false && boolFromProtection(p?.allow_deletions)) dangerous.push('allow_deletions=true');
  return {
    compliance: missing.length || dangerous.length ? 'failed' : 'passed',
    missing,
    dangerous,
  };
}

function strictProtectionFailure(item: any): boolean {
  return item.status !== 'protected' && item.status !== 'applied'
    || item.compliance === 'failed'
    || item.status === 'skipped-pattern'
    || item.status === 'unavailable'
    || item.status === 'unprotected-or-inaccessible'
    || item.status === 'would-apply';
}

async function githubProtection(opts: {
  action?: string;
  branch?: string;
  repo?: string;
  requiredStatus?: string;
  requiredReviews?: string;
  strict?: boolean;
  dryRun?: boolean;
  replace?: boolean;
  allowNoRequiredStatus?: boolean;
  json?: boolean;
}): Promise<void> {
  const action = opts.action ?? 'check';
  if (!['check', 'apply'].includes(action)) throw new Error('action must be check or apply');
  const requiredStatus = parseCsv(opts.requiredStatus);
  if (action === 'apply' && requiredStatus.length === 0 && !opts.allowNoRequiredStatus) {
    throw new Error('github-protection apply requires --required-status=<context> or explicit --allow-no-required-status.');
  }
  const requiredReviewCount = opts.requiredReviews ? Number(opts.requiredReviews) : null;
  if (requiredReviewCount !== null && (!Number.isInteger(requiredReviewCount) || requiredReviewCount < 0)) {
    throw new Error('--required-reviews must be a nonnegative integer');
  }
  if (!await isGhAvailable()) throw new Error('gh CLI is not installed.');
  if (!await isAuthenticated()) throw new Error('gh CLI is not authenticated.');

  const config = await readProjectConfig().catch(() => DEFAULT_PROJECT_CONFIG);
  const repo = opts.repo ?? await currentRepo();
  const configuredBranches = opts.branch ? parseCsv(opts.branch) : config.git.protected_branches;
  const branches = configuredBranches.length ? configuredBranches : ['main'];
  const policy = {
    required_status_checks: requiredStatus,
    required_reviews: requiredReviewCount,
    require_strict_status_checks: true,
    enforce_admins: true,
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const rules = {
    required_status_checks: parseCsv(opts.requiredStatus),
    enforce_admins: true,
    required_pull_request_reviews: requiredReviewCount !== null
      ? { required_approving_review_count: requiredReviewCount }
      : undefined,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };

  const results: any[] = [];
  for (const branch of branches) {
    if (hasGlobSyntax(branch)) {
      results.push({
        branch,
        status: 'skipped-pattern',
        message: 'Classic branch protection applies to concrete branch names; use GitHub rulesets for patterns.',
      });
      continue;
    }
    try {
      const existing = await getBranchProtection(branch, repo).catch((error) => {
        if (action === 'apply' && error instanceof GitHubApiError && error.status === 404) return null;
        throw error;
      });
      const desiredPayload = branchProtectionPayload({
        ...rules,
        required_status_checks: rules.required_status_checks.length ? rules.required_status_checks : undefined,
      });
      if (!opts.replace && existing) {
        if (rules.required_status_checks.length === 0) delete desiredPayload.required_status_checks;
        if (!rules.required_pull_request_reviews) delete desiredPayload.required_pull_request_reviews;
        delete desiredPayload.restrictions;
      }
      if (action === 'apply') {
        const payload = opts.replace ? desiredPayload : mergeBranchProtectionPayload(existing, desiredPayload);
        if (opts.dryRun) {
          const existingSummary = existingProtectionPayload(existing);
          results.push({
            branch,
            status: 'would-apply',
            compliance: 'unchecked',
            mode: opts.replace ? 'replace' : 'merge-existing',
            existing_summary: existingSummary,
            planned_payload: payload,
            delta: branchProtectionDelta(existingSummary, payload),
          });
          continue;
        }
        await putBranchProtection(branch, payload, repo);
      }
      const protection = action === 'apply' && opts.dryRun ? existing : await getBranchProtection(branch, repo);
      const compliance = protection ? evaluateBranchProtection(protection, policy) : {
        compliance: 'failed',
        missing: ['branch_protection'],
        dangerous: [],
      };
      results.push({
        branch,
        status: action === 'apply' ? 'applied' : 'protected',
        ...compliance,
        protection,
      });
    } catch (error) {
      if (error instanceof GitHubApiError) {
        const unavailable = error.status === 403;
        results.push({
          branch,
          status: unavailable ? 'unavailable' : 'unprotected-or-inaccessible',
          api_status: error.status,
          message: unavailable
            ? 'GitHub refused branch protection access. For private repos this may require GitHub Pro, an organization plan, or admin permission.'
            : error.message,
        });
      } else {
        throw error;
      }
    }
  }

  const payload = { repo, action, results };
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`GitHub repository: ${repo}`);
    for (const item of results) {
      const compliance = item.compliance ? ` compliance=${item.compliance}` : '';
      console.log(`${item.branch}: ${item.status}${compliance}${item.api_status ? ` (HTTP ${item.api_status})` : ''}`);
      if (item.message) console.log(`  ${item.message}`);
      if (item.missing?.length) console.log(`  missing: ${item.missing.join(', ')}`);
      if (item.dangerous?.length) console.log(`  dangerous: ${item.dangerous.join(', ')}`);
    }
  }
  if (opts.strict && results.some((item) => strictProtectionFailure(item))) process.exitCode = 1;
}

function strictRulesetFailure(item: any): boolean {
  return item.status !== 'rules-found';
}

async function githubRuleset(opts: {
  action?: string;
  branch?: string;
  repo?: string;
  strict?: boolean;
  json?: boolean;
}): Promise<void> {
  const action = opts.action ?? 'check';
  if (action !== 'check') throw new Error('github-ruleset currently supports only check');
  if (!await isGhAvailable()) throw new Error('gh CLI is not installed.');
  if (!await isAuthenticated()) throw new Error('gh CLI is not authenticated.');
  const repo = opts.repo ?? await currentRepo();
  const branch = opts.branch ?? 'main';
  const results: any[] = [];
  try {
    const rules = await getBranchRules(branch, repo);
    const count = Array.isArray(rules) ? rules.length : 0;
    results.push({
      branch,
      status: count > 0 ? 'rules-found' : 'no-rules',
      rules,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      results.push({
        branch,
        status: error.status === 403 ? 'unavailable' : 'unavailable-or-inaccessible',
        api_status: error.status,
        message: error.message,
      });
    } else {
      throw error;
    }
  }
  const payload = { repo, action, results };
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`GitHub repository: ${repo}`);
    for (const item of results) {
      const count = Array.isArray(item.rules) ? ` rules=${item.rules.length}` : '';
      console.log(`${item.branch}: ${item.status}${count}${item.api_status ? ` (HTTP ${item.api_status})` : ''}`);
      if (item.message) console.log(`  ${item.message}`);
    }
  }
  if (opts.strict && results.some((item) => strictRulesetFailure(item))) process.exitCode = 1;
}

async function installHooks(): Promise<void> {
  await mkdir(PATHS.GIT_HOOKS, { recursive: true });
  const hooks = ['pre-commit.sh', 'prepare-commit-msg.sh', 'commit-msg.sh', 'post-commit.sh', 'pre-push.sh'];
  for (const hook of hooks) {
    const src = join(installRoot, 'hooks', hook);
    const dest = join(PATHS.GIT_HOOKS, hook.replace(/\.sh$/, ''));
    try {
      if (await pathExists(dest)) continue;
      await symlink(src, dest);
    } catch {
      await copyFile(src, dest);
      await chmod(dest, 0o755);
    }
  }
}

async function initProject(opts: { name: string; modules?: string; ciMode?: string; goal?: string; hypothesis?: string; namingProfile?: string }): Promise<void> {
  const modules = { ...DEFAULT_PROJECT_CONFIG.modules };
  for (const key of Object.keys(modules)) modules[key] = false;
  for (const mod of (opts.modules ?? 'gpu,data,lit').split(',').map((s) => s.trim()).filter(Boolean)) modules[mod] = true;
  const config = {
    ...DEFAULT_PROJECT_CONFIG,
    ci: { ...DEFAULT_PROJECT_CONFIG.ci, mode: opts.ciMode === 'enforce' ? 'enforce' as const : 'warn-only' as const },
    modules,
  };

  const dirs = [
    PATHS.LOCKS_DIR,
    PATHS.CHANGES_DIR,
    PATHS.STATE_DIR,
    PATHS.CACHE_DIR,
    PATHS.EXPERIMENTS,
    PATHS.DERIVATIONS,
    PATHS.DECISIONS,
    PATHS.REVIEWS,
    PATHS.HANDOFFS_OUTGOING,
    PATHS.HANDOFFS_INCOMING,
    PATHS.LIT,
    PATHS.PAPER_DRAFTS,
    PATHS.INFRA_GPU,
    PATHS.DATA,
    PATHS.MODELS,
    PATHS.EVALS,
    '.github/workflows',
    '.claude',
  ];
  for (const dir of dirs) await mkdir(dir, { recursive: true });
  await writeProjectConfig(config);
  await writeFile(PATHS.LEARNINGS, '', { flag: 'a' });

  const namingProfile = parseNamingProfile(opts.namingProfile);
  const context = {
    project_name: opts.name,
    goal: opts.goal ?? opts.name,
    hypothesis: opts.hypothesis ?? 'Initial hypothesis to be refined.',
    formalism_version: 'v1',
    modules,
    ...namingProfileContext(namingProfile),
  };
  const renders: Array<[string, string]> = [
    ['PROJECT.md.tmpl', PATHS.PROJECT_MD],
    ['formalism.md.tmpl', PATHS.FORMALISM_MD],
    ['claims.md.tmpl', PATHS.CLAIMS_MD],
    ['INDEX.md.tmpl', PATHS.INDEX_MD],
    ['matrix.md.tmpl', PATHS.EXPERIMENTS_MATRIX],
    ['MAP.md.tmpl', PATHS.MAP_MD],
    ['naming.yaml.tmpl', PATHS.NAMING],
    ['variables.yaml.tmpl', PATHS.VARIABLES],
    ['matrices.yaml.tmpl', PATHS.MATRICES],
    ['gitignore.tmpl', '.gitignore'],
    ['gitattributes.tmpl', '.gitattributes'],
    ['claude-settings.json.tmpl', '.claude/settings.json'],
  ];
  for (const [tmpl, dest] of renders) {
    if (!(await pathExists(dest))) await renderToFile(tmpl, dest, context);
  }
  if (!(await pathExists('.github/workflows/lablock.yml'))) await copyFile(join(installRoot, 'ci', 'lablock.yml'), '.github/workflows/lablock.yml');
  await injectAgentDoc(PATHS.CLAUDE_MD, 'CLAUDE.md.tmpl');
  await injectAgentDoc(PATHS.AGENTS_MD, 'AGENTS.md.tmpl');
  await installHooks();
}

async function injectAgentDoc(path: string, template: string): Promise<void> {
  const block = await readFile(join(installRoot, template), 'utf8');
  const marker = '## lablock';
  let existing = '';
  if (await pathExists(path)) existing = await readFile(path, 'utf8');
  const idx = existing.toLowerCase().indexOf(marker);
  const next = idx >= 0 ? existing.slice(0, idx).trimEnd() + '\n\n' + block.trim() + '\n' : `${existing.trimEnd()}${existing ? '\n\n' : ''}${block.trim()}\n`;
  await writeFile(path, next);
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readPackageName(root: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    return pkg.name ?? null;
  } catch {
    return null;
  }
}

async function detectLabLockSource(explicit?: string): Promise<string> {
  const candidates = [
    explicit,
    process.env.LABLOCK_HOME,
    await readPackageName(process.cwd()).then((name) => name === 'lablock' ? process.cwd() : undefined),
    join(homedir(), '.lablock/source'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const resolved = await realpath(candidate).catch(() => resolve(candidate));
    if (await readPackageName(resolved) === 'lablock') return resolved;
  }
  throw new Error('Could not locate a LabLock source. Pass --source=/path/to/LabLock or set LABLOCK_HOME.');
}

function hostTargets(host: string, scope: string): Array<{ label: string; path: string }> {
  const hosts = host === 'both' ? ['claude', 'codex'] : [host];
  const targets: Array<{ label: string; path: string }> = [];
  for (const h of hosts) {
    if (scope === 'global' || scope === 'both' || scope === 'auto') {
      targets.push({
        label: `${h}:global`,
        path: h === 'claude' ? join(homedir(), '.claude/skills') : join(homedir(), '.agents/skills'),
      });
    }
    if (scope === 'project' || scope === 'both') {
      targets.push({
        label: `${h}:project`,
        path: h === 'claude' ? '.claude/skills' : '.agents/skills',
      });
    }
  }
  return targets;
}

async function targetExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function copySkillTree(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    force: true,
    dereference: false,
    filter: (src) => {
      const rel = src.slice(source.length).replaceAll('\\', '/');
      return !rel.startsWith('/.git')
        && !rel.startsWith('/node_modules')
        && !rel.startsWith('/tests/.tmp');
    },
  });
}

async function updateOneSkillTarget(source: string, target: string, mode: 'symlink' | 'copy', dryRun: boolean): Promise<string> {
  const sourceReal = await realpath(source);
  const exists = await targetExists(target);
  const targetReal = exists ? await realpath(target).catch(() => resolve(target)) : null;
  if (targetReal === sourceReal) return 'already-current';

  if (dryRun) return exists ? `would-update:${mode}` : `would-create:${mode}`;

  await mkdir(dirname(target), { recursive: true });
  if (mode === 'symlink') {
    if (exists && await isSymlink(target)) await unlink(target);
    if (!await targetExists(target)) {
      await symlink(sourceReal, target);
      return 'symlinked';
    }
    await copySkillTree(sourceReal, target);
    return 'copied-existing-directory';
  }

  await copySkillTree(sourceReal, target);
  return exists ? 'copied' : 'created-copy';
}

async function listLabSkills(source: string): Promise<Array<{ name: string; path: string }>> {
  const entries = await readdir(source, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('lab-')) continue;
    const skillPath = join(source, entry.name);
    if (await pathExists(join(skillPath, 'SKILL.md'))) skills.push({ name: entry.name, path: skillPath });
  }
  if (skills.length === 0) throw new Error(`${source}: no lab-* skills found`);
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function updateInstalledSkills(opts: {
  source?: string;
  host?: string;
  scope?: string;
  mode?: string;
  pull?: boolean;
  dryRun?: boolean;
  json?: boolean;
}): Promise<void> {
  const payload = await refreshInstalledSkills(opts);
  printSkillUpdatePayload(payload, Boolean(opts.json));
}

async function refreshInstalledSkills(opts: {
  source?: string;
  host?: string;
  scope?: string;
  mode?: string;
  pull?: boolean;
  dryRun?: boolean;
}): Promise<{
  source: string;
  pulled: boolean;
  mode: 'symlink' | 'copy';
  results: Array<{ label: string; path: string; skill: string; result: string }>;
}> {
  const source = await detectLabLockSource(opts.source);
  if (opts.pull) await rawGit(['-C', source, 'pull', '--ff-only']);
  const host = opts.host ?? 'both';
  const scope = opts.scope ?? 'global';
  const mode = (opts.mode ?? 'symlink') as 'symlink' | 'copy';
  if (!['claude', 'codex', 'both'].includes(host)) throw new Error('--host must be claude, codex, or both');
  if (!['global', 'project', 'both', 'auto'].includes(scope)) throw new Error('--scope must be global, project, both, or auto');
  if (!['symlink', 'copy'].includes(mode)) throw new Error('--mode must be symlink or copy');

  let targets = hostTargets(host, scope);
  if (scope === 'auto') {
    const projectTargets = hostTargets(host, 'project');
    for (const target of projectTargets) {
      if (await targetExists(target.path)) targets.push(target);
    }
  }

  const skills = await listLabSkills(source);
  const results = [];
  for (const target of targets) {
    for (const skill of skills) {
      const skillTarget = join(target.path, skill.name);
      results.push({
        ...target,
        skill: skill.name,
        path: skillTarget,
        result: await updateOneSkillTarget(skill.path, skillTarget, mode, Boolean(opts.dryRun)),
      });
    }
  }

  return {
    source,
    pulled: Boolean(opts.pull),
    mode,
    results,
  };
}

function printSkillUpdatePayload(payload: {
  source: string;
  pulled: boolean;
  mode: 'symlink' | 'copy';
  results: Array<{ label: string; path: string; skill: string; result: string }>;
}, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`LabLock source: ${payload.source}`);
    for (const item of payload.results) console.log(`${item.label}:${item.skill}: ${item.result} -> ${item.path}`);
  }
}

async function runExternal(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`${args.join(' ')} failed (${code})\n${stdout}${stderr}`);
  return { stdout, stderr };
}

function validateUpdateRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error('--ref must not be empty');
  if (trimmed.startsWith('-')) throw new Error('--ref must not start with "-"');
  if (/[\s\0]/.test(trimmed)) throw new Error('--ref must not contain whitespace or null bytes');
  if (trimmed.includes('..')) throw new Error('--ref must not contain ".."');
  return trimmed;
}

async function switchSourceRef(source: string, ref: string): Promise<void> {
  const target = validateUpdateRef(ref);
  await rawGit(['-C', source, 'fetch', 'origin', target]);
  try {
    await rawGit(['-C', source, 'switch', target]);
    return;
  } catch {
    // New preview branches usually exist only on origin until first use.
  }
  try {
    await rawGit(['-C', source, 'switch', '-c', target, `origin/${target}`]);
    return;
  } catch {
    // Tags or commit-ish refs can still be installed in detached HEAD mode.
  }
  await rawGit(['-C', source, 'checkout', 'FETCH_HEAD']);
}

async function updateLabLock(opts: {
  source?: string;
  host?: string;
  scope?: string;
  mode?: string;
  ref?: string;
  pull?: boolean;
  install?: boolean;
  dryRun?: boolean;
  json?: boolean;
}): Promise<void> {
  const source = await detectLabLockSource(opts.source);
  const shouldPull = opts.pull !== false;
  const shouldInstall = opts.install !== false;
  const dryRun = Boolean(opts.dryRun);
  const ref = opts.ref ? validateUpdateRef(opts.ref) : null;

  const steps = {
    git_ref: ref ? (dryRun ? 'would-run' : 'ran') : 'skipped',
    git_pull: shouldPull ? (dryRun ? 'would-run' : 'ran') : 'skipped',
    bun_install: shouldInstall ? (dryRun ? 'would-run' : 'ran') : 'skipped',
  };

  if (ref && !dryRun) await switchSourceRef(source, ref);
  if (shouldPull && !dryRun) await rawGit(['-C', source, 'pull', '--ff-only']);
  if (shouldInstall && !dryRun) await runExternal(['bun', 'install'], source);

  const skillUpdate = await refreshInstalledSkills({
    source,
    host: opts.host,
    scope: opts.scope,
    mode: opts.mode,
    dryRun,
  });

  const payload = {
    source,
    ref,
    steps,
    skill_update: skillUpdate,
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`LabLock source: ${source}`);
  if (ref) console.log(`git ref: ${ref}`);
  console.log(`git fetch/switch ref: ${steps.git_ref}`);
  console.log(`git pull --ff-only: ${steps.git_pull}`);
  console.log(`bun install: ${steps.bun_install}`);
  for (const item of skillUpdate.results) console.log(`${item.label}:${item.skill}: ${item.result} -> ${item.path}`);
}

async function doctor(): Promise<void> {
  const checks: Array<[string, () => Promise<boolean>]> = [
    ['Bun >= 1.0', async () => {
      const out = await Bun.$`bun --version`.text();
      return Number(out.trim().split('.')[0]) >= 1;
    }],
    ['git available', async () => {
      await rawGit(['--version']);
      return true;
    }],
    ['gh available', async () => {
      try {
        await Bun.$`gh --version`.quiet();
        return true;
      } catch {
        return false;
      }
    }],
    ['project initialized', async () => pathExists(PATHS.CONFIG)],
    ['project config valid', async () => {
      await readProjectConfig();
      return true;
    }],
  ];
  for (const [name, fn] of checks) {
    const ok = await fn().catch(() => false);
    console.log(`${ok ? '✓' : '✗'} ${name}`);
  }
}

const program = new Command()
  .name('lablock')
  .description('LabLock research workflow guardrails');

program.command('version').action(async () => {
  console.log((await readFile(join(installRoot, 'VERSION'), 'utf8')).trim());
});

program.command('next-exp-id').action(async () => console.log(await nextExpId()));

program.command('doctor').action(async () => doctor().catch(fail));

program.command('dashboard')
  .description('Generate a static experiment planning and progress dashboard')
  .option('--out <dir>', 'output directory', PATHS.DASHBOARD_DIR)
  .option('--json', 'print dashboard JSON instead of writing files')
  .option('--open', 'open the generated HTML dashboard in the default browser')
  .option('--no-html', 'write data.json without index.html')
  .action(async (opts) => {
    try {
      if (opts.json) {
        jsonOut(await collectDashboardData());
        return;
      }
      const result = await writeDashboard({ outDir: opts.out, html: opts.html });
      console.log(`Dashboard data written: ${result.dataPath}`);
      if (result.htmlPath) console.log(`Dashboard HTML written: ${result.htmlPath}`);
      if (opts.open) {
        if (!result.htmlPath) throw new Error('--open requires HTML output; remove --no-html.');
        console.log(`Dashboard opened: ${await openDashboardFile(result.htmlPath)}`);
      }
    } catch (error) {
      fail(error);
    }
  });

program.command('init-project')
  .option('--name <name>', 'project name', process.cwd().split('/').at(-1))
  .option('--modules <csv>', 'enabled modules', 'gpu,data,lit')
  .option('--ci-mode <mode>', 'warn-only | enforce', 'warn-only')
  .option('--goal <text>', 'one-line goal')
  .option('--hypothesis <text>', 'initial hypothesis')
  .option('--naming-profile <profile>', 'minimal | paper-aligned | matrix-first', 'paper-aligned')
  .action(async (opts) => initProject(opts).catch(fail));

program.command('update')
  .description('Upgrade the installed LabLock source and refresh installed skills')
  .option('--source <path>', 'LabLock source repo; defaults to LABLOCK_HOME or detected install')
  .option('--ref <git-ref>', 'preview branch/tag/commit to fetch and install before refreshing skills')
  .option('--host <host>', 'claude | codex | both', 'both')
  .option('--scope <scope>', 'global | project | both | auto', 'global')
  .option('--mode <mode>', 'symlink | copy', 'symlink')
  .option('--no-pull', 'skip git pull --ff-only in the source repo')
  .option('--no-install', 'skip bun install after pulling')
  .option('--dry-run', 'show what would change')
  .option('--json', 'json output')
  .action(async (opts) => updateLabLock(opts).catch(fail));

program.command('update-skills')
  .description('Refresh installed LabLock skills from a local source repo')
  .option('--source <path>', 'LabLock source repo; defaults to LABLOCK_HOME or detected install')
  .option('--host <host>', 'claude | codex | both', 'both')
  .option('--scope <scope>', 'global | project | both | auto', 'global')
  .option('--mode <mode>', 'symlink | copy', 'symlink')
  .option('--pull', 'run git pull --ff-only in the source before updating')
  .option('--dry-run', 'show what would change')
  .option('--json', 'json output')
  .action(async (opts) => updateInstalledSkills(opts).catch(fail));

program.command('exp-init')
  .argument('<shortname>')
  .requiredOption('--hypothesis <text>', 'experiment hypothesis')
  .option('--parent <id>', 'parent experiment id; omit or use none for root experiment')
  .option('--config <pairs>', 'comma-separated dotted key=value invariants', 'optimizer.lr=0.001')
  .option('--control-added <csv>', 'allowed added changes')
  .option('--control-removed <csv>', 'allowed removed changes')
  .option('--control-modified <csv>', 'allowed modified changes')
  .option('--file-invariant <items>', 'comma-separated path:reason entries')
  .option('--matrix-id <id>', 'matrix registry id, e.g. mat-001')
  .option('--variable-id <id>', 'canonical variable registry id, e.g. var-001')
  .option('--canonical-variable <name>', 'canonical variable name, snake_case')
  .option('--variant-value <value>', 'value or variant being tested')
  .option('--paper-label <label>', 'human-readable label for paper tables')
  .option('--kill <csv>', 'kill criteria')
  .option('--success <csv>', 'success criteria')
  .option('--stage', 'git add created files')
  .action(async (shortname, opts) => {
    try {
      const expId = await createExperiment({ shortname, ...opts });
      console.log(`Experiment created: ${expId}`);
    } catch (error) {
      fail(error);
    }
  });

program.command('migrate-node')
  .description('Create a LabLock experiment node that mirrors legacy plan or experiment material')
  .argument('<shortname>')
  .requiredOption('--source <path>', 'legacy source file or directory to reference')
  .requiredOption('--hypothesis <text>', 'hypothesis or summary for the imported node')
  .option('--status <status>', 'planned | running | done | killed | superseded', 'planned')
  .option('--source-type <type>', 'plan | experiment | run | result | unknown', 'unknown')
  .option('--parent <id>', 'parent experiment id; omit or use none for root')
  .option('--confidence <level>', 'low | medium | high', 'medium')
  .option('--success <csv>', 'success criteria or import note')
  .option('--kill <csv>', 'kill criteria or import note')
  .option('--stage', 'git add created node files')
  .action(async (shortname, opts) => {
    try {
      const expId = await createMigratedExperimentNode({ shortname, ...opts });
      console.log(`Migrated experiment node created: ${expId}`);
    } catch (error) {
      fail(error);
    }
  });

program.command('fork')
  .requiredOption('--from <id>', 'experiment to fork')
  .option('--shortname <name>', 'new experiment shortname')
  .option('--reason <text>', 'decision reason')
  .option('--source <source>', 'working | staged', 'working')
  .option('--stage', 'git add created and updated files')
  .option('--no-supersede', 'do not mark source experiment superseded')
  .action(async (opts) => {
    try {
      if (!['working', 'staged'].includes(opts.source)) throw new Error('--source must be working or staged');
      const expId = await forkExperiment(opts);
      console.log(`Experiment forked: ${opts.from} -> ${expId}`);
    } catch (error) {
      fail(error);
    }
  });

program.command('config')
  .argument('<action>', 'get | set | list')
  .argument('[path]')
  .argument('[value]')
  .action(async (action, path, value) => {
    try {
      if (action === 'list') console.log(JSON.stringify(await readProjectConfig(), null, 2));
      else if (action === 'get') console.log(JSON.stringify(await getProjectConfigPath(path), null, 2));
      else if (action === 'set') await setProjectConfigPath(path, parseScalar(value));
      else throw new Error('action must be get, set, or list');
    } catch (error) {
      fail(error);
    }
  });

program.command('exp-start')
  .requiredOption('--exp <id>', 'experiment id')
  .option('--base <branch>', 'base branch', 'main')
  .option('--push', 'push branch to remote')
  .option('--remote <name>', 'remote name', 'origin')
  .action(async (opts) => expStart(opts).catch(fail));

program.command('exp-finalize')
  .requiredOption('--exp <id>', 'experiment id')
  .requiredOption('--status <status>', 'done | killed | superseded')
  .option('--tag', 'create <exp>-final tag')
  .option('--no-clear-current', 'do not clear .lablock/state/current-exp')
  .action(async (opts) => expFinalize(opts).catch(fail));

program.command('postmortem')
  .requiredOption('--exp <id>', 'experiment id')
  .option('--status <status>', 'final status', 'killed')
  .option('--overwrite', 'overwrite existing postmortem')
  .action(async (opts) => postmortem(opts).catch(fail));

program.command('cleanup-pr')
  .requiredOption('--exp <id>', 'experiment id')
  .option('--base <branch>', 'base branch', 'main')
  .option('--dry-run', 'only print planned file classification', true)
  .option('--json', 'json output')
  .action(async (opts) => cleanupPr(opts).catch(fail));

program.command('github-protection')
  .description('Check or apply GitHub branch protection for LabLock protected branches')
  .argument('[action]', 'check | apply', 'check')
  .option('--branch <csv>', 'branch names to check/apply; defaults to config git.protected_branches')
  .option('--repo <owner/name>', 'GitHub repository; defaults to current gh repo')
  .option('--required-status <csv>', 'status check contexts to require when applying protection')
  .option('--required-reviews <n>', 'required approving reviews when applying protection')
  .option('--strict', 'exit nonzero when protection is unavailable or noncompliant')
  .option('--dry-run', 'for apply: print planned payload without writing')
  .option('--replace', 'for apply: replace with the LabLock minimum policy instead of merging existing settings')
  .option('--allow-no-required-status', 'for apply: allow branch protection without required status checks')
  .option('--json', 'json output')
  .action(async (action, opts) => githubProtection({ action, ...opts }).catch(fail));

program.command('github-ruleset')
  .description('Read active GitHub rulesets/rules for a concrete branch ref')
  .argument('[action]', 'check', 'check')
  .option('--branch <name>', 'concrete branch/ref name to evaluate, e.g. paper/draft', 'main')
  .option('--repo <owner/name>', 'GitHub repository; defaults to current gh repo')
  .option('--strict', 'exit nonzero when no active rules are found or rules are unavailable')
  .option('--json', 'json output')
  .action(async (action, opts) => githubRuleset({ action, ...opts }).catch(fail));

program.command('override')
  .requiredOption('--exp <id>')
  .requiredOption('--reason <text>')
  .option('--commit-now')
  .action(async (opts) => {
    try {
      const lock = await readLock(opts.exp);
      if (lock.status !== 'active') throw new Error(`${opts.exp} is not active`);
      const diff = await stagedDiff();
      const classified = classifyDiff(diff);
      const drift_layers = {
        config: await verifyConfigLayer(lock, 'staged').catch(() => []),
        files: await verifyFilesLayer(lock, 'staged').catch(() => []),
      };
      const tag = suggestTag(classified, lock);
      const driftCount = drift_layers.config.length + drift_layers.files.length;
      if (tag !== 'SCOPE-DRIFT' && driftCount === 0) throw new Error('No staged SCOPE-DRIFT detected; override is unnecessary.');
      const changeId = newChangeId();
      const path = `decisions/${new Date().toISOString().slice(0, 10)}-override-${opts.exp}-${changeId}.md`;
      await renderToFile('decision-override.md.tmpl', path, { exp_id: opts.exp, change_id: changeId, reason: opts.reason, drift_layers });
      await stage(path);
      await writeMeta(CommitMetaSchema.parse({
        schema_version: 1,
        exp_id: opts.exp,
        change_id: changeId,
        tag: 'SCOPE-DRIFT',
        classified_files: classified.map((f) => ({ path: f.path, category: f.category, lines_added: f.lines_added, lines_removed: f.lines_removed })),
        drift_layers,
        override_decision: changeId,
        override_reason: opts.reason,
        created_at: new Date().toISOString(),
      }));
      if (opts.commitNow) await rawGit(['commit', '-m', `[${opts.exp}][SCOPE-DRIFT] Record override`, '-m', `LabLock-Change: ${changeId}`]);
      console.log(`Override recorded: ${changeId}`);
    } catch (error) {
      fail(error);
    }
  });

program.parse(process.argv);
