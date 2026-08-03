import { ChevronRightIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import {
  isCrossTabItem,
  renderHighlightedExcerpt,
  resultKey,
  type SearchResultItem,
} from './searchOverlayModel';

interface ResultsTranslations {
  results: string;
  minimumCharacters: string;
  searchingContents: string;
  noMatches: string;
  fileNameOrPathMatch: string;
  openResult: string;
  loadMore: string;
}

interface SearchOverlayResultsProps {
  results: readonly { item: SearchResultItem; score: number }[];
  selectedResultKey: string | null;
  query: string;
  matchCase: boolean;
  previewEnabled: boolean;
  showTitle: boolean;
  isSearching: boolean;
  hasCrossTabSearch: boolean;
  canLoadMore: boolean;
  translations: ResultsTranslations;
  onSelect: (key: string) => void;
  onOpen: (item: SearchResultItem) => void;
  onLoadMore: () => void;
}

export function SearchOverlayResults({
  results,
  selectedResultKey,
  query,
  matchCase,
  previewEnabled,
  showTitle,
  isSearching,
  hasCrossTabSearch,
  canLoadMore,
  translations: t,
  onSelect,
  onOpen,
  onLoadMore,
}: SearchOverlayResultsProps) {
  const trimmedQuery = query.trim();

  return (
    <section className="search-overlay-results-panel" aria-label={t.results}>
      <div className="search-overlay-section-header">
        <span className="search-overlay-section-title">{t.results}</span>
        <span className="search-overlay-result-count">{results.length}</span>
      </div>
      <div className="search-overlay-results" role="listbox">
        {trimmedQuery.length < 2 && <div className="search-overlay-message">{t.minimumCharacters}</div>}
        {trimmedQuery.length >= 2 && isSearching && results.length === 0 && (
          <div className="search-overlay-message">{t.searchingContents}</div>
        )}
        {trimmedQuery.length >= 2 && !isSearching && results.length === 0 && (
          <div className="search-overlay-message">{t.noMatches}</div>
        )}

        {results.map(({ item }) => {
          const key = resultKey(item);
          const active = key === selectedResultKey;
          return (
            <div
              key={key}
              className={`search-result-row${active ? ' is-active' : ''}${previewEnabled ? ' has-preview' : ''}`}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onSelect(key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(key);
                }
              }}
            >
              <span className="search-result-row__icon">MD</span>
              <div className="search-result-row__content">
                <div className="search-result-row__title">{showTitle ? item.title : item.fileName}</div>
                <div className="search-result-row__path">
                  {isCrossTabItem(item) ? `${item.tabLabel} / ` : ''}{item.relativePath}
                </div>
                <div className="search-result-row__excerpt">
                  {item.excerpt
                    ? renderHighlightedExcerpt(item.excerpt, query, matchCase)
                    : t.fileNameOrPathMatch}
                </div>
              </div>
              {previewEnabled ? null : (
                <TooltipButton
                  type="button"
                  className="search-result-row__open"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(item);
                  }}
                  tooltip={t.openResult}
                  tooltipPos="above"
                  tooltipAlign="right"
                  icon={<ChevronRightIcon size={15} />}
                />
              )}
            </div>
          );
        })}

        {hasCrossTabSearch && canLoadMore && (
          <div className="search-overlay-load-more">
            <button type="button" className="btn" onClick={onLoadMore}>{t.loadMore}</button>
          </div>
        )}
      </div>
    </section>
  );
}
