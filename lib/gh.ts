import { spawn } from 'node:child_process';

export class GitHubApiError extends Error {
  status: number | null;
  body: unknown;

  constructor(message: string, status: number | null = null, body: unknown = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.body = body;
  }
}

function parseGhError(stderr: string, fallback: string): Error {
  const jsonLine = stderr.split('\n').map((line) => line.trim()).find((line) => line.startsWith('{') && line.endsWith('}'));
  if (jsonLine) {
    try {
      const body = JSON.parse(jsonLine);
      return new GitHubApiError(body.message ?? fallback, Number(body.status) || null, body);
    } catch {
      // Fall through to plain error.
    }
  }
  const status = stderr.match(/\bHTTP\s+(\d{3})\b/)?.[1];
  return new GitHubApiError(stderr.trim() || fallback, status ? Number(status) : null, null);
}

async function gh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (d) => stdout.push(Buffer.from(d)));
    child.stderr.on('data', (d) => stderr.push(Buffer.from(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8');
      if (code === 0) resolve(out);
      else reject(parseGhError(Buffer.concat(stderr).toString('utf8'), `gh exited ${code}`));
    });
  });
}

async function ghWithInput(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdin.end(input);
    child.stdout.on('data', (d) => stdout.push(Buffer.from(d)));
    child.stderr.on('data', (d) => stderr.push(Buffer.from(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8');
      if (code === 0) resolve(out);
      else reject(parseGhError(Buffer.concat(stderr).toString('utf8'), `gh exited ${code}`));
    });
  });
}

function parseUrlAndNumber(out: string): { url: string; number: number } {
  const url = out.match(/https?:\/\/\S+/)?.[0] ?? out.trim();
  const number = Number(url.match(/\/(\d+)(?:$|\?)/)?.[1] ?? 0);
  return { url, number };
}

export async function isGhAvailable(): Promise<boolean> {
  try {
    await gh(['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await gh(['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}

export async function createRepo(options: {
  name: string;
  private: boolean;
  description?: string;
}): Promise<{ url: string }> {
  const args = ['repo', 'create', options.name, options.private ? '--private' : '--public', '--source=.', '--remote=origin'];
  if (options.description) args.push('--description', options.description);
  const out = await gh(args);
  return { url: out.match(/https?:\/\/\S+/)?.[0] ?? out.trim() };
}

export async function createPR(options: {
  title: string;
  body: string;
  base: string;
  head: string;
  draft?: boolean;
  labels?: string[];
}): Promise<{ url: string; number: number }> {
  const args = ['pr', 'create', '--title', options.title, '--body', options.body, '--base', options.base, '--head', options.head];
  if (options.draft) args.push('--draft');
  for (const label of options.labels ?? []) args.push('--label', label);
  return parseUrlAndNumber(await gh(args));
}

export async function currentRepo(): Promise<string> {
  const repo = (await gh(['repo', 'view', '--json', 'nameWithOwner'])).trim();
  return JSON.parse(repo).nameWithOwner;
}

export function branchProtectionPayload(rules: {
  required_status_checks?: string[];
  enforce_admins?: boolean;
  required_pull_request_reviews?: { required_approving_review_count: number };
  restrictions?: null;
  allow_force_pushes?: boolean;
  allow_deletions?: boolean;
}): Record<string, unknown> {
  return {
    required_status_checks: rules.required_status_checks
      ? { strict: true, contexts: rules.required_status_checks }
      : null,
    enforce_admins: Boolean(rules.enforce_admins),
    required_pull_request_reviews: rules.required_pull_request_reviews ?? null,
    restrictions: rules.restrictions ?? null,
    allow_force_pushes: Boolean(rules.allow_force_pushes),
    allow_deletions: Boolean(rules.allow_deletions),
  };
}

export async function getBranchProtection(branch: string, repo?: string): Promise<unknown> {
  const nameWithOwner = repo ?? await currentRepo();
  return JSON.parse(await gh(['api', `repos/${nameWithOwner}/branches/${branch}/protection`]));
}

export async function setBranchProtection(
  branch: string,
  rules: {
    required_status_checks?: string[];
    enforce_admins?: boolean;
    required_pull_request_reviews?: { required_approving_review_count: number };
    restrictions?: null;
    allow_force_pushes?: boolean;
    allow_deletions?: boolean;
  },
  repo?: string,
): Promise<void> {
  const nameWithOwner = repo ?? await currentRepo();
  await putBranchProtection(branch, branchProtectionPayload(rules), nameWithOwner);
}

export async function putBranchProtection(
  branch: string,
  payload: Record<string, unknown>,
  repo?: string,
): Promise<void> {
  const nameWithOwner = repo ?? await currentRepo();
  await ghWithInput(
    ['api', '--method', 'PUT', `repos/${nameWithOwner}/branches/${branch}/protection`, '--input', '-'],
    JSON.stringify(payload),
  );
}

export async function createIssue(options: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ url: string; number: number }> {
  const args = ['issue', 'create', '--title', options.title, '--body', options.body];
  for (const label of options.labels ?? []) args.push('--label', label);
  return parseUrlAndNumber(await gh(args));
}
