import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockHljs = {
  registerLanguage: vi.fn(),
  registerAliases: vi.fn(),
};

const mockMermaid = {
  registerExternalDiagrams: vi.fn().mockResolvedValue(undefined),
};

const chartRegister = vi.fn();
const mockChart = {
  register: chartRegister,
};

const languageMocks = {
  javascript: { default: vi.fn() },
  typescript: { default: vi.fn() },
  json: { default: vi.fn() },
  css: { default: vi.fn() },
  xml: { default: vi.fn() },
  markdown: { default: vi.fn() },
  bash: { default: vi.fn() },
  powershell: { default: vi.fn() },
  yaml: { default: vi.fn() },
  python: { default: vi.fn() },
};

vi.mock('highlight.js/styles/github-dark.css', () => ({}));
vi.mock('highlight.js/lib/core', () => ({ default: mockHljs }));
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: languageMocks.javascript.default }));
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: languageMocks.typescript.default }));
vi.mock('highlight.js/lib/languages/json', () => ({ default: languageMocks.json.default }));
vi.mock('highlight.js/lib/languages/css', () => ({ default: languageMocks.css.default }));
vi.mock('highlight.js/lib/languages/xml', () => ({ default: languageMocks.xml.default }));
vi.mock('highlight.js/lib/languages/markdown', () => ({ default: languageMocks.markdown.default }));
vi.mock('highlight.js/lib/languages/bash', () => ({ default: languageMocks.bash.default }));
vi.mock('highlight.js/lib/languages/powershell', () => ({ default: languageMocks.powershell.default }));
vi.mock('highlight.js/lib/languages/yaml', () => ({ default: languageMocks.yaml.default }));
vi.mock('highlight.js/lib/languages/python', () => ({ default: languageMocks.python.default }));

vi.mock('mermaid', () => ({ default: mockMermaid }));
vi.mock('@mermaid-js/mermaid-zenuml', () => ({ default: { id: 'zenuml' } }));

vi.mock('chart.js', () => ({
  Chart: mockChart,
  ArcElement: { id: 'ArcElement' },
  BarController: { id: 'BarController' },
  BarElement: { id: 'BarElement' },
  CategoryScale: { id: 'CategoryScale' },
  DoughnutController: { id: 'DoughnutController' },
  Filler: { id: 'Filler' },
  Legend: { id: 'Legend' },
  LineController: { id: 'LineController' },
  LineElement: { id: 'LineElement' },
  LinearScale: { id: 'LinearScale' },
  PieController: { id: 'PieController' },
  PointElement: { id: 'PointElement' },
  PolarAreaController: { id: 'PolarAreaController' },
  RadarController: { id: 'RadarController' },
  RadialLinearScale: { id: 'RadialLinearScale' },
  ScatterController: { id: 'ScatterController' },
  Tooltip: { id: 'Tooltip' },
}));

vi.mock('katex', () => ({ default: 'katex-module' }));
vi.mock('katex/dist/katex.min.css', () => ({}));

function loadModule() {
  return vi.importActual<typeof import('../../../../ui/src/lib/renderLibs')>(
    '../../../../ui/src/lib/renderLibs',
  );
}

describe('renderLibs', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHljs.registerLanguage.mockClear();
    mockHljs.registerAliases.mockClear();
    mockMermaid.registerExternalDiagrams.mockClear();
    mockMermaid.registerExternalDiagrams.mockResolvedValue(undefined);
    chartRegister.mockClear();
    if (typeof window !== 'undefined') {
      delete (window as any).hljs;
      delete (window as any).mermaid;
      delete (window as any).Chart;
    }
  });

  describe('getHighlightJs', () => {
    it('returns a promise', async () => {
      const { getHighlightJs } = await loadModule();
      const result = getHighlightJs();
      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves to the hljs instance', async () => {
      const { getHighlightJs } = await loadModule();
      const hljs = await getHighlightJs();
      expect(hljs).toBe(mockHljs);
    });

    it('sets window.hljs', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect((window as any).hljs).toBe(mockHljs);
    });

    it('registers all 10 languages', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerLanguage).toHaveBeenCalledTimes(10);
      const registeredNames = mockHljs.registerLanguage.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(registeredNames).toEqual([
        'javascript',
        'typescript',
        'json',
        'css',
        'xml',
        'markdown',
        'bash',
        'powershell',
        'yaml',
        'python',
      ]);
    });

    it('registers each language with its module default', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerLanguage).toHaveBeenCalledWith(
        'javascript',
        languageMocks.javascript.default,
      );
      expect(mockHljs.registerLanguage).toHaveBeenCalledWith(
        'typescript',
        languageMocks.typescript.default,
      );
      expect(mockHljs.registerLanguage).toHaveBeenCalledWith(
        'python',
        languageMocks.python.default,
      );
    });

    it('registers js/jsx/mjs/cjs aliases for javascript', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(
        ['js', 'jsx', 'mjs', 'cjs'],
        { languageName: 'javascript' },
      );
    });

    it('registers ts/tsx aliases for typescript', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(['ts', 'tsx'], {
        languageName: 'typescript',
      });
    });

    it('registers html/xhtml/svg aliases for xml', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(
        ['html', 'xhtml', 'svg'],
        { languageName: 'xml' },
      );
    });

    it('registers sh/shell aliases for bash', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(['sh', 'shell'], {
        languageName: 'bash',
      });
    });

    it('registers ps1/pwsh aliases for powershell', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(['ps1', 'pwsh'], {
        languageName: 'powershell',
      });
    });

    it('registers yml alias for yaml', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledWith(['yml'], {
        languageName: 'yaml',
      });
    });

    it('calls registerAliases 6 times total', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      expect(mockHljs.registerAliases).toHaveBeenCalledTimes(6);
    });

    it('returns the same promise on subsequent calls (singleton)', async () => {
      const { getHighlightJs } = await loadModule();
      const first = getHighlightJs();
      const second = getHighlightJs();
      expect(first).toBe(second);
      await first;
    });

    it('does not re-register languages on second call', async () => {
      const { getHighlightJs } = await loadModule();
      await getHighlightJs();
      await getHighlightJs();
      expect(mockHljs.registerLanguage).toHaveBeenCalledTimes(10);
    });

    it('isolates state between module reloads', async () => {
      const modA = await loadModule();
      const promiseA = modA.getHighlightJs();
      await promiseA;
      expect(mockHljs.registerLanguage).toHaveBeenCalledTimes(10);

      vi.resetModules();
      mockHljs.registerLanguage.mockClear();

      const modB = await loadModule();
      const promiseB = modB.getHighlightJs();
      await promiseB;
      expect(mockHljs.registerLanguage).toHaveBeenCalledTimes(10);
      expect(promiseA).not.toBe(promiseB);
    });
  });

  describe('getMermaid', () => {
    it('returns a promise', async () => {
      const { getMermaid } = await loadModule();
      const result = getMermaid();
      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves to the mermaid instance', async () => {
      const { getMermaid } = await loadModule();
      const mermaid = await getMermaid();
      expect(mermaid).toBe(mockMermaid);
    });

    it('sets window.mermaid', async () => {
      const { getMermaid } = await loadModule();
      await getMermaid();
      expect((window as any).mermaid).toBe(mockMermaid);
    });

    it('calls registerExternalDiagrams with zenuml', async () => {
      const { getMermaid } = await loadModule();
      await getMermaid();
      expect(mockMermaid.registerExternalDiagrams).toHaveBeenCalledTimes(1);
      expect(mockMermaid.registerExternalDiagrams).toHaveBeenCalledWith([
        { id: 'zenuml' },
      ]);
    });

    it('returns the same promise on subsequent calls (singleton)', async () => {
      const { getMermaid } = await loadModule();
      const first = getMermaid();
      const second = getMermaid();
      expect(first).toBe(second);
      await first;
    });

    it('does not re-register on second call', async () => {
      const { getMermaid } = await loadModule();
      await getMermaid();
      await getMermaid();
      expect(mockMermaid.registerExternalDiagrams).toHaveBeenCalledTimes(1);
    });

    it('still resolves when registerExternalDiagrams rejects', async () => {
      mockMermaid.registerExternalDiagrams.mockRejectedValueOnce(
        new Error('boom'),
      );
      const { getMermaid } = await loadModule();
      const mermaid = await getMermaid();
      expect(mermaid).toBe(mockMermaid);
    });

    it('still sets window.mermaid when registerExternalDiagrams rejects', async () => {
      mockMermaid.registerExternalDiagrams.mockRejectedValueOnce(
        new Error('boom'),
      );
      const { getMermaid } = await loadModule();
      await getMermaid();
      expect((window as any).mermaid).toBe(mockMermaid);
    });
  });

  describe('getChart', () => {
    it('returns a promise', async () => {
      const { getChart } = await loadModule();
      const result = getChart();
      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves to the Chart constructor', async () => {
      const { getChart } = await loadModule();
      const Chart = await getChart();
      expect(Chart).toBe(mockChart);
    });

    it('sets window.Chart', async () => {
      const { getChart } = await loadModule();
      await getChart();
      expect((window as any).Chart).toBe(mockChart);
    });

    it('registers 17 components', async () => {
      const { getChart } = await loadModule();
      await getChart();
      expect(chartRegister).toHaveBeenCalledTimes(1);
      const registeredComponents = chartRegister.mock.calls[0];
      expect(registeredComponents).toHaveLength(17);
    });

    it('registers the correct components in order', async () => {
      const { getChart } = await loadModule();
      await getChart();
      const components = chartRegister.mock.calls[0].map(
        (c: any) => c.id,
      );
      expect(components).toEqual([
        'ArcElement',
        'BarController',
        'BarElement',
        'CategoryScale',
        'DoughnutController',
        'Filler',
        'Legend',
        'LineController',
        'LineElement',
        'LinearScale',
        'PieController',
        'PointElement',
        'PolarAreaController',
        'RadarController',
        'RadialLinearScale',
        'ScatterController',
        'Tooltip',
      ]);
    });

    it('returns the same promise on subsequent calls (singleton)', async () => {
      const { getChart } = await loadModule();
      const first = getChart();
      const second = getChart();
      expect(first).toBe(second);
      await first;
    });

    it('does not re-register on second call', async () => {
      const { getChart } = await loadModule();
      await getChart();
      await getChart();
      expect(chartRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('getKatex', () => {
    it('returns a promise', async () => {
      const { getKatex } = await loadModule();
      const result = getKatex();
      expect(result).toBeInstanceOf(Promise);
    });

    it('resolves to katex.default', async () => {
      const { getKatex } = await loadModule();
      const katex = await getKatex();
      expect(katex).toBe('katex-module');
    });

    it('does not set window.katex', async () => {
      const { getKatex } = await loadModule();
      await getKatex();
      expect((window as any).katex).toBeUndefined();
    });

    it('returns the same promise on subsequent calls (singleton)', async () => {
      const { getKatex } = await loadModule();
      const first = getKatex();
      const second = getKatex();
      expect(first).toBe(second);
      await first;
    });
  });

  describe('cross-function isolation', () => {
    it('all four functions maintain independent singletons', async () => {
      const mod = await loadModule();
      const promises = [
        mod.getHighlightJs(),
        mod.getMermaid(),
        mod.getChart(),
        mod.getKatex(),
      ];
      const results = await Promise.all(promises);
      expect(results[0]).toBe(mockHljs);
      expect(results[1]).toBe(mockMermaid);
      expect(results[2]).toBe(mockChart);
      expect(results[3]).toBe('katex-module');
    });

    it('each function returns its own distinct promise', async () => {
      const mod = await loadModule();
      const p1 = mod.getHighlightJs();
      const p2 = mod.getMermaid();
      const p3 = mod.getChart();
      const p4 = mod.getKatex();
      expect(p1).not.toBe(p2);
      expect(p1).not.toBe(p3);
      expect(p1).not.toBe(p4);
      expect(p2).not.toBe(p3);
      expect(p2).not.toBe(p4);
      expect(p3).not.toBe(p4);
      await Promise.all([p1, p2, p3, p4]);
    });
  });
});
