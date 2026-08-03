---
timestamp: '2026-08-03T12:01:00+07:00'
name: Localization Catalog
topic: Supported locales and translation boundaries
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/15-localization-welcome-onboarding.md
related_docs:
- 03-settings-catalog.md
source_scope:
- ui/src/contexts/translations.ts
- ui/src/contexts/translationsData.ts
- ui/src/contexts/welcomeTranslations.ts
- ui/src/contexts/translationTypes.ts
test_scope:
- tests/unit/ui/contexts/translations.test.ts
- tests/unit/ui/contexts/search-translations.test.ts
- tests/unit/ui/contexts/welcome-translations.test.ts
- tests/unit/ui/welcomeTranslations.test.ts
runtime_scope:
- shared
keywords:
- localization
- i18n
---

# Localization Catalog

| Code | Locale label |
|---|---|
| `en` | English |
| `vi` | Vietnamese |
| `fr` | French |
| `es` | Spanish |
| `zh` | Chinese |
| `no` | Norwegian |
| `ja` | Japanese |
| `ko` | Korean |
| `ru` | Russian |

## Translation domains

- Shared navigation, search, settings, workspace, content, errors, dialogs, welcome, and theme labels.
- The `search` translation domain covers modal columns, Preview state/loading/failure, workspace inclusion checkboxes, resizer labels, match-case controls, tooltip arrow-open actions, current-file find controls, and sidebar workspace search.
- Welcome tips use a dedicated translation model/fallback.
- OS-native picker/file manager wording may be supplied by host/OS.

## Never translate

- UI→host/host→UI command names.
- Setting/action IDs.
- Paths, URLs, source code, Markdown, user document content, frontmatter keys, and file names unless a separate display title exists.

## Fallback

Unknown locale or missing key uses the canonical fallback, normally English. A language change updates labels without recreating workspace or resetting unrelated state.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/contexts/translations.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/translationsData.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/welcomeTranslations.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/translationTypes.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/contexts/translations.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/contexts/search-translations.test.ts` | All search keys exist in all nine locales |
| Verification | `tests/unit/ui/contexts/welcome-translations.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/welcomeTranslations.test.ts` | Automated expectation |

---

[← Error and Reason Catalog](09-error-and-reason-catalog.md) · [Documentation index](../README.md) · [Core Data Models →](11-core-data-models.md)
