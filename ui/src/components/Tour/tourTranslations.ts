export interface TourStepCopy {
  title: string;
  desc: string;
  badge: string;
}

export interface TourTranslations {
  startTour: string;
  startTourHint: string;
  next: string;
  back: string;
  skip: string;
  finish: string;
  stepOf: string;
  steps: {
    welcome: TourStepCopy;
    launchpad: TourStepCopy;
    features: TourStepCopy;
    manual: TourStepCopy;
    shortcuts: TourStepCopy;
    navigation: TourStepCopy;
    sidebar: TourStepCopy;
    reader: TourStepCopy;
    toc: TourStepCopy;
    insights: TourStepCopy;
    settings: TourStepCopy;
  };
}

const TRANSLATIONS: Record<string, TourTranslations> = {
  en: {
    startTour: 'Interactive Tour',
    startTourHint: 'Full-app walkthrough',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    finish: 'Finish',
    stepOf: 'Step {current} of {total}',
    steps: {
      welcome: { badge: 'Welcome', title: 'Command-Deck Homepage', desc: 'Your central hub for workspaces, interactive guides, manuals, and quick actions.' },
      launchpad: { badge: 'Launchpad', title: 'Workspace Launchpad', desc: 'Open local folders or files, drag & drop paths, and quickly switch recent workspaces.' },
      features: { badge: 'Capabilities', title: 'Interactive Capabilities', desc: 'Experience sortable tables, table-to-chart conversion, Mermaid diagrams, and local HTML preview.' },
      manual: { badge: 'Manual & AI', title: 'Searchable User Manual', desc: 'Browse built-in documentation and copy tailored 1-click prompts for AI coding assistants.' },
      shortcuts: { badge: 'Customization', title: 'Shortcuts & Themes', desc: 'Review live keyboard shortcuts, customize typography, and switch themes including Cyberpunk.' },
      navigation: { badge: 'Navigation', title: 'Multi-Tab Navigation', desc: 'Switch open markdown files, open new tabs, and split panes for side-by-side reading.' },
      sidebar: { badge: 'Explorer', title: 'Workspace File Tree', desc: 'Browse documentation hierarchies, search filenames, and pin your favorites.' },
      reader: { badge: 'Reader', title: 'Interactive Document Viewer', desc: 'Read styled markdown with live tables, chart rendering, code highlighting, and zoom.' },
      toc: { badge: 'Outline', title: 'Table of Contents', desc: 'Jump instantly between document sections with nested heading tracking and fast navigation.' },
      insights: { badge: 'Insights', title: 'Action Menu & Statistics', desc: 'View word counts, reading times, document outlines, and quick export shortcuts.' },
      settings: { badge: 'Settings', title: 'Preferences & Themes', desc: 'Customize reader font sizes, line heights, system themes, and keyboard bindings.' },
    },
  },
  vi: {
    startTour: 'Hướng dẫn tương tác',
    startTourHint: 'Tham quan toàn bộ ứng dụng',
    next: 'Tiếp tục',
    back: 'Quay lại',
    skip: 'Bỏ qua',
    finish: 'Hoàn tất',
    stepOf: 'Bước {current} / {total}',
    steps: {
      welcome: { badge: 'Chào mừng', title: 'Trung tâm điều khiển', desc: 'Không gian làm việc trung tâm kết hợp hướng dẫn, tài liệu và các tác vụ nhanh.' },
      launchpad: { badge: 'Khởi chạy', title: 'Bảng khởi chạy không gian', desc: 'Mở thư mục, tệp, kéo thả và truy cập nhanh các không gian làm việc gần đây.' },
      features: { badge: 'Tính năng', title: 'Khả năng tương tác cao', desc: 'Khám phá bảng dữ liệu tương tác, vẽ biểu đồ bảng, sơ đồ Mermaid và xem trước HTML.' },
      manual: { badge: 'Tài liệu & AI', title: 'Sổ tay hướng dẫn & AI', desc: 'Tra cứu tài liệu tích hợp và sao chép câu lệnh mẫu 1 chạm cho trợ lý AI.' },
      shortcuts: { badge: 'Tuỳ biến', title: 'Phím tắt & Giao diện', desc: 'Xem nhanh phím tắt, tuỳ biến font chữ và đổi giao diện phong phú gồm Cyberpunk.' },
      navigation: { badge: 'Điều hướng', title: 'Điều hướng đa tab', desc: 'Chuyển đổi giữa các tệp markdown đã mở, mở tab mới và chia đôi màn hình đọc.' },
      sidebar: { badge: 'Khám phá', title: 'Cây thư mục không gian', desc: 'Duyệt cấu trúc tài liệu, tìm kiếm tên tệp và ghim các tài liệu yêu thích.' },
      reader: { badge: 'Trình đọc', title: 'Trình xem tài liệu tương tác', desc: 'Đọc markdown định dạng đẹp với bảng tương tác, biểu đồ trực quan và tô màu mã nguồn.' },
      toc: { badge: 'Mục lục', title: 'Bảng mục lục nhanh', desc: 'Nhảy nhanh đến các phần của tài liệu với theo dõi tiêu đề phân cấp trực quan.' },
      insights: { badge: 'Thông tin', title: 'Menu tác vụ & Thống kê', desc: 'Xem số lượng từ, thời gian đọc ước tính, cấu trúc tài liệu và xuất bản nhanh.' },
      settings: { badge: 'Cài đặt', title: 'Tuỳ chọn & Giao diện', desc: 'Tuỳ chỉnh cỡ chữ đọc, khoảng cách dòng, chủ đề giao diện và phím tắt.' },
    },
  },
  fr: {
    startTour: 'Visite guidée',
    startTourHint: "Visite complète de l'application",
    next: 'Suivant',
    back: 'Retour',
    skip: 'Passer',
    finish: 'Terminer',
    stepOf: 'Étape {current} sur {total}',
    steps: {
      welcome: { badge: 'Bienvenue', title: "Page d'accueil Command-Deck", desc: 'Votre tableau de bord pour les espaces de travail, guides et actions rapides.' },
      launchpad: { badge: 'Lancement', title: "Lanceur d'espaces", desc: 'Ouvrez dossiers ou fichiers, glissez-déposez et retrouvez vos espaces récents.' },
      features: { badge: 'Fonctionnalités', title: 'Capacités interactives', desc: 'Tableaux triables, graphiques instantanés, Mermaid et prévisualisation HTML.' },
      manual: { badge: 'Manuel & IA', title: 'Manuel utilisateur & IA', desc: 'Consultez la documentation et copiez des prompts IA optimisés en un clic.' },
      shortcuts: { badge: 'Personnalisation', title: 'Raccourcis & Thèmes', desc: 'Consultez les raccourcis clavier, la typographie et activez le thème Cyberpunk.' },
      navigation: { badge: 'Navigation', title: 'Navigation multi-onglets', desc: "Basculez entre fichiers markdown ouverts, ouvrez de nouveaux onglets et scindez l'affichage." },
      sidebar: { badge: 'Explorateur', title: 'Arborescence des fichiers', desc: 'Parcourez la hiérarchie des documents, recherchez des fichiers et épinglez vos favoris.' },
      reader: { badge: 'Lecteur', title: 'Lecteur de documents interactif', desc: 'Lisez du markdown stylisé avec tableaux dynamiques, graphiques et coloration syntaxique.' },
      toc: { badge: 'Sommaire', title: 'Table des matières', desc: 'Naviguez instantanément entre les sections du document avec suivi des titres.' },
      insights: { badge: 'Aperçu', title: 'Actions & Statistiques', desc: 'Consultez le nombre de mots, le temps de lecture, les grandes lignes et exportez rapidement.' },
      settings: { badge: 'Paramètres', title: 'Préférences & Thèmes', desc: "Personnalisez la typographie, l'interlignage, les thèmes visuels et les raccourcis." },
    },
  },
  es: {
    startTour: 'Visita guiada',
    startTourHint: 'Recorrido completo de la aplicación',
    next: 'Siguiente',
    back: 'Atrás',
    skip: 'Omitir',
    finish: 'Finalizar',
    stepOf: 'Paso {current} de {total}',
    steps: {
      welcome: { badge: 'Bienvenida', title: 'Página de inicio Command-Deck', desc: 'Centro principal para gestionar espacios de trabajo, guías y acciones rápidas.' },
      launchpad: { badge: 'Lanzador', title: 'Lanzador de espacios', desc: 'Abra carpetas o archivos, arrastre elementos y acceda a espacios recientes.' },
      features: { badge: 'Funciones', title: 'Capacidades interactivas', desc: 'Tablas ordenables, gráficos desde tablas, diagramas Mermaid y visor HTML.' },
      manual: { badge: 'Manual e IA', title: 'Manual de usuario e IA', desc: 'Explore documentación integrada y copie prompts listos para asistentes de IA.' },
      shortcuts: { badge: 'Ajustes', title: 'Atajos y Temas', desc: 'Consulte atajos de teclado, ajustes tipográficos y temas como Cyberpunk.' },
      navigation: { badge: 'Navegación', title: 'Navegación multipestaña', desc: 'Alterne entre archivos markdown abiertos, cree nuevas pestañas y divida paneles de lectura.' },
      sidebar: { badge: 'Explorador', title: 'Árbol de archivos', desc: 'Examine la jerarquía de documentos, busque nombres de archivo y fije sus favoritos.' },
      reader: { badge: 'Lector', title: 'Visor de documentos interactivo', desc: 'Lea markdown estilizado con tablas dinámicas, gráficos, resaltado de sintaxis y zoom.' },
      toc: { badge: 'Índice', title: 'Tabla de contenido', desc: 'Salte al instante entre secciones del documento con seguimiento jerárquico de títulos.' },
      insights: { badge: 'Información', title: 'Menú de acciones y métricas', desc: 'Consulte conteo de palabras, tiempo de lectura, esquema y accesos rápidos de exportación.' },
      settings: { badge: 'Ajustes', title: 'Preferencias y temas', desc: 'Ajuste el tamaño de fuente de lectura, espaciado de línea, temas y atajos de teclado.' },
    },
  },
  zh: {
    startTour: '交互式导览',
    startTourHint: '全功能完整导览',
    next: '下一步',
    back: '上一步',
    skip: '跳过',
    finish: '完成',
    stepOf: '第 {current} 步，共 {total} 步',
    steps: {
      welcome: { badge: '欢迎', title: '控制台主页', desc: '集工作区、交互指南、使用手册与快捷操作于一体的中心控制台。' },
      launchpad: { badge: '启动台', title: '工作区启动台', desc: '打开本地文件夹或文件，拖拽导入路径，快速切换最近使用的工作区。' },
      features: { badge: '核心特性', title: '丰富交互能力', desc: '支持可排序表格、表格生成图表、Mermaid 架构图与本地优先 HTML 预览。' },
      manual: { badge: '手册与 AI', title: '可检索用户手册', desc: '查阅内置文档，并一键复制专为 AI 编码助手定制的上下文提示词。' },
      shortcuts: { badge: '个性化', title: '快捷键与主题', desc: '实时查看键盘快捷键，灵活调节字体排版，自由切换包含赛博朋克的精美主题。' },
      navigation: { badge: '导航', title: '多标签页导航', desc: '在已打开的 Markdown 文件间快速切换，新建标签页并支持分屏并排阅读。' },
      sidebar: { badge: '资源管理', title: '工作区文件树', desc: '浏览层级化文档目录，即时搜索文件名并收藏常用文档。' },
      reader: { badge: '阅读器', title: '交互式文档阅读器', desc: '高品质渲染 Markdown，支持交互式表格、即时图表渲染与代码高亮。' },
      toc: { badge: '大纲', title: '文档目录大纲', desc: '实时跟踪当前标题位置，快速跳转至文档任意章节。' },
      insights: { badge: '概览', title: '操作菜单与统计', desc: '查看字数统计、预计阅读时间、文档摘要及快速导出快捷方式。' },
      settings: { badge: '设置', title: '偏好设置与主题', desc: '灵活定制阅读字号、行距、系统色彩主题及键盘快捷键。' },
    },
  },
  no: {
    startTour: 'Interaktiv omvisning',
    startTourHint: 'Fullstendig app-omvisning',
    next: 'Neste',
    back: 'Tilbake',
    skip: 'Hopp over',
    finish: 'Fullfør',
    stepOf: 'Trinn {current} av {total}',
    steps: {
      welcome: { badge: 'Velkommen', title: 'Kommandodekk Hjemmeside', desc: 'Ditt kontrollpanel for arbeidsområder, guider og hurtighandlinger.' },
      launchpad: { badge: 'Oppstart', title: 'Arbeidsområdestarter', desc: 'Åpne mapper og filer, dra og slipp, og veksle mellom nylige områder.' },
      features: { badge: 'Funksjoner', title: 'Interaktive muligheter', desc: 'Sorterbare tabeller, diagrammer fra tabeller, Mermaid og HTML-visning.' },
      manual: { badge: 'Håndbok & AI', title: 'Søkbar brukermanual', desc: 'Utforsk innebygd dokumentasjon og kopier AI-prompts med ett klikk.' },
      shortcuts: { badge: 'Tilpasning', title: 'Snarveier & Temaer', desc: 'Se tastatursnarveier, juster typografi og velg temaer som Cyberpunk.' },
      navigation: { badge: 'Navigasjon', title: 'Flersidefane-navigasjon', desc: 'Veksle mellom åpnede markdown-filer, åpne nye faner og del visningsruten.' },
      sidebar: { badge: 'Utforsker', title: 'Arbeidsområdets filtré', desc: 'Bla gjennom dokumenthierarkiet, søk etter filnavn og fest dine favoritter.' },
      reader: { badge: 'Leser', title: 'Interaktiv dokumentviser', desc: 'Les stylet markdown med interaktive tabeller, diagrammer og syntaksutheving.' },
      toc: { badge: 'Innhold', title: 'Innholdsfortegnelse', desc: 'Hopp umiddelbart mellom seksjoner med overskriftssporing i sanntid.' },
      insights: { badge: 'Innsikt', title: 'Handlingsmeny og statistikk', desc: 'Se ordtelling, lesetid, dokumentoversikt og raske eksportvalg.' },
      settings: { badge: 'Innstillinger', title: 'Preferanser og temaer', desc: 'Tilpass skriftstørrelse, linjeavstand, systemtemaer og hurtigtaster.' },
    },
  },
  ja: {
    startTour: '対話型ツアー',
    startTourHint: 'アプリ全体のツアー',
    next: '次へ',
    back: '戻る',
    skip: 'スキップ',
    finish: '完了',
    stepOf: 'ステップ {current} / {total}',
    steps: {
      welcome: { badge: 'ようこそ', title: 'コマンドデッキ ホーム', desc: 'ワークスペース、ガイド、マニュアル、クイック操作を集約した統合ハブ。' },
      launchpad: { badge: 'ランチャー', title: 'ワークスペース ランチャー', desc: 'フォルダやファイルを開き、ドラッグ＆ドロップや履歴から素早く切替。' },
      features: { badge: '機能紹介', title: '多彩なインタラクティブ機能', desc: 'ソート対応表、表からのグラフ生成、Mermaid図、ローカルHTMLプレビュー。' },
      manual: { badge: 'マニュアル＆AI', title: '検索可能なユーザーマニュアル', desc: '内蔵ドキュメントの参照や、AIコーディング支援用プロンプトの1クリック取得。' },
      shortcuts: { badge: 'カスタマイズ', title: 'ショートカット＆テーマ', desc: 'リアルタイムショートカット一覧、タイポグラフィ、サイバーパンク等のテーマ。' },
      navigation: { badge: 'ナビゲーション', title: 'マルチタブ ナビゲーション', desc: '開いたMarkdownファイルを素早く切替、新規タブ作成や画面分割での並行閲覧に対応。' },
      sidebar: { badge: 'エクスプローラー', title: 'ワークスペース ファイルツリー', desc: '階層化された文書構造をブラウズし、ファイル名検索やお気に入り登録が可能。' },
      reader: { badge: 'リーダー', title: 'インタラクティブ 文書ビューア', desc: '美しいスタイルでMarkdownを閲覧。動的テーブル、グラフ描画、コード強調表示に対応。' },
      toc: { badge: '目次', title: '目次アウトライン', desc: '見出しの階層を追従しながら、ドキュメント内の各セクションへ瞬時にジャンプ。' },
      insights: { badge: 'インサイト', title: 'アクションメニューと統計', desc: '文字数や読了予測時間の確認、アウトライン表示、エクスポートへのクイックアクセス。' },
      settings: { badge: '設定', title: '環境設定とテーマ', desc: '文字サイズや行間、システムのカラーテーマ、キーバインドを好みにカスタマイズ。' },
    },
  },
  ko: {
    startTour: '대화형 투어',
    startTourHint: '전체 앱 둘러보기',
    next: '다음',
    back: '이전',
    skip: '건너뛰기',
    finish: '완료',
    stepOf: '{total}단계 중 {current}단계',
    steps: {
      welcome: { badge: '환영합니다', title: '커맨드 덱 홈', desc: '워크스페이스, 안내 가이드, 매뉴얼 및 빠른 실행을 위한 통합 허브입니다.' },
      launchpad: { badge: '런치패드', title: '워크스페이스 런치패드', desc: '폴더나 파일을 열고 드래그 앤 드롭하며 최근 작업 영역으로 빠르게 전환하세요.' },
      features: { badge: '주요 기능', title: '인터랙티브 기능', desc: '정렬 가능한 테이블, 테이블 차트 생성, Mermaid 다이어그램, 로컬 HTML 미리보기.' },
      manual: { badge: '매뉴얼 & AI', title: '검색 가능한 사용자 매뉴얼', desc: '기본 설명서를 탐색하고 AI 코딩 도구를 위한 프롬프트를 원클릭으로 복사하세요.' },
      shortcuts: { badge: '사용자 설정', title: '단축키 및 테마', desc: '실시간 키보드 단축키, 타이포그래피 설정 및 사이버펑크를 포함한 테마 전환.' },
      navigation: { badge: '탐색', title: '다중 탭 탐색', desc: '열려 있는 마크다운 파일을 빠르게 전환하고, 새 탭을 열거나 화면을 분할하여 읽으세요.' },
      sidebar: { badge: '탐색기', title: '워크스페이스 파일 트리', desc: '계층형 문서 구조를 탐색하고, 파일명을 검색하며 즐겨찾기를 고정하세요.' },
      reader: { badge: '리더', title: '인터랙티브 문서 뷰어', desc: '인터랙티브 표, 차트 렌더링, 코드 강조 및 확대 기능으로 마크다운을 쾌적하게 읽으세요.' },
      toc: { badge: '목차', title: '문서 목차(TOC)', desc: '실시간 제목 추적으로 문서의 원하는 섹션으로 즉시 이동하세요.' },
      insights: { badge: '인사이트', title: '작업 메뉴 및 통계', desc: '단어 수, 예상 읽기 시간, 문서 개요를 확인하고 빠르게 내보내기를 실행하세요.' },
      settings: { badge: '설정', title: '환경 설정 및 테마', desc: '글꼴 크기, 줄 간격, 시스템 테마 및 단축키 바인딩을 원하는 대로 변경하세요.' },
    },
  },
  ru: {
    startTour: 'Интерактивный тур',
    startTourHint: 'Полный обзор приложения',
    next: 'Далее',
    back: 'Назад',
    skip: 'Пропустить',
    finish: 'Готово',
    stepOf: 'Шаг {current} из {total}',
    steps: {
      welcome: { badge: 'Добро пожаловать', title: 'Панель управления', desc: 'Главный центр рабочих пространств, интерактивных руководств и быстрых действий.' },
      launchpad: { badge: 'Запуск', title: 'Лаунчер рабочих пространств', desc: 'Открывайте папки и файлы, перетаскивайте пути и переключайтесь между недавними.' },
      features: { badge: 'Возможности', title: 'Интерактивные возможности', desc: 'Сортировка таблиц, графики из таблиц, диаграммы Mermaid и HTML-просмотр.' },
      manual: { badge: 'Справка и ИИ', title: 'Руководство пользователя и ИИ', desc: 'Поиск по документации и копирование готовых промптов для ИИ-ассистентов.' },
      shortcuts: { badge: 'Настройки', title: 'Горячие клавиши и темы', desc: 'Клавиатурные сокращения, настройки шрифтов и темы оформления, включая Cyberpunk.' },
      navigation: { badge: 'Навигация', title: 'Вкладки и навигация', desc: 'Переключайтесь между открытыми файлами, открывайте вкладки и разделяйте экран для чтения.' },
      sidebar: { badge: 'Проводник', title: 'Дерево файлов проекта', desc: 'Просматривайте структуру документов, ищите файлы по имени и закрепляйте избранное.' },
      reader: { badge: 'Чтение', title: 'Интерактивный просмотр документов', desc: 'Стилизованный markdown с интерактивными таблицами, диаграммами и подсветкой кода.' },
      toc: { badge: 'Оглавление', title: 'Содержание документа', desc: 'Мгновенно перемещайтесь между разделами с отслеживанием заголовков в реальном времени.' },
      insights: { badge: 'Статистика', title: 'Меню действий и метрики', desc: 'Счетчик слов, время чтения, структура документа и быстрый экспорт.' },
      settings: { badge: 'Настройки', title: 'Параметры и темы', desc: 'Настройка размера шрифта, межстрочного интервала, цветовых схем и горячих клавиш.' },
    },
  },
};

export function getTourTranslations(language = 'en'): TourTranslations {
  const normalized = (language || 'en').toLowerCase().slice(0, 2);
  return TRANSLATIONS[normalized] ?? TRANSLATIONS.en;
}
