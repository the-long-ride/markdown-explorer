function escapeXmlHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function findXmlMarkupEnd(code: string, start: number, terminator = '>'): number {
  let quote: '"' | "'" | null = null;
  let subsetDepth = 0;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') subsetDepth += 1;
    else if (char === ']' && subsetDepth > 0) subsetDepth -= 1;
    if (subsetDepth === 0 && code.startsWith(terminator, index)) {
      return index + terminator.length;
    }
  }
  return code.length;
}

function highlightXmlText(value: string): string {
  const entityPattern = /&(?:#\d+|#x[\da-f]+|[A-Za-z_][\w.:-]*);/gi;
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(entityPattern)) {
    const index = match.index ?? 0;
    const plain = value.slice(cursor, index);
    output += plain.trim()
      ? `<span class="hl-val">${escapeXmlHtml(plain)}</span>`
      : escapeXmlHtml(plain);
    output += `<span class="hl-num">${escapeXmlHtml(match[0])}</span>`;
    cursor = index + match[0].length;
  }
  const tail = value.slice(cursor);
  output += tail.trim()
    ? `<span class="hl-val">${escapeXmlHtml(tail)}</span>`
    : escapeXmlHtml(tail);
  return output;
}

function highlightXmlTag(tag: string): string {
  if (tag.startsWith('<!--')) return `<span class="hl-cm">${escapeXmlHtml(tag)}</span>`;
  if (tag.startsWith('<![CDATA[')) return `<span class="hl-str">${escapeXmlHtml(tag)}</span>`;
  if (tag.startsWith('<?') || /^<!DOCTYPE\b/i.test(tag)) {
    return `<span class="hl-kw">${escapeXmlHtml(tag)}</span>`;
  }

  let index = 0;
  let output = '';
  if (tag[index] !== '<') return escapeXmlHtml(tag);
  output += '&lt;';
  index += 1;
  if (tag[index] === '/') {
    output += '/';
    index += 1;
  }

  const nameMatch = /^[A-Za-z_][\w:.-]*/.exec(tag.slice(index));
  if (!nameMatch) return escapeXmlHtml(tag);
  output += `<span class="hl-tag">${escapeXmlHtml(nameMatch[0])}</span>`;
  index += nameMatch[0].length;

  while (index < tag.length) {
    const remainder = tag.slice(index);
    const endMatch = /^(\s*)(\/?>)$/.exec(remainder);
    if (endMatch) {
      output += escapeXmlHtml(endMatch[1]) + escapeXmlHtml(endMatch[2]);
      break;
    }

    const whitespace = /^\s+/.exec(remainder)?.[0] ?? '';
    output += escapeXmlHtml(whitespace);
    index += whitespace.length;

    const attributeName = /^[A-Za-z_:][\w:.-]*/.exec(tag.slice(index))?.[0];
    if (!attributeName) {
      output += escapeXmlHtml(tag[index] ?? '');
      index += 1;
      continue;
    }
    output += `<span class="hl-attr">${escapeXmlHtml(attributeName)}</span>`;
    index += attributeName.length;

    const equalsMatch = /^\s*=\s*/.exec(tag.slice(index))?.[0];
    if (!equalsMatch) continue;
    output += escapeXmlHtml(equalsMatch);
    index += equalsMatch.length;

    const quote = tag[index];
    if (quote === '"' || quote === "'") {
      let valueEnd = index + 1;
      while (valueEnd < tag.length && tag[valueEnd] !== quote) valueEnd += 1;
      if (valueEnd < tag.length) valueEnd += 1;
      output += `<span class="hl-str">${escapeXmlHtml(tag.slice(index, valueEnd))}</span>`;
      index = valueEnd;
      continue;
    }

    const bareValue = /^[^\s>]+/.exec(tag.slice(index))?.[0] ?? '';
    if (bareValue) {
      output += `<span class="hl-str">${escapeXmlHtml(bareValue)}</span>`;
      index += bareValue.length;
    }
  }

  return output;
}

export function highlightXmlMarkup(code: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < code.length) {
    const tagStart = code.indexOf('<', cursor);
    if (tagStart === -1) {
      output += highlightXmlText(code.slice(cursor));
      break;
    }
    output += highlightXmlText(code.slice(cursor, tagStart));

    let end: number;
    if (code.startsWith('<!--', tagStart)) {
      const close = code.indexOf('-->', tagStart + 4);
      end = close === -1 ? code.length : close + 3;
    } else if (code.startsWith('<![CDATA[', tagStart)) {
      const close = code.indexOf(']]>', tagStart + 9);
      end = close === -1 ? code.length : close + 3;
    } else if (code.startsWith('<?', tagStart)) {
      const close = code.indexOf('?>', tagStart + 2);
      end = close === -1 ? code.length : close + 2;
    } else {
      end = findXmlMarkupEnd(code, tagStart + 1);
    }

    output += highlightXmlTag(code.slice(tagStart, end));
    cursor = end;
  }

  return output;
}
