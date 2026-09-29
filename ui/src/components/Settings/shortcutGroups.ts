import type { AppLanguage } from '../../contexts/languageOptions';
import type { ShortcutAction, ShortcutMission, ShortcutScope } from './settingsActions';

type ShortcutGroupTranslations = {
  missions: Record<ShortcutMission, string>;
  scopes: Record<ShortcutScope, string>;
};

const TRANSLATIONS: Record<AppLanguage, ShortcutGroupTranslations> = {
  en: {
    missions: { application: 'Application', document: 'Document', documentTabs: 'Document tabs', navigation: 'Navigation', search: 'Search', view: 'View & panels' },
    scopes: { both: 'All apps', 'non-vscode': 'Desktop & browser', desktop: 'Desktop & browser', electron: 'Desktop app', editor: 'Desktop app & VS Code' },
  },
  vi: {
    missions: { application: 'Ứng dụng', document: 'Tài liệu', documentTabs: 'Tab tài liệu', navigation: 'Điều hướng', search: 'Tìm kiếm', view: 'Hiển thị & bảng điều khiển' },
    scopes: { both: 'Mọi ứng dụng', 'non-vscode': 'Máy tính & trình duyệt', desktop: 'Máy tính & trình duyệt', electron: 'Ứng dụng máy tính', editor: 'Ứng dụng máy tính & VS Code' },
  },
  fr: {
    missions: { application: 'Application', document: 'Document', documentTabs: 'Onglets de document', navigation: 'Navigation', search: 'Recherche', view: 'Affichage et panneaux' },
    scopes: { both: 'Toutes les applications', 'non-vscode': 'Bureau et navigateur', desktop: 'Bureau et navigateur', electron: 'Application de bureau', editor: 'Application de bureau et VS Code' },
  },
  es: {
    missions: { application: 'Aplicación', document: 'Documento', documentTabs: 'Pestañas de documentos', navigation: 'Navegación', search: 'Búsqueda', view: 'Vista y paneles' },
    scopes: { both: 'Todas las aplicaciones', 'non-vscode': 'Escritorio y navegador', desktop: 'Escritorio y navegador', electron: 'Aplicación de escritorio', editor: 'Aplicación de escritorio y VS Code' },
  },
  zh: {
    missions: { application: '应用', document: '文档', documentTabs: '文档标签页', navigation: '导航', search: '搜索', view: '视图与面板' },
    scopes: { both: '所有应用', 'non-vscode': '桌面和浏览器', desktop: '桌面和浏览器', electron: '桌面应用', editor: '桌面应用和 VS Code' },
  },
  no: {
    missions: { application: 'Program', document: 'Dokument', documentTabs: 'Dokumentfaner', navigation: 'Navigasjon', search: 'Søk', view: 'Visning og paneler' },
    scopes: { both: 'Alle apper', 'non-vscode': 'Skrivebord og nettleser', desktop: 'Skrivebord og nettleser', electron: 'Skrivebordsapp', editor: 'Skrivebordsapp og VS Code' },
  },
  ja: {
    missions: { application: 'アプリ', document: 'ドキュメント', documentTabs: 'ドキュメントタブ', navigation: 'ナビゲーション', search: '検索', view: '表示とパネル' },
    scopes: { both: 'すべてのアプリ', 'non-vscode': 'デスクトップとブラウザー', desktop: 'デスクトップとブラウザー', electron: 'デスクトップアプリ', editor: 'デスクトップアプリと VS Code' },
  },
  ko: {
    missions: { application: '앱', document: '문서', documentTabs: '문서 탭', navigation: '탐색', search: '검색', view: '보기 및 패널' },
    scopes: { both: '모든 앱', 'non-vscode': '데스크톱 및 브라우저', desktop: '데스크톱 및 브라우저', electron: '데스크톱 앱', editor: '데스크톱 앱 및 VS Code' },
  },
  ru: {
    missions: { application: 'Приложение', document: 'Документ', documentTabs: 'Вкладки документов', navigation: 'Навигация', search: 'Поиск', view: 'Вид и панели' },
    scopes: { both: 'Все приложения', 'non-vscode': 'Рабочий стол и браузер', desktop: 'Рабочий стол и браузер', electron: 'Настольное приложение', editor: 'Настольное приложение и VS Code' },
  },
};

export function getShortcutGroupTranslations(language: string): ShortcutGroupTranslations {
  return TRANSLATIONS[language as AppLanguage] ?? TRANSLATIONS.en;
}

export interface ShortcutGroup {
  mission: ShortcutMission;
  label: string;
  actions: ShortcutAction[];
}

export function groupShortcutActions(
  actions: readonly ShortcutAction[],
  actionLabels: Record<string, string | undefined>,
  language: string,
): ShortcutGroup[] {
  const translations = getShortcutGroupTranslations(language);
  const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true });
  const grouped = new Map<ShortcutMission, ShortcutAction[]>();
  for (const action of actions) {
    const group = grouped.get(action.mission) ?? [];
    group.push(action);
    grouped.set(action.mission, group);
  }
  return [...grouped.entries()]
    .map(([mission, groupActions]) => ({
      mission,
      label: translations.missions[mission],
      actions: groupActions.sort((a, b) =>
        collator.compare(actionLabels[a.id] ?? a.label, actionLabels[b.id] ?? b.label) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => collator.compare(a.label, b.label) || a.mission.localeCompare(b.mission));
}
