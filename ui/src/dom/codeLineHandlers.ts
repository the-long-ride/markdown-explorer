export function readCodeLine(value: string | undefined): number | null {
  const line = Number(value);
  return Number.isFinite(line) && line > 0 ? line : null;
}

export function clampCodeLine(line: number, count: number): number {
  return Math.min(Math.max(Math.round(line), 1), Math.max(count, 1));
}

export function offsetToCodeLine(text: string, offset: number): number {
  const clampedOffset = Math.min(Math.max(offset, 0), text.length);
  return text.slice(0, clampedOffset).split('\n').length;
}

export function computeLineClasses(
  line: number,
  activeLine: number | null,
  selectedStart: number | null,
  selectedEnd: number | null,
): { isActive: boolean; isSelected: boolean } {
  const isActive = line === activeLine;
  const hasSelection = selectedStart !== null && selectedEnd !== null;
  const rangeStart = hasSelection ? Math.min(selectedStart, selectedEnd) : 0;
  const rangeEnd = hasSelection ? Math.max(selectedStart, selectedEnd) : -1;
  const isSelected = hasSelection && line >= rangeStart && line <= rangeEnd;
  return { isActive, isSelected };
}

export function lineFromPosition(clientY: number, top: number, lineHeight: number, count: number): number {
  return clampCodeLine(Math.floor((clientY - top) / lineHeight) + 1, count);
}

export function mergeLineRanges(
  offsetRange: { start: number; end: number } | null,
  rectRange: { start: number; end: number } | null,
): { start: number; end: number } | null {
  if (offsetRange && offsetRange.end <= offsetRange.start) {
    if (!rectRange || rectRange.end <= rectRange.start) return null;
    return rectRange;
  }
  if (!offsetRange) {
    if (rectRange && rectRange.end <= rectRange.start) return null;
    return rectRange;
  }
  if (!rectRange) return offsetRange;
  return { start: Math.min(offsetRange.start, rectRange.start), end: Math.max(offsetRange.end, rectRange.end) };
}

export function registerCodeLineHandlers() {
  const getCodeLineNumbers = (block: HTMLElement): HTMLElement[] =>
    Array.from(block.querySelectorAll('.mdn-codeblock-gutter span')) as HTMLElement[];

  const paintCodeLineState = (block: HTMLElement) => {
    const numbers = getCodeLineNumbers(block);
    const count = numbers.length;
    if (!count) return;

    const activeLine = readCodeLine(block.dataset.activeLine);
    const selectedStart = readCodeLine(block.dataset.selectedStart);
    const selectedEnd = readCodeLine(block.dataset.selectedEnd);

    numbers.forEach((span, index) => {
      const line = Number(span.dataset.line) || index + 1;
      const { isActive, isSelected } = computeLineClasses(line, activeLine, selectedStart, selectedEnd);
      span.classList.toggle('is-active', isActive);
      span.classList.toggle('is-selected', isSelected);
    });

    block.classList.toggle('has-code-line-active', activeLine !== null);
    block.classList.toggle('has-code-line-selection', selectedStart !== null && selectedEnd !== null);
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
    return lineFromPosition(clientY, top, lineHeight, count);
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

  const getSelectedCodeLinesFromRects = (block: HTMLElement, code: HTMLElement, range: Range): { start: number; end: number } | null => {
    const count = getCodeLineNumbers(block).length;
    if (!count) return null;

    const pre = code.closest('.mdn-pre') as HTMLElement | null;
    const measureEl = pre ?? code;
    const styles = window.getComputedStyle(measureEl);
    const fontSize = parseFloat(styles.fontSize) || 12;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.6;
    const codeRect = code.getBoundingClientRect();
    if (!codeRect.height || !lineHeight) return null;

    let startLine = Number.POSITIVE_INFINITY;
    let endLine = Number.NEGATIVE_INFINITY;
    Array.from(range.getClientRects()).forEach((rect) => {
      if (!rect.width && !rect.height) return;
      const top = Math.max(rect.top, codeRect.top);
      const bottom = Math.min(rect.bottom, codeRect.bottom);
      if (bottom <= top) return;

      const rectStartLine = clampCodeLine(Math.floor((top - codeRect.top) / lineHeight) + 1, count);
      const rectEndLine = clampCodeLine(Math.floor((bottom - 1 - codeRect.top) / lineHeight) + 1, count);
      startLine = Math.min(startLine, rectStartLine);
      endLine = Math.max(endLine, rectEndLine);
    });

    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null;
    return { start: startLine, end: endLine };
  };

  const getSelectedCodeLines = (block: HTMLElement, code: HTMLElement, range: Range): { start: number; end: number } | null => {
    const text = code.textContent ?? '';
    const startOffset = getCodeTextOffset(code, range.startContainer, range.startOffset);
    const endOffset = getCodeTextOffset(code, range.endContainer, range.endOffset);
    const start = Math.min(startOffset, endOffset);
    const end = Math.max(startOffset, endOffset);
    const rectLines = getSelectedCodeLinesFromRects(block, code, range);
    const offsetLines = end > start ? { start: offsetToCodeLine(text, start), end: offsetToCodeLine(text, Math.max(start, end - 1)) } : null;
    return mergeLineRanges(offsetLines, rectLines);
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

      const selectedLines = getSelectedCodeLines(block, code, range);
      if (!selectedLines) {
        setSelectedCodeLines(block, null);
        return;
      }

      setSelectedCodeLines(block, selectedLines.start, selectedLines.end);
    });
  };

  const updatePointerCodeLine = (event: PointerEvent | MouseEvent): { block: HTMLElement; line: number | null } | null => {
    const target = event.target instanceof Element ? event.target : null;
    const pre = target?.closest('.mdn-pre') as HTMLElement | null;

    if (!pre) {
      if (target && !target.closest('.mdn-codeblock')) {
        clearCodeLineState();
      }
      return null;
    }

    const block = pre.closest('.mdn-codeblock') as HTMLElement | null;
    if (!block) return null;

    clearCodeLineState(block);
    const line = lineFromPointer(pre, event.clientY);
    if (line !== null) {
      setActiveCodeLine(block, line);
    }
    return { block, line };
  };

  let dragBlock: HTMLElement | null = null;
  let dragStartLine: number | null = null;

  const beginPointerCodeSelection = (event: PointerEvent) => {
    const state = updatePointerCodeLine(event);
    dragBlock = state?.block ?? null;
    dragStartLine = state?.line ?? null;

    if (dragBlock) {
      setSelectedCodeLines(dragBlock, null);
    }
  };

  const updatePointerCodeSelection = (event: PointerEvent) => {
    if ((event.buttons & 1) !== 1) return;

    if (!dragBlock || dragStartLine === null) {
      updatePointerCodeLine(event);
      return;
    }

    const pre = dragBlock.querySelector('.mdn-pre') as HTMLElement | null;
    if (!pre) return;

    clearCodeLineState(dragBlock);
    const line = lineFromPointer(pre, event.clientY);
    if (line === null) return;

    setActiveCodeLine(dragBlock, line);
    setSelectedCodeLines(dragBlock, dragStartLine, line);
  };

  let codeSelectionFrame = 0;
  const scheduleCodeSelectionSync = () => {
    if (codeSelectionFrame) return;
    codeSelectionFrame = window.requestAnimationFrame(() => {
      codeSelectionFrame = 0;
      syncCodeSelection();
    });
  };

  const finishPointerCodeSelection = () => {
    dragBlock = null;
    dragStartLine = null;
    scheduleCodeSelectionSync();
  };

  document.addEventListener('pointerdown', beginPointerCodeSelection, true);
  document.addEventListener('click', updatePointerCodeLine, true);
  document.addEventListener('pointermove', updatePointerCodeSelection, true);
  document.addEventListener('pointerup', finishPointerCodeSelection, true);
  document.addEventListener('pointercancel', finishPointerCodeSelection, true);
  document.addEventListener('selectionchange', scheduleCodeSelectionSync);
  document.addEventListener('keyup', scheduleCodeSelectionSync, true);
}
