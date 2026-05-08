#!/usr/bin/env bun
import { Command } from 'commander';
import { cp, lstat, mkdir, readdir, readFile, readlink, realpath, symlink, unlink, copyFile, chmod, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { DEFAULT_PROJECT_CONFIG, type ScopeLock } from '../lib/types.ts';
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
import { GitHubApiError, branchProtectionPayload, currentRepo, getBranchProtection, isAuthenticated, isGhAvailable, putBranchProtection } from '../lib/gh.ts';
import { fail, parseScalar } from './_util.ts';
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
  return Object.keys(out).length ? out : null;
}

function normalizeExistingRestrictions(restrictions: any): unknown {
  if (!restrictions) return null;
  const names = (items: any[]) => items.map((item) => item.slug ?? item.login ?? item.name).filter(Boolean);
  return {
    users: Array.isArray(restrictions.users) ? names(restrictions.users) : [],
    teams: Array.isArray(restrictions.teams) ? names(restrictions.teams) : [],
    apps: Array.isArray(restrictions.apps) ? names(restrictions.apps) : [],
  };
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

function evaluateBranchProtection(
  protection: unknown,
  policy: {
    required_status_checks: string[];
    required_reviews: number | null;
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
      const existing = action === 'apply' && opts.replace && opts.dryRun
        ? null
        : await getBranchProtection(branch, repo).catch((error) => {
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
          results.push({
            branch,
            status: 'would-apply',
            compliance: 'unchecked',
            mode: opts.replace ? 'replace' : 'merge-existing',
            planned_payload: payload,
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

async function initProject(opts: { name: string; modules?: string; ciMode?: string; goal?: string; hypothesis?: string }): Promise<void> {
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

  const context = {
    project_name: opts.name,
    goal: opts.goal ?? opts.name,
    hypothesis: opts.hypothesis ?? 'Initial hypothesis to be refined.',
    formalism_version: 'v1',
    modules,
  };
  const renders: Array<[string, string]> = [
    ['PROJECT.md.tmpl', PATHS.PROJECT_MD],
    ['formalism.md.tmpl', PATHS.FORMALISM_MD],
    ['claims.md.tmpl', PATHS.CLAIMS_MD],
    ['INDEX.md.tmpl', PATHS.INDEX_MD],
    ['matrix.md.tmpl', PATHS.EXPERIMENTS_MATRIX],
    ['MAP.md.tmpl', PATHS.MAP_MD],
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

  const payload = {
    source,
    pulled: Boolean(opts.pull),
    mode,
    results,
  };
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`LabLock source: ${source}`);
    for (const item of results) console.log(`${item.label}:${item.skill}: ${item.result} -> ${item.path}`);
  }
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

program.command('init-project')
  .option('--name <name>', 'project name', process.cwd().split('/').at(-1))
  .option('--modules <csv>', 'enabled modules', 'gpu,data,lit')
  .option('--ci-mode <mode>', 'warn-only | enforce', 'warn-only')
  .option('--goal <text>', 'one-line goal')
  .option('--hypothesis <text>', 'initial hypothesis')
  .action(async (opts) => initProject(opts).catch(fail));

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
