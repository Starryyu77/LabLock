export const PATHS = {
  PROJECT_MD: 'PROJECT.md',
  FORMALISM_MD: 'formalism.md',
  CLAIMS_MD: 'claims.md',
  INDEX_MD: 'INDEX.md',
  MAP_MD: 'MAP.md',
  CLAUDE_MD: 'CLAUDE.md',
  AGENTS_MD: 'AGENTS.md',

  LABLOCK_DIR: '.lablock',
  CONFIG: '.lablock/config.yaml',
  LOCKS_DIR: '.lablock/locks',
  CHANGES_DIR: '.lablock/changes',
  NAMING: '.lablock/naming.yaml',
  VARIABLES: '.lablock/variables.yaml',
  MATRICES: '.lablock/matrices.yaml',
  LEARNINGS: '.lablock/learnings.jsonl',
  STATE_DIR: '.lablock/state',
  STATE_CURRENT_EXP: '.lablock/state/current-exp',
  STATE_FREEZE: '.lablock/state/freeze-status',
  STATE_CHANGE_INDEX: '.lablock/state/change-index.jsonl',
  CACHE_DIR: '.lablock/cache',
  DASHBOARD_DIR: '.lablock/dashboard',
  DASHBOARD_DATA: '.lablock/dashboard/data.json',
  DASHBOARD_HTML: '.lablock/dashboard/index.html',

  GIT_DIR: '.git',
  GIT_HOOKS: '.git/hooks',
  GIT_COMMIT_META: '.git/lablock-commit-meta.json',

  EXPERIMENTS: 'experiments',
  EXPERIMENTS_MATRIX: 'experiments/matrix.md',
  DERIVATIONS: 'derivations',
  DECISIONS: 'decisions',
  REVIEWS: 'reviews',
  HANDOFFS: 'handoffs',
  HANDOFFS_OUTGOING: 'handoffs/outgoing',
  HANDOFFS_INCOMING: 'handoffs/incoming',
  LIT: 'lit',
  PAPER: 'paper',
  PAPER_OUTLINE: 'paper/outline.md',
  PAPER_CLAIMS_TO_EVIDENCE: 'paper/claims-to-evidence.md',
  PAPER_DRAFTS: 'paper/drafts',

  INFRA_GPU: 'infra/gpu',
  DATA: 'data',
  MODELS: 'models',
  EVALS: 'evals',
} as const;

export function lockPath(expId: string): string {
  return `${PATHS.LOCKS_DIR}/${expId}.scope.lock`;
}

export function changesPath(expId: string): string {
  return `${PATHS.CHANGES_DIR}/${expId}.changes.log`;
}

export function experimentDir(expId: string, shortname?: string): string {
  return shortname ? `${PATHS.EXPERIMENTS}/${expId}-${shortname}` : `${PATHS.EXPERIMENTS}/${expId}-*`;
}
