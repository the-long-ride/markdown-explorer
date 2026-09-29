export interface RepositoryHistoryLabels {
  readonly search: string;
  readonly noMatches: string;
  readonly loadingMore: string;
  readonly allBranches: string;
}

export const REPOSITORY_HISTORY_LABELS: Record<string, RepositoryHistoryLabels> = {
  en: { search: 'Search commits', noMatches: 'No matching commits.', loadingMore: 'Loading older commits…', allBranches: 'All branches' },
  vi: { search: 'Tìm kiếm commit', noMatches: 'Không có commit phù hợp.', loadingMore: 'Đang tải commit cũ hơn…', allBranches: 'Tất cả nhánh' },
  fr: { search: 'Rechercher des commits', noMatches: 'Aucun commit correspondant.', loadingMore: 'Chargement d’anciens commits…', allBranches: 'Toutes les branches' },
  es: { search: 'Buscar commits', noMatches: 'No hay commits coincidentes.', loadingMore: 'Cargando commits anteriores…', allBranches: 'Todas las ramas' },
  zh: { search: '搜索提交', noMatches: '没有匹配的提交。', loadingMore: '正在加载更早的提交…', allBranches: '所有分支' },
  no: { search: 'Søk i commits', noMatches: 'Ingen samsvarende commits.', loadingMore: 'Laster eldre commits…', allBranches: 'Alle grener' },
  ja: { search: 'コミットを検索', noMatches: '一致するコミットはありません。', loadingMore: '古いコミットを読み込み中…', allBranches: 'すべてのブランチ' },
  ko: { search: '커밋 검색', noMatches: '일치하는 커밋이 없습니다.', loadingMore: '이전 커밋 불러오는 중…', allBranches: '모든 브랜치' },
  ru: { search: 'Поиск коммитов', noMatches: 'Совпадающие коммиты не найдены.', loadingMore: 'Загрузка более старых коммитов…', allBranches: 'Все ветки' },
};

export function getRepositoryHistoryLabels(language?: string): RepositoryHistoryLabels {
  return REPOSITORY_HISTORY_LABELS[language || 'en'] ?? REPOSITORY_HISTORY_LABELS.en;
}
