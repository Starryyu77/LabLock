#!/usr/bin/env bun
import { Command } from 'commander';
import { getProjectConfigPath, readProjectConfig, setProjectConfigPath } from '../lib/config.ts';
import { fail, parseScalar } from './_util.ts';

const program = new Command();
program.command('get <path>').action(async (path) => {
  try { console.log(JSON.stringify(await getProjectConfigPath(path), null, 2)); } catch (e) { fail(e); }
});
program.command('set <path> <value>').action(async (path, value) => {
  try { await setProjectConfigPath(path, parseScalar(value)); } catch (e) { fail(e); }
});
program.command('list').action(async () => {
  try { console.log(JSON.stringify(await readProjectConfig(), null, 2)); } catch (e) { fail(e); }
});
program.parse(process.argv);
