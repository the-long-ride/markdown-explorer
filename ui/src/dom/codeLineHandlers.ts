export function registerCodeLineHandlers() {
  const getCodeLineNumbers = (block: HTMLElement): HTMLElement[] =>
    Array.from(block.querySelectorAll('.mdn-codeblock-gutter span')) as HTMLElement[];

  const readCodeLine = (value: string | undefined): number | null => {
    const line = Number(value);
    return Number.isFinite(line) && line > 0 ? line : null;
  };

  const clampCodeLine = (line: number, count: number): number =>
    Math.min(Math.max(Math.round(line), 1), Math.max(count, 1));

  const paintCodeLineState = (block: HTMLElement) => {
    const numbers = getCodeLineNumbers(block);
    const count = numbers.length;
    if (!count) return;

    const activeLine = readCodeLine(block.dataset.activeLine);
    const selectedStart = readCodeLine(block.dataset.selectedStart);
    const selectedEnd = readCodeLine(block.dataset.selectedEnd);
    const hasSelection = selectedStart !== null && selectedEnd !== null;
    const rangeStart = hasSelection ? Math.min(selectedStart, selectedEnd) : 0;
    const rangeEnd = hasSelection ? Math.max(selectedStart, selectedEnd) : -1;

    numbers.forEach((span, index) => {
      const line = Number(span.dataset.line) || index + 1;
      span.classList.toggle('is-active', activeLine === line);
      span.classList.toggle('is-selected', hasSelection && line >= rangeStart && line <= rangeEnd);
    });

    block.classList.toggle('has-code-line-active', activeLine !== null);
    block.classList.toggle('has-code-line-selection', hasSelection);
  };

  const setActiveCodeLine = (block: HTMLElement, line: number | null) => {
    const count = getCodeLineNumbers(block).length;
    if (!count || line === null) {
      delete block.dataset.activeLine;
    } else {
      block.dataset.activeLine = String(clampCodeLine(line, count));
    }
    paintCodeLineState(block);
  };

  const setSelectedCodeLines = (block: HTMLElement, startLine: number | null, endLine?: number | null) => {
    const count = getCodeLineNumbers(block).length;
    if (!count || startLine === null || endLine === null || endLine === undefined) {
      delete block.dataset.selectedStart;
      delete block.dataset.selectedEnd;
    } else {
      block.dataset.selectedStart = String(clampCodeLine(startLine, count));
      block.dataset.selectedEnd = String(clampCodeLine(endLine, count));
    }
    paintCodeLineState(block);
  };

  const clearCodeLineState = (except?: HTMLElement | null) => {
    document.querySelectorAll('.mdn-codeblock').forEach((blockEl) => {
      const block = blockEl as HTMLElement;
      if (except && block === except) return;
      setActiveCodeLine(block, null);
      setSelectedCodeLines(block, null);
    });
  };

  const lineFromPointer = (pre: HTMLElement, clientY: number): number | null => {
    const block = pre.closest('.mdn-codeblock') as HTMLElement | null;
    if (!block) return null;
    const count = getCodeLineNumbers(block).length;
    if (!count) return null;

    const code = pre.querySelector('code') as HTMLElement | null;
    const measureEl = code ?? pre;
    const styles = window.getComputedStyle(pre);
    const fontSize = parseFloat(styles.fontSize) || 12;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.6;
    const top = measureEl.getBoundingClientRect().top;
    return clampCodeLine(Math.floor((clientY - top) / lineHeight) + 1, count);
  };

  const offsetToCodeLine = (text: string, offset: number): number => {
    const clampedOffset = Math.min(Math.max(offset, 0), text.length);
    return text.slice(0, clampedOffset).split('\n').length;
  };

  const getCodeTextOffset = (code: HTMLElement, container: Node, offset: number): number => {
    const textLength = code.textContent?.length ?? 0;
    const codeRange = document.createRange();
    const pointRange = document.createRange();
    codeRange.selectNodeContents(code);

    try {
      pointRange.setStart(container, offset);
      pointRange.collapse(true);
    } catch {
      return 0;
    }

    if (pointRange.compareBoundaryPoints(Range.START_TO_START, codeRange) <= 0) return 0;
    if (pointRange.compareBoundaryPoints(Range.START_TO_END, codeRange) >= 0) return textLength;

    const beforeRange = document.createRange();
    beforeRange.setStart(code, 0);
    beforeRange.setEnd(container, offset);
    return Math.min(Math.max(beforeRange.toString().length, 0), textLength);
  };

  const getSelectedCodeLines = (code: HTMLElement, range: Range): { start: number; end: number } | null => {
    const text = code.textContent ?? '';
    const startOffset = getCodeTextOffset(code, range.startContainer, range.startOffset);
    const endOffset = getCodeTextOffset(code, range.endContainer, range.endOffset);
    const start = Math.min(startOffset, endOffset);
    const end = Math.max(startOffset, endOffset);
    if (end <= start) return null;

    const startLine = offsetToCodeLine(text, start);
    const endLine = offsetToCodeLine(text, Math.max(start, end - 1));
    return { start: startLine, end: endLine };
  };

  const syncCodeSelection = () => {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hasRange = Boolean(range && !selection?.isCollapsed);

    document.querySelectorAll('.mdn-codeblock').forEach((blockEl) => {
      const block = blockEl as HTMLElement;
      const code = block.querySelector('code') as HTMLElement | null;
      if (!hasRange || !range || !code) {
        setSelectedCodeLines(block, null);
        return;
      }

      let intersects = false;
      try {
        intersects = range.intersectsNode(code);
      } catch {
        intersects = false;
      }

      if (!intersects) {
        setSelectedCodeLines(block, null);
        return;
      }

      const selectedLines = getSelectedCodeLines(code, range);
      if (!selectedLines) {
        setSelectedCodeLines(block, null);
        return;
      }

      setSelectedCodeLines(block, selectedLines.start, selectedLines.end);
    });
  };

  const updatePointerCodeLine = (event: PointerEvent | MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const pre = target?.closest('.mdn-pre') as HTMLElement | null;

    if (!pre) {
      if (target && !target.closest('.mdn-codeblock')) {
        clearCodeLineState();
      }
      return;
    }

    const block = pre.closest('.mdn-codeblock') as HTMLElement | null;
    if (!block) return;

    clearCodeLineState(block);
    const line = lineFromPointer(pre, event.clientY);
    if (line !== null) {
      setActiveCodeLine(block, line);
    }
  };

  let codeSelectionFrame = 0;
  const scheduleCodeSelectionSync = () => {
    if (codeSelectionFrame) return;
    codeSelectionFrame = window.requestAnimationFrame(() => {
      codeSelectionFrame = 0;
      syncCodeSelection();
    });
  };

  document.addEventListener('pointerdown', updatePointerCodeLine, true);
  document.addEventListener('click', updatePointerCodeLine, true);
  document.addEventListener('pointermove', (event) => {
    if ((event.buttons & 1) !== 1) return;
    updatePointerCodeLine(event);
  }, true);
  document.addEventListener('selectionchange', scheduleCodeSelectionSync);
}
