import { spawn } from 'node:child_process';
import simpleGit from 'simple-git';

export class BinaryFileError extends Error {
  constructor(path: string) {
    super(`${path}: staged blob appears to be binary`);
    this.name = 'BinaryFileError';
  }
}

const git = simpleGit();

export async function currentBranch(): Promise<string | null> {
  const summary = await git.branch();
  return summary.detached ? null : summary.current;
}

export async function stagedFiles(): Promise<string[]> {
  const out = await rawGit(['diff', '--cached', '--name-only']);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function stagedDiff(): Promise<string> {
  return rawGit(['diff', '--cached']);
}

function assertText(path: string, content: string): string {
  if (content.includes('\0')) throw new BinaryFileError(path);
  return content;
}

export async function stagedBlob(filePath: string): Promise<string> {
  return assertText(filePath, await rawGit(['show', `:${filePath}`]));
}

export async function headBlob(filePath: string): Promise<string> {
  return assertText(filePath, await rawGit(['show', `HEAD:${filePath}`]));
}

export async function stage(filePath: string): Promise<void> {
  await rawGit(['add', filePath]);
}

export async function recentCommits(n: number): Promise<Array<{
  hash: string;
  message: string;
  date: string;
  author: string;
}>> {
  const sep = '\x1f';
  const rec = '\x1e';
  const out = await rawGit(['log', `-${n}`, `--format=%H${sep}%s${sep}%cI${sep}%an${rec}`]);
  return out.split(rec).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [hash, message, date, author] = line.split(sep);
    return { hash, message, date, author };
  });
}

export async function grepCommits(pattern: string): Promise<string[]> {
  const out = await rawGit(['log', '--all', '--format=%H', `--grep=${pattern}`]);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function branches(pattern?: string): Promise<string[]> {
  const out = await rawGit(['branch', '--list', pattern ?? '*', '--format=%(refname:short)']);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function commitsAheadOf(branchA: string, branchB: string): Promise<string[]> {
  const out = await rawGit(['log', `${branchB}..${branchA}`, '--format=%H']);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function isFastForward(localSha: string, remoteSha: string): Promise<boolean> {
  if (/^0+$/.test(remoteSha)) return true;
  try {
    await rawGit(['merge-base', '--is-ancestor', remoteSha, localSha]);
    return true;
  } catch {
    return false;
  }
}

export async function rawGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (d) => stdout.push(Buffer.from(d)));
    child.stderr.on('data', (d) => stderr.push(Buffer.from(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8');
      if (code === 0) {
        resolve(out);
      } else {
        const err = Buffer.concat(stderr).toString('utf8').trim();
        reject(new Error(`git ${args.join(' ')} failed (${code}): ${err}`));
      }
    });
  });
}
