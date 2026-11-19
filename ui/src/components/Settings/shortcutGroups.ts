import type { AppLanguage } from '../../contexts/languageOptions';
import type { ShortcutAction, ShortcutMission, ShortcutScope } from './settingsActions';

type ShortcutGroupTranslations = {
  missions: Record<ShortcutMission, string>;
  descriptions?: Partial<Record<ShortcutMission, string>>;
  scopes: Record<ShortcutScope, string>;
};

const TRANSLATIONS: Record<AppLanguage, ShortcutGroupTranslations> = {
  en: {
    missions: { application: 'Application', document: 'Document', documentTabs: 'Document tabs', markdownEditor: 'Markdown Editor', navigation: 'Navigation', search: 'Search', view: 'View & panels' },
    descriptions: {
      markdownEditor: 'Active when focused inside the Markdown editor. These shortcuts take priority and can override general app shortcuts while editing.',
    },
    scopes: { both: 'All apps', 'non-vscode': 'Desktop & browser', desktop: 'Desktop & browser', electron: 'Desktop app', editor: 'Desktop app & VS Code' },
  },
  vi: {
    missions: { application: 'Ứng dụng', document: 'Tài liệu', documentTabs: 'Tab tài liệu', markdownEditor: 'Trình soạn thảo Markdown', navigation: 'Điều hướng', search: 'Tìm kiếm', view: 'Hiển thị & bảng điều khiển' },
    descriptions: {
      markdownEditor: 'Áp dụng khi con trỏ đang ở trong trình soạn thảo Markdown. Các phím tắt này được ưu tiên và có thể ghi đè phím tắt chung của ứng dụng khi đang chỉnh sửa.',
    },
    scopes: { both: 'Mọi ứng dụng', 'non-vscode': 'Máy tính & trình duyệt', desktop: 'Máy tính & trình duyệt', electron: 'Ứng dụng máy tính', editor: 'Ứng dụng máy tính & VS Code' },
  },
  fr: {
    missions: { application: 'Application', document: 'Document', documentTabs: 'Onglets de document', markdownEditor: 'Éditeur Markdown', navigation: 'Navigation', search: 'Recherche', view: 'Affichage et panneaux' },
    descriptions: {
      markdownEditor: "Actif lorsque le curseur se trouve dans l'éditeur Markdown. Ces raccourcis sont prioritaires et peuvent remplacer les raccourcis généraux de l'application pendant l'édition.",
    },
    scopes: { both: 'Toutes les applications', 'non-vscode': 'Bureau et navigateur', desktop: 'Bureau et navigateur', electron: 'Application de bureau', editor: 'Application de bureau et VS Code' },
  },
  es: {
    missions: { application: 'Aplicación', document: 'Documento', documentTabs: 'Pestañas de documentos', markdownEditor: 'Editor Markdown', navigation: 'Navegación', search: 'Búsqueda', view: 'Vista y paneles' },
    descriptions: {
      markdownEditor: 'Activo cuando el foco está dentro del editor Markdown. Estos atajos tienen prioridad y pueden anular los atajos generales de la aplicación durante la edición.',
    },
    scopes: { both: 'Todas las aplicaciones', 'non-vscode': 'Escritorio y navegador', desktop: 'Escritorio y navegador', electron: 'Aplicación de escritorio', editor: 'Aplicación de escritorio y VS Code' },
  },
  zh: {
    missions: { application: '应用', document: '文档', documentTabs: '文档标签页', markdownEditor: 'Markdown 编辑器', navigation: '导航', search: '搜索', view: '视图与面板' },
    descriptions: {
      markdownEditor: '在 Markdown 编辑器获得焦点时生效。这些快捷键在编辑时具有更高优先级，并可能覆盖通用的应用快捷键。',
    },
    scopes: { both: '所有应用', 'non-vscode': '桌面和浏览器', desktop: '桌面和浏览器', electron: '桌面应用', editor: '桌面应用和 VS Code' },
  },
  no: {
    missions: { application: 'Program', document: 'Dokument', documentTabs: 'Dokumentfaner', markdownEditor: 'Markdown-redigerer', navigation: 'Navigasjon', search: 'Søk', view: 'Visning og paneler' },
    descriptions: {
      markdownEditor: 'Aktiv når markøren er i Markdown-redigereren. Disse hurtigtastene har prioritet og kan overstyre generelle app-snarveier under redigering.',
    },
    scopes: { both: 'Alle apper', 'non-vscode': 'Skrivebord og nettleser', desktop: 'Skrivebord og nettleser', electron: 'Skrivebordsapp', editor: 'Skrivebordsapp og VS Code' },
  },
  ja: {
    missions: { application: 'アプリ', document: 'ドキュメント', documentTabs: 'ドキュメントタブ', markdownEditor: 'Markdown エディター', navigation: 'ナビゲーション', search: '検索', view: '表示とパネル' },
    descriptions: {
      markdownEditor: 'Markdown エディターにフォーカスがあるときに適用されます。編集中はこれらのショートカットが優先され、一般的なアプリのショートカットを上書きすることがあります。',
    },
    scopes: { both: 'すべてのアプリ', 'non-vscode': 'デスクトップとブラウザー', desktop: 'デスクトップとブラウザー', electron: 'デスクトップアプリ', editor: 'デスクトップアプリと VS Code' },
  },
  ko: {
    missions: { application: '앱', document: '문서', documentTabs: '문서 탭', markdownEditor: 'Markdown 편집기', navigation: '탐색', search: '검색', view: '보기 및 패널' },
    descriptions: {
      markdownEditor: 'Markdown 편집기에 포커스가 있을 때 적용됩니다. 편집 중에는 이 단축키가 우선 적용되며 일반 앱 단축키보다 우선할 수 있습니다.',
    },
    scopes: { both: '모든 앱', 'non-vscode': '데스크톱 및 브라우저', desktop: '데스크톱 및 브라우저', electron: '데스크톱 앱', editor: '데스크톱 앱 및 VS Code' },
  },
  ru: {
    missions: { application: 'Приложение', document: 'Документ', documentTabs: 'Вкладки документов', markdownEditor: 'Редактор Markdown', navigation: 'Навигация', search: 'Поиск', view: 'Вид и панели' },
    descriptions: {
      markdownEditor: 'Действует при фокусе в редакторе Markdown. Эти сочетания клавиш имеют приоритет и могут переопределять общие сочетания клавиш приложения во время редактирования.',
    },
    scopes: { both: 'Все приложения', 'non-vscode': 'Рабочий стол и браузер', desktop: 'Рабочий стол и браузер', electron: 'Настольное приложение', editor: 'Настольное приложение и VS Code' },
  },
};

export function getShortcutGroupTranslations(language: string): ShortcutGroupTranslations {
  return TRANSLATIONS[language as AppLanguage] ?? TRANSLATIONS.en;
}

export interface ShortcutGroup {
  mission: ShortcutMission;
  label: string;
  description?: string;
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
      description: translations.descriptions?.[mission],
      actions: groupActions.sort((a, b) =>
        collator.compare(actionLabels[a.id] ?? a.label, actionLabels[b.id] ?? b.label) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => collator.compare(a.label, b.label) || a.mission.localeCompare(b.mission));
}
