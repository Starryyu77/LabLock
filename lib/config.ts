import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import {
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG,
  GlobalConfigSchema,
  ProjectConfigSchema,
  type GlobalConfig,
  type ProjectConfig,
} from './types.ts';
import { PATHS } from './paths.ts';
import { ensureParent, pathExists } from './fs-util.ts';

const GLOBAL_CONFIG = join(homedir(), '.lablock', 'config.yaml');

function parseYamlObject(text: string, path: string): unknown {
  const data = yaml.load(text);
  if (data === null || typeof data !== 'object') throw new Error(`${path}: expected YAML object`);
  return data;
}

function dumpYaml(data: unknown): string {
  return yaml.dump(data, { lineWidth: 120, noRefs: true, sortKeys: false });
}

export async function readGlobalConfig(): Promise<GlobalConfig> {
  if (!(await pathExists(GLOBAL_CONFIG))) return DEFAULT_GLOBAL_CONFIG;
  return GlobalConfigSchema.parse(parseYamlObject(await readFile(GLOBAL_CONFIG, 'utf8'), GLOBAL_CONFIG));
}

export async function writeGlobalConfig(c: GlobalConfig): Promise<void> {
  await mkdir(dirname(GLOBAL_CONFIG), { recursive: true });
  await writeFile(GLOBAL_CONFIG, dumpYaml(GlobalConfigSchema.parse(c)));
}

export async function readProjectConfig(): Promise<ProjectConfig> {
  if (!(await pathExists(PATHS.CONFIG))) return DEFAULT_PROJECT_CONFIG;
  return ProjectConfigSchema.parse(parseYamlObject(await readFile(PATHS.CONFIG, 'utf8'), PATHS.CONFIG));
}

export async function writeProjectConfig(c: ProjectConfig): Promise<void> {
  await ensureParent(PATHS.CONFIG);
  await writeFile(PATHS.CONFIG, dumpYaml(ProjectConfigSchema.parse(c)));
}

function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPath(obj: any, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] == null || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[parts.at(-1)!] = value;
}

export async function getProjectConfigPath(path: string): Promise<unknown> {
  return getPath(await readProjectConfig(), path);
}

export async function setProjectConfigPath(path: string, value: unknown): Promise<void> {
  const config = await readProjectConfig();
  setPath(config, path, value);
  await writeProjectConfig(config);
}
