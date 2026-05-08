import { describe, expect, test } from 'bun:test';
import { formatEntry, parseLine } from '../../lib/changes.ts';

describe('changes', () => {
  test('format and parse round trip', () => {
    const entry = {
      timestamp: '2026-05-01T10:23:11Z',
      tag: 'INFRA-FIX' as const,
      change_id: 'chg-A12F3B9C',
      message: 'grad clipping added',
    };
    expect(parseLine(formatEntry(entry))).toEqual(entry);
  });

  test('unicode message parses', () => {
    const parsed = parseLine('2026-05-01T10:23:11Z [NOTE] change:chg-A12F3B9C 中文 message');
    expect(parsed?.message).toBe('中文 message');
  });
});
