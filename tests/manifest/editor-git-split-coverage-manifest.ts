export const editorGitSplitCoverageManifest: Record<string, string[]> = {
  'ui/src/editor/documentSession.ts': ['tests/unit/ui/editor/document-session.test.ts'],
  'ui/src/editor/documentWorkingCopy.ts': ['tests/unit/ui/contexts/content-tab-editing.test.ts'],
  'ui/src/editor/saveDocument.ts': ['tests/unit/ui/editor/save-document.test.ts'],
  'ui/src/contexts/editorUiTranslations.ts': ['tests/unit/ui/contexts/editor-ui-translations.test.ts'],
  'ui/src/components/Content/PlainMarkdownEditor.tsx': ['tests/unit/ui/components/plain-markdown-editor.test.tsx'],
  'electron/workspace/document-write.js': ['tests/unit/electron/document-write.test.ts'],
  'vscode/src/core/panelDocumentWrite.ts': ['tests/unit/vscode/panel-document-write.test.ts'],
};