import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { ExportCenterSourcePanel } from '../../../../ui/src/components/Export/ExportCenterSourcePanel';
import { ExportMultiSelect } from '../../../../ui/src/components/Export/ExportMultiSelect';
import { SearchableSelect } from '../../../../ui/src/components/shared/SearchableSelect';

function file(relativePath: string): MdFile {
  const parts = relativePath.split('/');
  return {
    fsPath: `/workspace/${relativePath}`,
    relativePath,
    parts,
    fileName: parts.at(-1) || relativePath,
    title: relativePath.replace(/\.mdx?$/, ''),
    extension: relativePath.endsWith('.mdx') ? '.mdx' : '.md',
    documentKind: 'markdown',
  };
}

const files = [file('README.md'), file('guide/intro.md'), file('guide/setup.md')];

describe('Export Center source controls', () => {
  it('offers Whole workspace as a first-class source and shows its resolved count', () => {
    render(<ExportCenterSourcePanel
      sourceMode="workspace"
      setSourceMode={() => {}}
      currentFile={files[0]}
      files={files}
      selectedPaths={new Set()}
      onSelectedPathsChange={() => {}}
      folders={['guide']}
      folder="guide"
      setFolder={() => {}}
      folderFileCount={2}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Source mode' }));
    expect(screen.getByRole('option', { name: 'Whole workspace' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Renderable documents: 3')).toBeTruthy();
  });

  it('selects a source mode from the custom dropdown and disables unavailable modes', () => {
    const setSourceMode = vi.fn();
    render(<ExportCenterSourcePanel
      sourceMode="current"
      setSourceMode={setSourceMode}
      currentFile={null}
      files={files}
      selectedPaths={new Set()}
      onSelectedPathsChange={() => {}}
      folders={[]}
      folder=""
      setFolder={() => {}}
      folderFileCount={0}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Source mode' }));
    expect(screen.getByRole('option', { name: 'Current document' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Folder' })).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByRole('option', { name: 'Whole workspace' }));
    expect(setSourceMode).toHaveBeenCalledWith('workspace');
  });

  it('filters document rows and bulk-selects only visible matches with switches', () => {
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set([files[0].fsPath]));
      return <ExportMultiSelect
        ariaLabel="Documents to export"
        items={files.map((item) => ({ id: item.fsPath, label: item.fileName, detail: item.relativePath }))}
        selected={selected}
        onChange={setSelected}
        searchPlaceholder="Search documents"
      />;
    }
    render(<Harness />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search documents' }), { target: { value: 'guide' } });
    expect(screen.queryByText('README.md')).toBeNull();
    expect(screen.getAllByRole('switch')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    for (const control of screen.getAllByRole('switch')) expect(control).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Unselect all' }));
    for (const control of screen.getAllByRole('switch')) expect(control).toHaveAttribute('aria-checked', 'false');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search documents' }), { target: { value: '' } });
    expect(screen.getByRole('switch', { name: 'Include README.md' })).toHaveAttribute('aria-checked', 'true');
  });

  it('uses a searchable keyboard-selectable custom folder dropdown', () => {
    const onChange = vi.fn();
    render(<SearchableSelect
      label="Folder to export"
      value="guide"
      options={[
        { value: 'guide', label: 'guide' },
        { value: 'guide/deep', label: 'guide/deep' },
        { value: 'other', label: 'other' },
      ]}
      onChange={onChange}
      searchPlaceholder="Search folders"
    />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Folder to export' }));
    const search = screen.getByRole('searchbox', { name: 'Search folders' });
    fireEvent.change(search, { target: { value: 'deep' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('guide/deep');
  });
});
