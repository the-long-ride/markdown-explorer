import { describe, expect, it, vi } from 'vitest';
import { runEnhancementTasks } from '../../../../ui/src/components/Content/enhancementTasks';
import { enhanceTables } from '../../../../ui/src/components/Content/enhancements/tableEnhancement';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('content enhancement scheduling', () => {
  it('starts independent renderers concurrently', async () => {
    const slow = deferred<void>();
    const started: string[] = [];

    const run = runEnhancementTasks([
      { label: 'slow', run: async () => { started.push('slow'); await slow.promise; } },
      { label: 'math', run: async () => { started.push('math'); } },
      { label: 'mermaid', run: async () => { started.push('mermaid'); } },
      { label: 'tables', run: async () => { started.push('tables'); } },
    ], () => false);

    await Promise.resolve();
    expect(started).toEqual(['slow', 'math', 'mermaid', 'tables']);

    slow.resolve();
    await run;
  });

  it('isolates a renderer failure from the other renderers', async () => {
    const completed: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runEnhancementTasks([
      { label: 'broken', run: async () => { throw new Error('load failed'); } },
      { label: 'math', run: async () => { completed.push('math'); } },
      { label: 'mermaid', run: async () => { completed.push('mermaid'); } },
    ], () => false);

    expect(completed).toEqual(['math', 'mermaid']);
    expect(error).toHaveBeenCalledWith('broken error:', expect.any(Error));
    error.mockRestore();
  });

  it('initializes table controls without waiting for Chart.js', async () => {
    document.body.innerHTML = `
      <span id="table-1-count"></span>
      <button id="table-1-toggle-btn"></button>
      <table id="table-1" class="mdn-table"><tbody><tr><td>1</td></tr></tbody></table>
    `;
    const chartLoad = deferred<unknown>();
    const getChart = vi.fn(() => chartLoad.promise);
    const detectChartable = vi.fn();
    const tableGlobals: any = { states: {}, detectChartable };

    await enhanceTables(document, { getChart, tableGlobals });

    expect(getChart).not.toHaveBeenCalled();
    expect(tableGlobals.ensureChartLibrary).toBe(getChart);
    expect(detectChartable).toHaveBeenCalledWith('table-1');
    expect(document.getElementById('table-1')?.dataset.mdnEnhanced).toBe('true');
  });
});
