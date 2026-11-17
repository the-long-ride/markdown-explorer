export interface TipItem {
  title: string;
  desc: string;
  badge?: string;
}

export type TipGroupId =
  | "navigateAndOrganize"
  | "authoringAndHistory"
  | "previewStructuredContent"
  | "workWithRichDocuments"
  | "insightsAndExport"
  | "personalizeMarkdownExplorer";

export const TIP_GROUP_LABELS: Record<string, Record<TipGroupId, string>> = {
  en: {
    navigateAndOrganize: "Navigate, search & organize",
    authoringAndHistory: "Edit, split view & version history",
    previewStructuredContent: "Tables, charts, code & sandboxes",
    workWithRichDocuments: "Diagrams, math, media & document conversion",
    insightsAndExport: "Workspace insights, knowledge graph & export",
    personalizeMarkdownExplorer: "Personalize themes, shortcuts & tour",
  },
  vi: {
    navigateAndOrganize: "Điều hướng, tìm kiếm & sắp xếp",
    authoringAndHistory: "Chỉnh sửa, chế độ chia đôi & lịch sử phiên bản",
    previewStructuredContent: "Bảng, biểu đồ, mã nguồn & hộp cát",
    workWithRichDocuments: "Sơ đồ, toán học, đa phương tiện & chuyển đổi tài liệu",
    insightsAndExport: "Thông tin chi tiết, đồ thị tri thức & xuất tệp",
    personalizeMarkdownExplorer: "Cá nhân hóa giao diện, phím tắt & chuyến tham quan",
  },
  fr: {
    navigateAndOrganize: "Naviguer, rechercher et organiser",
    authoringAndHistory: "Édition, vue fractionnée et historique",
    previewStructuredContent: "Tableaux, graphiques, code et sandboxes",
    workWithRichDocuments: "Diagrammes, maths, médias et conversion de documents",
    insightsAndExport: "Aperçus d'espace, graphe de connaissances et export",
    personalizeMarkdownExplorer: "Personnaliser thèmes, raccourcis et visite guidée",
  },
  es: {
    navigateAndOrganize: "Navegar, buscar y organizar",
    authoringAndHistory: "Edición, vista dividida e historial",
    previewStructuredContent: "Tablas, gráficos, código y sandboxes",
    workWithRichDocuments: "Diagramas, matemáticas, medios y conversión de documentos",
    insightsAndExport: "Estadísticas del espacio, grafo de conocimiento y exportación",
    personalizeMarkdownExplorer: "Personalizar temas, atajos y recorrido interactivo",
  },
  zh: {
    navigateAndOrganize: "导航、搜索与整理",
    authoringAndHistory: "编辑、分屏视图与版本历史",
    previewStructuredContent: "表格、图表、代码与沙箱",
    workWithRichDocuments: "图表、数学公式、媒体与文档转换",
    insightsAndExport: "工作区洞察、知识图谱与导出",
    personalizeMarkdownExplorer: "个性化主题、快捷键与导览",
  },
  no: {
    navigateAndOrganize: "Naviger, søk og organiser",
    authoringAndHistory: "Redigering, delt visning og versjonshistorikk",
    previewStructuredContent: "Tabeller, diagrammer, kode og sandkasser",
    workWithRichDocuments: "Diagrammer, matematikk, medier og dokumentkonvertering",
    insightsAndExport: "Arbeidsområde-innsikt, kunnskapsgraf og eksport",
    personalizeMarkdownExplorer: "Tilpass temaer, snarveier og omvisning",
  },
  ja: {
    navigateAndOrganize: "移動・検索・整理",
    authoringAndHistory: "編集・分割表示・バージョン履歴",
    previewStructuredContent: "表・チャート・コード・サンドボックス",
    workWithRichDocuments: "ダイアグラム・数式・メディア・ドキュメント変換",
    insightsAndExport: "ワークスペース分析・ナレッジグラフ・エクスポート",
    personalizeMarkdownExplorer: "テーマ・ショートカット・ツアーのカスタマイズ",
  },
  ko: {
    navigateAndOrganize: "탐색, 검색 및 정리",
    authoringAndHistory: "편집, 분할 뷰 및 버전 기록",
    previewStructuredContent: "표, 차트, 코드 및 샌드박스",
    workWithRichDocuments: "다이어그램, 수식, 미디어 및 문서 변환",
    insightsAndExport: "작업 공간 인사이트, 지식 그래프 및 내보내기",
    personalizeMarkdownExplorer: "테마, 단축키 및 둘러보기 맞춤 설정",
  },
  ru: {
    navigateAndOrganize: "Навигация, поиск и организация",
    authoringAndHistory: "Редактирование, сплит-вид и история версий",
    previewStructuredContent: "Таблицы, диаграммы, код и песочницы",
    workWithRichDocuments: "Диаграммы, формулы, медиа и конвертация документов",
    insightsAndExport: "Аналитика рабочего пространства, граф знаний и экспорт",
    personalizeMarkdownExplorer: "Персонализация тем, горячих клавиш и тура",
  },
};

export const TIPS_CONTENT: Record<string, Array<TipItem>> = {
  en: [
    { title: "Quick Search vs. Find in Current File Shortcuts", desc: "Separate global search from quick in-file keyword lookup:\n• Desktop App: (Ctrl+F) for global Quick Search, (Ctrl+Shift+F) for all tabs, and bare key (F) for keyword search in the current document.\n• VS Code: (Ctrl+K) for Quick Search, (Ctrl+Shift+K) for all tabs, and bare key (K) for in-file keyword finding.", badge: "Search Shortcuts" },
    { title: "HTML Live Preview Sandbox & Direct Interaction", desc: "Fenced ```html code blocks automatically spawn an isolated iframe sandbox with scripts enabled. Click (Show Preview) on the block header to safely run buttons, inputs, interactive widgets, and scripts directly inside your markdown.", badge: "HTML Sandbox" },
    { title: "Drag & Drop for Instant Workspace Loading", desc: "Drop any workspace folder or Markdown file from your OS file manager directly into the application window to mount the workspace or open the file immediately with zero dialogs.", badge: "Drag & Drop" },
    { title: "Excel-Style Table Interactions & Charts", desc: "Click column headers to sort, use the funnel icon to filter values, and use the search bar to filter rows. Toggle (Bar), (Line), or (Pie) to instantly visualize numeric tables as dynamic Chart.js charts.", badge: "Tables & Charts" },
    { title: "Premium Media Modal & Diagram Zooming", desc: "Click any image or Mermaid diagram to open the backdrop-blur viewer. Scroll (Mouse Wheel) to zoom, click and drag to (pan) high-resolution assets, and use (Left/Right) arrow keys to cycle through document media.", badge: "Media Viewer" },
    { title: "Distraction-Free Focus Mode", desc: "Press (Ctrl+Alt+F) (or click the expand button on the document header) to hide the sidebar, topbar, and Table of Contents for an immersive, distraction-free reading canvas.", badge: "Focus Mode" },
    { title: "Narrow Down Files with Scope Focus", desc: "Working in large mono-repos? Click the Scope Focus icon in the sidebar to isolate only active subfolders and hide noisy files across the entire file tree.", badge: "Scope Focus" },
    { title: "Customize Styles with Theme Remix", desc: "Go to Settings → (Theme Remix) to tweak fonts, line heights, surface styling, and accents across 8+ aesthetics, or import and export custom theme sheets (.json).", badge: "Theme Remix" },
    { title: "Quick Workspace Switcher", desc: "On Desktop, press (Ctrl+P) anytime to open the workspace switcher modal. Jump between recent folders or drag in a new path without touching your mouse.", badge: "Quick Switch" }
  ],
  vi: [
    { title: "Tìm kiếm nhanh tức thì (Quick Search) vs. Tìm trong tệp (Find in File)", desc: "Tách biệt tìm kiếm toàn cục và tìm từ khóa trong tệp:\n• Desktop: (Ctrl+F) tìm nhanh toàn dự án, (Ctrl+Shift+F) tìm trên mọi tab, phím đơn (F) để tìm từ khóa trong tệp hiện tại.\n• VS Code: (Ctrl+K) tìm nhanh, (Ctrl+Shift+K) tìm trên mọi tab, phím đơn (K) để tìm từ khóa trong tệp hiện tại.", badge: "Phím tắt thông minh" },
    { title: "HTML Live Preview Sandbox & Tương tác trực tiếp", desc: "Các khối mã ```html tự động tạo khung iframe sandbox an toàn với script được kích hoạt. Nhấn (Show Preview) trên góc block để chạy thử giao diện, nút bấm, biểu mẫu và script trực tiếp.", badge: "HTML Sandbox" },
    { title: "Kéo & Thả để mở Không gian làm việc nhanh", desc: "Kéo thả bất kỳ thư mục dự án hoặc tập tin Markdown nào từ trình quản lý tệp hệ thống vào cửa sổ ứng dụng để mở và gắn kết không gian làm việc tức thì.", badge: "Kéo & Thả" },
    { title: "Phân tích & Trực quan hóa dữ liệu bảng kiểu Excel", desc: "Nhấp đầu cột để sắp xếp, dùng phễu lọc để lọc giá trị và gõ ô tìm kiếm để lọc hàng. Nhấp (Bar), (Line) hoặc (Pie) để chuyển bảng số liệu thành biểu đồ Chart.js sinh động.", badge: "Bảng & Biểu đồ" },
    { title: "Trình xem đa phương tiện cao cấp & Thu phóng sơ đồ", desc: "Nhấp vào hình ảnh hoặc sơ đồ Mermaid để mở trình xem nền mờ. Lăn chuột ((Mouse Wheel)) để phóng to/thu nhỏ, kéo rê để di chuyển ảnh và phím mũi tên (Trái/Phải) để chuyển ảnh.", badge: "Trình xem đa phương tiện" },
    { title: "Chế độ đọc tập trung (Focus Mode)", desc: "Nhấn (Ctrl+Alt+F) (hoặc nút phóng to ở góc thẻ tài liệu) để ẩn thanh bên, thanh trên và mục lục, mang lại không gian đọc toàn màn hình không phân tâm.", badge: "Đọc tập trung" },
    { title: "Tập trung phạm vi (Scope Focus)", desc: "Làm việc trong dự án lớn? Nhấp biểu tượng Chỉnh sửa phạm vi trên thanh bên để chỉ hiển thị các thư mục cần thiết và ẩn các tệp không liên quan.", badge: "Tập trung phạm vi" },
    { title: "Tự phối màu giao diện (Theme Remix)", desc: "Vào Cài đặt → (Theme Remix) để tùy biến phông chữ, màu sắc, ảnh nền trên hơn 8 phong cách chủ đề, hoặc nhập/xuất cấu hình (.json) chia sẻ cùng nhóm.", badge: "Theme Remix" },
    { title: "Chuyển nhanh không gian làm việc", desc: "Trên Desktop, nhấn (Ctrl+P) bất cứ lúc nào để mở khung chuyển đổi không gian làm việc. Chuyển đổi nhanh giữa các thư mục gần đây mà không cần rời tay khỏi bàn phím.", badge: "Chuyển nhanh" }
  ],
  fr: [
    { title: "Recherche rapide vs Recherche dans le fichier", desc: "Pour accélérer vos recherches, Markdown Explorer distingue la recherche globale de la recherche locale :\n• Desktop : (Ctrl+F) pour la recherche globale, (Ctrl+Shift+F) pour tous les onglets, touche unique (F) pour le fichier actuel.\n• VS Code : (Ctrl+K) pour la recherche globale, (Ctrl+Shift+K) pour tous les onglets, touche unique (K) pour le fichier actuel.", badge: "Raccourcis intelligents" },
    { title: "Sandbox HTML & Interaction directe", desc: "Pour les blocs HTML (e.g. ```html ... ```), Markdown Explorer crée une iframe Sandbox sécurisée ((sandbox=\"allow-scripts\")). Cliquez sur (Show Preview) pour interagir avec les boutons, entrées et scripts en toute sécurité.", badge: "Sandbox HTML" },
    { title: "Glisser-Déposer pour l'espace de travail", desc: "Sur l'application Desktop, glissez un dossier ou un fichier Markdown depuis votre explorateur de fichiers et déposez-le n'importe où dans la fenêtre pour l'ouvrir instantanément.", badge: "Exclusivité Desktop" },
    { title: "Tableaux de style Excel & Graphiques", desc: "Cliquez sur (Bar), (Line) ou (Pie) pour générer des graphiques Chart.js. Triez en cliquant sur les en-têtes, filtrez avec l'icône d'entonnoir, ou recherchez du texte dans la barre au-dessus.", badge: "Actions de tableau" },
    { title: "Visionneuse premium & Zoom de diagrammes", desc: "Cliquez sur une image ou un diagramme Mermaid pour ouvrir une visionneuse floutée. Utilisez (Mouse Wheel) pour zoomer, glissez pour déplacer et utilisez (Left/Right) pour faire défiler.", badge: "Visionneuse" },
    { title: "Mode Focus sans distraction", desc: "Basculez le mode Focus avec (Ctrl+Alt+F) (ou le bouton en haut à gauche du document) pour masquer la barre latérale, la barre supérieure et la table des matières (TOC) pour une lecture propre.", badge: "Mode Focus" },
    { title: "Focalisation de portée (Scope Focus)", desc: "Dans un grand dépôt, cliquez sur l'icône de focalisation en haut de la barre latérale pour afficher uniquement certains fichiers ou sous-dossiers et masquer le reste.", badge: "Scope Focus" },
    { title: "Personnaliser les styles avec Theme Remix", desc: "Allez dans Paramètres → (Theme Remix) pour créer et personnaliser vos thèmes CSS. Réglez les polices, couleurs, images d'arrière-plan, ou importez/exportez des fichiers (.json).", badge: "Theme Remix" },
    { title: "Sélecteur rapide d'espace de travail", desc: "Sur l'application Desktop, appuyez sur (Ctrl+P) à tout moment pour ouvrir le modal (Switch Workspace). Naviguez rapidement entre vos dossiers récents.", badge: "Changement rapide" }
  ],
  es: [
    { title: "Búsqueda rápida vs. Atajos de archivo", desc: "Para acelerar la búsqueda, Markdown Explorer separa la búsqueda global de la local:\n• Escritorio: (Ctrl+F) para búsqueda global, (Ctrl+Shift+F) para todas las pestañas, tecla (F) para el archivo actual.\n• VS Code: (Ctrl+K) para búsqueda global, (Ctrl+Shift+K) para todas las pestañas, tecla (K) para el archivo actual.", badge: "Atajos inteligentes" },
    { title: "Sandbox HTML e interacción directa", desc: "Para bloques HTML (e.g. ```html ... ```), se genera un iframe Sandbox seguro ((sandbox=\"allow-scripts\")). Haga clic en (Show Preview) para ejecutar botones, entradas o scripts de forma segura.", badge: "Sandbox HTML" },
    { title: "Arrastrar y soltar para espacio de trabajo", desc: "En la aplicación de Escritorio, arrastre cualquier carpeta o archivo Markdown desde su explorador del sistema y suéltelo en la ventana para cargarlo al instante.", badge: "Exclusivo de Escritorio" },
    { title: "Tablas estilo Excel y Gráficos", desc: "Use los botones (Bar), (Line) o (Pie) para renderizar gráficos Chart.js. Ordene al hacer clic en cabeceras, filtre con el embudo o busque texto sobre la tabla.", badge: "Acciones de tabla" },
    { title: "Visor premium y Zoom de diagramas", desc: "Haga clic en una imagen o diagrama Mermaid para abrir el visor. Ruede la rueda del mouse ((Mouse Wheel)) para hacer zoom, arrastre para mover o use (Left/Right) para cambiar de imagen.", badge: "Visor multimedia" },
    { title: "Modo Enfoque sin distracciones", desc: "Active el modo Enfoque con (Ctrl+Alt+F) (o el botón arriba a la izquierda del documento) para ocultar las barras laterales, superiores y el índice (TOC) para una lectura limpia.", badge: "Modo Enfoque" },
    { title: "Enfoque de alcance (Scope Focus)", desc: "¿Trabaja en un repositorio enorme? Haga clic en el icono en la barra lateral para seleccionar archivos o carpetas específicas y ocultar el resto del árbol.", badge: "Scope Focus" },
    { title: "Personalizar estilos con Theme Remix", desc: "Vaya a Ajustes → (Theme Remix) para crear y personalizar sus temas de diseño. Ajuste fuentes, colores, imágenes de fondo e importe/exporte archivos (.json).", badge: "Theme Remix" },
    { title: "Selector rápido de espacio de trabajo", desc: "En la aplicación de Escritorio, pulse (Ctrl+P) para abrir el modal (Switch Workspace). Salte rápidamente entre carpetas recientes o arrastre una nueva carpeta.", badge: "Cambio rápido" }
  ],
  zh: [
    { title: "快速搜索与文件内查找", desc: "为提高检索速度，Markdown Explorer 将全局搜索与文件内查找进行了分离：\n• 桌面端：按 (Ctrl+F) 打开全局快速搜索，按 (Ctrl+Shift+F) 在所有标签页中搜索。按单键 (F) 在当前文件中查找。\n• VS Code：按 (Ctrl+K) 打开全局快速搜索，按 (Ctrl+Shift+K) 在所有标签页中搜索。按单键 (K) 在当前文件中查找。", badge: "智能快捷键" },
    { title: "HTML 预览沙箱与交互", desc: "当您编写 HTML 代码块（e.g. ```html ... ```）时，Markdown Explorer 会自动创建一个安全的沙箱 iframe（(sandbox=\"allow-scripts\")）。点击 (Show Preview) 按钮即可安全地与按钮、输入框及脚本进行交互。", badge: "HTML 沙箱" },
    { title: "拖拽加载工作区", desc: "在桌面端应用中，您无需手动点击打开对话框。只需从系统文件管理器中拖入任何工作区文件夹或 Markdown 文件到窗口中，即可立即加载或打开。", badge: "桌面端专属" },
    { title: "Excel 风格表格与图表", desc: "点击表格上方的 (Bar)、(Line) 或 (Pie) 按钮，可将数值表格一键转换为 Chart.js 图表。您还可以点击表头进行排序，使用漏斗图标过滤行，或在上方搜索栏中检索行内容。", badge: "表格操作" },
    { title: "高级媒体窗口与图表缩放", desc: "点击图片或 Mermaid 图表可打开高级背景模糊弹窗。使用鼠标滚轮 ((Mouse Wheel)) 进行缩放，按住并拖动进行平移，使用 (Left/Right) 方向键可循环切换文档中的所有图片。", badge: "媒体窗口" },
    { title: "无干扰专注模式", desc: "使用 (Ctrl+Alt+F) 快捷键（或点击文档卡片左上角的缩放按钮）可开启专注模式，隐藏侧边栏、顶部栏和目录树（TOC），带来干净的全宽阅读体验。", badge: "专注模式" },
    { title: "工作区范围专注 (Scope Focus)", desc: "在庞大的仓库中工作？点击侧边栏顶部的范围编辑按钮，仅勾选需要查看的文件或子文件夹。Markdown Explorer 将临时过滤文件树以保持专注。", badge: "Scope Focus" },
    { title: "使用 Theme Remix 自定义样式", desc: "进入设置 → (Theme Remix) 来创建和定制您自己的主题。您可以细调字号、主色调、背景图片，或导入/导出 (.json) 主题配置文件。", badge: "Theme Remix" },
    { title: "快速工作区切换器", desc: "在桌面端应用中，按 (Ctrl+P) 可打开 (Switch Workspace) 弹窗。无需离开键盘，即可在最近文件夹之间快速切换或拖入新文件夹加载。", badge: "快速切换" }
  ],
  no: [
    { title: "Hurtigsøk vs. Søk i gjeldende fil", desc: "For raskere søk skiller Markdown Explorer mellom globalt søk og søk i filen:\n• Skrivebordsapp: Trykk (Ctrl+F) for globalt hurtigsøk, (Ctrl+Shift+F) for alle faner. Trykk enkeltknappen (F) for søk i gjeldende fil.\n• VS Code: Trykk (Ctrl+K) for globalt hurtigsøk, (Ctrl+Shift+K) for alle faner. Trykk enkeltknappen (K) for søk i gjeldende fil.", badge: "Smarte snarveier" },
    { title: "HTML Sandbox & Interaksjon", desc: "Når du skriver HTML-kodeblokker (e.g. ```html ... ```), oppretter Markdown Explorer en sikker, isolert iframe Sandbox ((sandbox=\"allow-scripts\")). Klikk på (Show Preview) for å kjøre knapper, input eller skript trygt.", badge: "HTML Sandbox" },
    { title: "Dra & slipp for arbeidsområde", desc: "I skrivebordsappen trenger du ikke bruke filutforsker-dialoger. Bare dra en mappe eller Markdown-fil fra OS-et og slipp den i programvinduet for å åpne den.", badge: "Skrivebord-eksklusiv" },
    { title: "Excel-tabellinteraksjoner & Diagrammer", desc: "Klikk på (Bar), (Line) eller (Pie) over tabellen for å tegne Chart.js-diagrammer. Klikk på kolonneoverskrifter for å sortere, traktikonet for å filtrere, eller søk i søkefeltet over.", badge: "Tabellhandlinger" },
    { title: "Premium medievisning & Zoom", desc: "Klikk på et bilde eller Mermaid-diagram for å åpne visningen. Rull med musehjulet ((Mouse Wheel)) for å zoome, klikk og dra for å panorere, eller bruk (Left/Right) piltastene.", badge: "Medievisning" },
    { title: "Distrasjonsfri Fokusmodus", desc: "Slå på Fokusmodus med (Ctrl+Alt+F) (oder klikk på knappen øverst til venstre) for å skjule sidemeny, topplinje og innholdsfortegnelse (TOC) for en ren leseopplevelse.", badge: "Fokusmodus" },
    { title: "Omfangsfokus (Scope Focus)", desc: "Jobber du i et stort depot? Klikk på omfangsknappen øverst i sidemenyen for å velge kun filene og mappene du vil se, og skjule alt annet.", badge: "Scope Focus" },
    { title: "Tilpass stiler med Theme Remix", desc: "Gå til Innstillinger → (Theme Remix) for å opprette og tilpasse dine egne designtemaer. Endre skrifttyper, farger, bakgrunnsbilde, eller importer/eksporter (.json)-filer.", badge: "Theme Remix" },
    { title: "Hurtigbytte av arbeidsområde", desc: "I skrivebordsappen kan du trykke (Ctrl+P) for å åpne (Switch Workspace)-vinduet og bytte raskt mellom nylige mapper.", badge: "Raskt bytte" }
  ],
  ja: [
    { title: "クイック検索 vs. ファイル内検索", desc: "検索スピード向上のため、グローバル検索とファイル内検索を分離しています：\n• デスクトップ：(Ctrl+F) で全体クイック検索、(Ctrl+Shift+F) で全タブ検索。(F) 単体キーで現在のファイル内検索。\n• VS Code：(Ctrl+K) で全体クイック検索、(Ctrl+Shift+K) で全タブ検索。(K) 単体キーで現在のファイル内検索。", badge: "スマートショートカット" },
    { title: "HTML プレビューサンドボックス", desc: "HTMLコードブロック（e.g. ```html ... ```）記述时、安全な iframe サンドボックス（(sandbox=\"allow-scripts\")）を自動作成します。(Show Preview) ボタンをクリックすると、ボタンや入力を安全に実行できます。", badge: "HTML サンドボックス" },
    { title: "ドラッグ＆ドロップで即時読み込み", desc: "デスクトップ版では、ダイアログを操作する必要はありません。ファイルマネージャーから任意のフォルダやファイルをウィンドウにドラッグ＆ドロップするだけで、読み込めます。", badge: "デスクトップ専用" },
    { title: "Excel風テーブル操作 & グラフ", desc: "テーブル上部の (Bar)、(Line)、(Pie) ボタンをクリックして Chart.js グラフに変換します。ヘッダーをクリックしてソート、漏斗アイコンでフィルタ、上部バーでテキスト検索が可能です。", badge: "テーブル操作" },
    { title: "高級メディアビューア & ズーム", desc: "画像や Mermaid 図をクリックして背景ぼかしウィンドウを起動します。マウスホイール（(Mouse Wheel)）でズーム、ドラッグで移動、(Left/Right) 方向キーで画像を切り替えられます。", badge: "メディアビューア" },
    { title: "集中読書フォーカスモード", desc: "(Ctrl+Alt+F)（またはドキュメント左上のズームボタン）でフォーカスモードを切り替え、サイドバー、トップバー、目次（TOC）を隠して全幅で読書に集中できます。", badge: "フォーカスモード" },
    { title: "スコープフォーカス (Scope Focus)", desc: "巨大なプロジェクトですか？サイドバー上部のスコープ編集アイコンをクリックして、表示したい特定のファイルやフォルダのみを選択してファイルツリーを整理します。", badge: "スコープフォーカス" },
    { title: "スタイルのカスタマイズ (Theme Remix)", desc: "設定 → (Theme Remix) で独自のスタイルを作成・カスタマイズできます。フォントサイズ、アクセントカラー、背景画像を調整し、(.json) ファイルでインポート/エクスポートできます。", badge: "Theme Remix" },
    { title: "クイックワークスペーススイッチャー", desc: "デスクトップ版では、(Ctrl+P) を押すだけで (Switch Workspace) 画面が開きます。キーボードから手を離さずに最近のフォルダを素早く切り替えられます。", badge: "クイック切り替え" }
  ],
  ko: [
    { title: "빠른 검색 vs. 현재 파일 검색", desc: "검색 속도를 높이기 위해 전역 검색과 파일 내 검색을 분리했습니다:\n• 데스크톱: (Ctrl+F)로 전역 빠른 검색, (Ctrl+Shift+F)로 모든 탭 검색. 단일 키 (F)로 현재 파일 내 검색.\n• VS Code: (Ctrl+K)로 전역 빠른 검색, (Ctrl+Shift+K)로 모든 탭 검색. 단일 키 (K)로 현재 파일 내 검색.", badge: "스마트 단축키" },
    { title: "HTML 프리뷰 샌드박스 및 상호작용", desc: "HTML 코드 블록(e.g. ```html ... ```) 작성 시 안전한 iframe 샌드박스((sandbox=\"allow-scripts\"))를 생성합니다. (Show Preview) 버튼을 클릭해 버튼, 입력 또는 스크립트를 안전하게 조작해 보세요.", badge: "HTML 샌드박스" },
    { title: "드래그 앤 드롭 작업 공간 로드", desc: "데스크톱 앱에서는 대화 상자를 누를 필요가 없습니다. 탐색기에서 작업 공간 폴더나 마크다운 파일을 드래그하여 앱 창에 놓기만 하면 즉시 마운트되어 열립니다.", badge: "데스크톱 전용" },
    { title: "Excel 스타일 표 상호작용 & 차트", desc: "표 위의 (Bar), (Line), (Pie) 버튼을 눌러 Chart.js 차트로 즉시 변환하세요. 헤더 클릭으로 정렬, 깔때기 아이콘으로 필터링, 위쪽 검색바에서 행 내용을 검색할 수 있습니다.", badge: "표 기능" },
    { title: "프리미엄 미디어 모달 & 줌", desc: "이미지나 Mermaid 다이어그램을 클릭해 흐릿한 배경의 모달을 여세요. 마우스 휠((Mouse Wheel))로 확대/축소, 드래그로 이동, (Left/Right) 방향키로 이미지를 전환할 수 있습니다.", badge: "미디어 모달" },
    { title: "집중 독서 포커스 모드", desc: "(Ctrl+Alt+F)(또는 문서 카드 왼쪽 위의 확장 버튼)로 포커스 모드를 켜서 사이드바, 상단바, 목차(TOC)를 숨기고 깔끔하게 가로 전체 화면으로 읽으세요.", badge: "포커스 모드" },
    { title: "범위 집중 (Scope Focus)", desc: "방대한 저장소인가요? 사이드바 상단의 범위 편집 아이콘을 클릭하여 보고 싶은 특정 파일이나 폴더만 선택하고 나머지는 파일 트리에서 숨길 수 있습니다.", badge: "범위 집중" },
    { title: "스타일 맞춤 설정 (Theme Remix)", desc: "설정 → (Theme Remix)로 이동하여 나만의 스타일 테마를 만드세요. 글꼴 크기, 강조 색상, 배경 이미지를 세밀하게 조정한 후 (.json) 파일로 내보내거나 가져올 수 있습니다.", badge: "Theme Remix" },
    { title: "빠른 작업 공간 전환기", desc: "데스크톱 앱에서 (Ctrl+P)를 누르면 언제든지 (Switch Workspace) 창이 열립니다. 최근 폴더 간 이동이나 새 폴더 드래그 로드를 키보드로 신속하게 처리할 수 있습니다.", badge: "빠른 전환" }
  ],
  ru: [
    { title: "Быстрый поиск vs. Поиск в файле", desc: "Для ускорения поиска мы разделили глобальный поиск и поиск в файле:\n• Desktop-приложение: (Ctrl+F) для глобального поиска, (Ctrl+Shift+F) для всех вкладок. Одиночная клавиша (F) для поиска в текущем файле.\n• VS Code: (Ctrl+K) для глобального поиска, (Ctrl+Shift+K) для всех вкладок. Одиночная клавиша (K) для поиска в текущем файле.", badge: "Умные клавиши" },
    { title: "Песочница HTML и интерактивность", desc: "Для HTML-блоков (e.g. ```html ... ```) создается безопасная песочница iframe ((sandbox=\"allow-scripts\")). Нажмите (Show Preview) для взаимодействия с кнопками, полями ввода и скриптами.", badge: "Песочница HTML" },
    { title: "Перетаскивание рабочих областей", desc: "В Desktop-приложении вам не нужно открывать диалоги. Просто перетащите папку проекта или файл Markdown из проводника в окно программы для мгновенного открытия.", badge: "Только для Desktop" },
    { title: "Таблицы Excel и диаграммы", desc: "Нажмите кнопки (Bar), (Line) или (Pie) над таблицей для мгновенного построения диаграмм Chart.js. Сортируйте кликом по заголовкам, фильтруйте воронкой или ищите в строке поиска.", badge: "Действия таблиц" },
    { title: "Премиум-просмотр медиа и зум", desc: "Кликните по картинке или Mermaid-диаграмме для открытия модального окна с размытием фона. Используйте колесико мыши ((Mouse Wheel)) для зума, тяните для перемещения и переключайте стрелками (Left/Right).", badge: "Просмотр медиа" },
    { title: "Режим чтения во весь экран", desc: "Включите режим фокуса с помощью (Ctrl+Alt+F) (или кнопки слева вверху документа), чтобы скрыть боковую панель, верхнюю панель и содержание (TOC) для чистого чтения.", badge: "Режим фокуса" },
    { title: "Фокусировка области (Scope Focus)", desc: "Работаете в огромном репозитории? Нажмите иконку редактирования области вверху боковой панели, чтобы выбрать конкретные файлы и скрыть все лишние папки.", badge: "Scope Focus" },
    { title: "Кастомизация стилей (Theme Remix)", desc: "Перейдите в Настройки → (Theme Remix) для создания собственных тем оформления. Настройте шрифты, цвета, фоновые изображения или импортируйте темы в формате (.json).", badge: "Theme Remix" },
    { title: "Переключение рабочей области", desc: "В Desktop-приложении нажмите (Ctrl+P), чтобы открыть модальное окно (Switch Workspace) для быстрого переключения между недавними проектами.", badge: "Переключение" }
  ]
};
