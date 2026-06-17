import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');

async function run(args: string[], cwd: string, expectCode = 0) {
  const proc = Bun.spawn(args, {
    cwd,
    env: { ...process.env, LABLOCK_HOME: repoRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== expectCode) throw new Error(`${args.join(' ')} exited ${code}\n${stdout}\n${stderr}`);
  return { stdout, stderr, code };
}

describe('skill lint', () => {
  test('all LabLock skills satisfy frontmatter and description limits', async () => {
    const result = await run([process.execPath, join(repoRoot, 'bin/lablock-skill-lint.ts'), '--json'], repoRoot);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('ok');
    expect(payload.checked).toBeGreaterThanOrEqual(24);
    expect(payload.issues).toEqual([]);
  });

  test('implementation handoff mode has a coding-agent template', async () => {
    const skill = await readFile(join(repoRoot, 'lab-handoff/SKILL.md'), 'utf8');
    const template = await readFile(join(repoRoot, 'templates/handoff-implementation.md.tmpl'), 'utf8');
    expect(skill).toContain('implementation');
    expect(skill).toContain('coding agent');
    expect(template).toContain('## Research objective to preserve');
    expect(template).toContain('Do not add broad defensive gates');
  });

  test('lab-taste is advisory and writes a research taste note', async () => {
    const skill = await readFile(join(repoRoot, 'lab-taste/SKILL.md'), 'utf8');
    expect(skill).toContain('科研品味');
    expect(skill).toContain('Hamming lens');
    expect(skill).toContain('Graham lens');
    expect(skill).toContain('Bourdieu lens');
    expect(skill).toContain('reviews/<date>-<topic>-taste.md');
    expect(skill).toContain('not a gate');
  });

  test('lab-research-debug combines external research and local diagnosis', async () => {
    const skill = await readFile(join(repoRoot, 'lab-research-debug/SKILL.md'), 'utf8');
    const template = await readFile(join(repoRoot, 'templates/research-debug.md.tmpl'), 'utf8');
    expect(skill).toContain('open-source communities');
    expect(skill).toContain('External Research');
    expect(skill).toContain('Local Code Analysis');
    expect(skill).toContain('Confirmed local bug');
    expect(skill).toContain('not a blocking verdict');
    expect(template).toContain('## External Research Plan');
    expect(template).toContain('## Diagnostic Conclusion');
  });

  test('vNext skeleton skills and templates are present', async () => {
    const advice = await readFile(join(repoRoot, 'lab-advice/SKILL.md'), 'utf8');
    const planExp = await readFile(join(repoRoot, 'lab-plan-exp/SKILL.md'), 'utf8');
    const roadmap = await readFile(join(repoRoot, 'lab-roadmap/SKILL.md'), 'utf8');
    const monitor = await readFile(join(repoRoot, 'lab-monitor/SKILL.md'), 'utf8');
    const deguard = await readFile(join(repoRoot, 'lab-deguard/SKILL.md'), 'utf8');
    const handoff = await readFile(join(repoRoot, 'lab-handoff/SKILL.md'), 'utf8');

    expect(advice).toContain('vNext Stage Routing');
    expect(planExp).toContain('Roadmap');
    expect(roadmap).toContain('Step 名称');
    expect(monitor).toContain('实验总目标');
    expect(deguard).toContain('defensive bloat');
    expect(handoff).toContain('Mode: expert-consultation');
    expect(handoff).toContain('Mode: reply');

    for (const template of [
      'objective.md.tmpl',
      'progress.md.tmpl',
      'roadmap.md.tmpl',
      'monitor.md.tmpl',
      'deguard.md.tmpl',
      'handoff-expert-consultation.md.tmpl',
      'handoff-reply-summary.md.tmpl',
    ]) {
      const body = await readFile(join(repoRoot, 'templates', template), 'utf8');
      expect(body.length).toBeGreaterThan(100);
    }
  });
});
