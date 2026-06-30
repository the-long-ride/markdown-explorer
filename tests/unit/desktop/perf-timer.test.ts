import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPerfTimer } = require('../../../desktop/perf-timer.js');

describe('createPerfTimer', () => {
  let hrtime: { bigint: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    let counter = 0;
    hrtime = {
      bigint: vi.fn(() => {
        counter += 1000;
        return BigInt(counter * 1_000_000);
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('disabled', () => {
    let perf: ReturnType<typeof createPerfTimer>;

    beforeEach(() => {
      perf = createPerfTimer({ hrtime, isEnabled: false });
    });

    test('mark is no-op when disabled', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('test-mark');
      expect(spy).not.toHaveBeenCalled();
    });

    test('measure is no-op when disabled', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.measure('test-measure', 'start', 'end');
      expect(spy).not.toHaveBeenCalled();
    });

    test('setRendererMarks is no-op when disabled', () => {
      perf.setRendererMarks({ 'renderer:entry': 42 });
    });

    test('printSummary is no-op when disabled', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.printSummary();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('enabled', () => {
    let perf: ReturnType<typeof createPerfTimer>;

    beforeEach(() => {
      perf = createPerfTimer({ hrtime, isEnabled: true });
    });

    test('mark stores timestamp and logs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('alpha');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('[perf] mark alpha');
    });

    test('measure computes delta between two marks', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('start');
      perf.mark('end');
      perf.measure('task', 'start', 'end');
      const calls = spy.mock.calls.map((c) => c[0]);
      expect(calls).toContain('[perf] task: 1000ms');
    });

    test('measure uses current time when end mark is missing', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('start');
      perf.measure('task', 'start');
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0];
      expect(lastCall).toMatch(/^\[perf\] task: \d+ms$/);
    });

    test('measure uses default endName same as name', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('task');
      perf.measure('task', 'task');
      expect(spy.mock.calls[spy.mock.calls.length - 1][0]).toMatch(/^\[perf\] task: \d+ms$/);
    });

    test('measure is silent when start mark does not exist', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.measure('missing', 'nonexistent');
      expect(spy).not.toHaveBeenCalled();
    });

    test('setRendererMarks stores entries', () => {
      perf.setRendererMarks({ 'renderer:entry': 100, 'renderer:react-mounted': 200 });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.printSummary();
      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('Renderer JS entry: 100ms'))).toBe(true);
      expect(calls.some((s) => s.includes('React mounted: 200ms'))).toBe(true);
    });

    test('setRendererMarks overwrites previous entries', () => {
      perf.setRendererMarks({ 'renderer:entry': 50 });
      perf.setRendererMarks({ 'renderer:entry': 150, 'renderer:react-mounted': 300 });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.printSummary();
      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('Renderer JS entry: 150ms'))).toBe(true);
      expect(calls.some((s) => s.includes('React mounted: 300ms'))).toBe(true);
    });

    test('setRendererMarks is no-op for null/undefined entries', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.setRendererMarks(null);
      perf.printSummary();
      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.filter((s) => s.includes('Renderer')).length).toBe(0);
    });

    test('printSummary logs full cold-start summary', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('main:required');
      perf.mark('electron:ready');
      perf.mark('window:created');
      perf.mark('renderer:did-finish-load');
      perf.setRendererMarks({ 'renderer:entry': 100, 'renderer:react-mounted': 200 });
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('==== COLD START SUMMARY ===='))).toBe(true);
      expect(calls.some((s) => s.includes('Module require: 1000ms'))).toBe(true);
      expect(calls.some((s) => s.includes('Window create: 1000ms'))).toBe(true);
      expect(calls.some((s) => s.includes('HTML load + renderer boot: 1000ms'))).toBe(true);
      expect(calls.some((s) => s.includes('TOTAL (main require'))).toBe(true);
      expect(calls.some((s) => s.includes('Renderer JS entry: 100ms'))).toBe(true);
      expect(calls.some((s) => s.includes('React mounted: 200ms'))).toBe(true);
    });

    test('printSummary outputs only available pairs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('main:required');
      perf.mark('electron:ready');
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('Module require:'))).toBe(true);
      expect(calls.filter((s) => s.includes('Window create')).length).toBe(0);
      expect(calls.filter((s) => s.includes('HTML load')).length).toBe(0);
    });

    test('printSummary shows Module require + Window create without renderer marks', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('main:required');
      perf.mark('electron:ready');
      perf.mark('window:created');
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('Module require:'))).toBe(true);
      expect(calls.some((s) => s.includes('Window create:'))).toBe(true);
      expect(calls.filter((s) => s.includes('HTML load')).length).toBe(0);
      expect(calls.filter((s) => s.includes('Renderer')).length).toBe(0);
    });

    test('printSummary shows only renderer marks without module pairs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.setRendererMarks({ 'renderer:entry': 150 });
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.filter((s) => s.includes('Module require')).length).toBe(0);
      expect(calls.filter((s) => s.includes('Window create')).length).toBe(0);
      expect(calls.filter((s) => s.includes('HTML load')).length).toBe(0);
      expect(calls.some((s) => s.includes('Renderer JS entry: 150ms'))).toBe(true);
    });

    test('printSummary fits with only renderer:react-mounted', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.setRendererMarks({ 'renderer:react-mounted': 250 });
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('React mounted: 250ms'))).toBe(true);
      expect(calls.filter((s) => s.includes('Renderer JS entry')).length).toBe(0);
    });

    test('printSummary skips renderer:entry when undefined', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.setRendererMarks({ 'renderer:entry': undefined, 'renderer:react-mounted': 300 });
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.filter((s) => s.includes('Renderer JS entry')).length).toBe(0);
      expect(calls.some((s) => s.includes('React mounted: 300ms'))).toBe(true);
    });

    test('printSummary skips renderer:react-mounted when undefined', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.setRendererMarks({ 'renderer:entry': 200, 'renderer:react-mounted': undefined });
      perf.printSummary();

      const calls = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => s.includes('Renderer JS entry: 200ms'))).toBe(true);
      expect(calls.filter((s) => s.includes('React mounted')).length).toBe(0);
    });

    test('hrtime.bigint is called for each mark', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      perf.mark('a');
      perf.mark('b');
      perf.mark('c');
      expect(hrtime.bigint).toHaveBeenCalledTimes(3);
    });
  });
});