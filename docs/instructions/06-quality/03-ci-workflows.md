---
timestamp: '2026-08-01T22:54:00+07:00'
name: Continuous Integration Workflows
topic: Automated test, release, deployment, store, and statistics workflows
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- .github/workflows/test.yml
- .github/workflows/release.yml
- .github/workflows/deploy-website.yml
- .github/workflows/publish-desktop-stores.yml
- .github/workflows/refresh-marketplace-stats.yml
test_scope:
- tests/contracts/workflow-config.test.ts
- tests/contracts/release-notes.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Continuous Integration Workflows

## Workflow inventory

| Workflow | Responsibility |
|---|---|
| `.github/workflows/test.yml` | Install, test, contracts, coverage/build verification |
| `.github/workflows/release.yml` | Versioned release artifacts and release metadata |
| `.github/workflows/deploy-website.yml` | Build/deploy website experience |
| `.github/workflows/publish-desktop-stores.yml` | Desktop store packaging/publishing |
| `.github/workflows/refresh-marketplace-stats.yml` | Refresh marketplace/statistics data |

## CI contract

- Use the repository package manager and lockfile.
- Run required host/project tests before publishing artifacts.
- Preserve version synchronization across packages/configurations.
- Produce only artifacts matching the intended release channel/platform.
- Keep secrets in CI secret stores; never write them into source/docs/log output.
- A workflow change must pass workflow-config contracts.

## Failure behavior

Publishing jobs stop on build/test/signing/upload failure. A partially successful platform build is reported accurately; it is not represented as a complete multi-platform release.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `.github/workflows/test.yml` | Active behavior or contract |
| Implementation | `.github/workflows/release.yml` | Active behavior or contract |
| Implementation | `.github/workflows/deploy-website.yml` | Active behavior or contract |
| Implementation | `.github/workflows/publish-desktop-stores.yml` | Active behavior or contract |
| Implementation | `.github/workflows/refresh-marketplace-stats.yml` | Active behavior or contract |
| Verification | `tests/contracts/workflow-config.test.ts` | Automated expectation |
| Verification | `tests/contracts/release-notes.test.ts` | Automated expectation |

---

[← Contract, Parity, Dead-Code, and LOC Gates](02-contract-parity-dead-code-loc.md) · [Documentation index](../README.md) · [Build and Release Specification →](04-build-and-release.md)
