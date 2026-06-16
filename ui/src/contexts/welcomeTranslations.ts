// =============================================================================
// contexts/welcomeTranslations.ts — Welcome Screen Translations
// =============================================================================

export interface WelcomeTranslations {
  hero: {
    title: string;
    descDesktop: string;
    descVSCode: string;
    createdBy: string;
    repository: string;
    license: string;
    desktopRecommendation: string;
    macosInstallBtn: string;
  };
  privacy: {
    title: string;
    desc: string;
    bullets: string[];
  };
  features: {
    title: string;
    tree: { title: string; desc: string };
    search: { title: string; desc: string };
    tables: { title: string; desc: string };
    charts: { title: string; desc: string };
    highlight: { title: string; desc: string };
    modal: { title: string; desc: string };
    shortcuts: { title: string; vscodeDesc: string; desc: string };
  };
  shortcutsTable: {
    headers: { action: string; shortcut: string };
    rows: {
      back: string;
      backShortcut: string;
      forward: string;
      forwardShortcut: string;
      welcome: string;
      settings: string;
      theme: string;
      zoomModal: string;
      zoomModalShortcut: string;
      refresh: string;
      collapse: string;
      expand: string;
      workspace: string;
      sidebar: string;
      zoomIn: string;
      zoomInShortcut: string;
      zoomOut: string;
      zoomOutShortcut: string;
    };
    note: string;
  };
  issues: {
    title: string;
    hint: string;
    linkText: string;
    bullets: string[];
  };
}

export const WELCOME_TRANSLATIONS: Record<string, WelcomeTranslations> = {
  en: {
    hero: {
      title: "Welcome to Markdown Explorer",
      descDesktop: "A premium, local-first documentation viewer and navigator for Desktop.",
      descVSCode: "A premium, local-first documentation viewer and navigator for Visual Studio Code.",
      createdBy: "Created by",
      repository: "Repository",
      license: "License",
      desktopRecommendation: "For the best experience, we recommend using the Desktop App.",
      macosInstallBtn: "Install Guide",
    },
    privacy: {
      title: "🔒 100% Private, Offline-First & Independent",
      desc: "We believe your documentation should be kept completely private. Markdown Explorer operates entirely on your local machine:",
      bullets: [
        "No Tracking & Telemetry: We do not collect or send any usage data, analytics, or keystrokes.",
        "No External Libraries: This app/extension does not package or load any third-party external trackers, analytic scripts, or telemetry libraries.",
        "100% Offline Support: All markdown parsing, scanning, rendering, and quick search indexing are executed locally with zero remote dependencies.",
      ],
    },
    features: {
      title: "How to Use All Features",
      tree: {
        title: "📁 Workspace Navigation Tree",
        desc: "The left sidebar displays an interactive folder structure scanning all markdown files in your workspace. Simply click any file to open it in preview mode. You can filter files by name using the search bar at the top of the sidebar.",
      },
      search: {
        title: "🔍 Instant Quick Search",
        desc: "Press the search shortcut from anywhere in the preview window to open the quick search overlay. Type a query to search markdown filenames, paths, titles, and file contents. Use the mouse or keyboard to select and open a file.",
      },
      tables: {
        title: "📋 Excel-Style Interactive Data Tables",
        desc: "Standard markdown tables are automatically converted to interactive tables. You can sort columns by clicking their headers, use the funnel icon on headers to filter rows by values, and type inside the search bar above the table to search row contents.",
      },
      charts: {
        title: "📊 One-Click Table-to-Chart Switcher",
        desc: "For tables containing numeric columns, a view switcher will appear. Click the Bar, Line, or Pie buttons to instantly visualize the table data as an interactive Chart.js chart.",
      },
      highlight: {
        title: "🎨 Syntax Highlighting & Mermaid Diagrams",
        desc: "Enjoy high-contrast, premium syntax highlighting for code blocks (TypeScript, JavaScript, etc.) with custom overrides for comments and optional properties. Mermaid sequence, flowchart, and class diagrams render natively on the client with 100% strict offline containment.",
      },
      modal: {
        title: "🖼️ Zoomable Backdrop Media Modal",
        desc: "Click any image or diagram within your documents to launch a premium backdrop-blur modal. You can scroll to zoom in/out, click and drag to pan across high-res graphics, or use the arrow keys to cycle through all images in the document.",
      },
      shortcuts: {
        title: "⌨️ Keyboard Shortcuts & Navigation",
        vscodeDesc: "Use Ctrl+Shift+M (Cmd+Shift+M on Mac) to open Markdown Explorer, and Ctrl+Alt+V (Cmd+Alt+V on Mac) or click the editor title button to quickly toggle the Markdown Explorer view on a markdown file.",
        desc: "Control and navigate your documentation easily using standard and customizable keyboard shortcuts:",
      },
    },
    shortcutsTable: {
      headers: { action: "Action", shortcut: "Default Shortcut" },
      rows: {
        back: "Back to previous file",
        backShortcut: "or Mouse Back button",
        forward: "Go to next file",
        forwardShortcut: "or Mouse Forward button",
        welcome: "Go to welcome page",
        settings: "Open settings modal",
        theme: "Toggle light/dark mode",
        zoomModal: "Zoom in/out image (in image modal)",
        zoomModalShortcut: "Scroll Mouse Wheel",
        refresh: "Refresh current file",
        collapse: "Collapse all heading groups",
        expand: "Expand all heading groups",
        workspace: "Go to workspace selection page",
        sidebar: "Toggle sidebar",
        zoomIn: "Zoom in",
        zoomInShortcut: "or Wheel Up",
        zoomOut: "Zoom out",
        zoomOutShortcut: "or Wheel Down",
      },
      note: "Note: You can change all keyboard shortcuts from the Settings Modal (click settings button or press Ctrl+I).",
    },
    issues: {
      title: "🐞 Report Issues & Get Help",
      hint: "Before opening a new issue, please check the repository Issues page to avoid duplicates:",
      linkText: "Repository Issues",
      bullets: [
        "Search existing issues first to see if someone already reported it.",
        "Include steps to reproduce, your OS, and whether you use the VS Code extension or Desktop app.",
        "Attach a small sample markdown file or screenshot and any console errors if available.",
      ],
    },
  },
  vi: {
    hero: {
      title: "Chào mừng đến với Markdown Explorer",
      descDesktop: "Trình hiển thị và điều hướng tài liệu cao cấp, bảo mật cục bộ dành cho Máy tính.",
      descVSCode: "Trình hiển thị và điều hướng tài liệu cao cấp, bảo mật cục bộ dành cho Visual Studio Code.",
      createdBy: "Tạo bởi",
      repository: "Kho lưu trữ",
      license: "Giấy phép",
      desktopRecommendation: "Để có trải nghiệm tốt nhất, chúng tôi khuyên bạn nên sử dụng ứng dụng Desktop.",
      macosInstallBtn: "Hướng dẫn cài đặt",
    },
    privacy: {
      title: "🔒 100% Riêng tư, Cục bộ trước hết & Độc lập",
      desc: "Chúng tôi tin rằng tài liệu của bạn nên được giữ hoàn toàn riêng tư. Markdown Explorer hoạt động hoàn toàn trên máy cục bộ của bạn:",
      bullets: [
        "Không theo dõi & Đo lường từ xa: Chúng tôi không thu thập hoặc gửi bất kỳ dữ liệu sử dụng, phân tích hay lượt nhấn phím nào.",
        "Không dùng thư viện ngoài: Ứng dụng/tiện ích mở rộng này không đóng gói hoặc tải bất kỳ trình theo dõi bên thứ ba, tập lệnh phân tích hay thư viện đo lường từ xa nào.",
        "Hỗ trợ ngoại tuyến 100%: Tất cả các quá trình phân tích cú pháp, quét cấu trúc, kết xuất markdown và lập chỉ mục tìm kiếm nhanh đều được thực hiện cục bộ mà không có phụ thuộc từ xa.",
      ],
    },
    features: {
      title: "Cách sử dụng tất cả tính năng",
      tree: {
        title: "📁 Cây thư mục không gian làm việc",
        desc: "Thanh bên trái hiển thị cấu trúc thư mục tương tác quét tất cả các tệp markdown trong không gian làm việc của bạn. Chỉ cần nhấp vào bất kỳ tệp nào để mở ở chế độ xem trước. Bạn có thể lọc tệp theo tên bằng thanh tìm kiếm ở đầu thanh bên.",
      },
      search: {
        title: "🔍 Tìm kiếm nhanh tức thì",
        desc: "Nhấn phím tắt tìm kiếm từ bất kỳ đâu trong cửa sổ xem trước để mở khung tìm kiếm nhanh. Nhập từ khóa để tìm kiếm tên tệp markdown, đường dẫn, tiêu đề và nội dung tệp. Sử dụng chuột hoặc bàn phím để chọn và mở tệp.",
      },
      tables: {
        title: "📋 Bảng dữ liệu tương tác kiểu Excel",
        desc: "Các bảng markdown tiêu chuẩn được tự động chuyển đổi thành bảng tương tác. Bạn có thể sắp xếp các cột bằng cách nhấp vào tiêu đề, sử dụng biểu tượng phễu để lọc các hàng theo giá trị và nhập vào thanh tìm kiếm phía trên bảng để tìm nội dung hàng.",
      },
      charts: {
        title: "📊 Chuyển đổi bảng thành biểu đồ bằng một cú nhấp",
        desc: "Đối với các bảng chứa cột số, một trình chuyển đổi chế độ xem sẽ xuất hiện. Nhấp vào các nút Cột, Đường hoặc Tròn để trực quan hóa dữ liệu bảng ngay lập tức dưới dạng biểu đồ Chart.js tương tác.",
      },
      highlight: {
        title: "🎨 Tô sáng cú pháp & Sơ đồ Mermaid",
        desc: "Trải nghiệm tô sáng cú pháp cao cấp, độ tương phản cao cho các khối mã (TypeScript, JavaScript, v.v.) với ghi đè tùy chỉnh cho chú thích và thuộc tính tùy chọn. Các sơ đồ trình tự, lưu đồ và sơ đồ lớp Mermaid được kết xuất cục bộ hoàn toàn an toàn ngoại tuyến.",
      },
      modal: {
        title: "🖼️ Cửa sổ đa phương tiện làm mờ nền",
        desc: "Nhấp vào bất kỳ hình ảnh hoặc sơ đồ nào trong tài liệu của bạn để mở cửa sổ phóng to làm mờ nền cao cấp. Bạn có thể cuộn để phóng to/thu nhỏ, nhấp kéo để di chuyển hình ảnh độ phân giải cao hoặc sử dụng các phím mũi tên để chuyển qua lại giữa các hình ảnh.",
      },
      shortcuts: {
        title: "⌨️ Phím tắt & Điều hướng",
        vscodeDesc: "Sử dụng Ctrl+Shift+M (Cmd+Shift+M trên Mac) để mở Markdown Explorer, và Ctrl+Alt+V (Cmd+Alt+V trên Mac) hoặc nhấp vào nút tiêu đề trình chỉnh sửa để bật/tắt nhanh chế độ xem Markdown Explorer của tệp markdown.",
        desc: "Kiểm soát và điều hướng tài liệu của bạn dễ dàng bằng các phím tắt tiêu chuẩn và có thể tùy chỉnh:",
      },
    },
    shortcutsTable: {
      headers: { action: "Thao tác", shortcut: "Phím tắt mặc định" },
      rows: {
        back: "Quay lại tệp trước đó",
        backShortcut: "hoặc nút Back của chuột",
        forward: "Đi tới tệp tiếp theo",
        forwardShortcut: "hoặc nút Forward của chuột",
        welcome: "Đi tới trang chào mừng",
        settings: "Mở cài đặt",
        theme: "Bật/Tắt chế độ sáng/tối",
        zoomModal: "Phóng to/thu nhỏ ảnh (trong cửa sổ ảnh)",
        zoomModalShortcut: "Cuộn bánh xe chuột",
        refresh: "Tải lại tệp hiện tại",
        collapse: "Thu gọn tất cả tiêu đề",
        expand: "Mở rộng tất cả tiêu đề",
        workspace: "Đi tới trang chọn không gian làm việc",
        sidebar: "Bật/Tắt thanh bên",
        zoomIn: "Phóng to",
        zoomInShortcut: "hoặc Cuộn chuột lên",
        zoomOut: "Thu nhỏ",
        zoomOutShortcut: "hoặc Cuộn chuột xuống",
      },
      note: "Lưu ý: Bạn có thể thay đổi tất cả các phím tắt từ Cửa sổ cài đặt (nhấp nút cài đặt hoặc nhấn Ctrl+I).",
    },
    issues: {
      title: "🐞 Báo cáo lỗi & Trợ giúp",
      hint: "Trước khi mở yêu cầu mới, vui lòng kiểm tra trang Các vấn đề (Issues) của kho lưu trữ để tránh trùng lặp:",
      linkText: "Các vấn đề của Kho lưu trữ",
      bullets: [
        "Tìm kiếm các vấn đề hiện có trước để xem đã có ai báo cáo chưa.",
        "Cung cấp các bước tái hiện lỗi, hệ điều hành của bạn và việc bạn đang sử dụng tiện ích mở rộng VS Code hay ứng dụng Máy tính.",
        "Đính kèm một tệp markdown mẫu nhỏ hoặc ảnh chụp màn hình cùng lỗi giao diện điều khiển (console) nếu có.",
      ],
    },
  },
  fr: {
    hero: {
      title: "Bienvenue sur Markdown Explorer",
      descDesktop: "Un visualiseur et navigateur de documentation premium et local pour Bureau.",
      descVSCode: "Un visualiseur et navigateur de documentation premium et local pour Visual Studio Code.",
      createdBy: "Créé par",
      repository: "Dépôt",
      license: "Licence",
      desktopRecommendation: "Pour la meilleure expérience, nous vous recommandons d'utiliser l'application Bureau.",
      macosInstallBtn: "Guide d'installation",
    },
    privacy: {
      title: "🔒 105% Privé, Local-First & Indépendant",
      desc: "Nous pensons que votre documentation doit rester totalement privée. Markdown Explorer fonctionne entièrement sur votre machine locale :",
      bullets: [
        "Aucun suivi ni télémétrie : Nous ne collectons ni n'envoyons aucune donnée d'utilisation, analyse ou frappe de touche.",
        "Aucune bibliothèque externe : Cette application/extension n'intègre ni ne charge aucun tracker externe tiers, script d'analyse ou bibliothèque de télémétrie.",
        "Support 100% hors ligne : Tous les processus d'analyse, d'exploration, de rendu de markdown et d'indexation de recherche rapide sont exécutés localement sans dépendances distantes.",
      ],
    },
    features: {
      title: "Comment utiliser toutes les fonctionnalités",
      tree: {
        title: "📁 Arborescence de navigation de l'espace de travail",
        desc: "La barre latérale gauche affiche une structure de dossiers interactive scannant tous les fichiers markdown de votre espace de travail. Cliquez simplement sur un fichier pour l'ouvrir en mode aperçu. Vous pouvez filtrer les fichiers par nom via la barre de recherche en haut.",
      },
      search: {
        title: "🔍 Recherche rapide instantanée",
        desc: "Appuyez sur le raccourci de recherche depuis n'importe où dans la fenêtre d'aperçu pour ouvrir la recherche rapide. Tapez votre requête pour rechercher les noms de fichiers, chemins, titres et contenus. Utilisez la souris ou le clavier pour sélectionner et ouvrir un fichier.",
      },
      tables: {
        title: "📋 Tableaux de données interactifs style Excel",
        desc: "Les tableaux markdown standard sont automatiquement convertis en tableaux interactifs. Vous pouvez trier les colonnes en cliquant sur leurs en-têtes, utiliser l'icône d'entonnoir pour filtrer les lignes par valeurs et rechercher dans les lignes via la barre de recherche au-dessus du tableau.",
      },
      charts: {
        title: "📊 Convertisseur Tableau en Graphique en un clic",
        desc: "Pour les tableaux contenant des colonnes numériques, un sélecteur de vue apparaît. Cliquez sur les boutons Barre, Ligne ou Camembert pour visualiser instantanément les données sous forme de graphique interactif Chart.js.",
      },
      highlight: {
        title: "🎨 Coloration syntaxique & Diagrammes Mermaid",
        desc: "Profitez d'une coloration syntaxique premium à fort contraste pour les blocs de code (TypeScript, JavaScript, etc.) avec des surcharges personnalisées. Les diagrammes de séquence, de flux et de classes Mermaid s'affichent nativement en mode hors ligne strict.",
      },
      modal: {
        title: "🖼️ Visionneuse multimédia avec flou d'arrière-plan",
        desc: "Cliquez sur une image ou un diagramme pour ouvrir une visionneuse premium avec arrière-plan flouté. Vous pouvez zoomer avec la molette, faire glisser pour vous déplacer ou utiliser les flèches du clavier pour faire défiler les images.",
      },
      shortcuts: {
        title: "⌨️ Raccourcis clavier & Navigation",
        vscodeDesc: "Utilisez Ctrl+Shift+M (Cmd+Shift+M sur Mac) pour ouvrir Markdown Explorer, et Ctrl+Alt+V (Cmd+Alt+V sur Mac) ou cliquez sur le titre de l'éditeur pour basculer rapidement la vue.",
        desc: "Contrôlez et naviguez facilement dans votre documentation à l'aide des raccourcis clavier standards et personnalisables :",
      },
    },
    shortcutsTable: {
      headers: { action: "Action", shortcut: "Raccourci par défaut" },
      rows: {
        back: "Retour au fichier précédent",
        backShortcut: "ou bouton Retour de la souris",
        forward: "Aller au fichier suivant",
        forwardShortcut: "ou bouton Suivant de la souris",
        welcome: "Aller à la page d'accueil",
        settings: "Ouvrir les paramètres",
        theme: "Basculer le mode clair/sombre",
        zoomModal: "Zoomer/Dézoomer l'image (dans la visionneuse)",
        zoomModalShortcut: "Faire défiler la molette",
        refresh: "Actualiser le fichier actuel",
        collapse: "Réduire tous les titres",
        expand: "Développer tous les titres",
        workspace: "Aller au choix de l'espace de travail",
        sidebar: "Basculer la barre latérale",
        zoomIn: "Zoom avant",
        zoomInShortcut: "ou Molette vers le haut",
        zoomOut: "Zoom arrière",
        zoomOutShortcut: "ou Molette vers le bas",
      },
      note: "Note : Vous pouvez modifier tous les raccourcis depuis la fenêtre des paramètres (cliquez sur le bouton de configuration ou appuyez sur Ctrl+I).",
    },
    issues: {
      title: "🐞 Signaler un bug & Obtenir de l'aide",
      hint: "Avant d'ouvrir un ticket, veuillez vérifier les tickets existants sur le dépôt pour éviter les doublons :",
      linkText: "Tickets du dépôt",
      bullets: [
        "Recherchez d'abord les tickets existants.",
        "Indiquez les étapes de reproduction, votre système d'exploitation et si vous utilisez l'extension VS Code ou l'application Bureau.",
        "Joignez un court fichier markdown d'exemple ou une capture d'écran, ainsi que les erreurs de console si disponibles.",
      ],
    },
  },
  es: {
    hero: {
      title: "Bienvenido a Markdown Explorer",
      descDesktop: "Un visor y navegador de documentación premium y local para Escritorio.",
      descVSCode: "Un visor y navegador de documentación premium y local para Visual Studio Code.",
      createdBy: "Creado por",
      repository: "Repositorio",
      license: "Licencia",
      desktopRecommendation: "Para obtener la mejor experiencia, recomendamos utilizar la aplicación de Escritorio.",
      macosInstallBtn: "Guía de instalación",
    },
    privacy: {
      title: "🔒 100% Privado, Local-First e Independiente",
      desc: "Creemos que su documentación debe mantenerse completamente privada. Markdown Explorer funciona en su máquina local:",
      bullets: [
        "Sin seguimiento ni telemetría: No recopilamos ni enviamos datos de uso, análisis ni pulsaciones de teclas.",
        "Sin bibliotecas externas: Esta aplicación/extensión no incluye ni carga rastreadores externos de terceros, scripts de análisis ni telemetría.",
        "Soporte 100% sin conexión: El procesamiento, escaneo, renderizado y la indexación rápida de markdown se realizan localmente sin dependencias remotas.",
      ],
    },
    features: {
      title: "Cómo usar todas las funciones",
      tree: {
        title: "📁 Árbol de navegación del espacio de trabajo",
        desc: "La barra lateral izquierda muestra una estructura de carpetas interactiva que escanea todos los archivos markdown. Haga clic en cualquier archivo para abrirlo. Puede filtrar archivos por nombre usando la barra de búsqueda superior.",
      },
      search: {
        title: "🔍 Búsqueda rápida instantánea",
        desc: "Presione el atajo de búsqueda desde cualquier lugar para abrir la ventana de búsqueda rápida. Escriba para buscar nombres de archivos markdown, rutas, títulos y contenido de archivos. Use el mouse o el teclado para seleccionar y abrir un archivo.",
      },
      tables: {
        title: "📋 Tablas de datos interactivas al estilo Excel",
        desc: "Las tablas estándar de markdown se convierten automáticamente en tablas interactivas. Puede ordenar columnas haciendo clic en sus encabezados, usar el icono de embudo para filtrar filas y buscar en la tabla usando el buscador de arriba.",
      },
      charts: {
        title: "📊 Convertidor de Tabla a Gráfico en un clic",
        desc: "Para tablas con columnas numéricas, aparecerá un selector. Haga clic en los botones de Barra, Línea o Torta para visualizar instantáneamente los datos con un gráfico interactivo de Chart.js.",
      },
      highlight: {
        title: "🎨 Resaltado de sintaxis y diagramas Mermaid",
        desc: "Disfrute de un resaltado de sintaxis premium y de alto contraste para bloques de código con personalizaciones. Los diagramas de secuencia, flujo y clases Mermaid se renderizan localmente de forma estricta sin conexión.",
      },
      modal: {
        title: "🖼️ Visor de imágenes con desenfoque de fondo",
        desc: "Haga clic en cualquier imagen o diagrama para abrir un visor flotante premium. Puede usar la rueda del mouse para hacer zoom, arrastrar para mover o usar las flechas del teclado para navegar por las imágenes.",
      },
      shortcuts: {
        title: "⌨️ Atajos de teclado y navegación",
        vscodeDesc: "Use Ctrl+Shift+M (Cmd+Shift+M en Mac) para abrir Markdown Explorer, y Ctrl+Alt+V (Cmd+Alt+V en Mac) o el botón de título del editor para alternar la vista rápidamente.",
        desc: "Controle y navegue fácilmente por sus documentos con atajos de teclado estándar y personalizables:",
      },
    },
    shortcutsTable: {
      headers: { action: "Acción", shortcut: "Atajo predeterminado" },
      rows: {
        back: "Volver al archivo anterior",
        backShortcut: "o botón Atrás del mouse",
        forward: "Ir al siguiente archivo",
        forwardShortcut: "o botón Adelante del mouse",
        welcome: "Ir a la página de bienvenida",
        settings: "Abrir ajustes",
        theme: "Alternar modo claro/oscuro",
        zoomModal: "Acercar/Alejar imagen (en el visor)",
        zoomModalShortcut: "Girar rueda del mouse",
        refresh: "Actualizar archivo actual",
        collapse: "Contraer todos los títulos",
        expand: "Expandir todos los títulos",
        workspace: "Ir a selección de espacio de trabajo",
        sidebar: "Alternar barra lateral",
        zoomIn: "Acercar",
        zoomInShortcut: "o Rueda arriba",
        zoomOut: "Alejar",
        zoomOutShortcut: "o Rueda abajo",
      },
      note: "Nota: Puede cambiar todos los atajos de teclado desde el panel de ajustes (haga clic en el botón de ajustes o presione Ctrl+I).",
    },
    issues: {
      title: "🐞 Informar problemas y obtener ayuda",
      hint: "Antes de abrir un nuevo problema, verifique la sección Issues del repositorio para evitar duplicados:",
      linkText: "Problemas del repositorio",
      bullets: [
        "Busque primero problemas existentes.",
        "Incluya pasos para reproducir, su sistema operativo y si usa la extensión de VS Code o la aplicación de Escritorio.",
        "Adjunte un archivo markdown de muestra o captura de pantalla y los errores de consola si los hay.",
      ],
    },
  },
  zh: {
    hero: {
      title: "欢迎使用 Markdown Explorer",
      descDesktop: "一款为桌面端打造的优质、本地优先的文档查看与导航工具。",
      descVSCode: "一款为 VS Code 打造的优质、本地优先的文档查看与导航插件。",
      createdBy: "开发者",
      repository: "开源仓库",
      license: "开源协议",
      desktopRecommendation: "为获得最佳体验，建议使用桌面客户端。",
      macosInstallBtn: "安装指南",
    },
    privacy: {
      title: "🔒 100% 隐私安全、本地优先与独立运行",
      desc: "我们坚信您的文档应当是完全私密的。Markdown Explorer 完全在您的本地计算机上运行：",
      bullets: [
        "无跟踪与遥测：我们不会收集或发送任何使用数据、分析信息或键盘输入。",
        "无外部依赖库：此应用/插件没有打包或加载任何第三方外部跟踪器、分析脚本或遥测库。",
        "100% 离线支持：所有 Markdown 解析、扫描、渲染以及快速搜索索引均在本地执行，没有任何远程依赖项。",
      ],
    },
    features: {
      title: "如何使用所有功能",
      tree: {
        title: "📁 工作区导航树",
        desc: "左侧边栏显示一个交互式文件夹结构，扫描工作区中的所有 Markdown 文件。只需单击任何文件即可在预览模式下将其打开。您可以使用侧边栏顶部的搜索栏按名称过滤文件。",
      },
      search: {
        title: "🔍 瞬间快速搜索",
        desc: "在预览窗口的任何位置按下搜索快捷键即可打开快速搜索面板。输入查询即可搜索 Markdown 文件名、路径、标题和文件内容。使用鼠标或键盘选择并打开文件。",
      },
      tables: {
        title: "📋 Excel 风格交互式数据表",
        desc: "标准的 Markdown 数据表将自动转换为交互式表格。您可以通过单击表头对列进行排序，使用表头上的漏斗图标按数值过滤行，并在表格上方的搜索栏内输入内容以搜索行数据。",
      },
      charts: {
        title: "📊 一键“表转图表”切换器",
        desc: "对于包含数值列的表格，会出现一个视图切换按钮。单击柱状图、折线图或饼图按钮，即可将表格数据瞬间可视化为交互式 Chart.js 图表。",
      },
      highlight: {
        title: "🎨 代码高亮与 Mermaid 流程图",
        desc: "为代码块（TypeScript、JavaScript等）提供高对比度、优质的代码高亮显示，并对注释和可选属性进行了定制覆盖。Mermaid 时序图、流程图和类图在客户端原生渲染，具备 100% 严格的离线隔离。",
      },
      modal: {
        title: "🖼️ 可缩放的磨砂背景媒体窗口",
        desc: "单击文档中的任何图像或图表即可启动精美的背景模糊弹窗。您可以滚动鼠标滚轮进行放大/缩小，点击并拖动以在高清图像中平移，或使用方向键循环查看文档中的所有图像。",
      },
      shortcuts: {
        title: "⌨️ 键盘快捷键与导航",
        vscodeDesc: "使用 Ctrl+Shift+M（Mac 上为 Cmd+Shift+M）打开 Markdown Explorer，使用 Ctrl+Alt+V（Mac 上为 Cmd+Alt+V）或单击编辑器标题按钮在 Markdown 文件上快速切换预览。",
        desc: "使用标准和可自定义的键盘快捷键轻松控制和导航您的文档：",
      },
    },
    shortcutsTable: {
      headers: { action: "操作", shortcut: "默认快捷键" },
      rows: {
        back: "返回上一个文件",
        backShortcut: "或鼠标侧键（后退）",
        forward: "前往下一个文件",
        forwardShortcut: "或鼠标侧键（前进）",
        welcome: "前往欢迎页面",
        settings: "打开设置窗口",
        theme: "切换浅色/深色模式",
        zoomModal: "放大/缩小图像（在图像窗口中）",
        zoomModalShortcut: "滚动鼠标滚轮",
        refresh: "刷新当前文件",
        collapse: "折叠所有标题分组",
        expand: "展开所有标题分组",
        workspace: "前往工作区选择页面",
        sidebar: "切换侧边栏可见性",
        zoomIn: "放大",
        zoomInShortcut: "或滚轮向上",
        zoomOut: "缩小",
        zoomOutShortcut: "或滚轮向下",
      },
      note: "提示：您可以在“设置窗口”中修改所有的键盘快捷键（单击设置按钮或按 Ctrl+I）。",
    },
    issues: {
      title: "🐞 报告问题与获取帮助",
      hint: "在创建新的 Issue 之前，请先检查仓库的 Issues 页面以避免重复：",
      linkText: "仓库 Issues 页面",
      bullets: [
        "首先搜索现有的 Issues。",
        "提供复现步骤、您的操作系统，以及您使用的是 VS Code 插件还是桌面端应用。",
        "如果可行，请附带一个简短的示例 Markdown 文件或截图，以及控制台的错误信息。",
      ],
    },
  },
  no: {
    hero: {
      title: "Velkommen til Markdown Explorer",
      descDesktop: "En førsteklasses, lokal-først dokumentviser og navigator for Skrivebord.",
      descVSCode: "En førsteklasses, lokal-først dokumentviser og navigator for Visual Studio Code.",
      createdBy: "Laget av",
      repository: "Kildekode",
      license: "Lisens",
      desktopRecommendation: "For den beste opplevelsen, anbefaler vi å bruke skrivebordsappen.",
      macosInstallBtn: "Installeringsveiledning",
    },
    privacy: {
      title: "🔒 100% Privat, Frakoblet-Først & Uavhengig",
      desc: "Vi mener at dokumentasjonen din skal holdes helt privat. Markdown Explorer kjører i sin helhet på din lokale maskin:",
      bullets: [
        "Ingen sporing eller telemetri: Vi samler ikke inn eller sender bruksdata, analyser eller tastetrykk.",
        "Ingen eksterne biblioteker: Denne appen/utvidelsen laster ikke inn eksterne sporere, analyseskript eller telemetribiblioteker fra tredjeparter.",
        "100% frakoblet støtte: All markdown-analyse, skanning, rendering og hurtigsøksindeksering utføres lokalt uten eksterne avhengigheter.",
      ],
    },
    features: {
      title: "Slik bruker du alle funksjonene",
      tree: {
        title: "📁 Navigasjonstre for arbeidsområde",
        desc: "Venstre sidemeny viser en interaktiv mappestruktur som skanner alle markdown-filer i arbeidsområdet ditt. Klikk på en fil for å åpne den. Du kan søke etter filer øverst i sidemenyen.",
      },
      search: {
        title: "🔍 Øyeblikkelig hurtigsøk",
        desc: "Trykk på søkesnarveien hvor som helst for å åpne hurtigsøkpanelet. Skriv for å søke i markdown-filnavn, stier, titler og filinnhold. Bruk musen eller tastaturet til å velge og åpne en fil.",
      },
      tables: {
        title: "📋 Excel-lignende interaktive datatabeller",
        desc: "Standard markdown-tabeller konverteres automatisk til interaktive tabeller. Du kan sortere kolonner ved å klikke på kolonneoverskriftene, bruke traktikonet til å filtrere rader, og søke etter radinnhold i søkefeltet over tabellen.",
      },
      charts: {
        title: "📊 Tabell-til-diagram-veksler med ett klikk",
        desc: "For tabeller med numeriske kolonner vil en diagramveksler vises. Klikk på Stolpe-, Linje- eller Kakestykke-knappene for å visualisere dataene som et interaktivt Chart.js-diagram.",
      },
      highlight: {
        title: "🎨 Syntaksutheving & Mermaid-diagrammer",
        desc: "Utheving med høy kontrast for kodeblokker med tilpassede overstyringer for kommentarer. Mermaid-sekvens-, flyt- og klassediagrammer rendres lokalt uten eksterne avhengigheter.",
      },
      modal: {
        title: "🖼️ Zoombar medievisning med uskarp bakgrunn",
        desc: "Klikk på et bilde eller diagram for å åpne medievisningen. Du kan rulle for å zoome inn/ut, klikke og dra for å panorere, eller bruke piltastene til å bytte mellom bilder i dokumentet.",
      },
      shortcuts: {
        title: "⌨️ Tastatursnarveier & Navigasjon",
        vscodeDesc: "Bruk Ctrl+Shift+M (Cmd+Shift+M på Mac) for å åpne Markdown Explorer, og Ctrl+Alt+V (Cmd+Alt+V på Mac) eller klikk på editortittelknappen for å veksle visning.",
        desc: "Styr og naviger dokumentasjonen din enkelt ved hjelp av standard og tilpassbare snarveier:",
      },
    },
    shortcutsTable: {
      headers: { action: "Handling", shortcut: "Standardsnarvei" },
      rows: {
        back: "Tilbake til forrige fil",
        backShortcut: "eller tilbakeknappen på musen",
        forward: "Gå til neste fil",
        forwardShortcut: "eller fremknappen på musen",
        welcome: "Gå til velkomstside",
        settings: "Åpne innstillinger",
        theme: "Bytt lys/mørk modus",
        zoomModal: "Zoom inn/ut bilde (i bildevisning)",
        zoomModalShortcut: "Rull musehjulet",
        refresh: "Oppdater gjeldende fil",
        collapse: "Slå sammen alle overskrifter",
        expand: "Utvid alle overskrifter",
        workspace: "Gå til valg av arbeidsområde",
        sidebar: "Bytt sidemenyvisning",
        zoomIn: "Zoom inn",
        zoomInShortcut: "eller Rull opp",
        zoomOut: "Zoom ut",
        zoomOutShortcut: "eller Rull ned",
      },
      note: "Merk: Du kan endre tastatursnarveiene i innstillingene (klikk på tannhjulet eller trykk på Ctrl+I).",
    },
    issues: {
      title: "🐞 Rapporter feil & Få hjelp",
      hint: "Sjekk Issues-siden på Github før du oppretter en ny sak for å unngå dubletter:",
      linkText: "Kildekodens Issues",
      bullets: [
        "Søk i eksisterende saker først.",
        "Inkluder fremgangsmåte for å gjenskape feilen, operativsystem og om du bruker VS Code-utvidelsen eller skrivebordsappen.",
        "Legg ved en kort markdown-eksempelfil eller et skjermbilde og eventuelle konsollfeil.",
      ],
    },
  },
  ja: {
    hero: {
      title: "Markdown Explorer へようこそ",
      descDesktop: "デスクトップ向けのプレミアムでローカル優先のドキュメントビューアおよびナビゲーターです。",
      descVSCode: "VS Code 向けのプレミアムでローカル優先のドキュメントビューアおよびナビゲーターです。",
      createdBy: "作成者",
      repository: "リポジトリ",
      license: "ライセンス",
      desktopRecommendation: "最高の体験を得るために、デスクトップアプリの使用をお勧めします。",
      macosInstallBtn: "インストールガイド",
    },
    privacy: {
      title: "🔒 100% プライベート、ローカル優先、独立稼働",
      desc: "私たちはドキュメントのプライバシーを完全に守るべきだと考えています。Markdown Explorer はすべてお使いのローカルマシン上で動作します：",
      bullets: [
        "トラッキング・テレメトリなし：使用データ、分析、キー入力の収集や送信は一切行いません。",
        "外部ライブラリなし：サードパーティの外部トラッカー、分析スクリプト、テレメトリライブラリを読み込むことはありません。",
        "100% オフライン対応：Markdown の解析、スキャン、レンダリング、クイック検索インデックス作成はすべて、リモートの依存関係なしにローカルで実行されます。",
      ],
    },
    features: {
      title: "すべての機能の使い方",
      tree: {
        title: "📁 ワークスペースナビゲーションツリー",
        desc: "左サイドバーには、ワークスペース内のすべての Markdown ファイルをスキャンするインタラクティブなフォルダー構造が表示されます。ファイルを無選択でクリックしてプレビューモードで開きます。サイドバー上部の検索バーで名前による絞り込みが可能です。",
      },
      search: {
        title: "🔍 インスタントクイック検索",
        desc: "プレビューウィンドウの任意の場所から検索のショートカットキーを押すと、クイック検索オーバーレイが表示されます。検索クエリを入力して、ファイル名、パス、タイトル、ファイル内容から検索します。マウスまたはキーボードで選択してファイルを開きます。",
      },
      tables: {
        title: "📋 Excel 風のインタラクティブデータ表",
        desc: "標準の Markdown 表は自動的にインタラクティブな表に変換されます。ヘッダーをクリックして列を並べ替えたり、漏斗アイコンで値をフィルタリングしたり、表の上の検索バーに入力して行の内容を検索できます。",
      },
      charts: {
        title: "📊 ワンクリックの表からチャートへの切り替え",
        desc: "数値列を含む表の場合、ビュー切り替えボタンが表示されます。「棒」「折れ線」または「円」ボタンをクリックすると、データをインタラクティブな Chart.js チャートとして即座に可視化できます。",
      },
      highlight: {
        title: "🎨 構文ハイライトと Mermaid 図",
        desc: "コードブロック（TypeScript、JavaScriptなど）には、高コントラストでプレミアムな構文ハイライトが適用されます。Mermaid のシーケンス、フローチャート、クラス図は、厳密なオフライン環境でクライアント側でネイティブにレンダリングされます。",
      },
      modal: {
        title: "🖼️ 背景ぼかし付きのズーム可能なメディアビューア",
        desc: "ドキュメント内の画像や図をクリックすると、背景ぼかし付きのポップアップウィンドウが起動します。マウスホイールでズームイン/ズームアウトし、ドラッグでパン、矢印キーでドキュメント内の画像を前後に切り替えられます。",
      },
      shortcuts: {
        title: "⌨️ キーボードショートカットとナビゲーション",
        vscodeDesc: "Ctrl+Shift+M（Mac では Cmd+Shift+M）で Markdown Explorer を開き、Ctrl+Alt+V（Mac では Cmd+Alt+V）またはエディタタイトルボタンでプレビュー表示を切り替えます。",
        desc: "標準およびカスタマイズ可能なキーボードショートカットを使用して、ドキュメントの操作やナビゲーションを簡単に行えます：",
      },
    },
    shortcutsTable: {
      headers: { action: "操作", shortcut: "デフォルトのショートカット" },
      rows: {
        back: "前のファイルに戻る",
        backShortcut: "またはマウスの戻るボタン",
        forward: "次のファイルに進む",
        forwardShortcut: "またはマウスの進むボタン",
        welcome: "ウェルカムページに移動",
        settings: "設定画面を開く",
        theme: "ライト/ダークモード切り替え",
        zoomModal: "画像を拡大/縮小（画像ウィンドウ内）",
        zoomModalShortcut: "マウスホイールのスクロール",
        refresh: "現在のファイルを更新",
        collapse: "すべての見出しグループを折りたたむ",
        expand: "すべての見出しグループを展開する",
        workspace: "ワークスペース選択画面に移動",
        sidebar: "サイドバーの表示切り替え",
        zoomIn: "拡大",
        zoomInShortcut: "またはホイール上にスクロール",
        zoomOut: "縮小",
        zoomOutShortcut: "またはホイール下にスクロール",
      },
      note: "注：すべてのキーボードショートカットは、設定画面（設定ボタンをクリックするか、Ctrl+I を押す）から変更できます。",
    },
    issues: {
      title: "🐞 バグ報告とサポート",
      hint: "重複を避けるため、新しい Issue を作成する前にリポジトリの Issues ページを確認してください：",
      linkText: "リポジトリの Issues",
      bullets: [
        "まず、既存の Issue を検索してください。",
        "再現手順、OS、VS Code 拡張機能とデスクトップアプリのどちらを使用しているかを明記してください。",
        "可能であれば、短いサンプルの Markdown ファイルやスクリーンショット、コンソールのエラーログを添付してください。",
      ],
    },
  },
  ko: {
    hero: {
      title: "Markdown Explorer에 오신 것을 환영합니다",
      descDesktop: "데스크톱 환경을 위한 프리미엄, 로컬 우선의 문서 뷰어 및 네비게이터입니다.",
      descVSCode: "VS Code 환경을 위한 프리미엄, 로컬 우선의 문서 뷰어 및 네비게이터입니다.",
      createdBy: "만든 이",
      repository: "저장소",
      license: "라이선스",
      desktopRecommendation: "최상의 경험을 위해 데스크톱 앱을 사용하는 것을 권장합니다.",
      macosInstallBtn: "설치 가이드",
    },
    privacy: {
      title: "🔒 100% 개인 정보 보호, 로컬 우선 및 독립 실행",
      desc: "우리는 귀하의 문서가 완전히 개인적으로 유지되어야 한다고 믿습니다. Markdown Explorer는 로컬 컴퓨터에서 완전하게 실행됩니다:",
      bullets: [
        "추적 및 텔레메트리 없음: 사용량 데이터, 분석 또는 키 입력을 수집하거나 전송하지 않습니다.",
        "외부 라이브러리 없음: 이 앱/확장 프로그램은 제3자 트래커, 분석 스크립트 또는 텔레메트리 라이브러리를 포함하거나 불러오지 않습니다.",
        "100% 오프라인 지원: 모든 마크다운 분석, 스캔, 렌더링 및 빠른 검색 인덱싱은 원격 종속성 없이 로컬에서 수행됩니다.",
      ],
    },
    features: {
      title: "모든 기능 사용 방법",
      tree: {
        title: "📁 작업 공간 네비게이션 트리",
        desc: "왼쪽 사이드바에는 작업 공간의 모든 마크다운 파일을 스캔하는 대화형 폴더 구조가 표시됩니다. 파일을 클릭하여 프리뷰 모드로 엽니다. 사이드바 상단 검색 바에서 이름으로 필터링할 수 있습니다.",
      },
      search: {
        title: "🔍 즉각적인 빠른 검색",
        desc: "프리뷰 창 어디서든 검색 단축키를 눌러 빠른 검색 팝업을 엽니다. 마크다운 파일 이름, 경로, 제목 및 내용을 검색하려면 검색어를 입력하십시오. 마우스나 키보드로 선택하여 파일을 엽니다.",
      },
      tables: {
        title: "📋 Excel 스타일 대화형 데이터 표",
        desc: "표준 마크다운 표가 대화형 표로 자동 변환됩니다. 헤더를 클릭하여 열을 정렬하고, 필터 아이콘으로 값을 필터링하며, 표 위의 검색 창에서 행 내용을 검색할 수 있습니다.",
      },
      charts: {
        title: "📊 원클릭 표-차트 변환",
        desc: "숫자 열이 포함된 표에는 차트 변환 버튼이 표시됩니다. 가로, 세로, 원형 차트 버튼을 클릭하여 데이터를 대화형 Chart.js 차트로 즉시 시각화할 수 있습니다.",
      },
      highlight: {
        title: "🎨 구문 강조 및 Mermaid 다이어그램",
        desc: "코드 블록에 고대비 프리미엄 구문 강조가 적용됩니다. Mermaid의 시퀀스, 플로우차트, 클래스 다이어그램은 완벽한 오프라인 환경인 클라이언트 측에서 기본으로 렌더링됩니다.",
      },
      modal: {
        title: "🖼️ 배경 흐림 기능이 있는 미디어 뷰어",
        desc: "문서의 이미지나 다이어그램을 클릭하여 미디어 뷰어를 엽니다. 마우스 휠로 확대/축소하고, 드래그로 이동하며, 방향키를 사용하여 문서 내의 이미지들을 전환할 수 있습니다.",
      },
      shortcuts: {
        title: "⌨️ 키보드 단축키 및 네비게이션",
        vscodeDesc: "Ctrl+Shift+M(Mac의 경우 Cmd+Shift+M)으로 Markdown Explorer를 열고, Ctrl+Alt+V(Mac의 경우 Cmd+Alt+V) 또는 편집기 제목 버튼을 눌러 보기 모드를 전환합니다.",
        desc: "표준 및 사용자 정의 키보드 단축키를 사용하여 문서를 편리하게 조작하고 탐색하십시오:",
      },
    },
    shortcutsTable: {
      headers: { action: "동작", shortcut: "기본 단축키" },
      rows: {
        back: "이전 파일로 돌아가기",
        backShortcut: "또는 마우스 뒤로 가기 버튼",
        forward: "다음 파일로 이동",
        forwardShortcut: "또는 마우스 앞으로 가기 버튼",
        welcome: "시작 페이지로 이동",
        settings: "설정 창 열기",
        theme: "라이트/다크 모드 전환",
        zoomModal: "이미지 확대/축소 (미디어 뷰어에서)",
        zoomModalShortcut: "마우스 휠 스크롤",
        refresh: "현재 파일 새로고침",
        collapse: "모든 제목 접기",
        expand: "모든 제목 펼치기",
        workspace: "작업 공간 선택 화면으로 이동",
        sidebar: "사이드바 표시 전환",
        zoomIn: "확대",
        zoomInShortcut: "또는 휠 위로",
        zoomOut: "축소",
        zoomOutShortcut: "또는 휠 아래로",
      },
      note: "참고: 설정 창(설정 버튼 클릭 또는 Ctrl+I 입력)에서 모든 키보드 단축키를 변경할 수 있습니다.",
    },
    issues: {
      title: "🐞 버그 보고 및 지원",
      hint: "중복을 피하기 위해 새 문제를 제기하기 전에 저장소 Issues 페이지를 확인해 주십시오:",
      linkText: "저장소 Issues",
      bullets: [
        "먼저 기존 이슈를 검색해 보십시오.",
        "재현 단계, 사용 중인 OS, VS Code 확장 기능과 데스크톱 앱 중 어떤 것을 사용하고 있는지 기재해 주십시오.",
        "가능하면 간단한 샘플 마크다운 파일이나 스크린샷, 콘솔 오류 로그를 첨부해 주십시오.",
      ],
    },
  },
  ru: {
    hero: {
      title: "Добро пожаловать в Markdown Explorer",
      descDesktop: "Удобный локальный просмотрщик и навигатор документации премиум-класса для ПК.",
      descVSCode: "Удобный локальный просмотрщик и навигатор документации премиум-класса для VS Code.",
      createdBy: "Создатель",
      repository: "Репозиторий",
      license: "Лицензия",
      desktopRecommendation: "Для наилучшего удобства рекомендуем использовать приложение для ПК.",
      macosInstallBtn: "Руководство по установке",
    },
    privacy: {
      title: "🔒 100% Конфиденциально, Локально и Независимо",
      desc: "Мы считаем, что ваша документация должна оставаться абсолютно конфиденциальной. Markdown Explorer работает полностью на вашем локальном компьютере:",
      bullets: [
        "Никакого отслеживания и телеметрии: Мы не собираем и не отправляем данные об использовании, аналитику или нажатия клавиш.",
        "Никаких внешних библиотек: Это приложение/расширение не загружает сторонние внешние трекеры, скрипты аналитики или телеметрии.",
        "100% Автономная работа: Весь анализ markdown, сканирование, рендеринг и быстрый поиск выполняются локально без внешних зависимостей.",
      ],
    },
    features: {
      title: "Как использовать все функции",
      tree: {
        title: "📁 Дерево навигации рабочей области",
        desc: "Левая боковая панель отображает интерактивную структуру папок со всеми файлами markdown. Просто нажмите на файл, чтобы открыть его. Вы можете искать файлы по названию в верхней части боковой панели.",
      },
      search: {
        title: "🔍 Мгновенный быстрый поиск",
        desc: "Нажмите сочетание клавиш поиска в любом месте, чтобы открыть панель быстрого поиска. Введите запрос для поиска по именам файлов markdown, путям, заголовкам и содержимому файлов. Используйте мышь или клавиатуру для открытия файла.",
      },
      tables: {
        title: "📋 Интерактивные таблицы данных в стиле Excel",
        desc: "Стандартные таблицы markdown автоматически преобразуются в интерактивные. Вы можете сортировать столбцы при нажатии на их заголовки, использовать значок воронки для фильтрации строк и искать по содержимому в строке поиска над таблицей.",
      },
      charts: {
        title: "📊 Преобразование таблицы в интерактивный график",
        desc: "Для таблиц с числовыми столбцами появится переключатель видов. Нажмите кнопку гистограммы, линейного или кругового графика для мгновенной визуализации данных с помощью Chart.js.",
      },
      highlight: {
        title: "🎨 Подсветка синтаксиса и диаграммы Mermaid",
        desc: "Высококонтрастная премиум-подсветка синтаксиса для блоков кода с кастомными стилями для комментариев. Диаграммы последовательностей, блок-схемы и диаграммы классов Mermaid отображаются локально в строгом автономном режиме.",
      },
      modal: {
        title: "🖼️ Масштабируемый просмотрщик медиа с размытием фона",
        desc: "Нажмите на любое изображение или диаграмму, чтобы открыть просмотрщик медиа. Вы можете использовать колесико мыши для масштабирования, перетаскивать для панорамирования или использовать стрелки для навигации.",
      },
      shortcuts: {
        title: "⌨️ Сочетания клавиш и Навигация",
        vscodeDesc: "Используйте Ctrl+Shift+M (Cmd+Shift+M на Mac) для запуска Markdown Explorer, и Ctrl+Alt+V (Cmd+Alt+V на Mac) или нажмите на заголовок редактора для быстрого переключения.",
        desc: "Легко управляйте документацией с помощью стандартных и настраиваемых сочетаний клавиш:",
      },
    },
    shortcutsTable: {
      headers: { action: "Действие", shortcut: "Сочетание по умолчанию" },
      rows: {
        back: "Назад к предыдущему файлу",
        backShortcut: "или кнопка Назад на мыши",
        forward: "Вперед к следующему файлу",
        forwardShortcut: "или кнопка Вперед на мыши",
        welcome: "Перейти на приветственную страницу",
        settings: "Открыть окно настроек",
        theme: "Переключить светлую/темную тему",
        zoomModal: "Увеличить/уменьшить масштаб (в окне просмотра)",
        zoomModalShortcut: "Прокрутка колесика мыши",
        refresh: "Обновить текущий файл",
        collapse: "Свернуть все группы заголовков",
        expand: "Развернуть все группы заголовков",
        workspace: "Перейти к выбору рабочей области",
        sidebar: "Переключить видимость боковой панели",
        zoomIn: "Увеличить",
        zoomInShortcut: "или прокрутка колесика вверх",
        zoomOut: "Уменьшить",
        zoomOutShortcut: "или прокрутка колесика вниз",
      },
      note: "Примечание: Вы можете изменить сочетания клавиш в окне настроек (нажмите кнопку настроек или Ctrl+I).",
    },
    issues: {
      title: "🐞 Сообщить об ошибке и получить помощь",
      hint: "Перед открытием нового вопроса проверьте раздел Issues в репозитории на наличие дубликатов:",
      linkText: "Раздел Issues репозитория",
      bullets: [
        "Сначала поищите в существующих темах.",
        "Укажите шаги для воспроизведения, вашу ОС и версию (расширение VS Code или приложение для ПК).",
        "Прикрепите небольшой пример markdown или скриншот, а также ошибки из консоли, если они есть.",
      ],
    },
  },
};

export function getWelcomeTranslations(langCode: string): WelcomeTranslations {
  const code = (langCode || "en").toLowerCase();
  return WELCOME_TRANSLATIONS[code] || WELCOME_TRANSLATIONS.en;
}
