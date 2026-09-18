export interface FeatureSettingsTranslations {
  readonly features: string;
  readonly featuresDesc: string;
  readonly historySidebarEnabled: string;
  readonly historySidebarEnabledDesc: string;
  readonly markdownEditingEnabled: string;
  readonly markdownEditingEnabledDesc: string;
}

const FEATURE_SETTINGS_TRANSLATIONS: Record<string, FeatureSettingsTranslations> = {
  en: {
    features: 'Features',
    featuresDesc: 'Choose which Markdown Explorer features are available and how document browsing behaves.',
    historySidebarEnabled: 'History tab in left sidebar',
    historySidebarEnabledDesc: 'Show repository Git history in the left sidebar when the current workspace supports Git history.',
    markdownEditingEnabled: 'Edit with Markdown Explorer',
    markdownEditingEnabledDesc: 'Allow direct Markdown editing inside Markdown Explorer. This is off by default.',
  },
  vi: {
    features: 'Tính năng',
    featuresDesc: 'Chọn các tính năng Markdown Explorer được bật và cách duyệt tài liệu hoạt động.',
    historySidebarEnabled: 'Tab Lịch sử ở thanh bên trái',
    historySidebarEnabledDesc: 'Hiển thị lịch sử Git của kho mã ở thanh bên trái khi không gian làm việc hiện tại hỗ trợ lịch sử Git.',
    markdownEditingEnabled: 'Chỉnh sửa bằng Markdown Explorer',
    markdownEditingEnabledDesc: 'Cho phép chỉnh sửa Markdown trực tiếp trong Markdown Explorer. Mặc định tính năng này tắt.',
  },
  fr: {
    features: 'Fonctionnalités',
    featuresDesc: 'Choisissez les fonctionnalités disponibles et le comportement de navigation des documents.',
    historySidebarEnabled: 'Onglet Historique dans la barre latérale',
    historySidebarEnabledDesc: 'Afficher l’historique Git du dépôt dans la barre latérale lorsque l’espace de travail le permet.',
    markdownEditingEnabled: 'Modifier avec Markdown Explorer',
    markdownEditingEnabledDesc: 'Autoriser la modification directe du Markdown dans Markdown Explorer. Désactivé par défaut.',
  },
  es: {
    features: 'Funciones',
    featuresDesc: 'Elige qué funciones de Markdown Explorer están disponibles y cómo se comporta la navegación.',
    historySidebarEnabled: 'Pestaña Historial en la barra lateral',
    historySidebarEnabledDesc: 'Muestra el historial Git del repositorio en la barra lateral cuando el espacio de trabajo lo admite.',
    markdownEditingEnabled: 'Editar con Markdown Explorer',
    markdownEditingEnabledDesc: 'Permite editar Markdown directamente en Markdown Explorer. Está desactivado por defecto.',
  },
  zh: {
    features: '功能',
    featuresDesc: '选择可用的 Markdown Explorer 功能以及文档浏览方式。',
    historySidebarEnabled: '左侧边栏历史记录标签',
    historySidebarEnabledDesc: '当当前工作区支持 Git 历史记录时，在左侧边栏显示仓库历史。',
    markdownEditingEnabled: '使用 Markdown Explorer 编辑',
    markdownEditingEnabledDesc: '允许直接在 Markdown Explorer 中编辑 Markdown。默认关闭。',
  },
  no: {
    features: 'Funksjoner',
    featuresDesc: 'Velg hvilke Markdown Explorer-funksjoner som er tilgjengelige og hvordan dokumentnavigering fungerer.',
    historySidebarEnabled: 'Historikkfane i venstre sidefelt',
    historySidebarEnabledDesc: 'Vis Git-historikk for repositoriet i sidefeltet når arbeidsområdet støtter Git-historikk.',
    markdownEditingEnabled: 'Rediger med Markdown Explorer',
    markdownEditingEnabledDesc: 'Tillat direkte Markdown-redigering i Markdown Explorer. Dette er av som standard.',
  },
  ja: {
    features: '機能',
    featuresDesc: '利用する Markdown Explorer の機能とドキュメント閲覧の動作を選択します。',
    historySidebarEnabled: '左サイドバーの履歴タブ',
    historySidebarEnabledDesc: '現在のワークスペースが Git 履歴に対応している場合、リポジトリ履歴を左サイドバーに表示します。',
    markdownEditingEnabled: 'Markdown Explorer で編集',
    markdownEditingEnabledDesc: 'Markdown Explorer 内で Markdown を直接編集できるようにします。既定ではオフです。',
  },
  ko: {
    features: '기능',
    featuresDesc: '사용할 Markdown Explorer 기능과 문서 탐색 동작을 선택합니다.',
    historySidebarEnabled: '왼쪽 사이드바 기록 탭',
    historySidebarEnabledDesc: '현재 작업 공간이 Git 기록을 지원할 때 저장소 기록을 왼쪽 사이드바에 표시합니다.',
    markdownEditingEnabled: 'Markdown Explorer로 편집',
    markdownEditingEnabledDesc: 'Markdown Explorer에서 Markdown을 직접 편집할 수 있습니다. 기본값은 꺼짐입니다.',
  },
  ru: {
    features: 'Функции',
    featuresDesc: 'Выберите доступные функции Markdown Explorer и поведение навигации по документам.',
    historySidebarEnabled: 'Вкладка истории на левой панели',
    historySidebarEnabledDesc: 'Показывать историю Git репозитория на левой панели, если текущее рабочее пространство поддерживает Git.',
    markdownEditingEnabled: 'Редактировать в Markdown Explorer',
    markdownEditingEnabledDesc: 'Разрешить прямое редактирование Markdown в Markdown Explorer. По умолчанию выключено.',
  },
};

export function getFeatureSettingsTranslations(language?: string): FeatureSettingsTranslations {
  return FEATURE_SETTINGS_TRANSLATIONS[language || 'en'] ?? FEATURE_SETTINGS_TRANSLATIONS.en;
}
