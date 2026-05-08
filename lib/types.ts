import { z } from 'zod';

export const ExpIdSchema = z.string().regex(/^exp-\d{3}$/);
export const ClaimIdSchema = z.string().regex(/^C\d+$/);
export const ProofIdSchema = z.string().regex(/^proof-\d+$/);
export const ChangeIdSchema = z.string().regex(/^chg-[0-9A-Z]{8}$/);
export const FormalismVersionSchema = z.string().regex(/^v\d+$/);
export const DateLikeStringSchema = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
);

export const ExperimentFrontmatterSchema = z.object({
  id: ExpIdSchema,
  parent: ExpIdSchema.nullable(),
  status: z.enum(['planned', 'running', 'done', 'killed', 'superseded']),
  created: DateLikeStringSchema,
  hypothesis: z.string().min(1).max(280),
  related_claims: z.array(ClaimIdSchema).optional(),
  formalism_version: FormalismVersionSchema.optional(),
  tags: z.array(z.string()).optional(),
  forked_from: ExpIdSchema.nullable().optional(),
  fork_reason: z.enum(['scope-drift', 'parallel-exploration', 'manual']).nullable().optional(),
  drift_commit: z.string().regex(/^[a-f0-9]{7,40}$/).nullable().optional(),
  kill_criteria_met: z.boolean().nullable().optional(),
  finalized_at: z.string().nullable().optional(),
});
export type ExperimentFrontmatter = z.infer<typeof ExperimentFrontmatterSchema>;

export const ClaimSchema = z.object({
  id: ClaimIdSchema,
  statement: z.string(),
  strength: z.enum(['hypothesis', 'empirical', 'derived', 'assumed']),
  evidence: z.array(z.union([ExpIdSchema, ProofIdSchema])),
  claimed_in_paper: z.string().nullable().optional(),
  confidence: z.enum(['low', 'medium', 'high']).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const DerivationFrontmatterSchema = z.object({
  id: ProofIdSchema,
  status: z.enum(['draft', 'complete', 'verified']),
  related_claims: z.array(ClaimIdSchema),
  tools_used: z.array(z.string()).optional(),
});
export type DerivationFrontmatter = z.infer<typeof DerivationFrontmatterSchema>;

export const DecisionFrontmatterSchema = z.object({
  type: z.enum(['scope-update', 'formalism-bump', 'method-pivot', 'override', 'other']),
  created: DateLikeStringSchema,
  exp_id: ExpIdSchema.nullable().optional(),
  change_id: ChangeIdSchema.nullable().optional(),
  related_decisions: z.array(z.string()).optional(),
}).passthrough();
export type DecisionFrontmatter = z.infer<typeof DecisionFrontmatterSchema>;

export const ProbeSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  requires: z.array(z.enum(['cpu', 'gpu', 'data', 'network'])),
  timeout_sec: z.number().int().positive().default(300),
  run_on: z.array(z.enum(['local', 'ci-exp', 'ci-main', 'manual'])),
  reason: z.string().min(1),
});
export type Probe = z.infer<typeof ProbeSchema>;

export const FileInvariantSchema = z.object({
  path: z.string().min(1),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  reason: z.string().min(1),
});
export type FileInvariant = z.infer<typeof FileInvariantSchema>;

const ControlledChangesSchema = z.object({
  added: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
  modified: z.array(z.string()).optional(),
}).refine((v) => Boolean(v.added?.length || v.removed?.length || v.modified?.length), {
  message: 'At least one controlled change must be listed',
});

export const ScopeLockSchema = z.object({
  exp_id: ExpIdSchema,
  shortname: z.string().regex(/^[a-z][a-z0-9-]*$/),
  hypothesis: z.string().min(1).max(280),
  parent: ExpIdSchema.nullable(),
  created: DateLikeStringSchema,
  status: z.enum(['active', 'superseded', 'finalized']),
  locked_invariants: z.object({
    config: z.record(z.any()).optional(),
    files: z.array(FileInvariantSchema).optional(),
    probes: z.array(ProbeSchema).optional(),
  }).refine((v) => {
    const configNonEmpty = Boolean(v.config && Object.keys(v.config).length > 0);
    return Boolean(configNonEmpty || v.files?.length || v.probes?.length);
  }, { message: 'At least one invariant layer must be non-empty' }),
  controlled_changes: ControlledChangesSchema,
  kill_criteria: z.array(z.string()).min(1),
  success_criteria: z.array(z.string()).min(1),
});
export type ScopeLock = z.infer<typeof ScopeLockSchema>;

export const CommitTagSchema = z.enum([
  'INFRA-FIX',
  'SCOPE-DRIFT',
  'CODE',
  'RESULT',
  'NOTE',
  'FORMALISM',
  'PAPER',
  'MAIN',
]);
export type CommitTag = z.infer<typeof CommitTagSchema>;

export const FileCategorySchema = z.enum([
  'formalism',
  'claim',
  'decision',
  'utility',
  'exp-script',
  'debug-noise',
  'index',
  'config',
  'doc',
  'other',
]);
export type FileCategory = z.infer<typeof FileCategorySchema>;

export const CommitMetaSchema = z.object({
  schema_version: z.literal(1),
  exp_id: ExpIdSchema.nullable(),
  change_id: ChangeIdSchema,
  tag: CommitTagSchema,
  classified_files: z.array(z.object({
    path: z.string(),
    category: FileCategorySchema,
    lines_added: z.number().int().nonnegative(),
    lines_removed: z.number().int().nonnegative(),
  })),
  drift_layers: z.object({
    config: z.array(z.object({
      key: z.string(),
      expected: z.any(),
      actual: z.any(),
    })),
    files: z.array(z.object({
      path: z.string(),
      expected_hash: z.string(),
      actual_hash: z.string(),
    })),
  }),
  override_decision: ChangeIdSchema.nullable(),
  override_reason: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type CommitMeta = z.infer<typeof CommitMetaSchema>;

export const GlobalConfigSchema = z.object({
  version: z.literal(1),
  default_host: z.enum(['claude', 'codex', 'both']),
  auto_upgrade: z.boolean(),
  analytics: z.enum(['off', 'local-only']),
  editor: z.string(),
  gh_cli: z.string(),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const ProjectConfigSchema = z.object({
  version: z.literal(1),
  ci: z.object({
    mode: z.enum(['warn-only', 'enforce']),
    enforce_branches: z.array(z.string()),
    run_probes_on: z.array(z.string()),
  }),
  git: z.object({
    protected_branches: z.array(z.string()),
    protected_tags: z.array(z.string()),
    commit_message_format: z.string(),
    lfs_threshold_mb: z.number().positive(),
    archive_after_days: z.number().positive(),
  }),
  experiments: z.object({
    id_format: z.string(),
    next_id_strategy: z.enum(['max-plus-one']),
    status_values: z.array(z.string()),
  }),
  modules: z.record(z.boolean()),
  drift: z.object({
    layers: z.object({
      config: z.enum(['enabled', 'disabled']),
      files: z.enum(['enabled', 'disabled']),
      probes: z.enum(['local', 'ci-only', 'both', 'disabled']),
    }),
    override_decision_dir: z.string(),
  }),
  paper: z.object({
    default_venue: z.string(),
    claim_strength_levels: z.array(z.string()),
  }),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export interface ChangeIndexEntry {
  change_id: string;
  commit: string;
  exp: string | null;
  tag: string;
  files_changed: number;
  time: string;
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  version: 1,
  ci: {
    mode: 'warn-only',
    enforce_branches: [],
    run_probes_on: ['ci-main'],
  },
  git: {
    protected_branches: ['main', 'paper/**'],
    protected_tags: ['formalism-v*', 'claim-frozen-*', 'exp-*-final'],
    commit_message_format: '[%scope%][%tag%] %message%',
    lfs_threshold_mb: 50,
    archive_after_days: 30,
  },
  experiments: {
    id_format: 'exp-%03d',
    next_id_strategy: 'max-plus-one',
    status_values: ['planned', 'running', 'done', 'killed', 'superseded'],
  },
  modules: {
    gpu: true,
    data: true,
    agents: false,
    vision: false,
    lit: true,
  },
  drift: {
    layers: {
      config: 'enabled',
      files: 'enabled',
      probes: 'ci-only',
    },
    override_decision_dir: 'decisions/',
  },
  paper: {
    default_venue: '',
    claim_strength_levels: ['hypothesis', 'empirical', 'derived', 'assumed'],
  },
};

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: 1,
  default_host: 'both',
  auto_upgrade: false,
  analytics: 'off',
  editor: process.env.EDITOR || 'vim',
  gh_cli: 'auto',
};
