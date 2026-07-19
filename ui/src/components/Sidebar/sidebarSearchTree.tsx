import { useAppState } from '../../contexts/AppStateContext';
import { FolderChevronIcon, FolderIcon } from '../shared/icons';
import { unicodeIndexOf } from '../../utils/unicodeSearch';
import type { FolderNode, WorkspaceSearchResult } from '../../types';

export interface SearchResultFileNode { kind: 'file'; fsPath: string; fileName: string; relativePath: string; title: string; matches: WorkspaceSearchResult[]; }
export interface SearchResultFolderNode { kind: 'folder'; name: string; path: string; children: SearchResultFolderNode[]; files: SearchResultFileNode[]; }

export function buildSearchResultTree(node: FolderNode, fileMap: Map<string, WorkspaceSearchResult[]>): SearchResultFolderNode | null {
  const files = node.files.flatMap((file) => {
    const matches = fileMap.get(file.fsPath);
    return matches ? [{ kind: 'file' as const, fsPath: file.fsPath, fileName: file.fileName, relativePath: file.relativePath, title: file.title, matches }] : [];
  });
  const children = node.children.flatMap((child) => { const tree = buildSearchResultTree(child, fileMap); return tree ? [tree] : []; });
  return files.length || children.length ? { kind: 'folder', name: node.name, path: node.path, children, files } : null;
}

export function renderHighlightedExcerpt(excerpt: string, query: string) {
  const needle = query.trim().replace(/\s+/g, ' ');
  if (!needle) return excerpt;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let result = unicodeIndexOf(excerpt, needle, 0);
  if (!result) return excerpt;
  while (result) {
    const matchIndex = result.index;
    const matchEnd = matchIndex + result.matchLength;
    if (matchIndex > cursor) pieces.push(excerpt.slice(cursor, matchIndex));
    pieces.push(<strong key={`${matchIndex}-${matchEnd}`}>{excerpt.slice(matchIndex, matchEnd)}</strong>);
    cursor = matchEnd;
    result = unicodeIndexOf(excerpt, needle, cursor);
  }
  if (cursor < excerpt.length) pieces.push(excerpt.slice(cursor));
  return pieces;
}

export function SearchResultFileView({ file, query, collapsedPaths, togglePath }: { file: SearchResultFileNode; query: string; collapsedPaths: Set<string>; togglePath: (path: string) => void }) {
  const { state, navigate } = useAppState();
  const isOpen = !collapsedPaths.has(file.fsPath);
  const displayName = state.settings.showTitle ? file.title : file.fileName;
  const handleClickMatch = (match: WorkspaceSearchResult) => {
    window.dispatchEvent(new CustomEvent('search-jump', { detail: { filePath: file.fsPath, query, matchOrdinal: match.matchOrdinal, matchIndex: match.matchIndex } }));
    navigate(file.fsPath);
  };
  return <div className={`tree-file-search-group${isOpen ? ' is-open' : ''}`}><div className="tree-file-search-header" onClick={() => togglePath(file.fsPath)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePath(file.fsPath); } }}><span className="tree-file-search-chevron"><FolderChevronIcon /></span><span className="tree-file-search-name" title={file.relativePath}>{displayName}</span><span className="tree-file-search-count-badge">{file.matches.length}</span></div>{isOpen && <div className="tree-file-search-matches" role="group">{file.matches.map((match, idx) => <div key={`${file.fsPath}:${match.matchIndex}:${idx}`} className="tree-file-search-match-row" onClick={() => handleClickMatch(match)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleClickMatch(match); } }}>{match.lineNumber && <span className="tree-file-search-match-line">{match.lineNumber}</span>}<span className="tree-file-search-match-excerpt">{renderHighlightedExcerpt(match.excerpt || '', query)}</span></div>)}</div>}</div>;
}

export function SearchResultFolderView({ node, query, collapsedPaths, togglePath }: { node: SearchResultFolderNode; query: string; collapsedPaths: Set<string>; togglePath: (path: string) => void }) {
  const isOpen = !collapsedPaths.has(node.path);
  return <div className={`tree-folder${isOpen ? ' is-open' : ''}`}><div className="tree-folder__header" onClick={() => togglePath(node.path)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePath(node.path); } }}><span className="tree-folder__chevron"><FolderChevronIcon /></span><FolderIcon /><span className="tree-folder__name">{node.name}</span></div>{isOpen && <div className="tree-folder__children" role="group">{node.files.map((file) => <SearchResultFileView key={file.fsPath} file={file} query={query} collapsedPaths={collapsedPaths} togglePath={togglePath} />)}{node.children.map((child) => <SearchResultFolderView key={child.path} node={child} query={query} collapsedPaths={collapsedPaths} togglePath={togglePath} />)}</div>}</div>;
}
