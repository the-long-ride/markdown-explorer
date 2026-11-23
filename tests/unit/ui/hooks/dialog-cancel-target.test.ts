import { describe, expect, it } from 'vitest';
import { isDialogCancelTarget } from '../../../../ui/src/hooks/useDialogKeyboard';

describe('isDialogCancelTarget', () => {
  it('detects targets outside the primary action, custom cancel elements and cancel selectors', () => {
    document.body.innerHTML = '<div><button id="primary">ok</button><button id="other">x</button><span class="cancel"><b id="inner">c</b></span></div>';
    const primary = document.getElementById('primary') as HTMLElement;
    const other = document.getElementById('other') as HTMLElement;
    const inner = document.getElementById('inner') as HTMLElement;
    expect(isDialogCancelTarget(document as any, {} as any)).toBe(false);
    expect(isDialogCancelTarget(other, { primaryRef: { current: primary } } as any)).toBe(true);
    expect(isDialogCancelTarget(other, { isCancelElement: (el: HTMLElement) => el === other } as any)).toBe(true);
    expect(isDialogCancelTarget(inner, { cancelSelector: '.cancel' } as any)).toBe(true);
    expect(isDialogCancelTarget(primary, { primaryRef: { current: primary }, cancelSelector: '.cancel' } as any)).toBe(false);
  });
});
