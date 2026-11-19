import type { TipItem } from './welcomeTipsContent';

export const EXTENDED_TIPS_PART_A: Record<string, Record<string, TipItem>> = {
  en: {
    bookmarks: {
      badge: 'Bookmarks',
      title: 'Text Selection Bookmarks & Bookmark Manager',
      desc: 'Select any text or heading in a document to save a named passage bookmark. Open the Sidebar Bookmarks tab to search, filter, rename, jump to, or batch-delete saved bookmarks across your workspace.',
    },
    tocAndSections: {
      badge: 'TOC & Sections',
      title: 'Interactive TOC & Collapsible Heading Sections',
      desc: "Use the right-hand Table of Contents to jump to any heading, click section chevrons in the document to collapse or expand long sections, or click a heading's copy button to copy that entire section's Markdown.",
    },
    liveAndSourceEditor: {
      badge: 'Markdown Editor',
      title: 'Live Markdown Editing & Plain Source Mode',
      desc: 'Press (Ctrl+E) to edit blocks inline with live preview, or press (Ctrl+Alt+E) to open the full Plain Markdown Source Editor with the formatting toolbar. Save changes directly to disk anytime with (Ctrl+S).',
    },
    splitPaneView: {
      badge: 'Split View',
      title: 'Side-by-Side Split Pane Comparison',
      desc: 'Open a second document pane from the tab context menu or topbar to read, compare, or edit two Markdown files side by side with independent tab bars and scrolling.',
    },
    fileRevisionHistory: {
      badge: 'File History',
      title: 'Local File Revision History & Visual Diffs',
      desc: 'Click History in the topbar to inspect automatic local file snapshots, compare changes in Unified, Split Source, or Rendered Diff mode, and restore any previous version.',
    },
    gitRepoHistory: {
      badge: 'Git History',
      title: 'Git Repository History & Commit Snapshots',
      desc: 'Switch to the History tab in the sidebar to browse Git commits, inspect modified files per commit, and preview historical repository snapshots without leaving the workspace.',
    },
    codeBlocksSelection: {
      badge: 'Code Blocks',
      title: 'Code Block Line Selection, Copy & Collapse',
      desc: 'Click any line number (or use (Shift+Click) for a range) inside a code block to highlight and copy specific lines, copy the full snippet in one click, or collapse long code blocks.',
    },
    mermaidAndMath: {
      badge: 'Mermaid & Math',
      title: 'Mermaid Diagrams, ZenUML & KaTeX Math',
      desc: 'Render flowcharts, sequence, ZenUML, class, state, and ER diagrams 100% offline alongside LaTeX math formulas ($...$ and $$...$$), with one-click SVG/PNG snapshot export.',
    },
    docConversion: {
      badge: 'Doc Conversion',
      title: 'Office & PDF Document Conversion',
      desc: 'Enable Document Conversion in Settings to preview .docx, .xlsx, .pptx, and .pdf files directly as clean, structured Markdown inside your workspace.',
    },
    knowledgeGraph: {
      badge: 'Knowledge Graph',
      title: 'Interactive Knowledge Graph & AI Link Repair',
      desc: 'Open Workspace Insights (Graph tab) to visualize document links, backlinks, 1st/2nd-degree neighbors, and tag clusters, or copy an AI agent prompt to fix broken links.',
    },
    insightsSuite: {
      badge: 'Insights Suite',
      title: 'Link Audit, Markdown Linter, Related Docs & Media Gallery',
      desc: 'Use Workspace Insights to audit broken internal/external links (Links), check Markdown lint rules (Lint), discover semantically related files (Related), and browse all workspace images & diagrams (Gallery).',
    },
    exportCenter: {
      badge: 'Export Center',
      title: 'Multi-Format Export Center',
      desc: 'Open Export Center from the topbar to export the active document or a filtered workspace batch to Standalone HTML, PDF, DOCX, PNG, or SVG with theme-matched styling.',
    },
    aiManualPrompt: {
      badge: 'AI Assistant',
      title: 'AI-Ready User Manual & Context Prompt',
      desc: 'Open the User Manual tab on the homepage to copy a version-aware AI prompt (referencing llm.txt and Changelog) into any AI assistant for accurate, step-by-step guidance.',
    },
    visualThemeStyles: {
      badge: 'Visual Themes',
      title: '8+ Visual Theme Styles & Pet Companions',
      desc: 'Switch between Default, Glass, Bento, Raw Grid, Cyberpunk, and interactive Pet themes (Corgi, Cat, Hamster), and toggle Light or Dark mode anytime with (Ctrl+T).',
    },
    tourAndKeybindings: {
      badge: 'Tour & Shortcuts',
      title: 'Custom Keybindings & Interactive Walkthrough Tour',
      desc: 'Rebind or disable any keyboard shortcut in Settings, export/import your settings (.json), and click Interactive Tour on the homepage anytime for a guided full-app walkthrough.',
    },
  },
  vi: {
    bookmarks: {
      badge: 'Dấu trang',
      title: 'Đánh dấu đoạn văn bản & Quản lý dấu trang',
      desc: 'Chọn bất kỳ đoạn văn bản hoặc tiêu đề nào trong tài liệu để lưu dấu trang có đặt tên. Mở thẻ Dấu trang ở thanh bên để tìm kiếm, lọc, đổi tên, nhảy đến vị trí hoặc xóa hàng loạt dấu trang đã lưu.',
    },
    tocAndSections: {
      badge: 'Mục lục & Phần',
      title: 'Mục lục tương tác & Thu gọn mở rộng phân mục',
      desc: "Sử dụng Mục lục bên phải để nhảy nhanh đến bất kỳ tiêu đề nào, nhấn vào mũi tên phân mục trong tài liệu để thu gọn hoặc mở rộng các phần dài, hoặc nhấn nút sao chép ở tiêu đề để sao chép toàn bộ Markdown của phần đó.",
    },
    liveAndSourceEditor: {
      badge: 'Trình soạn thảo',
      title: 'Chỉnh sửa Markdown trực tiếp & Chế độ mã nguồn',
      desc: 'Nhấn (Ctrl+E) để chỉnh sửa các khối nội dung trực tiếp kèm xem trước tức thì, hoặc nhấn (Ctrl+Alt+E) để mở Trình soạn thảo mã nguồn Markdown đầy đủ với thanh công cụ định dạng. Lưu thay đổi trực tiếp vào ổ đĩa bất kỳ lúc nào với (Ctrl+S).',
    },
    splitPaneView: {
      badge: 'Chế độ chia đôi',
      title: 'So sánh tài liệu song song hai khung nhìn',
      desc: 'Mở khung tài liệu thứ hai từ menu chuột phải của tab hoặc thanh trên cùng để đọc, so sánh hoặc chỉnh sửa hai tệp Markdown cạnh nhau với các thanh tab và thanh cuộn độc lập.',
    },
    fileRevisionHistory: {
      badge: 'Lịch sử tệp',
      title: 'Lịch sử phiên bản tệp cục bộ & So sánh trực quan',
      desc: 'Nhấp Lịch sử trên thanh trên cùng để kiểm tra các bản chụp tệp cục bộ tự động, so sánh thay đổi ở chế độ Thống nhất, Chia đôi mã nguồn hoặc So sánh hiển thị, và khôi phục bất kỳ phiên bản nào.',
    },
    gitRepoHistory: {
      badge: 'Lịch sử Git',
      title: 'Lịch sử kho Git & Bản chụp commit',
      desc: 'Chuyển sang tab Lịch sử ở thanh bên để duyệt các commit Git, xem danh sách tệp được chỉnh sửa theo từng commit và xem trước bản chụp lịch sử của kho lưu trữ ngay trong không gian làm việc.',
    },
    codeBlocksSelection: {
      badge: 'Khối mã nguồn',
      title: 'Chọn dòng khối mã, sao chép & thu gọn',
      desc: 'Nhấp vào số dòng bất kỳ (hoặc dùng (Shift+Click) để chọn một dải dòng) trong khối mã để tô sáng và sao chép các dòng đã chọn, sao chép toàn bộ đoạn mã trong một cú nhấp, hoặc thu gọn các khối mã dài.',
    },
    mermaidAndMath: {
      badge: 'Mermaid & Toán',
      title: 'Sơ đồ Mermaid, ZenUML & Công thức toán KaTeX',
      desc: 'Hiển thị lưu đồ, sơ đồ tuần tự, ZenUML, sơ đồ lớp, trạng thái và ER hoàn toàn ngoại tuyến cùng các công thức toán LaTeX ($...$ và $$...$$), hỗ trợ xuất ảnh chụp SVG/PNG chỉ với một cú nhấp chuột.',
    },
    docConversion: {
      badge: 'Chuyển đổi tài liệu',
      title: 'Chuyển đổi tài liệu Office & PDF sang Markdown',
      desc: 'Bật Chuyển đổi tài liệu trong Cài đặt để xem trước các tệp .docx, .xlsx, .pptx và .pdf trực tiếp dưới dạng Markdown sạch sẽ, có cấu trúc chuẩn ngay trong không gian làm việc.',
    },
    knowledgeGraph: {
      badge: 'Đồ thị tri thức',
      title: 'Đồ thị tri thức tương tác & Sửa liên kết bằng AI',
      desc: 'Mở Thông tin chi tiết không gian làm việc (tab Đồ thị) để trực quan hóa liên kết tài liệu, liên kết ngược, nút lân cận bậc 1/2 và cụm thẻ, hoặc sao chép lời nhắc AI để sửa chữa các liên kết hỏng.',
    },
    insightsSuite: {
      badge: 'Bộ công cụ chi tiết',
      title: 'Kiểm tra liên kết, Linter Markdown, Tài liệu liên quan & Bộ sưu tập',
      desc: 'Sử dụng Thông tin chi tiết để kiểm tra liên kết nội bộ/bên ngoài bị hỏng (Liên kết), kiểm tra quy tắc cú pháp Markdown (Lint), khám phá các tệp có liên quan ngữ nghĩa (Liên quan), và duyệt toàn bộ ảnh & sơ đồ trong không gian làm việc (Bộ sưu tập).',
    },
    exportCenter: {
      badge: 'Trung tâm xuất tệp',
      title: 'Trung tâm xuất đa định dạng',
      desc: 'Mở Trung tâm xuất tệp từ thanh trên cùng để xuất tài liệu đang mở hoặc hàng loạt tệp theo bộ lọc sang HTML độc lập, PDF, DOCX, PNG hoặc SVG với kiểu dáng chuẩn theo chủ đề.',
    },
    aiManualPrompt: {
      badge: 'Trợ lý AI',
      title: 'Sổ tay hướng dẫn & Lời nhắc ngữ cảnh cho AI',
      desc: 'Mở thẻ Sổ tay hướng dẫn trên trang chào mừng để sao chép lời nhắc AI theo đúng phiên bản hiện tại (tham chiếu llm.txt và Nhật ký thay đổi) vào bất kỳ trợ lý AI nào để nhận hướng dẫn chuẩn xác từng bước.',
    },
    visualThemeStyles: {
      badge: 'Chủ đề giao diện',
      title: 'Hơn 8 phong cách chủ đề & Thú cưng đồng hành',
      desc: 'Chuyển đổi giữa các phong cách Mặc định, Thủy tinh (Glass), Bento, Lưới thô (Raw Grid), Cyberpunk và các chủ đề thú cưng tương tác (Corgi, Mèo, Chuột hamster), và bật/tắt chế độ Sáng/Tối bất cứ lúc nào với (Ctrl+T).',
    },
    tourAndKeybindings: {
      badge: 'Tham quan & Phím tắt',
      title: 'Tùy biến phím tắt & Chuyến tham quan tương tác',
      desc: 'Gán lại hoặc vô hiệu hóa bất kỳ phím tắt nào trong Cài đặt, xuất/nhập cấu hình (.json), và nhấp Chuyến tham quan trên trang chào mừng để được hướng dẫn toàn bộ tính năng ứng dụng.',
    },
  },
  fr: {
    bookmarks: {
      badge: 'Signets',
      title: 'Signets de sélection de texte et gestionnaire',
      desc: "Sélectionnez du texte ou un titre dans un document pour enregistrer un signet de passage nommé. Ouvrez l'onglet Signets de la barre latérale pour rechercher, filtrer, renommer, atteindre ou supprimer en masse vos signets.",
    },
    tocAndSections: {
      badge: 'TOC et sections',
      title: 'Table des matières interactive et sections repliables',
      desc: "Utilisez la table des matières à droite pour naviguer vers n'importe quel titre, cliquez sur les chevrons du document pour replier ou déplier les sections, ou cliquez sur le bouton de copie d'un titre pour copier le Markdown de la section entière.",
    },
    liveAndSourceEditor: {
      badge: 'Éditeur Markdown',
      title: 'Édition Markdown en direct et mode source brut',
      desc: "Appuyez sur (Ctrl+E) pour éditer des blocs en ligne avec aperçu dynamique, ou sur (Ctrl+Alt+E) pour ouvrir l'éditeur de source Markdown complet avec barre d'outils. Enregistrez directement sur le disque à tout moment avec (Ctrl+S).",
    },
    splitPaneView: {
      badge: 'Vue fractionnée',
      title: 'Comparaison côte à côte en volet fractionné',
      desc: "Ouvrez un second volet de document depuis le menu contextuel d'un onglet ou la barre supérieure pour lire, comparer ou modifier deux fichiers Markdown côte à côte avec barres d'onglets et défilement indépendants.",
    },
    fileRevisionHistory: {
      badge: 'Historique de fichier',
      title: 'Historique des révisions locales et diffs visuels',
      desc: 'Cliquez sur Historique dans la barre supérieure pour inspecter les instantanés automatiques locaux, comparer les modifications en mode Unifié, Source fractionnée ou Diff rendu, et restaurer une version précédente.',
    },
    gitRepoHistory: {
      badge: 'Historique Git',
      title: 'Historique du dépôt Git et instantanés de commits',
      desc: "Basculez sur l'onglet Historique de la barre latérale pour parcourir les commits Git, examiner les fichiers modifiés par commit et prévisualiser les instantanés historiques sans quitter l'espace de travail.",
    },
    codeBlocksSelection: {
      badge: 'Blocs de code',
      title: 'Sélection de lignes de code, copie et repli',
      desc: 'Cliquez sur un numéro de ligne (ou utilisez (Shift+Click) pour une plage) dans un bloc de code pour surligner et copier des lignes spécifiques, copier le snippet entier en un clic ou replier les longs blocs.',
    },
    mermaidAndMath: {
      badge: 'Mermaid et maths',
      title: 'Diagrammes Mermaid, ZenUML et formules KaTeX',
      desc: 'Générez des organigrammes, diagrammes de séquence, ZenUML, de classes, d\'état et ER 100% hors ligne avec des formules LaTeX ($...$ et $$...$$), avec export instantané en SVG/PNG en un clic.',
    },
    docConversion: {
      badge: 'Conversion doc',
      title: 'Conversion de documents Office et PDF',
      desc: 'Activez la conversion de documents dans les paramètres pour prévisualiser les fichiers .docx, .xlsx, .pptx et .pdf directement en Markdown propre et structuré dans votre espace de travail.',
    },
    knowledgeGraph: {
      badge: 'Graphe de connaissances',
      title: 'Graphe de connaissances interactif et réparation de liens par IA',
      desc: "Ouvrez les Aperçus de l'espace (onglet Graphe) pour visualiser les liens, rétroliens, voisins de 1er/2e degré et clusters de tags, ou copiez une invite pour agent IA afin de corriger les liens brisés.",
    },
    insightsSuite: {
      badge: 'Suite d\'aperçus',
      title: 'Audit de liens, Linter Markdown, Documents liés et Galerie',
      desc: 'Utilisez les Aperçus pour auditer les liens internes/externes cassés (Liens), valider les règles de linter Markdown (Lint), découvrir les fichiers sémantiquement proches (Liés) et parcourir toutes les images et diagrammes (Galerie).',
    },
    exportCenter: {
      badge: 'Centre d\'export',
      title: 'Centre d\'export multi-formats',
      desc: 'Ouvrez le Centre d\'export depuis la barre supérieure pour exporter le document actif ou un lot filtré de l\'espace en HTML autonome, PDF, DOCX, PNG ou SVG avec un style fidèle à votre thème.',
    },
    aiManualPrompt: {
      badge: 'Assistant IA',
      title: 'Manuel prêt pour l\'IA et invite contextuelle',
      desc: "Ouvrez l'onglet Manuel d'utilisation sur la page d'accueil pour copier une invite IA alignée sur votre version (référençant llm.txt et le Changelog) dans n'importe quel assistant pour un guidage précis étape par étape.",
    },
    visualThemeStyles: {
      badge: 'Thèmes visuels',
      title: 'Plus de 8 styles thématiques et compagnons animaux',
      desc: 'Basculez entre les thèmes Par défaut, Glass, Bento, Raw Grid, Cyberpunk et les animaux interactifs (Corgi, Chat, Hamster), et changez de mode clair/sombre à tout moment avec (Ctrl+T).',
    },
    tourAndKeybindings: {
      badge: 'Visite et raccourcis',
      title: 'Raccourcis personnalisés et visite guidée interactive',
      desc: 'Modifiez ou désactivez n\'importe quel raccourci dans les paramètres, exportez/importez votre configuration (.json), et lancez la visite interactive depuis l\'accueil pour découvrir toutes les fonctionnalités.',
    },
  },
};
