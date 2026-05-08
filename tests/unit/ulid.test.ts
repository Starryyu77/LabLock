import { describe, expect, test } from 'bun:test';
import { isValidChangeId, newChangeId } from '../../lib/ulid.ts';

describe('ulid', () => {
  test('generates valid change id', () => {
    expect(isValidChangeId(newChangeId())).toBe(true);
  });
});
