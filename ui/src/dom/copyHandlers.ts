export function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function getHeadingAt(lines: string[], index: number) {
  const atxMatch = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(lines[index]);
  if (atxMatch) {
    return {
      level: atxMatch[1].length,
      text: atxMatch[2].trim(),
      start: index,
      end: index + 1,
    };
  }

  const nextLine = lines[index + 1];
  if (!nextLine || !lines[index].trim()) return null;
  if (/^=+$/.test(nextLine.trim())) {
    return { level: 1, text: lines[index].trim(), start: index, end: index + 2 };
  }
  if (/^-+$/.test(nextLine.trim()) && !/^[-*+]\s/.test(lines[index])) {
    return { level: 2, text: lines[index].trim(), start: index, end: index + 2 };
  }
  return null;
}

export function markdownSectionFromSource(
  source: string | null | undefined,
  sectionId: string,
  occurrence = 0,
  _getHeadingAt: (lines: string[], index: number) => { level: number; text: string; start: number; end: number } | null = getHeadingAt,
  _slugifyHeading: (text: string) => string = slugifyHeading,
) {
  if (!source || !sectionId) return '';
  const lines = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let matchedOccurrence = 0;

  for (let index = 0; index < lines.length; index++) {
    const heading = _getHeadingAt(lines, index);
    if (!heading) continue;
    if (_slugifyHeading(heading.text) !== sectionId) continue;
    if (matchedOccurrence < occurrence) {
      matchedOccurrence += 1;
      continue;
    }

    let end = lines.length;
    for (let nextIndex = heading.end; nextIndex < lines.length; nextIndex++) {
      const nextHeading = _getHeadingAt(lines, nextIndex);
      if (nextHeading && nextHeading.level <= heading.level) {
        end = nextHeading.start;
        break;
      }
    }
    return lines.slice(heading.start, end).join('\n').trim();
  }

  return '';
}

export const markCopied = (btn: HTMLElement | null | undefined, resetText: string) => {
  if (!btn) return;
  const feedbackBtn = btn as HTMLElement & { __copyResetTimer?: number };
  if (feedbackBtn.__copyResetTimer) {
    window.clearTimeout(feedbackBtn.__copyResetTimer);
  }

  btn.classList.add('is-copied');
  const tooltip = btn.querySelector('.tooltip-text');
  if (tooltip) tooltip.textContent = 'Copied!';
  feedbackBtn.__copyResetTimer = window.setTimeout(() => {
    btn.classList.remove('is-copied');
    if (tooltip) tooltip.textContent = resetText;
    feedbackBtn.__copyResetTimer = undefined;
  }, 2000);
};

export function cleanClonedText(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function computeSectionOccurrence(sections: Element[], section: Element): number {
  return Math.max(0, sections.indexOf(section));
}

export function registerCopyHandlers(win: any) {
  const copyText = (text: string) => {
    if (!text) return;
    if (win.PlatformBridge) {
      win.PlatformBridge.copyToClipboard(text);
    } else {
      void navigator.clipboard.writeText(text);
    }
  };

  const textFromElement = (source: HTMLElement) => {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll([
      '.tooltip-text',
      '.mdn-anchor',
      '.mdn-section-copy-btn',
      '.mdn-section-chevron',
      '.mdn-copy-btn',
      '.mdn-toggle-preview-btn',
      '.mdn-codeblock-toggle-btn',
      '.mdn-codeblock-lang',
      '.mdn-table-toolbar',
      '.mdn-table-filter-btn',
      '.mdn-sort-icon',
    ].join(',')).forEach((el) => el.remove());
    return cleanClonedText(clone.innerText || clone.textContent || '');
  };

  win.UI.markCopyButtonCopied = markCopied;

  win.UI.copySection = (btn: HTMLElement, event?: Event) => {
    event?.stopPropagation();
    const section = btn.closest('.mdn-section') as HTMLElement | null;
    const body = Array.from(section?.children ?? [])
      .find((child) => child.classList.contains('mdn-section-body')) as HTMLElement | undefined;
    if (!section || !body) return;
    try {
      const sameIdSections = Array.from(document.querySelectorAll<HTMLElement>(`.mdn-section[id="${CSS.escape(section.id)}"]`));
      const occurrence = computeSectionOccurrence(sameIdSections, section);
      const markdownSource = markdownSectionFromSource(win.UI.currentMarkdownSource, section.id, occurrence);
      copyText(markdownSource || textFromElement(body));
      markCopied(btn, 'Copy section content');
    } catch (err) {
      console.warn('Failed to copy section to clipboard:', err);
    }
  };

  win.UI.copyDocument = (btn?: HTMLElement | null) => {
    const body = document.getElementById('mdBody') as HTMLElement | null;
    if (!body) return;
    try {
      copyText(textFromElement(body));
      markCopied(btn, 'Copy file content');
    } catch (err) {
      console.warn('Failed to copy document to clipboard:', err);
    }
  };

  win.UI.copyCode = (btn: HTMLElement) => {
    const code = btn.closest('.mdn-codeblock')?.querySelector('code')?.innerText ?? '';
    try {
      copyText(code);
    } catch (err) {
      console.warn('Failed to copy code to clipboard:', err);
    }
    markCopied(btn, 'Copy code');
  };
  win.UI_copyCode = win.UI.copyCode;
}
