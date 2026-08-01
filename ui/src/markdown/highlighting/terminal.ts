import { highlightStringInterpolations } from './interpolations';

export const TERMINAL_LANGS = new Set([
  'bash', 'sh', 'shell', 'zsh', 'powershell', 'pwsh', 'cmd', 'terminal',
]);

type TerminalProtectedToken = {
  start: number;
  end: number;
  cls: 'str' | 'cm';
  text: string;
};

function escapeTerminalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightTerminal(code: string, lang: string): string {
  const protectedTokens: TerminalProtectedToken[] = [];
  let cursor = 0;

  while (cursor < code.length) {
    const quote = code[cursor];
    if (quote === '"' || quote === "'") {
      let end = cursor + 1;
      while (end < code.length) {
        if (code[end] === quote && code[end - 1] !== '\\') {
          end += 1;
          break;
        }
        end += 1;
      }
      protectedTokens.push({ start: cursor, end, cls: 'str', text: code.slice(cursor, end) });
      cursor = end;
      continue;
    }
    if (quote === '#') {
      const end = code.indexOf('\n', cursor);
      const commentEnd = end === -1 ? code.length : end;
      protectedTokens.push({ start: cursor, end: commentEnd, cls: 'cm', text: code.slice(cursor, commentEnd) });
      cursor = commentEnd;
      continue;
    }
    cursor += 1;
  }

  const protectedByStart = new Map(protectedTokens.map((token) => [token.start, token]));
  const powershell = lang === 'powershell' || lang === 'pwsh';
  const variablePattern = powershell
    ? /^\$(?:env:)?[A-Za-z_][\w:.-]*/
    : /^\$(?:\{?[A-Za-z_#@*!?-]+\}?)/;
  const parameterPattern = powershell
    ? /^(?:-[A-Za-z?][\w-]*|\/[A-Za-z][\w-]*)/
    : /^(?:--[A-Za-z0-9][\w-]*|--|-[A-Za-z?][\w-]*)/;
  const scalarPattern = powershell
    ? /^(?:\d+(?:\.\d+)?|true|false|null|\$(?:true|false|null))\b/i
    : /^(?:\d+(?:\.\d+)?|true|false|null)\b/i;
  const wordPattern = /^[^\s"'#$&|;<>^=]+/;
  const operators = ['&&', '||', '>>', '<<', '|', ';', '>', '<', '^'];

  let output = '';
  let index = 0;
  let commandPosition = true;

  const appendToken = (text: string, cls?: string) => {
    output += cls
      ? '<span class="hl-' + cls + '">' + escapeTerminalHtml(text) + '</span>'
      : escapeTerminalHtml(text);
  };

  while (index < code.length) {
    const protectedToken = protectedByStart.get(index);
    if (protectedToken) {
      const escaped = escapeTerminalHtml(protectedToken.text);
      const content = protectedToken.cls === 'str'
        ? highlightStringInterpolations(escaped, lang)
        : escaped;
      output += '<span class="hl-' + protectedToken.cls + '">' + content + '</span>';
      index = protectedToken.end;
      continue;
    }

    const current = code[index];
    if (/\s/.test(current)) {
      output += escapeTerminalHtml(current);
      if (current === '\n') {
        const continued = code[index - 1] === '\\' || (powershell && code[index - 1] === String.fromCharCode(96)) || code[index - 2] === '\\';
        if (!continued) commandPosition = true;
      }
      index += 1;
      continue;
    }

    const continuation = (current === '\\' || (powershell && current === String.fromCharCode(96))) &&
      (code[index + 1] === '\n' || (code[index + 1] === '\r' && code[index + 2] === '\n'));
    const operator = operators.find((candidate) => code.startsWith(candidate, index));
    if (continuation) {
      appendToken(current, 'op');
      commandPosition = false;
      index += 1;
      continue;
    }
    if (operator) {
      appendToken(operator, 'op');
      commandPosition = operator !== '^';
      index += operator.length;
      continue;
    }

    const parameter = code.slice(index).match(parameterPattern)?.[0];
    if (parameter) {
      appendToken(parameter, 'param');
      index += parameter.length;
      commandPosition = false;
      continue;
    }

    const variable = code.slice(index).match(variablePattern)?.[0];
    if (variable) {
      const cls = powershell && /^\$(?:true|false|null)$/i.test(variable) ? 'val' : 'var';
      appendToken(variable, cls);
      index += variable.length;
      commandPosition = false;
      continue;
    }

    const scalar = code.slice(index).match(scalarPattern)?.[0];
    if (scalar) {
      appendToken(scalar, 'val');
      index += scalar.length;
      commandPosition = false;
      continue;
    }

    const word = code.slice(index).match(wordPattern)?.[0];
    if (word) {
      appendToken(word, commandPosition ? 'cmd' : undefined);
      commandPosition = false;
      index += word.length;
      continue;
    }

    appendToken(current);
    commandPosition = false;
    index += 1;
  }

  return output;
}
