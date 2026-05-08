import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import Handlebars from 'handlebars';
import { pathExists } from './fs-util.ts';

const installRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

Handlebars.registerHelper('date', () => new Date().toISOString().slice(0, 10));
Handlebars.registerHelper('datetime', () => new Date().toISOString());
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('join', (arr: unknown[], sep: string) => Array.isArray(arr) ? arr.join(sep) : '');

export async function renderTemplate(templateName: string, context: Record<string, any>): Promise<string> {
  const templatePath = join(installRoot, 'templates', templateName);
  const template = Handlebars.compile(await readFile(templatePath, 'utf8'), { noEscape: true });
  return template(context);
}

export async function renderToFile(
  templateName: string,
  destPath: string,
  context: Record<string, any>,
  options?: { overwrite?: boolean },
): Promise<void> {
  if (!options?.overwrite && await pathExists(destPath)) {
    throw new Error(`${destPath}: destination exists`);
  }
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, await renderTemplate(templateName, context));
}
