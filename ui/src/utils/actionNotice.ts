export type ActionNoticeTone = 'neutral' | 'success' | 'error';

export interface ActionNoticeDetail {
  readonly message: string;
  readonly tone: ActionNoticeTone;
}

export const ACTION_NOTICE_EVENT = 'markdown-explorer-action-notice';

export function dispatchActionNotice(message: string, tone: ActionNoticeTone = 'neutral'): void {
  const normalized = String(message ?? '').trim();
  if (!normalized || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ActionNoticeDetail>(ACTION_NOTICE_EVENT, {
    detail: { message: normalized, tone },
  }));
}

export function normalizeActionNoticeDetail(detail: unknown): ActionNoticeDetail | null {
  if (typeof detail === 'string') {
    const message = detail.trim();
    return message ? { message, tone: 'neutral' } : null;
  }
  if (!detail || typeof detail !== 'object') return null;
  const value = detail as Partial<ActionNoticeDetail>;
  const message = String(value.message ?? '').trim();
  if (!message) return null;
  const tone: ActionNoticeTone = value.tone === 'success' || value.tone === 'error'
    ? value.tone
    : 'neutral';
  return { message, tone };
}
