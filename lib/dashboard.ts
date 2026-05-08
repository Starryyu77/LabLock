import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { readFrontmatter } from './frontmatter.ts';
import { atomicWrite, pathExists, readTextIfExists } from './fs-util.ts';
import { listLocks } from './lock.ts';
import { PATHS } from './paths.ts';
import type { ExperimentFrontmatter, ScopeLock } from './types.ts';

export interface DashboardExperiment {
  id: string;
  shortname: string;
  status: string;
  lock_status: string | null;
  parent: string | null;
  forked_from: string | null;
  created: string | null;
  is_current: boolean;
  hypothesis: string;
  path: string;
  result_path: string;
  config_path: string;
  planning: {
    hypothesis: string;
    what_changed: string[];
    success_criteria: string[];
    kill_criteria: string[];
    notes: string;
  };
  progress: {
    summary: string;
    has_results_file: boolean;
  };
  controlled_changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  config: Array<{ key: string; value: unknown }>;
  children: string[];
  next_subexperiments: string[];
}

export interface DashboardData {
  generated_at: string;
  project: {
    name: string;
    goal: string | null;
    current_hypothesis: string | null;
  };
  summary: {
    total: number;
    planned: number;
    running: number;
    done: number;
    killed: number;
    superseded: number;
    active_locks: number;
    current_exp: string | null;
  };
  experiments: DashboardExperiment[];
}

export interface DashboardWriteResult {
  data: DashboardData;
  dataPath: string;
  htmlPath: string | null;
}

function normalizeHeading(raw: string): string {
  return raw.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
}

function extractSection(markdown: string, names: string[]): string {
  const wanted = new Set(names.map(normalizeHeading));
  const lines = markdown.split(/\r?\n/);
  let collecting = false;
  const out: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      if (collecting) break;
      collecting = wanted.has(normalizeHeading(match[2]));
      continue;
    }
    if (collecting) out.push(line);
  }
  return out.join('\n').trim();
}

function bulletLines(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

function compactMarkdown(markdown: string, maxChars = 420): string {
  const text = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
    .join(' ');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}...`;
}

function flattenConfig(value: unknown, prefix = ''): Array<{ key: string; value: unknown }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [{ key: prefix, value }] : [];
  }
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) rows.push(...flattenConfig(child, next));
    else rows.push({ key: next, value: child });
  }
  return rows;
}

function dateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

async function listExperimentHypotheses(): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(PATHS.EXPERIMENTS, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const paths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(PATHS.EXPERIMENTS, entry.name, 'hypothesis.md').replaceAll('\\', '/');
    if (await pathExists(path)) paths.push(path);
  }
  return paths.sort();
}

async function readProjectSummary(): Promise<DashboardData['project']> {
  const raw = await readTextIfExists(PATHS.PROJECT_MD);
  if (!raw) return { name: basename(process.cwd()), goal: null, current_hypothesis: null };
  const title = raw.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? basename(process.cwd());
  return {
    name: title,
    goal: compactMarkdown(extractSection(raw, ['One-line goal']), 220) || null,
    current_hypothesis: compactMarkdown(extractSection(raw, ['Current hypothesis']), 220) || null,
  };
}

function shortnameFromPath(path: string, id: string): string {
  const dir = path.split('/').at(-2) ?? id;
  return dir.startsWith(`${id}-`) ? dir.slice(id.length + 1) : dir;
}

async function readConfigRows(path: string): Promise<Array<{ key: string; value: unknown }>> {
  const raw = await readTextIfExists(path);
  if (!raw) return [];
  return flattenConfig(yaml.load(raw) ?? {}).sort((a, b) => a.key.localeCompare(b.key));
}

function lockById(locks: ScopeLock[]): Map<string, ScopeLock> {
  return new Map(locks.map((lock) => [lock.exp_id, lock]));
}

export async function collectDashboardData(): Promise<DashboardData> {
  const [project, locks, currentExpRaw, hypothesisPaths] = await Promise.all([
    readProjectSummary(),
    listLocks(),
    readTextIfExists(PATHS.STATE_CURRENT_EXP),
    listExperimentHypotheses(),
  ]);
  const locksById = lockById(locks);
  const currentExp = currentExpRaw?.trim() || null;
  const experiments: DashboardExperiment[] = [];

  for (const hypothesisPath of hypothesisPaths) {
    const doc = await readFrontmatter<ExperimentFrontmatter>(hypothesisPath);
    const fm = doc.frontmatter as any;
    if (!fm.id) continue;
    const id = String(fm.id);
    const shortname = shortnameFromPath(hypothesisPath, id);
    const lock = locksById.get(id);
    const resultPath = join(hypothesisPath, '..', 'results.md').replaceAll('\\', '/');
    const configPath = join(hypothesisPath, '..', 'config.yaml').replaceAll('\\', '/');
    const resultsRaw = await readTextIfExists(resultPath);
    const progressSection = resultsRaw
      ? extractSection(resultsRaw, ['Progress', 'Current progress', 'Progress log', 'Results', '进展', '结果'])
      : '';
    const explicitNext = [
      ...bulletLines(extractSection(doc.body, ['Next sub-experiment', 'Next sub-experiments', 'Next steps', '下一步', '子实验'])),
      ...(resultsRaw ? bulletLines(extractSection(resultsRaw, ['Next sub-experiment', 'Next sub-experiments', 'Next steps', '下一步', '子实验'])) : []),
    ];
    const whatChanged = bulletLines(extractSection(doc.body, ['What changed', 'Controlled changes', '实验方案', '方案']));
    const success = lock?.success_criteria ?? bulletLines(extractSection(doc.body, ['Success criteria']));
    const kill = lock?.kill_criteria ?? bulletLines(extractSection(doc.body, ['Kill criteria']));
    const controlled = lock?.controlled_changes ?? {
      added: whatChanged.filter((line) => line.toLowerCase().startsWith('added:')).map((line) => line.replace(/^added:\s*/i, '')),
      removed: whatChanged.filter((line) => line.toLowerCase().startsWith('removed:')).map((line) => line.replace(/^removed:\s*/i, '')),
      modified: whatChanged.filter((line) => line.toLowerCase().startsWith('modified:')).map((line) => line.replace(/^modified:\s*/i, '')),
    };

    experiments.push({
      id,
      shortname,
      status: String(fm.status ?? 'unknown'),
      lock_status: lock?.status ?? null,
      parent: fm.parent ?? lock?.parent ?? null,
      forked_from: fm.forked_from ?? null,
      created: dateString(fm.created),
      is_current: currentExp === id,
      hypothesis: String(fm.hypothesis ?? lock?.hypothesis ?? '').trim(),
      path: hypothesisPath,
      result_path: resultPath,
      config_path: configPath,
      planning: {
        hypothesis: compactMarkdown(extractSection(doc.body, ['Hypothesis']) || String(fm.hypothesis ?? ''), 520),
        what_changed: whatChanged,
        success_criteria: success,
        kill_criteria: kill,
        notes: compactMarkdown(extractSection(doc.body, ['Notes', 'Plan notes', '规划备注']), 360),
      },
      progress: {
        summary: compactMarkdown(progressSection || resultsRaw || '', 520),
        has_results_file: Boolean(resultsRaw),
      },
      controlled_changes: {
        added: controlled.added ?? [],
        removed: controlled.removed ?? [],
        modified: controlled.modified ?? [],
      },
      config: await readConfigRows(configPath),
      children: [],
      next_subexperiments: explicitNext,
    });
  }

  const byId = new Map(experiments.map((experiment) => [experiment.id, experiment]));
  for (const experiment of experiments) {
    const parent = experiment.parent ?? experiment.forked_from;
    if (parent && byId.has(parent)) byId.get(parent)!.children.push(experiment.id);
  }
  for (const experiment of experiments) {
    const plannedChildren = experiment.children
      .map((id) => byId.get(id))
      .filter((child): child is DashboardExperiment => child !== undefined && ['planned', 'running'].includes(child.status))
      .map((child) => `${child.id} ${child.shortname}: ${child.hypothesis}`);
    experiment.next_subexperiments = [...new Set([...experiment.next_subexperiments, ...plannedChildren])];
  }

  experiments.sort((a, b) => a.id.localeCompare(b.id));
  const count = (status: string) => experiments.filter((experiment) => experiment.status === status).length;
  return {
    generated_at: new Date().toISOString(),
    project,
    summary: {
      total: experiments.length,
      planned: count('planned'),
      running: count('running'),
      done: count('done'),
      killed: count('killed'),
      superseded: count('superseded'),
      active_locks: locks.filter((lock) => lock.status === 'active').length,
      current_exp: currentExp,
    },
    experiments,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function jsonScript(data: DashboardData): string {
  return JSON.stringify(data).replaceAll('</script', '<\\/script');
}

function relLink(outDir: string, target: string): string {
  const rel = relative(outDir, target).replaceAll('\\', '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function statusTone(status: string): string {
  if (status === 'running') return 'running';
  if (status === 'done') return 'done';
  if (status === 'killed') return 'killed';
  if (status === 'superseded') return 'superseded';
  return 'planned';
}

function metric(label: string, value: unknown): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function statusBars(data: DashboardData): string {
  const statuses = [
    ['planned', data.summary.planned],
    ['running', data.summary.running],
    ['done', data.summary.done],
    ['killed', data.summary.killed],
    ['superseded', data.summary.superseded],
  ];
  const total = Math.max(data.summary.total, 1);
  return `<div class="status-bars">${statuses.map(([status, value]) => {
    const width = Math.max(4, Math.round((Number(value) / total) * 100));
    return `<div class="status-row"><span>${escapeHtml(status)}</span><div><i class="${statusTone(String(status))}" style="width:${width}%"></i></div><strong>${escapeHtml(value)}</strong></div>`;
  }).join('')}</div>`;
}

function listItems(items: string[], empty = '—'): string {
  if (!items.length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function configRows(items: Array<{ key: string; value: unknown }>): string {
  if (!items.length) return '<p class="empty">—</p>';
  return `<dl>${items.slice(0, 8).map((item) => `<div><dt>${escapeHtml(item.key)}</dt><dd>${escapeHtml(JSON.stringify(item.value))}</dd></div>`).join('')}</dl>`;
}

function experimentCard(experiment: DashboardExperiment, outDir: string): string {
  const tone = statusTone(experiment.status);
  const next = experiment.next_subexperiments.length ? experiment.next_subexperiments[0] : '—';
  return [
    `<article class="experiment-card" data-status="${escapeAttr(experiment.status)}" data-exp="${escapeAttr(experiment.id)}">`,
    '<div class="card-top">',
    `<a class="exp-link" href="${escapeAttr(relLink(outDir, experiment.path))}">${escapeHtml(experiment.id)}</a>`,
    `<span class="status ${tone}">${escapeHtml(experiment.status)}</span>`,
    '</div>',
    `<h3>${escapeHtml(experiment.shortname)}</h3>`,
    `<p>${escapeHtml(experiment.hypothesis || '—')}</p>`,
    '<div class="card-grid">',
    `<span>Parent</span><strong>${escapeHtml(experiment.parent ?? experiment.forked_from ?? 'root')}</strong>`,
    `<span>Progress</span><strong>${escapeHtml(experiment.progress.summary || '—')}</strong>`,
    `<span>Next</span><strong>${escapeHtml(next)}</strong>`,
    '</div>',
    '</article>',
  ].join('');
}

function lane(title: string, status: string, experiments: DashboardExperiment[], outDir: string): string {
  const items = experiments.filter((experiment) => experiment.status === status);
  return [
    `<section class="lane" data-lane="${escapeAttr(status)}">`,
    '<div class="lane-head">',
    `<h3>${escapeHtml(title)}</h3>`,
    `<span>${items.length}</span>`,
    '</div>',
    items.length ? items.map((experiment) => experimentCard(experiment, outDir)).join('\n') : '<p class="empty">—</p>',
    '</section>',
  ].join('');
}

function experimentDepths(experiments: DashboardExperiment[]): Map<string, number> {
  const byId = new Map(experiments.map((experiment) => [experiment.id, experiment]));
  const depths = new Map<string, number>();
  function depthOf(experiment: DashboardExperiment, seen = new Set<string>()): number {
    if (depths.has(experiment.id)) return depths.get(experiment.id)!;
    if (seen.has(experiment.id)) return 0;
    const parentId = experiment.parent ?? experiment.forked_from;
    const parent = parentId ? byId.get(parentId) : undefined;
    const depth = parent ? depthOf(parent, new Set([...seen, experiment.id])) + 1 : 0;
    depths.set(experiment.id, depth);
    return depth;
  }
  experiments.forEach((experiment) => depthOf(experiment));
  return depths;
}

function experimentMap(experiments: DashboardExperiment[]): string {
  const depths = experimentDepths(experiments);
  return `<nav class="tree" aria-label="Experiment tree">
    ${experiments.map((experiment) => {
      const depth = depths.get(experiment.id) ?? 0;
      return `<button type="button" data-exp-nav="${escapeAttr(experiment.id)}" style="--depth:${depth}">
        <span class="node-dot ${statusTone(experiment.status)}"></span>
        <span class="node-main"><strong>${escapeHtml(experiment.id)}</strong><small>${escapeHtml(experiment.shortname)}</small></span>
      </button>`;
    }).join('')}
  </nav>`;
}

function detailsPanel(experiment: DashboardExperiment, outDir: string): string {
  return [
    `<section class="detail-panel" data-exp-detail="${escapeAttr(experiment.id)}">`,
    '<div class="detail-title">',
    `<div><span class="mono">${escapeHtml(experiment.id)}</span><h2>${escapeHtml(experiment.shortname)}</h2></div>`,
    `<span class="status ${statusTone(experiment.status)}">${escapeHtml(experiment.status)}</span>`,
    '</div>',
    '<div class="detail-links">',
    `<a href="${escapeAttr(relLink(outDir, experiment.path))}">hypothesis.md</a>`,
    `<a href="${escapeAttr(relLink(outDir, experiment.result_path))}">results.md</a>`,
    `<a href="${escapeAttr(relLink(outDir, experiment.config_path))}">config.yaml</a>`,
    '</div>',
    '<div class="detail-grid">',
    `<section><h3>Plan</h3><p>${escapeHtml(experiment.planning.hypothesis || experiment.hypothesis || '—')}</p></section>`,
    `<section><h3>Progress</h3><p>${escapeHtml(experiment.progress.summary || '—')}</p></section>`,
    `<section><h3>Next Sub-experiments</h3>${listItems(experiment.next_subexperiments)}</section>`,
    `<section><h3>Controlled Changes</h3>${listItems([
      ...experiment.controlled_changes.added.map((item) => `Added: ${item}`),
      ...experiment.controlled_changes.removed.map((item) => `Removed: ${item}`),
      ...experiment.controlled_changes.modified.map((item) => `Modified: ${item}`),
    ])}</section>`,
    `<section><h3>Success Criteria</h3>${listItems(experiment.planning.success_criteria)}</section>`,
    `<section><h3>Kill Criteria</h3>${listItems(experiment.planning.kill_criteria)}</section>`,
    `<section><h3>Config</h3>${configRows(experiment.config)}</section>`,
    `<section><h3>Children</h3>${listItems(experiment.children)}</section>`,
    '</div>',
    '</section>',
  ].join('');
}

function renderDashboardHtml(data: DashboardData, outDir: string): string {
  const active = data.experiments.find((experiment) => experiment.is_current)
    ?? data.experiments.find((experiment) => experiment.status === 'running')
    ?? data.experiments.find((experiment) => experiment.status === 'planned')
    ?? data.experiments[0];
  const lanes = [
    lane('Planned', 'planned', data.experiments, outDir),
    lane('Running', 'running', data.experiments, outDir),
    lane('Done', 'done', data.experiments, outDir),
    lane('Killed', 'killed', data.experiments, outDir),
    lane('Superseded', 'superseded', data.experiments, outDir),
  ].join('\n');
  const details = data.experiments.map((experiment) => detailsPanel(experiment, outDir)).join('\n');
  const emptyState = data.experiments.length
    ? ''
    : '<section class="empty-board"><h2>No experiments yet</h2><p>The experiment tree is empty.</p></section>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.project.name)} · LabLock Experiment Board</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8f5;
      --surface: #ffffff;
      --surface-soft: #fbfcfa;
      --ink: #202422;
      --muted: #68716b;
      --line: #dfe4dc;
      --line-strong: #c8d1c6;
      --accent: #256f5c;
      --accent-ink: #0f3e32;
      --blue: #335c99;
      --amber: #a96416;
      --red: #a33b3b;
      --violet: #6c4b8f;
      --shadow: 0 16px 40px rgba(25, 35, 30, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      line-height: 1.45;
    }
    a { color: inherit; text-decoration: none; }
    .shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
    header {
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.86);
      backdrop-filter: blur(18px);
      position: sticky;
      top: 0;
      z-index: 3;
    }
    .header-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 22px 28px;
      display: grid;
      grid-template-columns: minmax(280px, 1fr) auto;
      gap: 24px;
      align-items: end;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 28px; line-height: 1.12; font-weight: 720; }
    .subtitle { color: var(--muted); margin-top: 8px; max-width: 760px; }
    .toolbar { display: flex; align-items: center; gap: 10px; }
    .search {
      width: 260px;
      height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 7px;
      background: #fff;
      color: var(--ink);
      padding: 0 12px;
      font: inherit;
    }
    .select {
      height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 7px;
      background: #fff;
      color: var(--ink);
      padding: 0 10px;
      font: inherit;
    }
    main {
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
      padding: 24px 28px 36px;
      display: grid;
      grid-template-columns: 270px minmax(520px, 1fr) minmax(360px, 470px);
      gap: 20px;
      align-items: start;
    }
    .rail, .detail-panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .rail { padding: 16px; position: sticky; top: 104px; }
    .rail h2, .board h2 { font-size: 13px; color: var(--muted); font-weight: 700; text-transform: uppercase; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .metric {
      min-height: 70px;
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 10px;
      background: var(--surface-soft);
    }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 5px; font-size: 24px; line-height: 1; }
    .status-bars { display: grid; gap: 8px; margin-top: 16px; }
    .status-row {
      display: grid;
      grid-template-columns: 76px 1fr 22px;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
    }
    .status-row div {
      height: 8px;
      border-radius: 99px;
      background: #ecf0ea;
      overflow: hidden;
    }
    .status-row i { display: block; height: 100%; border-radius: inherit; background: var(--amber); }
    .status-row i.running { background: var(--accent); }
    .status-row i.done { background: var(--blue); }
    .status-row i.killed { background: var(--red); }
    .status-row i.superseded { background: var(--violet); }
    .status-row strong { color: var(--ink); text-align: right; }
    .tree { margin-top: 18px; display: grid; gap: 4px; }
    .tree button {
      min-height: 42px;
      border: 0;
      background: transparent;
      border-radius: 6px;
      padding: 7px 8px 7px calc(8px + var(--depth, 0) * 18px);
      text-align: left;
      color: var(--muted);
      font: inherit;
      cursor: pointer;
      display: grid;
      grid-template-columns: 12px 1fr;
      align-items: center;
      gap: 8px;
    }
    .tree button.active, .tree button:hover { background: #edf3ef; color: var(--accent-ink); }
    .node-dot {
      width: 9px;
      height: 9px;
      border-radius: 99px;
      background: var(--amber);
      box-shadow: 0 0 0 3px rgba(169, 100, 22, 0.10);
    }
    .node-dot.running { background: var(--accent); box-shadow: 0 0 0 3px rgba(37, 111, 92, 0.12); }
    .node-dot.done { background: var(--blue); box-shadow: 0 0 0 3px rgba(51, 92, 153, 0.12); }
    .node-dot.killed { background: var(--red); box-shadow: 0 0 0 3px rgba(163, 59, 59, 0.12); }
    .node-dot.superseded { background: var(--violet); box-shadow: 0 0 0 3px rgba(108, 75, 143, 0.12); }
    .node-main { display: grid; gap: 1px; min-width: 0; }
    .node-main strong { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; color: var(--ink); }
    .node-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .board { min-width: 0; }
    .board-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 14px; }
    .generated { color: var(--muted); font-size: 12px; }
    .lanes {
      display: grid;
      grid-template-columns: repeat(5, minmax(180px, 1fr));
      gap: 12px;
      align-items: start;
      overflow-x: auto;
      padding-bottom: 6px;
    }
    .lane {
      min-width: 180px;
      min-height: 420px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.62);
      padding: 10px;
      display: grid;
      align-content: start;
      gap: 10px;
    }
    .lane-head {
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 4px 6px;
      border-bottom: 1px solid var(--line);
    }
    .lane-head h3 { font-size: 13px; line-height: 1.2; }
    .lane-head span {
      min-width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      border-radius: 99px;
      background: var(--surface-soft);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .experiment-card {
      min-height: 214px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 16px;
      box-shadow: 0 8px 18px rgba(25, 35, 30, 0.06);
      cursor: pointer;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 10px;
    }
    .experiment-card:hover, .experiment-card.active { border-color: var(--accent); }
    .card-top, .detail-title, .detail-links { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .exp-link, .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; color: var(--accent-ink); }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .status::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 99px;
      background: var(--blue);
    }
    .status.running::before { background: var(--accent); }
    .status.done::before { background: var(--blue); }
    .status.killed::before { background: var(--red); }
    .status.superseded::before { background: var(--violet); }
    .status.planned::before { background: var(--amber); }
    .experiment-card h3 { font-size: 16px; line-height: 1.2; }
    .experiment-card p { color: var(--muted); min-height: 64px; }
    .card-grid {
      border-top: 1px solid var(--line);
      padding-top: 10px;
      display: grid;
      grid-template-columns: 70px 1fr;
      gap: 6px 10px;
      font-size: 12px;
    }
    .card-grid span { color: var(--muted); }
    .card-grid strong { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .detail-panel { display: none; padding: 18px; position: sticky; top: 104px; }
    .detail-panel.active { display: block; }
    .detail-title { align-items: start; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
    .detail-title h2 { margin-top: 4px; font-size: 24px; line-height: 1.14; }
    .detail-links { justify-content: flex-start; flex-wrap: wrap; margin: 12px 0 16px; }
    .detail-links a {
      border: 1px solid var(--line);
      border-radius: 6px;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
      padding: 0 10px;
      color: var(--accent-ink);
      background: var(--surface-soft);
      font-size: 12px;
      font-weight: 700;
    }
    .detail-grid { display: grid; gap: 12px; }
    .detail-grid section {
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }
    .detail-grid h3 { font-size: 13px; margin-bottom: 8px; }
    .detail-grid p, .detail-grid li, .empty { color: var(--muted); }
    ul { margin: 0; padding-left: 18px; }
    li + li { margin-top: 4px; }
    dl { margin: 0; display: grid; gap: 6px; }
    dl div { display: grid; grid-template-columns: minmax(110px, 0.7fr) 1fr; gap: 10px; }
    dt { color: var(--muted); overflow-wrap: anywhere; }
    dd { margin: 0; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; overflow-wrap: anywhere; }
    .empty-board {
      grid-column: 1 / -1;
      min-height: 280px;
      border: 1px dashed var(--line-strong);
      border-radius: 8px;
      display: grid;
      place-content: center;
      gap: 8px;
      text-align: center;
      color: var(--muted);
    }
    .hidden { display: none; }
    @media (max-width: 1180px) {
      .header-inner { grid-template-columns: 1fr; align-items: start; }
      main { grid-template-columns: 220px 1fr; }
      .detail-panel { grid-column: 2; position: static; }
      .lanes { grid-template-columns: repeat(5, minmax(190px, 1fr)); }
    }
    @media (max-width: 780px) {
      .header-inner, main { padding-left: 16px; padding-right: 16px; }
      .toolbar { flex-wrap: wrap; }
      .search { width: 100%; }
      main { grid-template-columns: 1fr; }
      .rail, .detail-panel { position: static; }
      .lanes { grid-template-columns: 1fr; overflow-x: visible; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="header-inner">
        <div>
          <h1>${escapeHtml(data.project.name)} Experiment Board</h1>
          <p class="subtitle">${escapeHtml(data.project.goal ?? data.project.current_hypothesis ?? 'LabLock experiment planning and progress board')}</p>
        </div>
        <div class="toolbar">
          <input class="search" id="search" type="search" placeholder="Search experiments" aria-label="Search experiments">
          <select class="select" id="statusFilter" aria-label="Filter by status">
            <option value="all">All status</option>
            <option value="planned">Planned</option>
            <option value="running">Running</option>
            <option value="done">Done</option>
            <option value="killed">Killed</option>
            <option value="superseded">Superseded</option>
          </select>
        </div>
      </div>
    </header>
    <main>
      <aside class="rail">
        <h2>Snapshot</h2>
        <div class="metrics">
          ${metric('Total', data.summary.total)}
          ${metric('Running', data.summary.running)}
          ${metric('Planned', data.summary.planned)}
          ${metric('Active locks', data.summary.active_locks)}
        </div>
        ${statusBars(data)}
        ${experimentMap(data.experiments)}
      </aside>
      <section class="board">
        <div class="board-head">
          <h2>Planning Board</h2>
          <span class="generated">Generated ${escapeHtml(data.generated_at)}</span>
        </div>
        <div class="lanes">
          ${lanes}
        </div>
      </section>
      <aside id="detailHost">
        ${details}
      </aside>
      ${emptyState}
    </main>
  </div>
  <script type="application/json" id="dashboard-data">${jsonScript(data)}</script>
  <script>
    const data = JSON.parse(document.getElementById('dashboard-data').textContent);
    const initial = ${JSON.stringify(active?.id ?? null)};
    const cards = [...document.querySelectorAll('[data-exp]')];
    const panels = [...document.querySelectorAll('[data-exp-detail]')];
    const nav = [...document.querySelectorAll('[data-exp-nav]')];
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('statusFilter');
    function select(id) {
      cards.forEach((card) => card.classList.toggle('active', card.dataset.exp === id));
      panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.expDetail === id));
      nav.forEach((item) => item.classList.toggle('active', item.dataset.expNav === id));
    }
    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      cards.forEach((card) => {
        const item = data.experiments.find((experiment) => experiment.id === card.dataset.exp);
        const haystack = [item.id, item.shortname, item.status, item.hypothesis, item.parent, item.forked_from].filter(Boolean).join(' ').toLowerCase();
        const visible = (!query || haystack.includes(query)) && (status === 'all' || item.status === status);
        card.classList.toggle('hidden', !visible);
      });
    }
    cards.forEach((card) => card.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      select(card.dataset.exp);
    }));
    nav.forEach((item) => item.addEventListener('click', () => select(item.dataset.expNav)));
    search.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    if (initial) select(initial);
  </script>
</body>
</html>
`;
}

export async function writeDashboard(options?: {
  outDir?: string;
  html?: boolean;
  data?: DashboardData;
}): Promise<DashboardWriteResult> {
  const outDir = options?.outDir ?? PATHS.DASHBOARD_DIR;
  const data = options?.data ?? await collectDashboardData();
  await mkdir(outDir, { recursive: true });
  const dataPath = join(outDir, 'data.json').replaceAll('\\', '/');
  await atomicWrite(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  let htmlPath: string | null = null;
  if (options?.html !== false) {
    htmlPath = join(outDir, 'index.html').replaceAll('\\', '/');
    await atomicWrite(htmlPath, renderDashboardHtml(data, outDir));
  }
  return { data, dataPath, htmlPath };
}

export function openDashboardFile(htmlPath: string): Promise<string> {
  return new Promise((resolveOpen, reject) => {
    const fileUrl = pathToFileURL(resolve(htmlPath)).href;
    let command: string;
    let args: string[];
    if (process.platform === 'darwin') {
      command = 'open';
      args = [fileUrl];
    } else if (process.platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', fileUrl];
    } else {
      command = 'xdg-open';
      args = [fileUrl];
    }
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', reject);
    child.unref();
    resolveOpen(fileUrl);
  });
}
