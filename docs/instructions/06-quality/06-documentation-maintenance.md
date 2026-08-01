---
timestamp: '2026-08-01T22:54:00+07:00'
name: Documentation Maintenance
topic: How application changes keep this specification complete and accurate
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope: []
test_scope: []
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Documentation Maintenance

## Change impact matrix

| Source change | Required documentation update |
|---|---|
| New user action/flow | New or revised use-case document and coverage row |
| New UI feature | Feature spec with HTML/CSS/JavaScript example |
| New command/message | Both protocol catalog and all affected runtimes/use cases |
| New setting/storage key | Settings/storage/reference and import/export rules |
| New file/format | File catalog, conversion feature/use case, security/limits |
| New runtime behavior | Runtime spec and parity matrix |
| New failure reason | Error catalog and recovery acceptance criteria |
| Build/store change | Quality/release/install documentation |

## Required validation

- YAML frontmatter parses and contains all required properties.
- Every relative Markdown navigation link resolves.
- Every `source_scope` and `test_scope` path exists.
- Every UI specification includes HTML, CSS, and JavaScript fences.
- Command/message catalogs exactly match active typed unions.
- Settings/theme/use-case coverage gates pass.
- No placeholder markers or obsolete command names appears.
- ZIP integrity test passes.

## Review rule

Review behavior against source, not against older docs. A copied old statement is not evidence.

---

[← Installers, Stores, and File Associations](05-installers-stores-associations.md) · [Documentation index](../README.md) · [Release Acceptance Matrix →](07-release-acceptance-matrix.md)
