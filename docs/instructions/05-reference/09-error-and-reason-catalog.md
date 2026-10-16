---
timestamp: '2026-10-07T00:00:00+07:00'
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
- ui/src/workspace/workspaceEntryMessages.ts
test_scope:
- tests/unit/ui/contexts/appStateReducer-missing.test.ts
- tests/unit/ui/settings-import-export.test.ts
- tests/node/document-conversion-variants.test.mjs
- tests/unit/ui/workspace/workspace-entry-messages.test.ts
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

## Workspace entry operations

Failure reasons of `createWorkspaceEntryResult.reason` and each `deleteWorkspaceEntriesResult.failed[].reason` (`WorkspaceEntryFailureReason`). The UI maps each reason to a translated `sidebar` message key (`workspaceEntryMessages.ts`).

| Reason | Meaning | UI message key |
|---|---|---|
| `exists` | An entry with that name already exists; never overwritten. | `entryErrorExists` |
| `invalid-name` | Empty, `.`/`..`, trailing dot or space, control character or one of `<>:"/\|?*`, or a reserved Windows device name. | `entryErrorInvalid` |
| `outside-workspace` | Path escapes the workspace lexically or through a symlinked parent. | `entryErrorOutside` |
| `protected` | A `.git` segment, or the workspace root itself. | `entryErrorProtected` |
| `missing` | Parent folder or entry not found. | `entryErrorMissing` |
| `permission-denied` | OS or browser permission refused. | `entryErrorPermission` |
| `unsupported` | No workspace, or a single-file workspace. | `entryErrorUnsupported` |
| `failed` | Any other error, including a UI-side timeout. | `entryErrorFailed` |

UI-side name checks run before any request and never reach a host: `empty` (`entryErrorEmpty`, including the untouched `.md` prefill), `invalid` (`entryErrorInvalid`), `reserved` (`entryErrorReserved`), `protected` (`entryErrorProtected`), and a same-name sibling in the loaded tree (`exists`, case-insensitive unless the host platform is Linux). A host failure keeps the inline input open with the mapped message. A partially failed delete shows the `deleteFailed` error notice (`{names}` = failed base names) while succeeded entries are still cleaned up. Messages use `{name}` for the entered name.

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
| Implementation | `ui/src/workspace/workspaceEntryMessages.ts` | Reason and name-check to translated message mapping |
| Verification | `tests/unit/ui/contexts/appStateReducer-missing.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/node/document-conversion-variants.test.mjs` | Automated expectation |
| Verification | `tests/unit/ui/workspace/workspace-entry-messages.test.ts` | Every problem resolves in all nine locales |

---

[← Limits and Thresholds Catalog](08-limits-catalog.md) · [Documentation index](../README.md) · [Localization Catalog →](10-localization-catalog.md)
