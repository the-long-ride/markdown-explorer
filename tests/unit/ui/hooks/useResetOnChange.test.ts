import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useResetOnChange } from '../../../../ui/src/hooks/useResetOnChange';

function useResettableMenu(file: string, version: number) {
  const [open, setOpen] = useState(false);
  useResetOnChange([file, version], () => setOpen(false));
  return { open, setOpen };
}

describe('useResetOnChange', () => {
  it('keeps state while deps are unchanged', () => {
    const { result, rerender } = renderHook(({ file, version }) => useResettableMenu(file, version), {
      initialProps: { file: 'a.md', version: 1 },
    });
    act(() => result.current.setOpen(true));
    rerender({ file: 'a.md', version: 1 });
    expect(result.current.open).toBe(true);
  });

  it('resets state within the render that sees a changed dep', () => {
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(({ file, version }) => {
      const menu = useResettableMenu(file, version);
      seen.push(menu.open);
      return menu;
    }, { initialProps: { file: 'a.md', version: 1 } });
    act(() => result.current.setOpen(true));
    seen.length = 0;

    rerender({ file: 'a.md', version: 2 });
    expect(result.current.open).toBe(false);
    expect(seen.at(-1)).toBe(false);

    act(() => result.current.setOpen(true));
    rerender({ file: 'b.md', version: 2 });
    expect(result.current.open).toBe(false);
  });
});
