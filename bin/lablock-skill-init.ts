#!/usr/bin/env bun
import { Command } from 'commander';
import { mkdir } from 'node:fs/promises';
import { renderToFile } from '../lib/templates.ts';
import { fail } from './_util.ts';

const program = new Command()
  .argument('<skill-name>')
  .option('--description <text>', 'skill description', 'LabLock extension skill.')
  .option('--user-only', 'disable model invocation');
program.parse(process.argv);
const name = program.args[0];
const opts = program.opts();

try {
  await mkdir(name, { recursive: true });
  await renderToFile('SKILL.md.tmpl', `${name}/SKILL.md`, {
    name,
    description: opts.description,
    disable_model_invocation: opts.userOnly ? 'true' : 'false',
  });
  console.log(`${name}/SKILL.md`);
} catch (error) {
  fail(error);
}
