#!/usr/bin/env bun
import { Command } from 'commander';
import { collectDashboardData, openDashboardFile, writeDashboard } from '../lib/dashboard.ts';
import { PATHS } from '../lib/paths.ts';
import { fail, jsonOut } from './_util.ts';

const program = new Command()
  .name('lablock-dashboard')
  .description('Generate a static LabLock experiment dashboard')
  .option('--out <dir>', 'output directory', PATHS.DASHBOARD_DIR)
  .option('--json', 'print dashboard JSON instead of writing files')
  .option('--open', 'open the generated HTML dashboard in the default browser')
  .option('--no-html', 'write data.json without index.html');

program.parse(process.argv);
const opts = program.opts();

try {
  if (opts.json) {
    jsonOut(await collectDashboardData());
  } else {
    const result = await writeDashboard({ outDir: opts.out, html: opts.html });
    console.log(`Dashboard data written: ${result.dataPath}`);
    if (result.htmlPath) console.log(`Dashboard HTML written: ${result.htmlPath}`);
    if (opts.open) {
      if (!result.htmlPath) throw new Error('--open requires HTML output; remove --no-html.');
      console.log(`Dashboard opened: ${await openDashboardFile(result.htmlPath)}`);
    }
  }
} catch (error) {
  fail(error);
}
