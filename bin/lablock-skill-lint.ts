#!/usr/bin/env bun
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { Command } from 'commander';
import { fail, jsonOut } from './_util.ts';

interface SkillIssue {
  path: string;
  code: string;
  message: string;
}

const program = new Command()
  .option('--root <path>', 'repository root', process.cwd())
  .option('--model-visible-limit <n>', 'description limit for model-visible skills', '350')
  .option('--user-only-limit <n>', 'description limit for user-only skills', '600')
  .option('--json', 'json output');

program.parse(process.argv);
const opts = program.opts();

async function pathExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function main() {
  const root = opts.root as string;
  const modelVisibleLimit = Number(opts.modelVisibleLimit);
  const userOnlyLimit = Number(opts.userOnlyLimit);
  if (!Number.isFinite(modelVisibleLimit) || modelVisibleLimit <= 0) throw new Error('--model-visible-limit must be a positive number');
  if (!Number.isFinite(userOnlyLimit) || userOnlyLimit <= 0) throw new Error('--user-only-limit must be a positive number');

  const entries = await readdir(root, { withFileTypes: true });
  const skillDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('lab-'))
    .map((entry) => entry.name)
    .sort();

  const issues: SkillIssue[] = [];
  let checked = 0;

  for (const dir of skillDirs) {
    const skillPath = join(root, dir, 'SKILL.md');
    if (!(await pathExists(skillPath))) continue;
    checked += 1;
    const parsed = matter(await readFile(skillPath, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const userOnly = data['disable-model-invocation'];
    const limit = userOnly === true ? userOnlyLimit : modelVisibleLimit;

    if (data.name !== dir) {
      issues.push({ path: skillPath, code: 'name-mismatch', message: `frontmatter name must equal directory name (${dir})` });
    }
    if (!description) {
      issues.push({ path: skillPath, code: 'missing-description', message: 'frontmatter description is required' });
    }
    if (typeof userOnly !== 'boolean') {
      issues.push({ path: skillPath, code: 'missing-disable-model-invocation', message: 'disable-model-invocation must be true or false' });
    }
    if (description.length > limit) {
      issues.push({
        path: skillPath,
        code: 'description-too-long',
        message: `description is ${description.length} chars; limit is ${limit}`,
      });
    }
  }

  const payload = { status: issues.length ? 'failed' : 'ok', checked, issues };
  if (opts.json) jsonOut(payload);
  else if (issues.length) {
    for (const issue of issues) console.log(`${issue.path}: ${issue.code}: ${issue.message}`);
  } else {
    console.log(`Skill lint ok (${checked} skills checked).`);
  }
  process.exit(issues.length ? 1 : 0);
}

main().catch((error) => fail(error, 2));
