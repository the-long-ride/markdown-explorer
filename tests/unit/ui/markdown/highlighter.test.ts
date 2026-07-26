import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { highlight } from '../../../../ui/src/markdown/highlighter';

describe('markdown/highlighter', () => {
  it('returns escaped code when no lang is provided', () => {
    const result = highlight('x < y', '');
    expect(result).toContain('lt;');
    expect(result).toContain('x');
  });

  it('returns escaped code for unknown language', () => {
    const result = highlight('const x = 1;', 'unknown-lang-xyz');
    expect(result).toBe('const x = 1;');
  });

  describe('javascript', () => {
    it('highlights keywords', () => {
      const result = highlight('const x = 1;', 'javascript');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-var');
    });

    it('highlights comments', () => {
      const result = highlight('// comment\nconst x = 1;', 'js');
      expect(result).toContain('hl-cm');
    });

    it('highlights strings', () => {
      const result = highlight('"hello"', 'js');
      expect(result).toContain('hl-str');
    });

    it('highlights numbers', () => {
      const result = highlight('42', 'js');
      expect(result).toContain('hl-num');
    });

    it('highlights functions', () => {
      const result = highlight('function foo() {}', 'js');
      expect(result).toContain('hl-func');
    });

    it('highlights class names', () => {
      const result = highlight('class MyClass {}', 'javascript');
      expect(result).toContain('hl-sel');
    });

    it('highlights template literals', () => {
      const result = highlight('`hello ${name}`', 'javascript');
      expect(result).toContain('hl-str');
      expect(result).toContain('hl-var');
    });

    it('highlights block comments', () => {
      const result = highlight('/* block\ncomment */', 'javascript');
      expect(result).toContain('hl-cm');
    });
  });

  describe('typescript', () => {
    it('highlights interface keyword', () => {
      const result = highlight('interface Foo {}', 'typescript');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-sel');
    });

    it('highlights type names', () => {
      const result = highlight('type MyType = string;', 'ts');
      expect(result).toContain('hl-kw');
    });
  });

  describe('python', () => {
    it('highlights def and function name', () => {
      const result = highlight('def hello():\n  pass', 'python');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-func');
    });

    it('highlights comments', () => {
      const result = highlight('# comment', 'py');
      expect(result).toContain('hl-cm');
    });

    it('highlights f-string interpolation', () => {
      const result = highlight('f"hello {name}"', 'python');
      expect(result).toContain('hl-str');
      expect(result).toContain('hl-var');
    });

    it('highlights triple-quoted strings', () => {
      const result = highlight('"""docstring"""', 'python');
      expect(result).toContain('hl-str');
    });
  });

  describe('rust', () => {
    it('highlights fn and function name', () => {
      const result = highlight('fn main() {}', 'rust');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-func');
    });

    it('highlights let and variable name', () => {
      const result = highlight('let x = 1;', 'rs');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-var');
    });
  });

  describe('go', () => {
    it('highlights func and package', () => {
      const result = highlight('package main\nfunc hello() {}', 'go');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-pkg');
      expect(result).toContain('hl-func');
    });

    it('highlights var declarations', () => {
      const result = highlight('var x int', 'golang');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-var');
    });
  });

  describe('bash', () => {
    it('highlights commands', () => {
      const result = highlight('echo "hello"', 'bash');
      expect(result).toContain('hl-cmd');
      expect(result).toContain('hl-str');
    });

    it('highlights variables', () => {
      const result = highlight('$HOME', 'sh');
      expect(result).toContain('hl-var');
    });

    it('highlights ${} interpolation', () => {
      const result = highlight('"${var}"', 'shell');
      expect(result).toContain('hl-var');
    });

    it('highlights comments', () => {
      const result = highlight('# comment', 'bash');
      expect(result).toContain('hl-cm');
    });

    it('distinguishes executable, flags, values, and operators', () => {
      const result = highlight('npm run build -- --mode=production && python app.py --count 2 --enabled true', 'bash');
      expect(result).toContain('<span class="hl-cmd">npm</span>');
      expect(result).toContain('<span class="hl-param">--</span>');
      expect(result).toContain('<span class="hl-param">--mode</span>');
      expect(result).toContain('<span class="hl-cmd">python</span>');
      expect(result).toContain('<span class="hl-param">--count</span>');
      expect(result).toContain('<span class="hl-val">2</span>');
      expect(result).toContain('<span class="hl-val">true</span>');
      expect(result).toContain('<span class="hl-op">&amp;&amp;</span>');
      expect(result).not.toContain('<span class="hl-cmd">run</span>');
    });

    it('defines a dedicated muted terminal color for K-Ink syntax', () => {
      const codeStyles = readFileSync(
        resolve(process.cwd(), 'ui/src/styles/global/global-code.css'),
        'utf8',
      );
      const themeStyles = readFileSync(
        resolve(process.cwd(), 'ui/src/styles/tokens/tokens-pet-themes.css'),
        'utf8',
      );

      expect(codeStyles).toContain('color: var(--hl-terminal-muted);');
      expect(themeStyles).toMatch(
        /\[data-theme-style="pet-k-ink"\]\[data-theme="dark"\],[\s\S]*?--hl-terminal-muted:/,
      );
      expect(themeStyles).toMatch(
        /\[data-theme-style="pet-k-ink"\]\[data-theme="light"\][\s\S]*?--hl-terminal-muted:/,
      );
    });

    it('protects quoted values and comments while styling shell operators', () => {
      const result = highlight('my-app.exe "--help" $HOME \\\n  --name "value && -x" # --comment', 'sh');
      expect(result).toContain('<span class="hl-cmd">my-app.exe</span>');
      expect(result).toContain('<span class="hl-str">"--help"</span>');
      expect(result).toContain('<span class="hl-var">$HOME</span>');
      expect(result).toContain('<span class="hl-op">\\</span>');
      expect(result).toContain('<span class="hl-str">"value &amp;&amp; -x"</span>');
      expect(result).toContain('<span class="hl-cm"># --comment</span>');
    });

    it('highlights PowerShell command syntax and aliases', () => {
      const result = highlight('pwsh -File .\\build.ps1 -Count 3 -Enabled $true; Write-Host "ok"', 'powershell');
      expect(result).toContain('<span class="hl-cmd">pwsh</span>');
      expect(result).toContain('<span class="hl-param">-File</span>');
      expect(result).toContain('<span class="hl-val">3</span>');
      expect(result).toContain('<span class="hl-val">$true</span>');
      expect(result).toContain('<span class="hl-op">;</span>');
      expect(result).toContain('<span class="hl-cmd">Write-Host</span>');
    });

    it('does not activate terminal highlighting for text fences', () => {
      expect(highlight('my-app --flag', 'text')).not.toContain('hl-cmd');
    });

    it('styles cmd caret escape as an operator', () => {
      const result = highlight('echo one ^ echo two', 'cmd');
      expect(result).toContain('<span class="hl-op">^</span>');
    });
  });

  describe('json', () => {
    it('highlights keys and values', () => {
      const result = highlight('{"key": "value", "num": 42}', 'json');
      expect(result).toContain('hl-attr');
      expect(result).toContain('hl-str');
      expect(result).toContain('hl-num');
    });

    it('highlights booleans and null', () => {
      const result = highlight('true false null', 'json');
      expect(result).toContain('hl-kw');
    });
  });

  describe('css', () => {
    it('highlights selectors', () => {
      const result = highlight('.foo { color: red; }', 'css');
      expect(result).toContain('hl-sel');
    });

    it('highlights comments', () => {
      const result = highlight('/* comment */', 'scss');
      expect(result).toContain('hl-cm');
    });

    it('highlights CSS custom properties', () => {
      const result = highlight('--my-var: red;', 'css');
      expect(result).toContain('hl-');
      expect(result).toContain('my-var');
    });
  });

  describe('html', () => {
    it('highlights tags', () => {
      const result = highlight('<div class="foo">', 'html');
      expect(result).toContain('hl-tag');
      expect(result).toContain('hl-attr');
      expect(result).toContain('hl-str');
    });

    it('highlights inline style attribute', () => {
      const result = highlight('<div style="color: red">', 'html');
      expect(result).toContain('hl-attr');
    });

    it('highlights script content', () => {
      const result = highlight('<script>const x = 1;</script>', 'html');
      expect(result).toContain('hl-kw');
    });

    it('highlights style content', () => {
      const result = highlight('<style>.x { color: red; }</style>', 'html');
      expect(result).toContain('hl-sel');
    });

    it('highlights comments', () => {
      const result = highlight('<!-- comment -->', 'html');
      expect(result).toContain('hl-cm');
    });
  });

  describe('xml fragments', () => {
    it('highlights XML tags, attributes, values, and text without a declaration', () => {
      const result = highlight('<catalog id="main"><book available="true">Markdown</book></catalog>', 'xml');

      expect(result).toContain('<span class="hl-tag">catalog</span>');
      expect(result).toContain('<span class="hl-tag">book</span>');
      expect(result).toContain('<span class="hl-attr">id</span>');
      expect(result).toContain('<span class="hl-str">"main"</span>');
      expect(result).toContain('<span class="hl-val">Markdown</span>');
      expect(result).not.toContain('&lt;?xml');
    });

    it('highlights namespace-prefixed names and self-closing tags', () => {
      const result = highlight('<xsl:template xmlns:xsl="urn:xsl"><ui:item data-id="42" /></xsl:template>', 'xhtml');

      expect(result).toContain('<span class="hl-tag">xsl:template</span>');
      expect(result).toContain('<span class="hl-attr">xmlns:xsl</span>');
      expect(result).toContain('<span class="hl-tag">ui:item</span>');
      expect(result).toContain('<span class="hl-attr">data-id</span>');
    });

    it('keeps greater-than characters inside quoted attribute values inside the tag', () => {
      const result = highlight('<rule expression="count > 10">active</rule>', 'xml');

      expect(result).toContain('<span class="hl-str">"count &gt; 10"</span>');
      expect(result).toContain('<span class="hl-val">active</span>');
      expect(result.match(/hl-tag/g)).toHaveLength(2);
    });

    it('highlights comments, CDATA, processing instructions, doctype, and entities', () => {
      const result = highlight(
        '<?xml version="1.0"?><!DOCTYPE note [<!ELEMENT note (#PCDATA)>]><!-- hi --><note><![CDATA[a < b]]>&amp;</note>',
        'svg',
      );

      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-cm');
      expect(result).toContain('hl-str');
      expect(result).toContain('<span class="hl-num">&amp;amp;</span>');
    });
  });

  describe('sql', () => {
    it('highlights SELECT FROM', () => {
      const result = highlight('SELECT * FROM users;', 'sql');
      expect(result).toContain('hl-kw');
    });

    it('highlights comments', () => {
      const result = highlight('-- comment', 'sql');
      expect(result).toContain('hl-cm');
    });
  });

  describe('diff', () => {
    it('highlights additions and deletions', () => {
      const result = highlight('+++ file\n--- file\n+added\n-removed', 'diff');
      expect(result).toContain('hl-diff-meta');
      expect(result).toContain('hl-diff-add');
      expect(result).toContain('hl-diff-del');
    });

    it('highlights hunk headers', () => {
      const result = highlight('@@ -1,3 +1,4 @@', 'diff');
      expect(result).toContain('hl-diff-hunk');
    });
  });

  describe('c', () => {
    it('highlights keywords', () => {
      const result = highlight('int main() { return 0; }', 'c');
      expect(result).toContain('hl-kw');
    });

    it('highlights preprocessor directives', () => {
      const result = highlight('#include <stdio.h>', 'c');
      expect(result).toContain('hl-kw');
    });

    it('highlights struct names', () => {
      const result = highlight('struct Point {}', 'c');
      expect(result).toContain('hl-sel');
    });
  });

  describe('cpp', () => {
    it('highlights class names', () => {
      const result = highlight('class MyClass {}', 'cpp');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-sel');
    });

    it('highlights template keyword', () => {
      const result = highlight('template<typename T>', 'c++');
      expect(result).toContain('hl-kw');
    });
  });

  describe('java', () => {
    it('highlights class and package', () => {
      const result = highlight('package com.example;\nclass Main {}', 'java');
      expect(result).toContain('hl-pkg');
      expect(result).toContain('hl-sel');
    });
  });

  describe('csharp', () => {
    it('highlights class name', () => {
      const result = highlight('class Program {}', 'csharp');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-sel');
    });

    it('highlights interpolated strings', () => {
      const result = highlight('$"hello {name}"', 'cs');
      expect(result).toContain('hl-str');
      expect(result).toContain('hl-var');
    });

    it('highlights verbatim interpolated strings', () => {
      const result = highlight('$@"hello {name}"', 'c#');
      expect(result).toContain('hl-str');
    });
  });

  describe('php', () => {
    it('highlights variables', () => {
      const result = highlight('$variable', 'php');
      expect(result).toContain('hl-var');
    });

    it('highlights function names', () => {
      const result = highlight('function myFunc() {}', 'php');
      expect(result).toContain('hl-func');
    });

    it('highlights comment styles (# and //)', () => {
      expect(highlight('# comment', 'php')).toContain('hl-cm');
      expect(highlight('// comment', 'php')).toContain('hl-cm');
    });
  });

  describe('ruby', () => {
    it('highlights instance and class variables', () => {
      const result = highlight('@instance_var @@class_var', 'ruby');
      expect(result).toContain('hl-var');
    });

    it('highlights def name', () => {
      const result = highlight('def my_method', 'rb');
      expect(result).toContain('hl-func');
    });

    it('skips comments that look like # non-comment in strings', () => {
      const result = highlight('"# not a comment"', 'ruby');
      expect(result).toContain('hl-str');
    });
  });

  describe('swift', () => {
    it('highlights let/var and variable names', () => {
      const result = highlight('let x = 1', 'swift');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-var');
    });

    it('highlights func and function name', () => {
      const result = highlight('func doThing() {}', 'swift');
      expect(result).toContain('hl-func');
    });

    it('highlights string interpolation', () => {
      const result = highlight('"hello \\(name)"', 'swift');
      expect(result).toContain('hl-var');
    });
  });

  describe('kotlin', () => {
    it('highlights val/var and variable names', () => {
      const result = highlight('val x = 1', 'kotlin');
      expect(result).toContain('hl-var');
    });

    it('highlights fun and function name', () => {
      const result = highlight('fun doThing() {}', 'kt');
      expect(result).toContain('hl-func');
    });
  });

  describe('elixir', () => {
    it('highlights defmodule and module name', () => {
      const result = highlight('defmodule MyApp do\nend', 'elixir');
      expect(result).toContain('hl-sel');
    });

    it('highlights atoms when preceded by word character', () => {
      const result = highlight('foo:atom_name', 'ex');
      expect(result).toContain('hl-sel');
    });

    it('does not highlight standalone atom due to word boundary requirement', () => {
      const result = highlight(':atom_name', 'ex');
      expect(result).not.toContain('hl-sel');
    });

    it('highlights # comments', () => {
      const result = highlight('# comment', 'exs');
      expect(result).toContain('hl-cm');
    });
  });

  describe('dart', () => {
    it('highlights class name', () => {
      const result = highlight('class MyClass extends Base {}', 'dart');
      expect(result).toContain('hl-sel');
    });

    it('highlights var/const/final', () => {
      const result = highlight('var x = 1;', 'dart');
      expect(result).toContain('hl-var');
    });
  });

  describe('scala', () => {
    it('highlights def name', () => {
      const result = highlight('def main()', 'scala');
      expect(result).toContain('hl-func');
    });

    it('highlights val/var names', () => {
      const result = highlight('val x = 1', 'scala');
      expect(result).toContain('hl-var');
    });
  });

  describe('hack', () => {
    it('highlights $ variables', () => {
      const result = highlight('$variable', 'hack');
      expect(result).toContain('hl-var');
    });

    it('highlights class name', () => {
      const result = highlight('class MyClass {}', 'hack');
      expect(result).toContain('hl-sel');
    });
  });

  describe('perl', () => {
    it('highlights $ non-keyword variables', () => {
      const result = highlight('$my_var', 'perl');
      expect(result).toContain('hl-var');
    });

    it('highlights @ array variables', () => {
      const result = highlight('@my_array', 'pl');
      expect(result).toContain('hl-var');
    });

    it('highlights % hash variables', () => {
      const result = highlight('%my_hash', 'perl');
      expect(result).toContain('hl-var');
    });

    it('highlights sub name', () => {
      const result = highlight('sub my_sub {}', 'perl');
      expect(result).toContain('hl-func');
    });
  });

  describe('r', () => {
    it('highlights function call', () => {
      const result = highlight('my_func()', 'r');
      expect(result).toContain('hl-func');
    });

    it('highlights keywords', () => {
      const result = highlight('if (TRUE) {}', 'r');
      expect(result).toContain('hl-kw');
    });
  });

  describe('string interpolation', () => {
    it('handles bash ${} interpolation', () => {
      const result = highlight('"${var}"', 'bash');
      expect(result).toContain('hl-var');
    });

    it('handles ruby #{} interpolation', () => {
      const result = highlight('"#{var}"', 'ruby');
      expect(result).toContain('hl-var');
    });

    it('handles Python f-string interpolation', () => {
      const result = highlight('f"hello {name}"', 'python');
      expect(result).toContain('hl-var');
    });

    it('does not interpolate in non-f-string Python', () => {
      const result = highlight('"hello {name}"', 'python');
      expect(result).not.toContain('hl-var');
    });

    it('handles C# interpolated string', () => {
      const result = highlight('$"hello {name}"', 'csharp');
      expect(result).toContain('hl-var');
    });

    it('handles bash bare $ variables', () => {
      const result = highlight('$HOME', 'bash');
      expect(result).toContain('hl-var');
    });

    it('skips bash bare $ in raw strings', () => {
      const result = highlight("r'no $var here'", 'bash');
      expect(result).not.toContain('hl-var');
    });
  });

  describe('phase ordering', () => {
    it('comment inside string stays as string (not re-highlighted as comment)', () => {
      const result = highlight('"// not a comment"', 'javascript');
      expect(result).toContain('hl-str');
      expect(result).not.toContain('hl-cm');
    });

    it('string inside comment stays as comment (not re-highlighted as string)', () => {
      const result = highlight('// "not a string"', 'javascript');
      expect(result).toContain('hl-cm');
    });
  });
});
