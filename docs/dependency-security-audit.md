# Dependency security audit

Audited on 2026-10-16 for v1.7.1 using pnpm 12.11.2.

The initial pnpm audit reported 12 advisories. Targeted updates removed ten, including all four reported Dependabot findings. Two advisories without published patches remain; no findings are suppressed.

| Dependency | Previous resolution | Patched resolution |
| --- | --- | --- |
| http-cache-semantics | 4.2.0 | 4.3.0 |
| markdown-it | 14.3.0 | 14.3.1 |
| brace-expansion | 5.0.9 | 5.0.12 |
| DOMPurify | 3.4.13 | 3.4.17 |
| fast-uri | 3.1.7 | 3.1.8 |
| KaTeX | 0.16.47 | 0.18.2 |
| source-map-js | 1.2.1 | 1.2.2 |

Security floors are configured in `pnpm-workspace.yaml` and checked against all resolved versions by the Node security contract. The direct UI KaTeX dependency also uses the patched release line.

## Remaining upstream findings

- [braces, GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high: root fast-glob and VSIX secretlint tooling depend on braces 3.0.3 through micromatch. No published patched version.
- [sprintf-js, GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), moderate: VS Code/Electron markdown-them depends on sprintf-js 1.0.3 through mammoth and argparse; Electron packaging also includes optional sprintf-js 1.1.3 through global-agent and roarr. No published patched version.

The full audit still exits with status 1. Dependency paths do not establish exploitability or absence of exposure. Re-run `pnpm audit` when upstream fixes become available; replacing parent dependencies or carrying local patches needs separate compatibility work.

## Verification

The dependency security contract fails against the vulnerable versions and passes after the updates. Node contracts, host and renderer tests, UI/VS Code compile and production builds passed during the audit. Frozen-lockfile installation also passed.

GitHub must scan a commit containing the updated lockfile before remote Dependabot alert state reflects these local fixes.
