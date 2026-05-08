import { Command } from 'commander';

export function jsonOut(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function fail(error: unknown, code = 1): never {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

export function boolOpt(cmd: Command, name: string): boolean {
  return Boolean(cmd.opts()[name]);
}

export function parseScalar(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
