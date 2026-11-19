const EXCLUDED_SELECTOR = [
  '.cm-editor',
  'textarea',
  'input',
  '.markdown-inline-editor',
  'svg',
  '.mermaid',
  'script',
  'style',
  '[data-color-swatched="true"]',
  '.mdn-color-token',
  '.mdn-color-swatch',
].join(', ');

const TARGET_SELECTOR = 'code, table td, table th';

/**
 * Matches:
 * 1. Hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA (bounded to avoid invalid hex lengths or anchor hashes)
 * 2. Functional CSS colors: rgb(...), rgba(...), hsl(...), hsla(...), oklch(...), oklab(...)
 */
const COLOR_REGEX = /(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(\s*[-+0-9.%\s,/a-zA-Zdegturnrad]+?\s*\)/gi;

function collectCandidateTextNodes(root: ParentNode): Text[] {
  const textNodes: Text[] = [];
  const node = root as Node;
  const doc = node.ownerDocument ?? (typeof document !== 'undefined' ? document : null);

  if (doc && typeof doc.createTreeWalker === 'function') {
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(EXCLUDED_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (!parent.closest(TARGET_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current = walker.nextNode();
    while (current) {
      textNodes.push(current as Text);
      current = walker.nextNode();
    }
  } else {
    function walk(curr: Node) {
      if (curr.nodeType === 3 /* Node.TEXT_NODE */) {
        const parent = (curr as Text).parentElement;
        if (parent && !parent.closest?.(EXCLUDED_SELECTOR) && parent.closest?.(TARGET_SELECTOR)) {
          textNodes.push(curr as Text);
        }
        return;
      }
      if (curr.nodeType === 1 /* Node.ELEMENT_NODE */) {
        const el = curr as Element;
        if (el.matches?.(EXCLUDED_SELECTOR)) return;
        for (let i = 0; i < el.childNodes.length; i += 1) {
          walk(el.childNodes[i]);
        }
      }
    }
    walk(node);
  }

  return textNodes;
}

export function enhanceColorSwatches(root: ParentNode): void {
  const textNodes = collectCandidateTextNodes(root);
  if (textNodes.length === 0) return;

  const doc = (root as Node).ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? '';
    if (!text) continue;

    if (!text.includes('#') && !/\b(?:rgba?|hsla?|oklch|oklab)\(/i.test(text)) {
      continue;
    }

    const matches = [...text.matchAll(COLOR_REGEX)];
    if (matches.length === 0) continue;

    const parentNode = textNode.parentNode;
    if (!parentNode) continue;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      const matchIndex = match.index!;
      const colorText = match[0];

      if (matchIndex > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, matchIndex)));
      }

      const token = doc.createElement('span');
      token.className = 'mdn-color-token';
      token.dataset.colorSwatched = 'true';

      const swatch = doc.createElement('span');
      swatch.className = 'mdn-color-swatch';
      swatch.dataset.color = colorText;
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.setProperty('--mdn-swatch-color', colorText);

      token.appendChild(swatch);
      token.appendChild(doc.createTextNode(colorText));

      fragment.appendChild(token);
      lastIndex = matchIndex + colorText.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    parentNode.replaceChild(fragment, textNode);
  }
}
