import type { CommitTag, FileCategory, ScopeLock } from './types.ts';

export interface ClassifiedFile {
  path: string;
  category: FileCategory;
  lines_added: number;
  lines_removed: number;
  reasons: string[];
}

const CODE_RE = /\.(py|ts|tsx|js|jsx|cpp|cc|c|h|hpp|rs|go|java|scala|sh)$/;

function pathCategory(path: string): { category: FileCategory; reason: string } {
  if (path === 'formalism.md' || path.startsWith('derivations/')) return { category: 'formalism', reason: 'path-match:formalism' };
  if (path === 'claims.md') return { category: 'claim', reason: 'path-match:claims' };
  if (path.startsWith('decisions/')) return { category: 'decision', reason: 'path-match:decisions' };
  if (/^experiments\/exp-\d{3}-[^/]+\/results\.md$/.test(path)) return { category: 'exp-script', reason: 'results' };
  if (/^experiments\/exp-\d{3}-/.test(path)) return { category: 'exp-script', reason: 'path-match:experiments' };
  if (['MAP.md', 'INDEX.md', 'experiments/matrix.md'].includes(path)) return { category: 'index', reason: 'path-match:index' };
  if (/(^|\/)config\.yaml$|\.cfg$|\.toml$/.test(path)) return { category: 'config', reason: 'path-match:config' };
  if (CODE_RE.test(path)) return { category: 'utility', reason: 'path-match:code' };
  if (path.endsWith('.md')) return { category: 'doc', reason: 'path-match:markdown' };
  return { category: 'other', reason: 'path-match:other' };
}

export function classifyDiff(diffText: string): ClassifiedFile[] {
  const files: ClassifiedFile[] = [];
  let current: ClassifiedFile | null = null;
  let addedContent = '';

  const flush = () => {
    if (!current) return;
    if (/(\bprint\s*\(|pdb\.set_trace\s*\(|console\.log\s*\()/.test(addedContent)) {
      current.reasons.push('debug-noise-pattern');
      if (current.category === 'utility') current.category = 'debug-noise';
    }
    files.push(current);
    current = null;
    addedContent = '';
  };

  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flush();
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const path = match?.[2] ?? line.replace(/^diff --git /, '').trim();
      const base = pathCategory(path);
      current = {
        path,
        category: base.category,
        lines_added: 0,
        lines_removed: 0,
        reasons: [base.reason],
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) {
      current.lines_added += 1;
      addedContent += `${line.slice(1)}\n`;
    } else if (line.startsWith('-')) {
      current.lines_removed += 1;
    }
  }
  flush();
  return files;
}

export function suggestTag(classified: ClassifiedFile[], lock: ScopeLock | null): CommitTag {
  if (classified.length === 0) return 'CODE';
  if (classified.every((f) => f.category === 'formalism')) return 'FORMALISM';
  if (classified.some((f) => f.reasons.includes('results') || f.path.endsWith('/results.md'))) return 'RESULT';
  if (classified.every((f) => f.category === 'debug-noise')) return 'NOTE';
  if (lock) {
    const invariantFiles = new Set(lock.locked_invariants.files?.map((f) => f.path) ?? []);
    if (classified.some((f) => invariantFiles.has(f.path))) return 'SCOPE-DRIFT';
    if (classified.some((f) => f.reasons.some((r) => r.startsWith('scope-drift-config:')))) return 'SCOPE-DRIFT';
  }
  if (classified.every((f) => f.category === 'claim')) return 'CODE';
  return 'CODE';
}
