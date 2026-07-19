import { describe, expect, test } from 'vitest';
import { highlight } from '../../../vscode/src/markdown/highlighter';

describe('highlight', () => {
  test('returns escaped HTML when lang is missing', () => {
    const result = highlight('const x = 1;', '');
    expect(result).toBe('const x = 1;');
    expect(result).not.toContain('<span');
  });

  test('returns escaped HTML when lang is not recognized', () => {
    const result = highlight('hello', 'unknownlang');
    expect(result).toBe('hello');
    expect(result).not.toContain('<span');
  });

  test('escapes HTML special chars', () => {
    const result = highlight('<script>alert(1)</script>', 'text');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;');
  });

  describe('javascript', () => {
    test('highlights keywords', () => {
      const result = highlight('const x = 1; return x;', 'javascript');
      expect(result).toContain('hl-kw');
      expect(result).toContain('const');
    });

    test('highlights strings', () => {
      const result = highlight('var s = "hello";', 'javascript');
      expect(result).toContain('hl-str');
      expect(result).toContain('"hello"');
    });

    test('highlights template literals with interpolation', () => {
      const result = highlight('let s = `value ${x}`;', 'javascript');
      expect(result).toContain('hl-var');
    });

    test('highlights line comments', () => {
      const result = highlight('// comment\nconst x = 1;', 'javascript');
      expect(result).toContain('hl-cm');
      expect(result).toContain('comment');
    });

    test('highlights block comments', () => {
      const result = highlight('/* block */ const x = 1;', 'javascript');
      expect(result).toContain('hl-cm');
    });

    test('highlights numbers', () => {
      const result = highlight('const x = 42;', 'javascript');
      expect(result).toContain('hl-num');
    });

    test('highlights function calls', () => {
      const result = highlight('foo();', 'javascript');
      expect(result).toContain('hl-func');
    });

    test('highlights class names', () => {
      const result = highlight('class MyClass {}', 'javascript');
      expect(result).toContain('hl-sel');
    });

    test('highlights PascalCase identifiers', () => {
      const result = highlight('MyComponent', 'javascript');
      expect(result).toContain('hl-sel');
    });

    test('highlights type primitives in typescript', () => {
      const result = highlight('let x: string;', 'typescript');
      expect(result).toContain('hl-sel');
    });
  });

  describe('typescript', () => {
    test('highlights TS keywords', () => {
      const result = highlight('interface Foo { bar: string }', 'typescript');
      expect(result).toContain('hl-kw');
    });
  });

  describe('python', () => {
    test('highlights python keywords', () => {
      const result = highlight('def foo(): return True', 'python');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-func');
    });

    test('highlights f-string interpolation', () => {
      const result = highlight('f"value {bar}"', 'python');
      expect(result).toContain('hl-var');
    });

    test('highlights triple-quoted strings', () => {
      const result = highlight('"""docstring"""', 'python');
      expect(result).toContain('hl-str');
    });
  });

  describe('go', () => {
    test('highlights go keywords', () => {
      const result = highlight('func main() { return }', 'go');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-func');
    });
  });

  describe('json', () => {
    test('highlights json keys and values', () => {
      const result = highlight('{ "name": "value", "count": 42 }', 'json');
      expect(result).toContain('hl-attr');
      expect(result).toContain('hl-str');
      expect(result).toContain('hl-num');
    });

    test('highlights json booleans and null', () => {
      const result = highlight('{ "active": true, "data": null }', 'json');
      expect(result).toContain('hl-kw');
    });
  });

  describe('css', () => {
    test('highlights selectors, properties, and values', () => {
      const result = highlight('.foo { color: red; }', 'css');
      expect(result).toContain('hl-sel');
      expect(result).toContain('hl-prop');
    });

    test('highlights CSS comments', () => {
      const result = highlight('/* comment */ .a { color: red; }', 'css');
      expect(result).toContain('hl-cm');
    });

    test('highlights hex colors as numbers', () => {
      const result = highlight('.foo { color: #ff0000; }', 'css');
      expect(result).toContain('hl-num');
    });

    test('highlights CSS custom properties in property position', () => {
      const result = highlight(':root { --main-color: blue; }', 'css');
      expect(result).toContain('hl-prop');
      expect(result).toContain('main-color');
    });
  });

  describe('html', () => {
    test('highlights tags and attributes', () => {
      const result = highlight('<div class="main">content</div>', 'html');
      expect(result).toContain('hl-tag');
      expect(result).toContain('hl-attr');
    });

    test('highlights inline style attributes as CSS', () => {
      const result = highlight('<div style="color: red;">', 'html');
      expect(result).toContain('hl-prop');
    });

    test('processes inline event handler attributes', () => {
      const result = highlight('<button onclick="foo()">', 'html');
      expect(result).toContain('hl-tag');
      expect(result).toContain('button');
    });

    test('highlights <style> blocks as CSS', () => {
      const result = highlight('<style>\n.foo {}\n</style>', 'html');
      expect(result).toContain('hl-sel');
    });

    test('highlights <script> blocks as JS', () => {
      const result = highlight('<script>\nconst x = 1;\n</script>', 'html');
      expect(result).toContain('hl-kw');
    });
  });

  describe('bash', () => {
    test('produces syntax-highlighted output for bash', () => {
      const result = highlight('echo "Hello $USER"', 'bash');
      expect(result).toContain('hl-cmd');
    });

    test('highlights bracket variables', () => {
      const result = highlight('export PATH=${HOME}', 'bash');
      expect(result).toContain('hl-var');
    });

    test('distinguishes executable, flags, values, and operators', () => {
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

    test('protects quoted values and comments while styling shell operators', () => {
      const result = highlight('my-app.exe "--help" $HOME \\\n  --name "value && -x" # --comment', 'sh');
      expect(result).toContain('<span class="hl-cmd">my-app.exe</span>');
      expect(result).toContain('<span class="hl-str">"--help"</span>');
      expect(result).toContain('<span class="hl-var">$HOME</span>');
      expect(result).toContain('<span class="hl-op">\\</span>');
      expect(result).toContain('<span class="hl-str">"value &amp;&amp; -x"</span>');
      expect(result).toContain('<span class="hl-cm"># --comment</span>');
    });

    test('highlights PowerShell command syntax and aliases', () => {
      const result = highlight('pwsh -File .\\build.ps1 -Count 3 -Enabled $true; Write-Host "ok"', 'powershell');
      expect(result).toContain('<span class="hl-cmd">pwsh</span>');
      expect(result).toContain('<span class="hl-param">-File</span>');
      expect(result).toContain('<span class="hl-val">3</span>');
      expect(result).toContain('<span class="hl-val">$true</span>');
      expect(result).toContain('<span class="hl-op">;</span>');
      expect(result).toContain('<span class="hl-cmd">Write-Host</span>');
    });

    test('does not activate terminal highlighting for text fences', () => {
      expect(highlight('my-app --flag', 'text')).not.toContain('hl-cmd');
    });

    test('styles cmd caret escape as an operator', () => {
      const result = highlight('echo one ^ echo two', 'cmd');
      expect(result).toContain('<span class="hl-op">^</span>');
    });
  });

  describe('rust', () => {
    test('highlights rust keywords', () => {
      const result = highlight('fn main() { let x = 42; }', 'rust');
      expect(result).toContain('hl-kw');
    });
  });

  describe('diff', () => {
    test('highlights diff additions, deletions, hunks', () => {
      const result = highlight('+added line\n-removed line\n@@ -1 +1 @@', 'diff');
      expect(result).toContain('hl-diff-add');
      expect(result).toContain('hl-diff-del');
      expect(result).toContain('hl-diff-hunk');
    });

    test('does not highlight +++ as addition', () => {
      const result = highlight('+++ b/file\n+added', 'diff');
      expect(result).toContain('hl-diff-meta');
    });
  });

  describe('sql', () => {
    test('highlights SQL keywords case-insensitively', () => {
      const result = highlight('SELECT * FROM users WHERE id = 1', 'sql');
      expect(result).toContain('hl-kw');
    });
  });

  describe('ruby/bash interpolation', () => {
    test('Ruby hash-brace interpolation', () => {
      const result = highlight('"Hello #{name}"', 'ruby');
      expect(result).toContain('hl-var');
    });
  });

  describe('swift interpolation', () => {
    test('Swift paren interpolation', () => {
      const result = highlight('"\\(value)"', 'swift');
      expect(result).toContain('hl-var');
    });
  });

  describe('basic masking: string contents not highlighted', () => {
    test('keyword highlighting in JS code', () => {
      const result = highlight('const s = "return this";', 'javascript');
      const spans = result.match(/hl-kw/g);
      expect(spans).not.toBeNull();
      expect(spans!.length).toBe(1);
    });
  });

  describe('aliases', () => {
    test('js alias for javascript', () => {
      const result = highlight('const x = 1;', 'js');
      expect(result).toContain('hl-kw');
    });

    test('cs alias for csharp', () => {
      const result = highlight('var x = 1;', 'csharp');
      expect(result).toContain('hl-kw');
    });

    test('golang alias for go', () => {
      const result = highlight('func main() {}', 'golang');
      expect(result).toContain('hl-kw');
    });
  });

  describe('c', () => {
    test('highlights keywords', () => {
      const result = highlight('int main() { return 0; }', 'c');
      expect(result).toContain('hl-kw');
    });

    test('highlights preprocessor directives', () => {
      const result = highlight('#include <stdio.h>', 'c');
      expect(result).toContain('hl-kw');
    });
  });

  describe('cpp', () => {
    test('highlights keywords', () => {
      const result = highlight('int main() { return 0; }', 'cpp');
      expect(result).toContain('hl-kw');
    });
  });

  describe('java', () => {
    test('highlights keywords', () => {
      const result = highlight('public class Foo { return; }', 'java');
      expect(result).toContain('hl-kw');
    });
  });

  describe('php', () => {
    test('highlights keywords and variables', () => {
      const result = highlight('function foo() { $bar = 1; }', 'php');
      expect(result).toContain('hl-kw');
      expect(result).toContain('hl-var');
    });

    test('highlights dollar-brace interpolation in double-quoted string', () => {
      const result = highlight('"value ${x}"', 'php');
      expect(result).toContain('hl-var');
    });

    test('highlights bare dollar variable without braces', () => {
      const result = highlight('"value $VAR"', 'php');
      expect(result).toContain('hl-var');
    });
  });

  describe('ruby', () => {
    test('highlights keywords', () => {
      const result = highlight('def foo; return; end', 'ruby');
      expect(result).toContain('hl-kw');
    });

    test('does NOT interpolate in single-quoted string', () => {
      const result = highlight("'no #{interp}'", 'ruby');
      expect(result).not.toContain('hl-var');
    });
  });

  describe('kotlin', () => {
    test('highlights keywords', () => {
      const result = highlight('fun main() { val x = 1 }', 'kotlin');
      expect(result).toContain('hl-kw');
    });
  });

  describe('scala', () => {
    test('highlights keywords', () => {
      const result = highlight('def foo() { val x = 1 }', 'scala');
      expect(result).toContain('hl-kw');
    });
  });

  describe('elixir', () => {
    test('highlights keywords', () => {
      const result = highlight('def foo do :ok end', 'elixir');
      expect(result).toContain('hl-kw');
    });

    test('highlights hash-brace interpolation', () => {
      const result = highlight('"value #{x}"', 'elixir');
      expect(result).toContain('hl-var');
    });
  });

  describe('dart', () => {
    test('highlights keywords', () => {
      const result = highlight('void main() { var x = 1; }', 'dart');
      expect(result).toContain('hl-kw');
    });
  });

  describe('hack', () => {
    test('highlights keywords', () => {
      const result = highlight('function foo() { $x = 1; }', 'hack');
      expect(result).toContain('hl-kw');
    });
  });

  describe('perl', () => {
    test('highlights keywords', () => {
      const result = highlight('sub foo { my $x = 1; }', 'perl');
      expect(result).toContain('hl-kw');
    });
  });

  describe('r', () => {
    test('highlights keywords', () => {
      const result = highlight('function(x) { return(TRUE) }', 'r');
      expect(result).toContain('hl-kw');
    });
  });

  describe('csharp interpolation', () => {
    test('highlights $-prefixed interpolated string braces', () => {
      const result = highlight('$"Hello {name}"', 'csharp');
      expect(result).toContain('hl-var');
    });

    test('highlights $@ verbatim interpolated string braces', () => {
      const result = highlight('$@"path={dir}"', 'csharp');
      expect(result).toContain('hl-var');
    });

    test('highlights @$ verbatim interpolated string braces', () => {
      const result = highlight('@$"path={dir}"', 'csharp');
      expect(result).toContain('hl-var');
    });

    test('does NOT highlight braces in regular string', () => {
      const result = highlight('"Hello {name}"', 'csharp');
      expect(result).not.toContain('hl-var');
    });
  });

  describe('bash bare dollar', () => {
    test('highlights bare $VAR without braces', () => {
      const result = highlight('"$HOME/bin"', 'bash');
      expect(result).toContain('hl-var');
    });
  });

  describe('single-quoted string interpolation suppression', () => {
    test('bash single-quoted string does NOT get bare-dollar interpolation', () => {
      const result = highlight("'$HOME'", 'bash');
      expect(result).not.toContain('hl-var');
    });

    test('bash raw-quoted string does NOT get interpolation', () => {
      const result = highlight("$'raw $VAR'", 'bash');
      expect(result).not.toContain('hl-var');
    });
  });

  describe('python string edge cases', () => {
    test('raw string does NOT get f-string interpolation', () => {
      const result = highlight('r"value {bar}"', 'python');
      expect(result).not.toContain('hl-var');
    });

    test('triple single-quoted is a single-quoted string', () => {
      const result = highlight("'''no {interp}'''", 'python');
      expect(result).toContain('hl-str');
      expect(result).not.toContain('hl-var');
    });
  });
});
