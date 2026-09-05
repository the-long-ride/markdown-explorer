import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string): string => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const design = readRepoFile('docs/workspace-insights-design.md');
const plan = readRepoFile('docs/superpowers/plans/2026-08-27-workspace-insights-wiki-links.md');

describe('Workspace Insights documentation sync', () => {
  it('describes the implemented architecture instead of an unstarted design', () => {
    expect(design).not.toContain('implementation has not started');
    expect(design).toContain('Implementation status');
    expect(design).toContain('PR #44');
  });

  it('documents authoritative cache validation and bounded source reads', () => {
    expect(design).toContain('provisional only');
    expect(design).toContain('rereads every eligible Markdown/MDX file');
    expect(design).toContain('8 concurrent source reads per platform bridge');
  });

  it('documents runtime polling and Wiki fragment navigation behavior', () => {
    expect(design).toContain('polls never overlap');
    expect(design).toContain('after the destination document renders');
    expect(design).toContain('collapsed parent sections are expanded');
  });

  it('documents every supported locale and translated presentation domain', () => {
    for (const locale of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
      expect(design).toContain(`\`${locale}\``);
    }
    for (const domain of ['Gallery categories', 'link statuses', 'relationship presets', 'lint rule names', 'severity labels']) {
      expect(design).toContain(domain);
    }
  });

  it('turns the original implementation plan into a historical completion record', () => {
    expect(plan).toContain('Historical completion record');
    expect(plan).toContain('docs/workspace-insights-design.md');
    expect(plan).not.toMatch(/^- \[ \]/m);
  });
});
