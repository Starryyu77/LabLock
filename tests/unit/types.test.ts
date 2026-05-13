import { describe, expect, test } from 'bun:test';
import {
  ExperimentFrontmatterSchema,
  MatrixRegistrySchema,
  NamingConfigSchema,
  ScopeLockSchema,
  VariableRegistrySchema,
} from '../../lib/types.ts';

describe('types', () => {
  test('valid experiment frontmatter passes', () => {
    expect(ExperimentFrontmatterSchema.parse({
      id: 'exp-007',
      parent: null,
      status: 'planned',
      created: '2026-05-08',
      hypothesis: 'A specific hypothesis.',
    }).id).toBe('exp-007');
  });

  test('invalid experiment ids fail', () => {
    for (const id of ['exp-7', 'experiment-007', 'exp-007a']) {
      expect(() => ExperimentFrontmatterSchema.parse({
        id,
        parent: null,
        status: 'planned',
        created: '2026-05-08',
        hypothesis: 'x',
      })).toThrow();
    }
  });

  test('scope lock rejects empty invariants', () => {
    expect(() => ScopeLockSchema.parse({
      exp_id: 'exp-001',
      shortname: 'baseline',
      hypothesis: 'x',
      parent: null,
      created: '2026-05-08',
      status: 'active',
      locked_invariants: {},
      controlled_changes: { modified: ['lr'] },
      kill_criteria: ['bad'],
      success_criteria: ['good'],
    })).toThrow();
  });

  test('scope lock rejects empty criteria', () => {
    expect(() => ScopeLockSchema.parse({
      exp_id: 'exp-001',
      shortname: 'baseline',
      hypothesis: 'x',
      parent: null,
      created: '2026-05-08',
      status: 'active',
      locked_invariants: { config: { lr: 0.1 } },
      controlled_changes: { modified: ['lr'] },
      kill_criteria: [],
      success_criteria: ['good'],
    })).toThrow();
  });

  test('naming config and registries validate canonical ids', () => {
    expect(NamingConfigSchema.parse({
      version: 1,
      profile: 'paper-aligned',
      canonical_variable_style: 'snake_case',
      experiment_shortname_pattern: 'exp-NNN-<axis>-<variant>',
      matrix_slug_pattern: '<topic>-<axis>-ablation',
      require_variable_registry: true,
      require_matrix_registry: true,
      paper_label_required: false,
      reserved_suffixes: ['baseline'],
    }).profile).toBe('paper-aligned');

    expect(VariableRegistrySchema.parse({
      version: 1,
      variables: [{
        var_id: 'var-001',
        canonical_name: 'qkv_projection_type',
        paper_label: 'QKV projection variant',
        code_keys: ['model.attn.qkv_projector'],
        type: 'categorical',
        role: 'independent_variable',
        allowed_values: ['baseline', 'elm_qkv'],
      }],
    }).variables[0].var_id).toBe('var-001');

    expect(MatrixRegistrySchema.parse({
      version: 1,
      matrices: [{
        matrix_id: 'mat-001',
        slug: 'qkv-projection-ablation',
        research_question: 'Does the QKV projection form explain the observed gain?',
        primary_variable: 'var-001',
        controlled_axes: ['dataset', 'model_size'],
        experiments: ['exp-001'],
        paper_target: 'Table 2',
      }],
    }).matrices[0].matrix_id).toBe('mat-001');
  });
});
