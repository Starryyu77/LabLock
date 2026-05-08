import { describe, expect, test } from 'bun:test';
import { ExperimentFrontmatterSchema, ScopeLockSchema } from '../../lib/types.ts';

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
});
