import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildLintAiPrompt,
  buildGraphAiPrompt,
  buildDuplicatesAiPrompt,
  copyTextToClipboard,
} from '../../../../ui/src/insights/aiPrompts';
import type { InsightsLintFinding } from '../../../../ui/src/insights/lint';
import type { DuplicateGroup } from '../../../../ui/src/insights/duplicates';
import type { WorkspaceInsightsSnapshot } from '../../../../ui/src/insights/index';
import type { AnalyzedDocument } from '../../../../ui/src/insights/analyzeDocument';

describe('aiPrompts', () => {
  describe('buildLintAiPrompt', () => {
    it('returns clean message when no lint findings exist', () => {
      const prompt = buildLintAiPrompt([]);
      expect(prompt).toContain('No markdown lint failures detected');
    });

    it('groups by file and error type, listing all lines with lint failures', () => {
      const findings: InsightsLintFinding[] = [
        {
          id: '1',
          path: 'docs/b.md',
          ruleId: 'heading/duplicate',
          severity: 'warning',
          message: 'Duplicate heading text',
          line: 42,
        },
        {
          id: '2',
          path: 'docs/a.md',
          ruleId: 'format/trailing-whitespace',
          severity: 'info',
          message: 'Trailing whitespace',
          line: 10,
        },
        {
          id: '3',
          path: 'docs/b.md',
          ruleId: 'heading/duplicate',
          severity: 'warning',
          message: 'Duplicate heading text',
          line: 15,
        },
        {
          id: '4',
          path: 'docs/b.md',
          ruleId: 'table/malformed-delimiter',
          severity: 'error',
          message: 'Malformed table delimiter',
          line: 8,
        },
      ];

      const prompt = buildLintAiPrompt(findings);
      expect(prompt).toContain('### File: `docs/a.md`');
      expect(prompt).toContain('### File: `docs/b.md`');
      // In docs/b.md, line 15 and 42 are both under heading/duplicate
      expect(prompt).toContain('Line 15: Duplicate heading text');
      expect(prompt).toContain('Line 42: Duplicate heading text');
      expect(prompt).toContain('Line 8: Malformed table delimiter');
    });
  });

  describe('buildGraphAiPrompt', () => {
    it('returns clean message when no graph issues exist', () => {
      const snapshot: WorkspaceInsightsSnapshot = {
        documents: new Map(),
        outboundLinks: new Map(),
        backlinks: new Map(),
        brokenLinks: [],
        tags: new Map(),
        headings: new Map(),
        titles: new Map(),
        revision: 1,
      };

      const prompt = buildGraphAiPrompt(snapshot);
      expect(prompt).toContain('All links, references, and diagram syntax in the workspace graph resolve cleanly');
    });

    it('detects broken links, syntax errors, case mismatches, and orphan documents', () => {
      const docA: AnalyzedDocument = {
        path: 'docA.md',
        exactFingerprint: 'fa',
        terminology: [],
        sections: [],
        tags: [],
        headings: [],
        aliases: [],
        lint: [
          {
            id: 'l1',
            path: 'docA.md',
            ruleId: 'wiki/malformed',
            severity: 'error',
            message: 'Malformed wiki link',
            line: 12,
          },
        ],
        media: [],
      };

      const orphanDoc: AnalyzedDocument = {
        path: 'isolated.md',
        exactFingerprint: 'fi',
        terminology: [],
        sections: [],
        tags: [],
        headings: [],
        aliases: [],
        lint: [],
        media: [],
      };

      const snapshot: WorkspaceInsightsSnapshot = {
        documents: new Map([
          ['docA.md', docA],
          ['isolated.md', orphanDoc],
        ]),
        outboundLinks: new Map([
          ['docA.md', [{ sourcePath: 'docA.md', targetPath: 'other.md', kind: 'link', referenceKind: 'markdown', sourceStart: 0, sourceEnd: 10, caseMismatch: true }]],
        ]),
        backlinks: new Map([
          ['other.md', [{ sourcePath: 'docA.md', targetPath: 'other.md', kind: 'link', referenceKind: 'markdown', sourceStart: 0, sourceEnd: 10, caseMismatch: true }]],
        ]),
        brokenLinks: [
          {
            sourcePath: 'docA.md',
            target: 'missing.md',
            status: 'missing',
            referenceKind: 'markdown',
            sourceStart: 0,
            sourceEnd: 10,
            candidates: ['found.md'],
          },
        ],
        tags: new Map(),
        headings: new Map(),
        titles: new Map(),
        revision: 1,
      };

      const prompt = buildGraphAiPrompt(snapshot);
      expect(prompt).toContain('Broken Links & Unresolved References');
      expect(prompt).toContain('`missing.md`');
      expect(prompt).toContain('`found.md`');
      expect(prompt).toContain('Syntax Errors in Links & Graph Diagrams');
      expect(prompt).toContain('Malformed wiki link');
      expect(prompt).toContain('Path Casing Mismatches');
      expect(prompt).toContain('Orphan Documents Disconnected From Graph');
      expect(prompt).toContain('`isolated.md`');
    });
  });

  describe('buildDuplicatesAiPrompt', () => {
    it('returns clean message when no duplicates exist', () => {
      const prompt = buildDuplicatesAiPrompt([]);
      expect(prompt).toContain('No duplicate documents or repeated sections detected');
    });

    it('includes exact, section, and near duplicates with brainstorming instructions', () => {
      const groups: DuplicateGroup[] = [
        {
          key: 'exact:1',
          kind: 'exact',
          paths: ['fileA.md', 'fileB.md'],
          fingerprint: '1',
        },
        {
          key: 'near:2',
          kind: 'near',
          paths: ['guide1.md', 'guide2.md'],
          score: 0.94,
        },
        {
          key: 'section:3',
          kind: 'section',
          paths: ['api.md', 'overview.md'],
          fingerprint: '3',
        },
      ];

      const prompt = buildDuplicatesAiPrompt(groups);
      expect(prompt).toContain('Exact Duplicates (100% Identical Content)');
      expect(prompt).toContain('Section & Repeated Passage Duplicates');
      expect(prompt).toContain('Near Duplicates');
      expect(prompt).toContain('94% similarity');
      expect(prompt).toContain('Double-check and brainstorm');
    });
  });

  describe('copyTextToClipboard', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('writes to navigator.clipboard when available', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const success = await copyTextToClipboard('test prompt');
      expect(success).toBe(true);
      expect(writeText).toHaveBeenCalledWith('test prompt');
    });
  });
});
