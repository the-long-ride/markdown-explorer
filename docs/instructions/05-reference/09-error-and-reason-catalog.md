---
timestamp: '2026-08-01T22:54:00+07:00'
name: Error and Reason Catalog
topic: Typed failure states, reason codes, and required recovery
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/19-errors-recovery-observability.md
related_docs:
- 01-ui-to-host-command-catalog.md
- 02-host-to-ui-message-catalog.md
source_scope:
- ui/src/types/settings.ts
- ui/src/types/hostMessages.ts
- ui/src/types/content.ts
- ui/src/settings/settingsImportExport.ts
test_scope:
- tests/unit/ui/contexts/appStateReducer-missing.test.ts
- tests/unit/ui/settings-import-export.test.ts
- tests/node/document-conversion-variants.test.mjs
runtime_scope:
- shared
keywords:
- errors
- recovery
- reasons
---

# Error and Reason Catalog

## Workspace unavailable

| Reason | Meaning | Required recovery |
|---|---|---|
| `missing` | Stored path/target no longer exists | Select another target or remove recent entry |
| `locked` | Target exists but access is denied/in use | Preserve recent; fix permission and retry |

## Workspace text resource

| Reason | Meaning | Required behavior |
|---|---|---|
| `outside-workspace` | Resolved path escapes allowed workspace | Reject and warn; never read |
| `missing` | Referenced asset absent | Continue partial preview |
| `unreadable` | Permission/read error | Continue partial preview; actionable warning |
| `unsupported` | Resource/type is not accepted text input | Omit asset |
| `timeout` | UI-side resource request exceeded wait | Abort request and allow retry |

## Settings import

`invalidJson`, `missingData`, `wrongFile`, `unknownSchema`.

## Conversion quality

| Code | Meaning |
|---|---|
| `converted-preview` | Converter produced expected preview |
| `legacy-best-effort` | Output exists with reduced fidelity warning |
| `conversion-failed` | Explanatory failure preview; not blank content |

## Bookmark save and rename

| Reason/code | Meaning | Required behavior |
|---|---|---|
| `target-unavailable` | The selected rendered target cannot be mapped to a valid source-anchored record | Keep the naming state available and show a translated red error toast |
| `storage-unavailable` | Bookmark persistence threw or failed read-back verification | Keep the previous in-memory snapshot and show a translated red error toast |
| `bookmark-persist-failed` | Internal store read-back did not match the serialized write | Convert to `storage-unavailable`; never announce success |
| verified success | Saved or renamed record is present in the read-back snapshot | Show a translated green success toast |

## Update state

`idle`, `downloading`, `downloaded`, `scheduled-on-exit`, `applying`, `error`.

## Navigation and operations

- `navNotFound` preserves current content and identifies unresolved href.
- `workspaceOpenCancelled` ends loading for the matching operation only.
- Cross-tab results may indicate `truncated`, `cancelled`, or `error`.
- Unknown/stale correlated errors are ignored rather than shown against current work.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/settings.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/contexts/appStateReducer-missing.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/node/document-conversion-variants.test.mjs` | Automated expectation |

---

[← Limits and Thresholds Catalog](08-limits-catalog.md) · [Documentation index](../README.md) · [Localization Catalog →](10-localization-catalog.md)
