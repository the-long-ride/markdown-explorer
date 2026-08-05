---
timestamp: '2026-08-05T13:14:00+07:00'
name: Localization, Welcome, Terms, and Onboarding
topic: Localization, Welcome, Terms, and Onboarding
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/contexts/translationsData.ts
- ui/src/contexts/welcomeTranslations.ts
- ui/src/contexts/userManualTranslations.ts
- ui/src/components/Content/welcomeTipsContent.ts
- ui/src/components/Content/UserManualTab.tsx
- ui/src/components/Modal/TermsModal.tsx
- ui/src/components/Modal/ThemeOnboardingModal.tsx
test_scope:
- tests/unit/ui/contexts/translations.test.ts
- tests/unit/ui/components/welcome-render.test.tsx
- tests/node/theme-onboarding-dropdown-visibility.test.mjs
- tests/node/user-manual-home.test.mjs
runtime_scope:
- all
- os-dialogs
keywords:
- localization, welcome, terms, and onboarding
---

# Localization, Welcome, Terms, and Onboarding

## Feature intent

Define supported locales, translation fallback, welcome content, first-run terms acceptance, initial theme onboarding, and persistence.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Localization | Translate application labels for nine supported languages. | UI is understandable to broader users. |
| Fallback | Use canonical English when key/locale is unavailable. | No blank labels. |
| Welcome | Features, searchable User manual, shortcuts, tips, and entry actions. | Tasks are discoverable without leaving the app. |
| Terms | Require first-run acknowledgement where configured. | Local-file/security expectations are visible. |
| Theme onboarding | Guide first visual selection once. | New users get a coherent appearance. |

## Interaction and processing flow

```mermaid
flowchart LR
    A[User input or host event] --> B[Validate and normalize]
    B --> C[Update application state]
    C --> D[Render or dispatch host command]
    D --> E[Announce result or recover error]
```

### Supported language codes

`en`, `vi`, `fr`, `es`, `zh`, `no`, `ja`, `ko`, `ru`.

### Non-translatable data

Commands, settings keys, filesystem paths, URLs, code, source document content, and protocol discriminants remain exact. Translations apply only to application presentation strings.

First-run completion uses separate local-storage flags for terms acceptance and theme onboarding.


## User manual contract

- The second homepage tab is **User manual**.
- One local case-insensitive search filters progressive sections: Start here, Reading, Finding, Bookmarks, Customization, and Troubleshooting.
- Task cards may dispatch direct actions for workspace selection, Search, Bookmarks, and Settings.
- Effective shortcut labels come from current settings rather than hard-coded display text.
- Manual copy exists in `en`, `vi`, `fr`, `es`, `zh`, `no`, `ja`, `ko`, and `ru`.
- No-results state and all action labels are keyboard accessible and theme-driven.

## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| First terms | Blocking acknowledgement | Accept |
| Theme onboarding | Style preview/finish | Complete |
| Welcome | Features/manual/shortcuts/tips/actions | Open workspace/document |
| Localized UI | Selected locale | Change/fallback |

## Runtime behavior

| Runtime | Specification |
|---|---|
| All | Shared translation/welcome/modals. |
| OS dialogs | Host/OS locale may differ from application locale. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.


## Acceptance criteria

- [ ] All supported locale codes resolve core labels.
- [ ] Missing translations fall back instead of blanking.
- [ ] Completed first-run steps do not repeat.
- [ ] Changing locale does not alter user document text.
- [x] The searchable User manual renders as the second tab with nine-locale copy and working direct actions.
## UI reference implementation

The sample shows the interaction boundary, not a replacement for the React implementation.

```html
<section class="spec-localization-welcome-terms-and-onboarding" aria-labelledby="localization-welcome-terms-and-onboarding-title">
  <h2 id="localization-welcome-terms-and-onboarding-title">Localization, Welcome, Terms, and Onboarding</h2>
  <p data-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-action>Apply appearance</button>
</section>
```

```css
.spec-localization-welcome-terms-and-onboarding {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  background: var(--surface);
  color: var(--text);
}
.spec-localization-welcome-terms-and-onboarding button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

```javascript
const root = document.querySelector('.spec-localization-welcome-terms-and-onboarding');
const status = root.querySelector('[data-status]');
root.querySelector('[data-action]').addEventListener('click', () => {
  window.PlatformBridge.postMessage({ command: 'updateAppearance', theme: 'dark', themeStyle: 'tokyo-night' });
  status.textContent = 'Request sent';
});
```
## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/contexts/translationsData.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/welcomeTranslations.ts` | Existing welcome content |
| Implementation | `ui/src/contexts/userManualTranslations.ts` | User Manual translation model |
| Implementation | `ui/src/components/Content/UserManualTab.tsx` | Manual search and task cards |
| Implementation | `ui/src/components/Content/welcomeTipsContent.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Modal/TermsModal.tsx` | Active behavior or contract |
| Implementation | `ui/src/components/Modal/ThemeOnboardingModal.tsx` | Active behavior or contract |
| Verification | `tests/unit/ui/contexts/translations.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/components/welcome-render.test.tsx` | Automated expectation |
| Verification | `tests/node/theme-onboarding-dropdown-visibility.test.mjs` | Automated expectation |
| Verification | `tests/node/user-manual-home.test.mjs` | Manual placement, action, and localization contract |

---

[← Keyboard, Accessibility, Focus, and Responsive Behavior](14-keyboard-accessibility-responsive.md) · [Documentation index](../README.md) · [Document Conversion and Preview Quality →](16-document-conversion.md)
