#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';

async function readTrim(path: string): Promise<string | null> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch {
    return null;
  }
}

const input = JSON.parse(await Bun.stdin.text()) as {
  tool: 'Edit' | 'Write' | 'MultiEdit' | 'apply_patch';
  parameters: { file_path?: string; path?: string; [k: string]: any };
};

const targetPath = input.parameters.file_path ?? input.parameters.path ?? '';
const freezeStatus = await readTrim('.lablock/state/freeze-status');
const currentExp = await readTrim('.lablock/state/current-exp');

if (freezeStatus === 'paper' && targetPath.startsWith('experiments/')) {
  console.log(JSON.stringify({
    permissionDecision: 'deny',
    reason: 'Paper write-lock active. Cannot modify experiments/ during paper writing.',
  }));
  process.exit(0);
}

if (currentExp) {
  const m = targetPath.match(/^experiments\/(exp-\d{3})-/);
  if (m && m[1] !== currentExp) {
    console.log(JSON.stringify({
      permissionDecision: 'deny',
      reason: `Currently focused on ${currentExp}. Cannot modify ${m[1]} files.`,
    }));
    process.exit(0);
  }
}

if (targetPath === '.lablock/config.yaml' || targetPath === 'formalism.md') {
  console.log(JSON.stringify({
    permissionDecision: 'allow',
    reason: `Editing ${targetPath} is protected. Confirm the change is intentional.`,
  }));
  process.exit(0);
}

console.log(JSON.stringify({ permissionDecision: 'allow' }));
