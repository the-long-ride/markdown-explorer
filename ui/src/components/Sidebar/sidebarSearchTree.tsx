import { useAppState } from '../../contexts/AppStateContext';
import { FolderChevronIcon, FolderIcon } from '../shared/icons';
import { unicodeIndexOf } from '../../utils/unicodeSearch';
import type { WorkspaceSearchResult } from '../../types';
import type { SearchResultFileNode, SearchResultFolderNode } from './sidebarSearchResultTree';

export function renderHighlightedExcerpt(excerpt: string, query: string, matchCase = false) {
  const needle = query.trim().replace(/\s+/g, ' ');
  if (!needle) return excerpt;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let exactIndex = matchCase ? excerpt.indexOf(needle) : -1;
  let result = matchCase ? null : unicodeIndexOf(excerpt, needle, 0);
  if (matchCase ? exactIndex < 0 : !result) return excerpt;
  while (matchCase ? exactIndex >= 0 : result) {
    const matchIndex = matchCase ? exactIndex : result!.index;
    const matchLength = matchCase ? needle.length : result!.matchLength;
    const matchEnd = matchIndex + matchLength;
    if (matchIndex > cursor) pieces.push(excerpt.slice(cursor, matchIndex));
    pieces.push(<strong key={`${matchIndex}-${matchEnd}`}>{excerpt.slice(matchIndex, matchEnd)}</strong>);
    cursor = matchEnd;
    exactIndex = matchCase ? excerpt.indexOf(needle, cursor) : -1;
    result = matchCase ? null : unicodeIndexOf(excerpt, needle, cursor);
  }
  if (cursor < excerpt.length) pieces.push(excerpt.slice(cursor));
  return pieces;
}

export function SearchResultFileView({ file, query, matchCase, collapsedPaths, togglePath }: { file: SearchResultFileNode; query: string; matchCase: boolean; collapsedPaths: Set<string>; togglePath: (path: string) => void }) {
  const { state, navigate } = useAppState();
  const isOpen = !collapsedPaths.has(file.fsPath);
  const displayName = state.settings.showTitle ? file.title : file.fileName;
  const handleClickMatch = (match: WorkspaceSearchResult) => {
    window.dispatchEvent(new CustomEvent('search-jump', { detail: { filePath: file.fsPath, query, matchOrdinal: match.matchOrdinal, matchIndex: match.matchIndex, matchCase } }));
    navigate(file.fsPath);
  };
  return <div className={`tree-file-search-group${isOpen ? ' is-open' : ''}`}><div className="tree-file-search-header" onClick={() => togglePath(file.fsPath)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePath(file.fsPath); } }}><span className="tree-file-search-chevron"><FolderChevronIcon /></span><span className="tree-file-search-name" title={file.relativePath}>{displayName}</span><span className="tree-file-search-count-badge">{file.matches.length}</span></div>{isOpen && <div className="tree-file-search-matches" role="group">{file.matches.map((match, idx) => <div key={`${file.fsPath}:${match.matchIndex}:${idx}`} className="tree-file-search-match-row" onClick={() => handleClickMatch(match)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleClickMatch(match); } }}>{match.lineNumber && <span className="tree-file-search-match-line">{match.lineNumber}</span>}<span className="tree-file-search-match-excerpt">{renderHighlightedExcerpt(match.excerpt || '', query, matchCase)}</span></div>)}</div>}</div>;
}

export function SearchResultFolderView({ node, query, matchCase, collapsedPaths, togglePath }: { node: SearchResultFolderNode; query: string; matchCase: boolean; collapsedPaths: Set<string>; togglePath: (path: string) => void }) {
  const isOpen = !collapsedPaths.has(node.path);
  return <div className={`tree-folder${isOpen ? ' is-open' : ''}`}><div className="tree-folder__header" onClick={() => togglePath(node.path)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePath(node.path); } }}><span className="tree-folder__chevron"><FolderChevronIcon /></span><FolderIcon /><span className="tree-folder__name">{node.name}</span></div>{isOpen && <div className="tree-folder__children" role="group">{node.files.map((file) => <SearchResultFileView key={file.fsPath} file={file} query={query} matchCase={matchCase} collapsedPaths={collapsedPaths} togglePath={togglePath} />)}{node.children.map((child) => <SearchResultFolderView key={child.path} node={child} query={query} matchCase={matchCase} collapsedPaths={collapsedPaths} togglePath={togglePath} />)}</div>}</div>;
}
