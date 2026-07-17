# Terminal Command Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, theme-aware command/parameter/value/operator highlighting for explicit Bash, POSIX shell, PowerShell, CMD, and terminal Markdown fences.

**Architecture:** Extend the existing custom highlighter with a dedicated terminal lexer path. Keep UI and VS Code highlighters in parity by applying the same rules and helper structure to both files. Add CSS classes to the UI global code-block stylesheet and its VS Code counterpart if present.

**Tech Stack:** TypeScript, Vitest, regex-based masked token lexer, HTML/CSS.

## Global Constraints

- Terminal mode is explicit only: `bash`, `sh`, `shell`, `zsh`, `powershell`, `pwsh`, `cmd`, `terminal`.
- HTML is escaped before token spans are added.
- Quoted strings/comments are protected from later token rules.
- First executable per command segment gets `hl-cmd`; subcommands remain default.
- No new runtime dependency.
- UI and VS Code behavior remain equivalent.

### Task 1: Add failing terminal highlighter tests

**Files:**
- Modify: `tests/unit/ui/markdown/highlighter.test.ts` (create if absent; otherwise append)
- Modify: `tests/unit/vscode/highlighter.test.ts` (create if absent; otherwise append)

**Interfaces:**
- Consumes: existing exported `highlight(code, lang)` functions.
- Produces: executable examples proving required classes and protected regions.

- [ ] **Step 1: Write tests for Bash token classes**

```ts
const html = highlight('npm run build -- --mode=production && python app.py --count 2 --enabled true', 'bash');
expect(html).toContain('<span class="hl-cmd">npm</span>');
expect(html).toContain('<span class="hl-param">--</span>');
expect(html).toContain('<span class="hl-param">--mode</span>');
expect(html).toContain('<span class="hl-cmd">python</span>');
expect(html).toContain('<span class="hl-param">--count</span>');
expect(html).toContain('<span class="hl-val">2</span>');
expect(html).toContain('<span class="hl-val">true</span>');
expect(html).toContain('<span class="hl-op">&&</span>');
expect(html).not.toContain('<span class="hl-cmd">run</span>');
```

- [ ] **Step 2: Add tests for strings, variables, comments, operators, and continuation**

```ts
const html = highlight('my-app.exe "--help" $HOME \\\n+  --name "value && -x" # --comment', 'sh');
expect(html).toContain('<span class="hl-cmd">my-app.exe</span>');
expect(html).toContain('<span class="hl-str">"--help"</span>');
expect(html).toContain('<span class="hl-var">$HOME</span>');
expect(html).toContain('<span class="hl-op">\\</span>');
expect(html).toContain('<span class="hl-str">"value &amp;&amp; -x"</span>');
expect(html).toContain('<span class="hl-cm"># --comment</span>');
```

- [ ] **Step 3: Add PowerShell and alias tests**

```ts
const html = highlight('pwsh -File .\\build.ps1 -Count 3 -Enabled $true; Write-Host "ok"', 'powershell');
expect(html).toContain('<span class="hl-cmd">pwsh</span>');
expect(html).toContain('<span class="hl-param">-File</span>');
expect(html).toContain('<span class="hl-val">3</span>');
expect(html).toContain('<span class="hl-val">$true</span>');
expect(html).toContain('<span class="hl-op">;</span>');
expect(html).toContain('<span class="hl-cmd">Write-Host</span>');
```

- [ ] **Step 4: Add safety and regression tests**

```ts
expect(highlight('echo "<b> && --help"', 'bash')).toContain('&lt;b&gt;');
expect(highlight('const x = 1;', 'javascript')).toContain('hl-kw');
expect(highlight('my-app --flag', 'text')).not.toContain('hl-cmd');
```

- [ ] **Step 5: Run focused tests and confirm RED**

Run: `rtk vitest run tests/unit/ui/markdown/highlighter.test.ts tests/unit/vscode/highlighter.test.ts`

Expected: FAIL because terminal classes and terminal language rules do not exist yet.

### Task 2: Implement terminal lexer in both highlighters

**Files:**
- Modify: `ui/src/markdown/highlighter.ts`
- Modify: `vscode/src/markdown/highlighter.ts`

**Interfaces:**
- Consumes: `highlight(code, lang)`.
- Produces: escaped HTML with terminal spans matching Task 1.

- [ ] **Step 1: Add terminal language aliases and token constants**

Use `TERMINAL_LANGS` for the eight explicit aliases and route them before generic `RULES` handling.

- [ ] **Step 2: Add masked terminal scanning**

Scan linearly while preserving quoted strings and comments as placeholders. Recognize separators and continuations as operators, flags as parameters, scalar literals as values, variables as existing `hl-var`, and the first executable token after a segment boundary as `hl-cmd`. Treat path-like executable names and names containing `.exe`, `-`, `_`, `/`, or `\\` as valid command tokens.

- [ ] **Step 3: Preserve subcommands and quoted content**

Only set command position at segment start. Once command is consumed, ordinary words stay unwrapped. Placeholder protection must prevent `--flag`, `&&`, and command names inside strings/comments from being classified.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `rtk vitest run tests/unit/ui/markdown/highlighter.test.ts tests/unit/vscode/highlighter.test.ts`

Expected: all new and existing highlighter tests pass.

### Task 3: Add terminal CSS classes and renderer parity tests

**Files:**
- Modify: `ui/src/styles/global/global-code.css`
- No separate VS Code stylesheet; VS Code renderer consumes shared `ui/src/styles/global/global-code.css` theme classes.
- Modify: `tests/unit/ui/markdown/codeRenderer.test.ts`
- Modify: `tests/unit/vscode/codeRenderer.test.ts`

**Interfaces:**
- Consumes: highlighter classes from Task 2.
- Produces: visible theme-aware command/parameter/operator/value colors and renderer coverage.

- [ ] **Step 1: Add renderer tests first**

Assert `renderCodeBlock({ lang: 'bash', content: 'npm --help' }, 'auto')` and PowerShell equivalent include `hl-cmd`/`hl-param`, while existing copy, line-number, and language markup remain present.

- [ ] **Step 2: Add CSS rules**

Define `.hl-cmd`, `.hl-param`, `.hl-op`, and `.hl-val`; use existing theme variables, with muted gray for parameters/operators and scalar values, and accent/function color for commands.

- [ ] **Step 3: Run UI and VS Code tests**

Run: `rtk vitest run --project ui --project vscode`

Expected: all project tests pass.

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md` or relevant Markdown rendering guideline discovered by `rtk find "*guideline*" .`

- [ ] **Step 1: Document supported terminal fences and token behavior**

Include one Bash and one PowerShell example showing supported language tags and visual semantics.

- [ ] **Step 2: Run formatting/type/build checks**

Run: `rtk prettier --check .`, `rtk npm test`, and `rtk npm run build`.

Expected: exit code 0 and no test failures, formatting errors, or build errors.

- [ ] **Step 3: Review diff and commit feature**

Run: `rtk git diff`, then stage only files changed for this feature and commit with `rtk git commit -m "feat(markdown): highlight terminal commands"`.
