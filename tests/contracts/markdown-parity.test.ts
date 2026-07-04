import { describe, expect, test } from 'vitest';
import { parse as parseUi } from '../../ui/src/markdown/parser';
import { HtmlRenderer as UiRenderer } from '../../ui/src/markdown/renderer';
import { parse as parseVsCode } from '../../vscode/src/markdown/parser';
import { HtmlRenderer as VsCodeRenderer } from '../../vscode/src/markdown/renderer';
import { markdownCorpus } from '../fixtures/markdown-corpus';

import {
  normalizeForSearch as normalizeUi,
  prepareHaystack as prepareUi,
  unicodeIndexOf as indexOfUi,
  unicodeFindAll as findAllUi,
} from '../../ui/src/utils/unicodeSearch';

import {
  normalizeForSearch as normalizeVscode,
  prepareHaystack as prepareVscode,
  unicodeIndexOf as indexOfVscode,
  unicodeFindAll as findAllVscode,
} from '../../vscode/src/core/unicodeSearch';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const desktopUnicode = require('../../electron/search/unicode-search.js');

function sanitizeTocEntry(entry: { level: number; text: string; id: string }) {
  return { level: entry.level, text: entry.text, id: entry.id };
}

function stripShortIds(html: string): string {
  return html.replace(/tbl_[a-z0-9]{2,8}/g, 'tbl_XXXXXX')
    .replace(/id_[a-z0-9]{2,8}/g, 'id_XXXXXX')
    .replace(/html_[a-z0-9]{2,8}/g, 'html_XXXXXX');
}

describe('markdown parity', () => {
  describe('parser parity', () => {
    for (const fixture of markdownCorpus) {
      test(`${fixture.name}: tokens and frontmatter match`, () => {
        const uiResult = parseUi(fixture.markdown, fixture.isMdx);
        const vscodeResult = parseVsCode(fixture.markdown, fixture.isMdx);

        const uiTokens = uiResult.tokens.map((t: any) => {
          const { ...rest } = t;
          return rest;
        });
        const vscodeTokens = vscodeResult.tokens.map((t: any) => {
          const { ...rest } = t;
          return rest;
        });

        expect(uiTokens).toEqual(vscodeTokens);
        expect(uiResult.frontmatter).toEqual(vscodeResult.frontmatter);
      });
    }
  });

  describe('renderer parity', () => {
    for (const fixture of markdownCorpus) {
      test(`${fixture.name}: html and toc match`, () => {
        const uiParsed = parseUi(fixture.markdown, fixture.isMdx);
        const vscodeParsed = parseVsCode(fixture.markdown, fixture.isMdx);

        const uiRenderer = new UiRenderer({ theme: 'dark', isMdx: fixture.isMdx });
        const vscodeRenderer = new VsCodeRenderer({ theme: 'dark', isMdx: fixture.isMdx });

        const uiRendered = uiRenderer.render(uiParsed.tokens);
        const vscodeRendered = vscodeRenderer.render(vscodeParsed.tokens);

        expect(stripShortIds(uiRendered.html)).toEqual(stripShortIds(vscodeRendered.html));
        expect(uiRendered.toc.map(sanitizeTocEntry)).toEqual(vscodeRendered.toc.map(sanitizeTocEntry));
      });
    }
  });

  describe('expected tokens', () => {
    const fixturesWithTokens = markdownCorpus.filter(f => f.expectedTokens);
    for (const fixture of fixturesWithTokens) {
      test(`${fixture.name}: parser output matches expectedTokens`, () => {
        const result = parseUi(fixture.markdown, fixture.isMdx);
        for (let i = 0; i < fixture.expectedTokens!.length; i++) {
          const expected = fixture.expectedTokens![i];
          const actual = result.tokens[i];
          expect(actual).toMatchObject(expected);
        }
      });
    }
  });

  describe('expected html invariants', () => {
    const fixturesWithInvariants = markdownCorpus.filter(f => f.expectedHtmlInvariants);
    for (const fixture of fixturesWithInvariants) {
      test(`${fixture.name}: html contains expected invariants`, () => {
        const parsed = parseUi(fixture.markdown, fixture.isMdx);
        const renderer = new UiRenderer({ theme: 'dark', isMdx: fixture.isMdx });
        const rendered = renderer.render(parsed.tokens);
        for (const invariant of fixture.expectedHtmlInvariants!) {
          expect(rendered.html).toContain(invariant);
        }
      });
    }
  });

  describe('unicode search parity', () => {
    const searchCases: Array<{
      name: string;
      text: string;
      needle: string;
    }> = [
      { name: 'turkish-I', text: '\u0130stanbul', needle: 'istanbul' },
      { name: 'german-ss', text: 'Stra\u00DFe', needle: 'strasse' },
      { name: 'nfc-e', text: 'caf\u00E9', needle: 'caf\u00E9' },
      { name: 'nfd-e', text: 'cafe\u0301', needle: 'cafe\u0301' },
      { name: 'nfc-vs-nfd', text: 'caf\u00E9', needle: 'cafe\u0301' },
      { name: 'plain-ascii', text: 'hello world', needle: 'world' },
      { name: 'empty-needle', text: 'hello', needle: '' },
      { name: 'empty-text', text: '', needle: 'test' },
      { name: 'both-empty', text: '', needle: '' },
      { name: 'not-found', text: 'abc', needle: 'xyz' },
    ];

    describe('normalizeForSearch', () => {
      for (const { name, text, needle } of searchCases) {
        if (!needle) continue;
        test(`${name}: all three implementations agree`, () => {
          const uiNorm = normalizeUi(needle);
          const vscodeNorm = normalizeVscode(needle);
          const desktopNorm = desktopUnicode.normalizeForSearch(needle);
          expect(uiNorm).toBe(vscodeNorm);
          expect(uiNorm).toBe(desktopNorm);

          const uiTextNorm = normalizeUi(text);
          const vscodeTextNorm = normalizeVscode(text);
          const desktopTextNorm = desktopUnicode.normalizeForSearch(text);
          expect(uiTextNorm).toBe(vscodeTextNorm);
          expect(uiTextNorm).toBe(desktopTextNorm);
        });
      }
    });

    describe('unicodeIndexOf', () => {
      for (const { name, text, needle } of searchCases) {
        test(`${name}: all three implementations agree`, () => {
          const uiResult = indexOfUi(text, needle);
          const vscodeResult = indexOfVscode(text, needle);

          expect(uiResult).toEqual(vscodeResult);

          if (needle && text) {
            const desktopResult1 = desktopUnicode.buildNormMap
              ? (() => {
                  const normNeedle = desktopUnicode.normalizeForSearch(needle);
                  if (!normNeedle) return null;
                  const map = desktopUnicode.buildNormMap(text);
                  const normIdx = map.normalizedText.indexOf(normNeedle);
                  if (normIdx === -1) return null;
                  const { origIdx, origLen } = map.mapSpan(normIdx, normNeedle.length);
                  return { index: origIdx, matchLength: origLen };
                })()
              : null;

            const { normalizedText, toOriginal } = desktopUnicode.buildNormMap(text);
            const normNeedle = desktopUnicode.normalizeForSearch(needle);
            if (!normNeedle) {
              expect(uiResult).toBeNull();
              return;
            }
            const normIdx = normalizedText.indexOf(normNeedle);
            let desktopResult: { index: number; matchLength: number } | null;
            if (normIdx === -1) {
              desktopResult = null;
            } else {
              const { origIdx, origLen } = (() => {
                const map = desktopUnicode.buildNormMap(text);
                return map.mapSpan(normIdx, normNeedle.length);
              })();
              desktopResult = { index: origIdx, matchLength: origLen };
            }
            expect(uiResult).toEqual(desktopResult);
          } else {
            expect(uiResult).toBeNull();
          }
        });
      }
    });

    describe('unicodeFindAll', () => {
      const findAllCases: Array<{ name: string; text: string; needle: string }> = [
        { name: 'multiple-ascii', text: 'abc abc abc', needle: 'abc' },
        { name: 'multiple-turkish', text: '\u0130stanbul \u0130zmir', needle: 'i' },
        { name: 'no-match', text: 'hello', needle: 'xyz' },
      ];

      for (const { name, text, needle } of findAllCases) {
        test(`${name}: ui and vscode agree`, () => {
          const uiResult = findAllUi(text, needle);
          const vscodeResult = findAllVscode(text, needle);
          expect(uiResult).toEqual(vscodeResult);
        });
      }
    });

    describe('prepareHaystack', () => {
      test('all three implementations produce same normalizedText', () => {
        const text = '\u0130stanbul caf\u00E9 Stra\u00DFe';
        const uiHaystack = prepareUi(text);
        const vscodeHaystack = prepareVscode(text);
        const desktopMap = desktopUnicode.buildNormMap(text);

        expect(uiHaystack.normalizedText).toBe(vscodeHaystack.normalizedText);
        expect(uiHaystack.normalizedText).toBe(desktopMap.normalizedText);
      });

      test('indexOf returns same results across implementations', () => {
        const text = 'Stra\u00DFe in \u0130stanbul';
        const needle = 'strasse';

        const uiHaystack = prepareUi(text);
        const vscodeHaystack = prepareVscode(text);

        const uiResult = uiHaystack.indexOf(needle);
        const vscodeResult = vscodeHaystack.indexOf(needle);

        expect(uiResult).toEqual(vscodeResult);

        const desktopMap = desktopUnicode.buildNormMap(text);
        const normNeedle = desktopUnicode.normalizeForSearch(needle);
        const normIdx = desktopMap.normalizedText.indexOf(normNeedle);
        if (normIdx === -1) {
          expect(uiResult).toBeNull();
        } else {
          const { origIdx, origLen } = desktopMap.mapSpan(normIdx, normNeedle.length);
          expect(uiResult).toEqual({ index: origIdx, matchLength: origLen });
        }
      });
    });
  });
});
