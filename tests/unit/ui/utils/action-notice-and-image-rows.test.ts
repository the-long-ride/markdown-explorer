import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTION_NOTICE_EVENT, dispatchActionNotice, normalizeActionNoticeDetail } from '../../../../ui/src/utils/actionNotice';
import { enhanceRawHtmlImageRows, isRawHtmlImageRow } from '../../../../ui/src/markdown/rawHtmlImageRows';

afterEach(() => { document.body.innerHTML = ''; });

describe('action notices', () => {
  it('dispatches trimmed messages and skips empty ones', () => {
    const listener = vi.fn();
    window.addEventListener(ACTION_NOTICE_EVENT, listener);
    dispatchActionNotice('   ');
    dispatchActionNotice(null as any);
    dispatchActionNotice(' saved ', 'success');
    window.removeEventListener(ACTION_NOTICE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ message: 'saved', tone: 'success' });
  });

  it('normalizes string and object details', () => {
    expect(normalizeActionNoticeDetail(' hi ')).toEqual({ message: 'hi', tone: 'neutral' });
    expect(normalizeActionNoticeDetail('  ')).toBeNull();
    expect(normalizeActionNoticeDetail(null)).toBeNull();
    expect(normalizeActionNoticeDetail(5)).toBeNull();
    expect(normalizeActionNoticeDetail({ message: '' })).toBeNull();
    expect(normalizeActionNoticeDetail({ message: 'x', tone: 'error' })).toEqual({ message: 'x', tone: 'error' });
    expect(normalizeActionNoticeDetail({ message: 'x', tone: 'success' })?.tone).toBe('success');
    expect(normalizeActionNoticeDetail({ message: 'x', tone: 'loud' })?.tone).toBe('neutral');
  });
});

describe('raw html image rows', () => {
  it('detects rows of direct and linked images only', () => {
    const el = (html: string, tag = 'p') => { const node = document.createElement(tag); node.innerHTML = html; return node; };
    expect(isRawHtmlImageRow(el('<img src="a"><img src="b">', 'section'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a"> text <img src="b">'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a">'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a"> <a href="#"> <img src="b"> </a>'))).toBe(true);
    expect(isRawHtmlImageRow(el('<img src="a"><a href="#"><img src="b"><img src="c"></a>'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a"><a href="#">t</a>'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a"><em>x</em>'))).toBe(false);
    expect(isRawHtmlImageRow(el('<img src="a"><!-- c --><img src="b">', 'div'))).toBe(false);
  });

  it('enhances rows once and applies author widths', () => {
    document.body.innerHTML = '<div id="r"><img src="a" width="120"><a href="#"><img src="b" width="40%"></a><img src="c" width=" "></div><span><img src="x"></span>';
    enhanceRawHtmlImageRows(document.body);
    enhanceRawHtmlImageRows(document.body);
    const row = document.getElementById('r')!;
    expect(row.classList.contains('mdn-image-row--html')).toBe(true);
    expect(row.style.getPropertyValue('--mdn-image-count')).toBe('3');
    const [first, link] = row.children as any;
    expect(first.style.flexBasis).toBe('120px');
    expect(link.style.maxWidth).toBe('40%');
    expect(link.classList.contains('mdn-image-row__item')).toBe(true);
    expect(document.querySelector('span')!.classList.contains('mdn-image-row')).toBe(false);
  });
});
