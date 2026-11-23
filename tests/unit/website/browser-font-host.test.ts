import { afterEach, expect, it, vi } from 'vitest';
import { handleBrowserFontHostCommand } from '../../../website-app/src/browser-font-host';

const filename = 'Sample-Regular.woff2';
const pickerFile = (name = filename) => ({ getFile: async () => new File(['font'], name) });
afterEach(() => { Reflect.deleteProperty(document, 'fonts'); });

function connect() {
  const send = vi.fn();
  return async (command: string, payload: Record<string, unknown> = {}) => {
    send.mockClear();
    const handled = await handleBrowserFontHostCommand({ command, requestId: 'font', ...payload }, send);
    return { handled, response: send.mock.lastCall?.[0] };
  };
}

it('imports, replaces, merges and removes font faces through the browser host', async () => {
  const loaded = { family: 'probe' };
  const load = vi.fn().mockResolvedValue(loaded);
  const add = vi.fn();
  const remove = vi.fn();
  vi.stubGlobal('FontFace', class { load = load; });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add, delete: remove } });
  const picker = vi.fn().mockResolvedValueOnce([pickerFile()]).mockResolvedValueOnce([pickerFile('Sample-Italic.woff2')])
    .mockResolvedValueOnce([pickerFile('sample-Regular.ttf')]).mockResolvedValueOnce([pickerFile('Another-Regular.ttf')]);
  vi.stubGlobal('showOpenFilePicker', picker);
  const dispatch = connect();
  expect(await dispatch('unknown')).toEqual({ handled: false, response: undefined });
  const imported = await dispatch('importDesktopFonts');
  const id = imported.response.importedId;
  expect(imported).toMatchObject({ handled: true, response: { command: 'desktopFontsResult', importedId: id } });
  expect(add).toHaveBeenCalledWith(loaded);
  expect(remove).toHaveBeenCalledWith(loaded);
  expect((await dispatch('importDesktopFonts')).response).toMatchObject({ importedId: id, fonts: [
    { faces: [{ style: 'normal' }, { style: 'italic' }] },
  ] });
  expect((await dispatch('importDesktopFonts')).response).toMatchObject({ importedId: id, fonts: [
    { faces: [{ style: 'italic' }, { style: 'normal' }] },
  ] });
  const { response: second } = await dispatch('importDesktopFonts');
  expect((await dispatch('listDesktopFonts')).response.fonts.map((font: { family: string }) => font.family)).toEqual(['Another', 'sample']);
  expect((await dispatch('removeImportedDesktopFont', { id })).response.fonts).toHaveLength(1);
  expect((await dispatch('removeImportedDesktopFont', { id: second.importedId })).response.fonts).toEqual([]);
});

it('handles picker cancellation, invalid fonts, and unavailable storage', async () => {
  const picker = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    .mockRejectedValueOnce('Picker went away').mockResolvedValueOnce([pickerFile()]);
  vi.stubGlobal('showOpenFilePicker', picker);
  const dispatch = connect();
  expect((await dispatch('importDesktopFonts')).response.importedId).toBeUndefined();
  expect((await dispatch('importDesktopFonts')).response.importedId).toBeUndefined();
  expect((await dispatch('importDesktopFonts')).response.error).toBe('Picker went away');
  vi.stubGlobal('FontFace', class { async load() { throw new Error('bad font data'); } });
  expect((await dispatch('importDesktopFonts')).response.error).toMatch(/could not be loaded/);
  expect((await dispatch('removeImportedDesktopFont', { id: 'not-a-font' })).response.error).toMatch(/Invalid imported/);
  vi.stubGlobal('indexedDB', undefined);
  expect((await dispatch('listDesktopFonts')).response).toMatchObject({ fonts: [], error: expect.stringContaining('unavailable') });
});

it('uses and cleans up the file input fallback', async () => {
  vi.stubGlobal('showOpenFilePicker', undefined);
  vi.stubGlobal('crypto', undefined);
  const dispatch = connect();
  const importRequest = dispatch('importDesktopFonts');
  await vi.waitFor(() => expect(document.querySelector('input[type="file"]')).not.toBeNull());
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [new File(['font'], filename)] });
  input.dispatchEvent(new Event('change'));
  const { response } = await importRequest;
  expect(response.importedId).toMatch(/^font_browser_/);
  expect(input.isConnected).toBe(false);
  expect((await dispatch('removeImportedDesktopFont', { id: response.importedId })).response.fonts).toEqual([]);

  const cancelRequest = dispatch('importDesktopFonts');
  await vi.waitFor(() => expect(document.querySelector('input[type="file"]')).not.toBeNull());
  document.querySelector('input[type="file"]')!.dispatchEvent(new Event('cancel'));
  expect((await cancelRequest).response.importedId).toBeUndefined();
  expect(document.querySelector('input[type="file"]')).toBeNull();
});

it('reports request and transaction failures from font storage', async () => {
  const dispatch = connect();
  const target = <T extends object>(properties: T) => Object.assign(new EventTarget(), properties);
  const fire = (object: EventTarget, type: string) => setTimeout(() => object.dispatchEvent(new Event(type)), 0);
  for (const [event, error, expected] of [
    ['open', new DOMException('Storage blocked', 'UnknownError'), 'Storage blocked'],
    ['request', null, 'IndexedDB request failed.'],
    ['abort', new DOMException('Storage closed', 'AbortError'), 'Storage closed'],
    ['abort', null, 'IndexedDB transaction aborted.'],
    ['error', new DOMException('Disk full', 'QuotaExceededError'), 'Disk full'],
    ['error', null, 'IndexedDB transaction failed.'],
  ] as const) {
    const close = vi.fn();
    const read = target({ result: [], error });
    const transaction = target({
      error,
      objectStore: () => ({
        getAll: () => {
          fire(read, event === 'request' ? 'error' : 'success');
          if (event === 'abort' || event === 'error') fire(transaction, event);
          return read;
        },
      }),
    });
    const open = target({ result: { transaction: () => transaction, close }, error });
    vi.stubGlobal('indexedDB', {
      open: () => {
        fire(open, event === 'open' ? 'error' : 'success');
        return open;
      },
    });
    expect((await dispatch('listDesktopFonts')).response).toMatchObject({ fonts: [], error: expect.stringContaining(expected) });
    expect(close).toHaveBeenCalledTimes(event === 'open' ? 0 : 2);
  }
});
