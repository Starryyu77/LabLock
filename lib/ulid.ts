import { ulid } from 'ulid';
import { ChangeIdSchema } from './types.ts';

export function newChangeId(): string {
  return `chg-${ulid().slice(-8)}`;
}

export function isValidChangeId(s: string): boolean {
  return ChangeIdSchema.safeParse(s).success;
}
