export const exportScopeCoverageManifest: Record<string, string[]> = {
  'electron/core/pdf-export.js': ['tests/unit/electron/pdf-export.test.ts'],
  'ui/src/components/Export/ExportCenterModal.tsx': [
    'tests/unit/ui/components/export-center-modal.test.tsx',
    'tests/unit/ui/components/export-center-close.test.tsx',
  ],
  'ui/src/components/Modal/ScopeViewModal.tsx': ['tests/unit/ui/components/scope-view-modal.test.tsx'],
  'ui/src/components/Modal/scopeHistory.ts': ['tests/unit/ui/components/scope-history.test.ts'],
  'ui/src/export/documentSnapshot.ts': ['tests/unit/ui/export/document-snapshot.test.ts'],
  'ui/src/export/exportHtml.ts': ['tests/unit/ui/export/export-html.test.ts'],
  'ui/src/export/exportModel.ts': ['tests/unit/ui/export/export-model.test.ts'],
  'ui/src/export/pdfExport.ts': ['tests/unit/ui/export/pdf-export-host.test.ts'],
  'ui/src/export/zipStore.ts': ['tests/unit/ui/export/zip-store.test.ts'],
};
