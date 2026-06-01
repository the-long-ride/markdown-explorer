(() => {
  /* ── i18n dictionary ───────────────────────────────────────────── */
  const LANGS = {
    en: {
      label: "EN",
      skipToContent: "Skip to content",
      navFeatures: "Features",
      navGallery: "Gallery",
      navDownload: "Download",
      navFaq: "FAQ",
      heroEyebrow: "VS Code extension and desktop app",
      heroCopy: "A private Markdown workspace reader with exact search jumps, Mermaid, math, video, syntax-highlighted code, interactive tables, charts, tabs, and a calm layout for real documentation.",
      btnInstallVscode: "Install for VS Code",
      btnDownloadDesktop: "Download desktop app",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Latest GitHub Release",
      metric1: "search scopes: file, workspace, all tabs",
      metric2: "highlighted programming languages",
      metric3: "row tables stay sortable and filterable",
      metric4: "Mermaid diagram styles rendered in docs",
      featuresEyebrow: "Built for agent-era Markdown",
      featuresTitle: "Your docs become an app",
      featuresSubtitle: "Markdown Explorer keeps files local while making big Markdown workspaces easier to scan, search, understand, and present.",
      featureSearchKicker: "Search",
      featureSearchTitle: "Find content across every open workspace tab",
      featureSearchBody: "Search current file, current workspace, or all desktop tabs. Results show focused excerpts and jump to the exact clicked match.",
      featureTablesKicker: "Tables",
      featureTablesTitle: "Large tables stay usable",
      featureTablesBody: "Sort and filter real rows, use multi-choice filters, and keep long tables collapsed while exploring filtered results.",
      featureChartsKicker: "Charts",
      featureChartsTitle: "Turn Markdown data into charts",
      featureChartsBody: "Switch suitable tables into Bar, Line, or Pie views when numeric columns are detected.",
      featureDiagramsKicker: "Diagrams",
      featureDiagramsTitle: "Mermaid diagrams render cleanly",
      featureDiagramsBody: "Flowcharts, timelines, git graphs, architecture diagrams, and more render inside your local Markdown reader.",
      featureMediaKicker: "Media",
      featureMediaTitle: "Markdown can carry video too",
      featureMediaBody: "Embed local video or supported streaming links without turning your documentation into a separate website.",
      galleryEyebrow: "Fresh screenshots",
      galleryTitle: "A viewer made for dense docs",
      gallerySubtitle: "Use Markdown Explorer for agent memory folders, engineering runbooks, release notes, diagrams, demos, and knowledge bases.",
      galleryCaption1: "Readable code blocks with language labels, line numbers, copy controls, and strong contrast.",
      galleryCaption2: "LaTeX math renders directly in the document flow.",
      galleryCaption3: "Interactive HTML sandboxes run in isolated previews.",
      galleryCaption4: "Zoom and inspect images or diagrams in a focused media modal.",
      galleryCaption5: "Desktop mode remembers recent workspaces and opens folders quickly.",
      privacyEyebrow: "Private by default",
      privacyTitle: "Offline, local, and comfortable for real project folders",
      privacyBody: "Markdown Explorer does not upload Markdown content. It scans and renders locally, making it useful for private notes, agent memory folders, engineering docs, runbooks, and project knowledge bases.",
      downloadEyebrow: "Get Markdown Explorer",
      downloadTitle: "Install the extension or download the desktop app",
      downloadSubtitle: "The desktop buttons read the current release version and assets from the GitHub API when this page loads.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "Best choice for VS Code users. Launch the docs viewer directly inside your editor.",
      dlVscodeBtn: "Install extension",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Use this for VSCodium and VS Code-compatible editors that rely on Open VSX.",
      dlOvxBtn: "Install from Open VSX",
      dlWinTitle: "Windows desktop",
      dlWinBody: "Download the portable `.exe` from the latest release and run it directly.",
      dlWinBtn: "Download Windows",
      dlMacTitle: "macOS desktop",
      dlMacBody: "Download a `.dmg` for your chip. Use `arm64` for Apple Silicon and `x64` for Intel Macs.",
      dlMacBtn: "Download macOS",
      dlLinuxTitle: "Linux desktop",
      dlLinuxBody: "Use `.AppImage` for portable launch, or `.deb` on Debian and Ubuntu-based systems.",
      dlLinuxBtn: "Download Linux",
      dlGhTitle: "Latest release page",
      dlGhBody: "Every GitHub Release includes file descriptions so you can pick the right package for your OS.",
      dlGhBtn: "View latest release",
      releaseChecking: "Checking latest release assets...",
      faqEyebrow: "Questions",
      faqTitle: "Common questions",
      faq1Q: "Is Markdown Explorer free?",
      faq1A: "Yes. The project is MIT licensed and the GitHub repository is public.",
      faq2Q: "Does it work without internet?",
      faq2A: "Yes. Rendering and searching happen locally. The website download buttons use GitHub only to find the latest release files and public download totals.",
      faq3Q: "Which desktop file should I download?",
      faq3A: "Windows users should choose `.exe`. Linux users can choose `.AppImage` or `.deb`. macOS users should choose `.dmg`, with `arm64` for Apple Silicon and `x64` for Intel.",
      footerBy: "Markdown Explorer by",
      footerIssues: "Issues",
      footerLicense: "License",
      releaseApiNote: "Desktop downloads resolve to GitHub Release",
      releaseApiNoteFallback: "Desktop downloads resolve from the GitHub Releases API.",
      releaseApiFail: "Could not read GitHub assets right now. Download buttons open the latest release page instead.",
      download: "download",
      downloads: "downloads",
      acrossAllVersions: "across all versions",
      acrossAllDesktop: "across all desktop releases.",
      seeChangelog: "See changelog on GitHub.",
    },
    vi: {
      label: "VI",
      skipToContent: "Bỏ qua nội dung",
      navFeatures: "Tính năng",
      navGallery: "Thư viện",
      navDownload: "Tải xuống",
      navFaq: "FAQ",
      heroEyebrow: "Tiện ích VS Code và ứng dụng máy tính",
      heroCopy: "Trình đọc Markdown cá nhân với tìm kiếm chính xác, Mermaid, toán học, video, tô sáng cú pháp, bảng tương tác, biểu đồ, tab và bố cục gọn gàng cho tài liệu thực.",
      btnInstallVscode: "Cài đặt cho VS Code",
      btnDownloadDesktop: "Tải ứng dụng máy tính",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Bản phát hành mới nhất GitHub",
      metric1: "phạm vi tìm kiếm: tệp, workspace, tất cả tab",
      metric2: "ngôn ngữ lập trình được tô sáng",
      metric3: "hàng bảng vẫn có thể sắp xếp và lọc",
      metric4: "kiểu sơ đồ Mermaid được kết xuất trong tài liệu",
      featuresEyebrow: "Được xây dựng cho Markdown thời AI",
      featuresTitle: "Tài liệu của bạn trở thành ứng dụng",
      featuresSubtitle: "Markdown Explorer giữ tệp cục bộ trong khi giúp các workspace Markdown lớn dễ quét, tìm kiếm, hiểu và trình bày hơn.",
      featureSearchKicker: "Tìm kiếm",
      featureSearchTitle: "Tìm nội dung trên mọi tab workspace đang mở",
      featureSearchBody: "Tìm kiếm tệp hiện tại, workspace hiện tại hoặc tất cả tab máy tính. Kết quả hiển thị đoạn trích và nhảy đến kết quả được nhấp.",
      featureTablesKicker: "Bảng",
      featureTablesTitle: "Bảng lớn vẫn dễ sử dụng",
      featureTablesBody: "Sắp xếp và lọc hàng thực, sử dụng bộ lọc nhiều lựa chọn và giữ bảng dài thu gọn khi khám phá kết quả lọc.",
      featureChartsKicker: "Biểu đồ",
      featureChartsTitle: "Chuyển đổi dữ liệu Markdown thành biểu đồ",
      featureChartsBody: "Chuyển các bảng phù hợp sang chế độ Thanh, Đường hoặc Hình tròn khi phát hiện cột số.",
      featureDiagramsKicker: "Sơ đồ",
      featureDiagramsTitle: "Sơ đồ Mermaid kết xuất gọn gàng",
      featureDiagramsBody: "Lưu đồ, dòng thời gian, biểu đồ git, sơ đồ kiến trúc và hơn thế nữa kết xuất ngay trong trình đọc Markdown cục bộ.",
      featureMediaKicker: "Phương tiện",
      featureMediaTitle: "Markdown cũng có thể chứa video",
      featureMediaBody: "Nhúng video cục bộ hoặc liên kết phát trực tuyến được hỗ trợ mà không cần biến tài liệu thành một trang web riêng biệt.",
      galleryEyebrow: "Ảnh chụp màn hình mới nhất",
      galleryTitle: "Trình xem dành cho tài liệu dày đặc",
      gallerySubtitle: "Sử dụng Markdown Explorer cho thư mục bộ nhớ AI, sổ tay vận hành, ghi chú phát hành, sơ đồ và cơ sở kiến thức.",
      galleryCaption1: "Khối mã dễ đọc với nhãn ngôn ngữ, số dòng, điều khiển sao chép và độ tương phản cao.",
      galleryCaption2: "Toán học LaTeX kết xuất trực tiếp trong luồng tài liệu.",
      galleryCaption3: "Sandbox HTML tương tác chạy trong bản xem trước biệt lập.",
      galleryCaption4: "Phóng to và kiểm tra hình ảnh hoặc sơ đồ trong modal phương tiện tập trung.",
      galleryCaption5: "Chế độ máy tính ghi nhớ workspace gần đây và mở thư mục nhanh chóng.",
      privacyEyebrow: "Riêng tư theo mặc định",
      privacyTitle: "Ngoại tuyến, cục bộ và thoải mái cho thư mục dự án thực",
      privacyBody: "Markdown Explorer không tải lên nội dung Markdown. Nó quét và kết xuất cục bộ, hữu ích cho ghi chú cá nhân, thư mục bộ nhớ AI, tài liệu kỹ thuật, sổ tay vận hành và cơ sở kiến thức dự án.",
      downloadEyebrow: "Tải Markdown Explorer",
      downloadTitle: "Cài đặt tiện ích hoặc tải ứng dụng máy tính",
      downloadSubtitle: "Các nút máy tính đọc phiên bản phát hành hiện tại và tài sản từ GitHub API khi trang này tải.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "Lựa chọn tốt nhất cho người dùng VS Code. Khởi chạy trình xem tài liệu trực tiếp bên trong trình soạn thảo.",
      dlVscodeBtn: "Cài đặt tiện ích",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Dùng cho VSCodium và các trình soạn thảo tương thích VS Code dựa trên Open VSX.",
      dlOvxBtn: "Cài từ Open VSX",
      dlWinTitle: "Máy tính Windows",
      dlWinBody: "Tải `.exe` di động từ bản phát hành mới nhất và chạy trực tiếp.",
      dlWinBtn: "Tải Windows",
      dlMacTitle: "Máy tính macOS",
      dlMacBody: "Tải `.dmg` cho chip của bạn. Dùng `arm64` cho Apple Silicon và `x64` cho Intel Mac.",
      dlMacBtn: "Tải macOS",
      dlLinuxTitle: "Máy tính Linux",
      dlLinuxBody: "Dùng `.AppImage` để khởi chạy di động hoặc `.deb` trên hệ thống Debian và Ubuntu.",
      dlLinuxBtn: "Tải Linux",
      dlGhTitle: "Trang phát hành mới nhất",
      dlGhBody: "Mỗi GitHub Release bao gồm mô tả tệp để bạn có thể chọn gói phù hợp cho hệ điều hành của mình.",
      dlGhBtn: "Xem bản phát hành mới nhất",
      releaseChecking: "Đang kiểm tra tài sản phát hành mới nhất...",
      faqEyebrow: "Câu hỏi",
      faqTitle: "Câu hỏi thường gặp",
      faq1Q: "Markdown Explorer có miễn phí không?",
      faq1A: "Có. Dự án được cấp phép MIT và kho GitHub là công khai.",
      faq2Q: "Có hoạt động không có internet không?",
      faq2A: "Có. Kết xuất và tìm kiếm diễn ra cục bộ. Các nút tải xuống của trang web chỉ sử dụng GitHub để tìm tệp phát hành mới nhất và tổng số lượt tải xuống công khai.",
      faq3Q: "Tôi nên tải tệp máy tính nào?",
      faq3A: "Người dùng Windows nên chọn `.exe`. Người dùng Linux có thể chọn `.AppImage` hoặc `.deb`. Người dùng macOS nên chọn `.dmg`, với `arm64` cho Apple Silicon và `x64` cho Intel.",
      footerBy: "Markdown Explorer bởi",
      footerIssues: "Vấn đề",
      footerLicense: "Giấy phép",
      releaseApiNote: "Nút tải máy tính trỏ đến GitHub Release",
      releaseApiNoteFallback: "Nút tải máy tính được phân giải từ GitHub Releases API.",
      releaseApiFail: "Không thể đọc tài sản GitHub lúc này. Nút tải xuống mở trang phát hành mới nhất.",
      download: "lượt tải",
      downloads: "lượt tải",
      acrossAllVersions: "trên tất cả phiên bản",
      acrossAllDesktop: "trên tất cả bản phát hành máy tính.",
      seeChangelog: "Xem changelog trên GitHub.",
    },
    fr: {
      label: "FR",
      skipToContent: "Passer au contenu",
      navFeatures: "Fonctionnalités",
      navGallery: "Galerie",
      navDownload: "Télécharger",
      navFaq: "FAQ",
      heroEyebrow: "Extension VS Code et application bureau",
      heroCopy: "Un lecteur Markdown privé avec recherches précises, Mermaid, maths, vidéo, code colorisé, tableaux interactifs, graphiques, onglets et une mise en page calme pour une vraie documentation.",
      btnInstallVscode: "Installer pour VS Code",
      btnDownloadDesktop: "Télécharger l'app bureau",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Dernière version GitHub",
      metric1: "portées de recherche : fichier, espace de travail, tous les onglets",
      metric2: "langages de programmation mis en évidence",
      metric3: "lignes de tableaux restent triables et filtrables",
      metric4: "styles de diagrammes Mermaid rendus dans les docs",
      featuresEyebrow: "Conçu pour le Markdown de l'ère IA",
      featuresTitle: "Vos docs deviennent une app",
      featuresSubtitle: "Markdown Explorer conserve les fichiers locaux tout en facilitant la navigation, la recherche, la compréhension et la présentation des grands espaces de travail Markdown.",
      featureSearchKicker: "Recherche",
      featureSearchTitle: "Trouvez du contenu dans chaque onglet ouvert",
      featureSearchBody: "Recherchez dans le fichier actuel, l'espace de travail actuel ou tous les onglets bureau. Les résultats affichent des extraits ciblés et sautent à la correspondance exacte.",
      featureTablesKicker: "Tableaux",
      featureTablesTitle: "Les grands tableaux restent utilisables",
      featureTablesBody: "Triez et filtrez les vraies lignes, utilisez des filtres à choix multiples et gardez les longs tableaux réduits lors de l'exploration des résultats filtrés.",
      featureChartsKicker: "Graphiques",
      featureChartsTitle: "Transformez les données Markdown en graphiques",
      featureChartsBody: "Passez les tableaux appropriés en vue Barres, Lignes ou Camembert lorsque des colonnes numériques sont détectées.",
      featureDiagramsKicker: "Diagrammes",
      featureDiagramsTitle: "Les diagrammes Mermaid s'affichent proprement",
      featureDiagramsBody: "Organigrammes, chronologies, graphiques git, diagrammes d'architecture et plus s'affichent dans votre lecteur Markdown local.",
      featureMediaKicker: "Médias",
      featureMediaTitle: "Markdown peut aussi contenir de la vidéo",
      featureMediaBody: "Intégrez des vidéos locales ou des liens de streaming supportés sans transformer votre documentation en site web séparé.",
      galleryEyebrow: "Captures d'écran récentes",
      galleryTitle: "Un lecteur fait pour les docs denses",
      gallerySubtitle: "Utilisez Markdown Explorer pour les dossiers mémoire IA, les runbooks, les notes de version, les diagrammes et les bases de connaissances.",
      galleryCaption1: "Blocs de code lisibles avec étiquettes de langage, numéros de ligne, contrôles de copie et fort contraste.",
      galleryCaption2: "Les maths LaTeX s'affichent directement dans le flux du document.",
      galleryCaption3: "Les sandbox HTML interactifs fonctionnent dans des aperçus isolés.",
      galleryCaption4: "Zoomez et inspectez des images ou diagrammes dans une modale média focalisée.",
      galleryCaption5: "Le mode bureau mémorise les espaces de travail récents et ouvre les dossiers rapidement.",
      privacyEyebrow: "Privé par défaut",
      privacyTitle: "Hors ligne, local et confortable pour les vrais dossiers de projet",
      privacyBody: "Markdown Explorer ne télécharge pas le contenu Markdown. Il scanne et rend localement, utile pour les notes privées, les dossiers mémoire IA, la documentation technique, les runbooks et les bases de connaissances.",
      downloadEyebrow: "Obtenir Markdown Explorer",
      downloadTitle: "Installez l'extension ou téléchargez l'app bureau",
      downloadSubtitle: "Les boutons bureau lisent la version de publication actuelle et les ressources depuis l'API GitHub au chargement de la page.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "Meilleur choix pour les utilisateurs VS Code. Lancez le lecteur de docs directement dans votre éditeur.",
      dlVscodeBtn: "Installer l'extension",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "À utiliser pour VSCodium et les éditeurs compatibles VS Code qui s'appuient sur Open VSX.",
      dlOvxBtn: "Installer depuis Open VSX",
      dlWinTitle: "Bureau Windows",
      dlWinBody: "Téléchargez le `.exe` portable depuis la dernière version et exécutez-le directement.",
      dlWinBtn: "Télécharger Windows",
      dlMacTitle: "Bureau macOS",
      dlMacBody: "Téléchargez un `.dmg` pour votre puce. Utilisez `arm64` pour Apple Silicon et `x64` pour les Mac Intel.",
      dlMacBtn: "Télécharger macOS",
      dlLinuxTitle: "Bureau Linux",
      dlLinuxBody: "Utilisez `.AppImage` pour un lancement portable, ou `.deb` sur les systèmes Debian et Ubuntu.",
      dlLinuxBtn: "Télécharger Linux",
      dlGhTitle: "Dernière page de version",
      dlGhBody: "Chaque version GitHub inclut des descriptions de fichiers pour choisir le bon paquet pour votre OS.",
      dlGhBtn: "Voir la dernière version",
      releaseChecking: "Vérification des ressources de la dernière version...",
      faqEyebrow: "Questions",
      faqTitle: "Questions fréquentes",
      faq1Q: "Markdown Explorer est-il gratuit ?",
      faq1A: "Oui. Le projet est sous licence MIT et le dépôt GitHub est public.",
      faq2Q: "Fonctionne-t-il sans internet ?",
      faq2A: "Oui. Le rendu et la recherche se font localement. Les boutons de téléchargement n'utilisent GitHub que pour trouver les derniers fichiers de version et les totaux de téléchargements publics.",
      faq3Q: "Quel fichier bureau dois-je télécharger ?",
      faq3A: "Les utilisateurs Windows doivent choisir `.exe`. Les utilisateurs Linux peuvent choisir `.AppImage` ou `.deb`. Les utilisateurs macOS doivent choisir `.dmg`, avec `arm64` pour Apple Silicon et `x64` pour Intel.",
      footerBy: "Markdown Explorer par",
      footerIssues: "Problèmes",
      footerLicense: "Licence",
      releaseApiNote: "Les téléchargements bureau pointent vers GitHub Release",
      releaseApiNoteFallback: "Les téléchargements bureau sont résolus depuis l'API GitHub Releases.",
      releaseApiFail: "Impossible de lire les ressources GitHub pour l'instant. Les boutons ouvrent la dernière page de version.",
      download: "téléchargement",
      downloads: "téléchargements",
      acrossAllVersions: "sur toutes les versions",
      acrossAllDesktop: "sur toutes les versions bureau.",
      seeChangelog: "Voir le changelog sur GitHub.",
    },
    es: {
      label: "ES",
      skipToContent: "Saltar al contenido",
      navFeatures: "Características",
      navGallery: "Galería",
      navDownload: "Descargar",
      navFaq: "FAQ",
      heroEyebrow: "Extensión de VS Code y aplicación de escritorio",
      heroCopy: "Un lector privado de espacios de trabajo Markdown con búsquedas exactas, Mermaid, matemáticas, vídeo, código resaltado, tablas interactivas, gráficos, pestañas y un diseño tranquilo para documentación real.",
      btnInstallVscode: "Instalar para VS Code",
      btnDownloadDesktop: "Descargar app de escritorio",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Última versión de GitHub",
      metric1: "ámbitos de búsqueda: archivo, espacio de trabajo, todas las pestañas",
      metric2: "lenguajes de programación resaltados",
      metric3: "filas de tablas siguen siendo ordenables y filtrables",
      metric4: "estilos de diagrama Mermaid renderizados en docs",
      featuresEyebrow: "Creado para el Markdown de la era IA",
      featuresTitle: "Tus docs se convierten en una app",
      featuresSubtitle: "Markdown Explorer mantiene los archivos locales mientras facilita la exploración, búsqueda, comprensión y presentación de grandes espacios de trabajo Markdown.",
      featureSearchKicker: "Búsqueda",
      featureSearchTitle: "Encuentra contenido en cada pestaña abierta",
      featureSearchBody: "Busca en el archivo actual, el espacio de trabajo actual o todas las pestañas de escritorio. Los resultados muestran extractos enfocados y saltan a la coincidencia exacta.",
      featureTablesKicker: "Tablas",
      featureTablesTitle: "Las tablas grandes siguen siendo usables",
      featureTablesBody: "Ordena y filtra filas reales, usa filtros de selección múltiple y mantén las tablas largas colapsadas al explorar resultados filtrados.",
      featureChartsKicker: "Gráficos",
      featureChartsTitle: "Convierte datos Markdown en gráficos",
      featureChartsBody: "Cambia las tablas adecuadas a vistas de Barras, Líneas o Circular cuando se detectan columnas numéricas.",
      featureDiagramsKicker: "Diagramas",
      featureDiagramsTitle: "Los diagramas Mermaid se renderizan limpiamente",
      featureDiagramsBody: "Diagramas de flujo, líneas de tiempo, gráficos git, diagramas de arquitectura y más se renderizan en tu lector Markdown local.",
      featureMediaKicker: "Medios",
      featureMediaTitle: "Markdown también puede llevar vídeo",
      featureMediaBody: "Incrusta vídeo local o enlaces de streaming compatibles sin convertir tu documentación en un sitio web separado.",
      galleryEyebrow: "Capturas de pantalla recientes",
      galleryTitle: "Un visor hecho para docs densos",
      gallerySubtitle: "Usa Markdown Explorer para carpetas de memoria IA, runbooks de ingeniería, notas de versión, diagramas y bases de conocimiento.",
      galleryCaption1: "Bloques de código legibles con etiquetas de lenguaje, números de línea, controles de copia y alto contraste.",
      galleryCaption2: "Las matemáticas LaTeX se renderizan directamente en el flujo del documento.",
      galleryCaption3: "Los sandboxes HTML interactivos se ejecutan en vistas previas aisladas.",
      galleryCaption4: "Amplía e inspecciona imágenes o diagramas en un modal de medios enfocado.",
      galleryCaption5: "El modo escritorio recuerda los espacios de trabajo recientes y abre carpetas rápidamente.",
      privacyEyebrow: "Privado por defecto",
      privacyTitle: "Sin conexión, local y cómodo para carpetas de proyecto reales",
      privacyBody: "Markdown Explorer no sube contenido Markdown. Escanea y renderiza localmente, siendo útil para notas privadas, carpetas de memoria IA, documentación técnica, runbooks y bases de conocimiento.",
      downloadEyebrow: "Obtén Markdown Explorer",
      downloadTitle: "Instala la extensión o descarga la app de escritorio",
      downloadSubtitle: "Los botones de escritorio leen la versión de lanzamiento actual y los activos desde la API de GitHub cuando carga la página.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "La mejor opción para usuarios de VS Code. Lanza el visor de docs directamente en tu editor.",
      dlVscodeBtn: "Instalar extensión",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Úsalo para VSCodium y editores compatibles con VS Code que dependen de Open VSX.",
      dlOvxBtn: "Instalar desde Open VSX",
      dlWinTitle: "Escritorio Windows",
      dlWinBody: "Descarga el `.exe` portable desde la última versión y ejecútalo directamente.",
      dlWinBtn: "Descargar Windows",
      dlMacTitle: "Escritorio macOS",
      dlMacBody: "Descarga un `.dmg` para tu chip. Usa `arm64` para Apple Silicon y `x64` para Mac Intel.",
      dlMacBtn: "Descargar macOS",
      dlLinuxTitle: "Escritorio Linux",
      dlLinuxBody: "Usa `.AppImage` para lanzamiento portable, o `.deb` en sistemas Debian y Ubuntu.",
      dlLinuxBtn: "Descargar Linux",
      dlGhTitle: "Última página de lanzamiento",
      dlGhBody: "Cada GitHub Release incluye descripciones de archivos para elegir el paquete correcto para tu SO.",
      dlGhBtn: "Ver último lanzamiento",
      releaseChecking: "Verificando activos de la última versión...",
      faqEyebrow: "Preguntas",
      faqTitle: "Preguntas frecuentes",
      faq1Q: "¿Es gratuito Markdown Explorer?",
      faq1A: "Sí. El proyecto tiene licencia MIT y el repositorio de GitHub es público.",
      faq2Q: "¿Funciona sin internet?",
      faq2A: "Sí. El renderizado y la búsqueda ocurren localmente. Los botones de descarga del sitio web solo usan GitHub para encontrar los últimos archivos de versión y los totales de descargas públicos.",
      faq3Q: "¿Qué archivo de escritorio debo descargar?",
      faq3A: "Los usuarios de Windows deben elegir `.exe`. Los usuarios de Linux pueden elegir `.AppImage` o `.deb`. Los usuarios de macOS deben elegir `.dmg`, con `arm64` para Apple Silicon y `x64` para Intel.",
      footerBy: "Markdown Explorer por",
      footerIssues: "Problemas",
      footerLicense: "Licencia",
      releaseApiNote: "Las descargas de escritorio apuntan a GitHub Release",
      releaseApiNoteFallback: "Las descargas de escritorio se resuelven desde la API de GitHub Releases.",
      releaseApiFail: "No se pudieron leer los activos de GitHub ahora. Los botones abren la última página de lanzamiento.",
      download: "descarga",
      downloads: "descargas",
      acrossAllVersions: "en todas las versiones",
      acrossAllDesktop: "en todas las versiones de escritorio.",
      seeChangelog: "Ver changelog en GitHub.",
    },
    zh: {
      label: "中文",
      skipToContent: "跳至内容",
      navFeatures: "功能",
      navGallery: "图库",
      navDownload: "下载",
      navFaq: "常见问题",
      heroEyebrow: "VS Code 扩展和桌面应用",
      heroCopy: "私有 Markdown 工作区阅读器，具有精确搜索跳转、Mermaid、数学、视频、代码高亮、交互式表格、图表、标签页和适合真实文档的简洁布局。",
      btnInstallVscode: "安装 VS Code 版",
      btnDownloadDesktop: "下载桌面应用",
      stripVscodeMarketplace: "VS Code 市场",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "最新 GitHub 版本",
      metric1: "搜索范围：文件、工作区、所有标签页",
      metric2: "支持语法高亮的编程语言",
      metric3: "行表格仍可排序和筛选",
      metric4: "在文档中渲染的 Mermaid 图表样式",
      featuresEyebrow: "为 AI 时代的 Markdown 而生",
      featuresTitle: "您的文档变成应用",
      featuresSubtitle: "Markdown Explorer 将文件保存在本地，同时使大型 Markdown 工作区更易于扫描、搜索、理解和展示。",
      featureSearchKicker: "搜索",
      featureSearchTitle: "在每个打开的工作区标签页中查找内容",
      featureSearchBody: "搜索当前文件、当前工作区或所有桌面标签页。结果显示聚焦摘录并跳转到精确点击的匹配项。",
      featureTablesKicker: "表格",
      featureTablesTitle: "大型表格保持可用",
      featureTablesBody: "对真实行进行排序和筛选，使用多选筛选器，在探索筛选结果时保持长表格折叠。",
      featureChartsKicker: "图表",
      featureChartsTitle: "将 Markdown 数据转换为图表",
      featureChartsBody: "当检测到数字列时，将合适的表格切换为条形图、折线图或饼图视图。",
      featureDiagramsKicker: "图形",
      featureDiagramsTitle: "Mermaid 图形渲染清晰",
      featureDiagramsBody: "流程图、时间线、Git 图、架构图等在您的本地 Markdown 阅读器中渲染。",
      featureMediaKicker: "媒体",
      featureMediaTitle: "Markdown 也可以包含视频",
      featureMediaBody: "嵌入本地视频或支持的流媒体链接，无需将您的文档变成单独的网站。",
      galleryEyebrow: "最新截图",
      galleryTitle: "为密集文档设计的查看器",
      gallerySubtitle: "将 Markdown Explorer 用于 AI 记忆文件夹、工程手册、发布说明、图表和知识库。",
      galleryCaption1: "带语言标签、行号、复制控件和高对比度的可读代码块。",
      galleryCaption2: "LaTeX 数学直接在文档流中渲染。",
      galleryCaption3: "交互式 HTML 沙盒在隔离预览中运行。",
      galleryCaption4: "在聚焦媒体模态中缩放和检查图像或图表。",
      galleryCaption5: "桌面模式记住最近的工作区并快速打开文件夹。",
      privacyEyebrow: "默认私有",
      privacyTitle: "离线、本地，适合真实项目文件夹",
      privacyBody: "Markdown Explorer 不上传 Markdown 内容。它在本地扫描和渲染，适用于私人笔记、AI 记忆文件夹、工程文档、手册和项目知识库。",
      downloadEyebrow: "获取 Markdown Explorer",
      downloadTitle: "安装扩展或下载桌面应用",
      downloadSubtitle: "页面加载时，桌面按钮从 GitHub API 读取当前发布版本和资产。",
      dlVscodeTitle: "VS Code 市场",
      dlVscodeBody: "VS Code 用户的最佳选择。直接在编辑器内启动文档查看器。",
      dlVscodeBtn: "安装扩展",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "适用于依赖 Open VSX 的 VSCodium 和兼容 VS Code 的编辑器。",
      dlOvxBtn: "从 Open VSX 安装",
      dlWinTitle: "Windows 桌面",
      dlWinBody: "从最新版本下载便携式 `.exe` 并直接运行。",
      dlWinBtn: "下载 Windows 版",
      dlMacTitle: "macOS 桌面",
      dlMacBody: "为您的芯片下载 `.dmg`。Apple Silicon 使用 `arm64`，Intel Mac 使用 `x64`。",
      dlMacBtn: "下载 macOS 版",
      dlLinuxTitle: "Linux 桌面",
      dlLinuxBody: "使用 `.AppImage` 进行便携启动，或在 Debian 和 Ubuntu 系统上使用 `.deb`。",
      dlLinuxBtn: "下载 Linux 版",
      dlGhTitle: "最新发布页面",
      dlGhBody: "每个 GitHub Release 都包含文件描述，以便您为您的操作系统选择正确的软件包。",
      dlGhBtn: "查看最新版本",
      releaseChecking: "正在检查最新版本资产...",
      faqEyebrow: "问题",
      faqTitle: "常见问题",
      faq1Q: "Markdown Explorer 是免费的吗？",
      faq1A: "是的。该项目采用 MIT 许可证，GitHub 仓库是公开的。",
      faq2Q: "它在没有网络的情况下工作吗？",
      faq2A: "是的。渲染和搜索在本地进行。网站下载按钮仅使用 GitHub 查找最新发布文件和公开下载总数。",
      faq3Q: "我应该下载哪个桌面文件？",
      faq3A: "Windows 用户应选择 `.exe`。Linux 用户可以选择 `.AppImage` 或 `.deb`。macOS 用户应选择 `.dmg`，Apple Silicon 使用 `arm64`，Intel 使用 `x64`。",
      footerBy: "Markdown Explorer 作者",
      footerIssues: "问题反馈",
      footerLicense: "许可证",
      releaseApiNote: "桌面下载指向 GitHub Release",
      releaseApiNoteFallback: "桌面下载从 GitHub Releases API 解析。",
      releaseApiFail: "目前无法读取 GitHub 资产。下载按钮将打开最新版本页面。",
      download: "次下载",
      downloads: "次下载",
      acrossAllVersions: "跨所有版本",
      acrossAllDesktop: "跨所有桌面版本。",
      seeChangelog: "在 GitHub 上查看更新日志。",
    },
    no: {
      label: "NO",
      skipToContent: "Hopp til innhold",
      navFeatures: "Funksjoner",
      navGallery: "Galleri",
      navDownload: "Last ned",
      navFaq: "FAQ",
      heroEyebrow: "VS Code-utvidelse og skrivebordsapp",
      heroCopy: "En privat Markdown-leser med nøyaktige søkehopp, Mermaid, matte, video, syntaksfremheving, interaktive tabeller, diagrammer, faner og et rolig oppsett for ekte dokumentasjon.",
      btnInstallVscode: "Installer for VS Code",
      btnDownloadDesktop: "Last ned skrivebordsapp",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Siste GitHub-utgivelse",
      metric1: "søkeomfang: fil, arbeidsområde, alle faner",
      metric2: "fremhevede programmeringsspråk",
      metric3: "raders tabeller forblir sorterbare og filtrerbare",
      metric4: "Mermaid-diagramstiler gjengitt i dokumenter",
      featuresEyebrow: "Bygget for AI-era Markdown",
      featuresTitle: "Dokumentene dine blir en app",
      featuresSubtitle: "Markdown Explorer holder filer lokale mens store Markdown-arbeidsområder blir lettere å skanne, søke, forstå og presentere.",
      featureSearchKicker: "Søk",
      featureSearchTitle: "Finn innhold på tvers av alle åpne faner",
      featureSearchBody: "Søk i gjeldende fil, gjeldende arbeidsområde eller alle skrivebordsflippeknapper. Resultater viser fokuserte utdrag og hopper til nøyaktig treff.",
      featureTablesKicker: "Tabeller",
      featureTablesTitle: "Store tabeller forblir brukbare",
      featureTablesBody: "Sorter og filtrer ekte rader, bruk flervalgsfiltre og hold lange tabeller sammenslått mens du utforsker filtrerte resultater.",
      featureChartsKicker: "Diagrammer",
      featureChartsTitle: "Gjør Markdown-data om til diagrammer",
      featureChartsBody: "Bytt passende tabeller til Stolpe-, Linje- eller Sektorvisninger når numeriske kolonner oppdages.",
      featureDiagramsKicker: "Figurer",
      featureDiagramsTitle: "Mermaid-figurer gjengis rent",
      featureDiagramsBody: "Flytskjemaer, tidslinjer, git-grafer, arkitekturdiagrammer og mer gjengis i din lokale Markdown-leser.",
      featureMediaKicker: "Medier",
      featureMediaTitle: "Markdown kan også bære video",
      featureMediaBody: "Bygg inn lokal video eller støttede strømmingslenker uten å gjøre dokumentasjonen til et eget nettsted.",
      galleryEyebrow: "Ferske skjermbilder",
      galleryTitle: "En leser laget for tette dokumenter",
      gallerySubtitle: "Bruk Markdown Explorer for AI-minnemapper, driftsruller, utgivelsesnotater, diagrammer og kunnskapsbaser.",
      galleryCaption1: "Lesbare kodeblokker med språketiketter, linjenumre, kopieringskontroller og sterk kontrast.",
      galleryCaption2: "LaTeX-matematikk gjengis direkte i dokumentflyten.",
      galleryCaption3: "Interaktive HTML-sandkasser kjøres i isolerte forhåndsvisninger.",
      galleryCaption4: "Zoom og inspiser bilder eller diagrammer i en fokusert mediemodal.",
      galleryCaption5: "Skrivebordsmodus husker nylige arbeidsområder og åpner mapper raskt.",
      privacyEyebrow: "Privat som standard",
      privacyTitle: "Frakoblet, lokal og komfortabel for ekte prosjektmapper",
      privacyBody: "Markdown Explorer laster ikke opp Markdown-innhold. Det skanner og gjengir lokalt, nyttig for private notater, AI-minnemapper, teknisk dokumentasjon, driftsruller og prosjektkunnskapsbaser.",
      downloadEyebrow: "Få Markdown Explorer",
      downloadTitle: "Installer utvidelsen eller last ned skrivebordsappen",
      downloadSubtitle: "Skrivebordsknappene leser gjeldende utgivelsesversjon og ressurser fra GitHub API når denne siden lastes.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "Beste valg for VS Code-brukere. Start dokumentleseren direkte i editoren din.",
      dlVscodeBtn: "Installer utvidelse",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Bruk dette for VSCodium og VS Code-kompatible editorer som bruker Open VSX.",
      dlOvxBtn: "Installer fra Open VSX",
      dlWinTitle: "Windows-skrivebord",
      dlWinBody: "Last ned den bærbare `.exe` fra siste utgivelse og kjør den direkte.",
      dlWinBtn: "Last ned Windows",
      dlMacTitle: "macOS-skrivebord",
      dlMacBody: "Last ned en `.dmg` for brikken din. Bruk `arm64` for Apple Silicon og `x64` for Intel Mac.",
      dlMacBtn: "Last ned macOS",
      dlLinuxTitle: "Linux-skrivebord",
      dlLinuxBody: "Bruk `.AppImage` for bærbar oppstart, eller `.deb` på Debian og Ubuntu-baserte systemer.",
      dlLinuxBtn: "Last ned Linux",
      dlGhTitle: "Siste utgivelsesside",
      dlGhBody: "Hver GitHub-utgivelse inkluderer filbeskrivelser slik at du kan velge riktig pakke for ditt OS.",
      dlGhBtn: "Vis siste utgivelse",
      releaseChecking: "Sjekker siste utgivelsesressurser...",
      faqEyebrow: "Spørsmål",
      faqTitle: "Vanlige spørsmål",
      faq1Q: "Er Markdown Explorer gratis?",
      faq1A: "Ja. Prosjektet er MIT-lisensiert og GitHub-repositoriet er offentlig.",
      faq2Q: "Fungerer det uten internett?",
      faq2A: "Ja. Gjengivelse og søk skjer lokalt. Nedlastingsknappene bruker bare GitHub for å finne de siste utgivelsesfilene og offentlige nedlastingstotaler.",
      faq3Q: "Hvilken skrivebordfil skal jeg laste ned?",
      faq3A: "Windows-brukere bør velge `.exe`. Linux-brukere kan velge `.AppImage` eller `.deb`. macOS-brukere bør velge `.dmg`, med `arm64` for Apple Silicon og `x64` for Intel.",
      footerBy: "Markdown Explorer av",
      footerIssues: "Problemer",
      footerLicense: "Lisens",
      releaseApiNote: "Skrivebordsnedlastinger peker til GitHub Release",
      releaseApiNoteFallback: "Skrivebordsnedlastinger løses fra GitHub Releases API.",
      releaseApiFail: "Kunne ikke lese GitHub-ressurser akkurat nå. Knappene åpner den siste utgivelsessiden i stedet.",
      download: "nedlasting",
      downloads: "nedlastinger",
      acrossAllVersions: "på tvers av alle versjoner",
      acrossAllDesktop: "på tvers av alle skrivebordsutgivelser.",
      seeChangelog: "Se endringslogg på GitHub.",
    },
    ja: {
      label: "JA",
      skipToContent: "コンテンツへスキップ",
      navFeatures: "機能",
      navGallery: "ギャラリー",
      navDownload: "ダウンロード",
      navFaq: "よくある質問",
      heroEyebrow: "VS Code 拡張機能とデスクトップアプリ",
      heroCopy: "正確な検索ジャンプ、Mermaid、数学、ビデオ、コードハイライト、インタラクティブなテーブル、チャート、タブ、そして実際のドキュメント向けの落ち着いたレイアウトを備えたプライベート Markdown ワークスペースリーダー。",
      btnInstallVscode: "VS Code にインストール",
      btnDownloadDesktop: "デスクトップアプリをダウンロード",
      stripVscodeMarketplace: "VS Code マーケットプレイス",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "最新の GitHub リリース",
      metric1: "検索範囲：ファイル、ワークスペース、全タブ",
      metric2: "ハイライト対応プログラミング言語",
      metric3: "行テーブルでもソート・フィルター可能",
      metric4: "ドキュメントでレンダリングされる Mermaid 図スタイル",
      featuresEyebrow: "AI 時代の Markdown のために構築",
      featuresTitle: "ドキュメントがアプリになる",
      featuresSubtitle: "Markdown Explorer はファイルをローカルに保ちながら、大規模な Markdown ワークスペースのスキャン、検索、理解、プレゼンテーションを容易にします。",
      featureSearchKicker: "検索",
      featureSearchTitle: "すべての開いているタブでコンテンツを検索",
      featureSearchBody: "現在のファイル、現在のワークスペース、またはすべてのデスクトップタブを検索します。結果は焦点を絞った抜粋を表示し、クリックした正確な一致にジャンプします。",
      featureTablesKicker: "テーブル",
      featureTablesTitle: "大きなテーブルも使いやすい",
      featureTablesBody: "実際の行をソートおよびフィルタリングし、複数選択フィルターを使用し、フィルタリング結果を探索しながら長いテーブルを折りたたんだままにします。",
      featureChartsKicker: "チャート",
      featureChartsTitle: "Markdown データをチャートに変換",
      featureChartsBody: "数値列が検出されたとき、適切なテーブルを棒、折れ線、または円グラフビューに切り替えます。",
      featureDiagramsKicker: "図形",
      featureDiagramsTitle: "Mermaid 図がきれいにレンダリング",
      featureDiagramsBody: "フローチャート、タイムライン、Git グラフ、アーキテクチャ図など、ローカル Markdown リーダー内でレンダリングされます。",
      featureMediaKicker: "メディア",
      featureMediaTitle: "Markdown はビデオも含められる",
      featureMediaBody: "ドキュメントを別のウェブサイトにすることなく、ローカルビデオまたはサポートされているストリーミングリンクを埋め込みます。",
      galleryEyebrow: "最新スクリーンショット",
      galleryTitle: "密度の高いドキュメント向けビューワー",
      gallerySubtitle: "AI メモリフォルダー、エンジニアリングランブック、リリースノート、図、デモ、知識ベースに Markdown Explorer を使用します。",
      galleryCaption1: "言語ラベル、行番号、コピーコントロール、強いコントラストを備えた読みやすいコードブロック。",
      galleryCaption2: "LaTeX 数学がドキュメントフローに直接レンダリングされます。",
      galleryCaption3: "インタラクティブな HTML サンドボックスが分離されたプレビューで実行されます。",
      galleryCaption4: "フォーカスされたメディアモーダルで画像や図を拡大して確認します。",
      galleryCaption5: "デスクトップモードは最近のワークスペースを記憶し、フォルダーをすばやく開きます。",
      privacyEyebrow: "デフォルトでプライベート",
      privacyTitle: "オフライン、ローカル、実際のプロジェクトフォルダーに快適",
      privacyBody: "Markdown Explorer は Markdown コンテンツをアップロードしません。ローカルでスキャンとレンダリングを行い、プライベートメモ、AI メモリフォルダー、エンジニアリングドキュメント、ランブック、プロジェクト知識ベースに役立ちます。",
      downloadEyebrow: "Markdown Explorer を入手",
      downloadTitle: "拡張機能をインストールまたはデスクトップアプリをダウンロード",
      downloadSubtitle: "デスクトップボタンはページ読み込み時に GitHub API から現在のリリースバージョンとアセットを読み取ります。",
      dlVscodeTitle: "VS Code マーケットプレイス",
      dlVscodeBody: "VS Code ユーザーに最適。エディター内で直接ドキュメントビューワーを起動します。",
      dlVscodeBtn: "拡張機能をインストール",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Open VSX に依存する VSCodium および VS Code 互換エディター用。",
      dlOvxBtn: "Open VSX からインストール",
      dlWinTitle: "Windows デスクトップ",
      dlWinBody: "最新リリースからポータブル `.exe` をダウンロードして直接実行します。",
      dlWinBtn: "Windows をダウンロード",
      dlMacTitle: "macOS デスクトップ",
      dlMacBody: "チップ用の `.dmg` をダウンロードします。Apple Silicon には `arm64`、Intel Mac には `x64` を使用します。",
      dlMacBtn: "macOS をダウンロード",
      dlLinuxTitle: "Linux デスクトップ",
      dlLinuxBody: "ポータブル起動には `.AppImage`、Debian および Ubuntu ベースのシステムには `.deb` を使用します。",
      dlLinuxBtn: "Linux をダウンロード",
      dlGhTitle: "最新リリースページ",
      dlGhBody: "各 GitHub リリースにはファイルの説明が含まれており、OS に適したパッケージを選択できます。",
      dlGhBtn: "最新リリースを表示",
      releaseChecking: "最新リリースアセットを確認中...",
      faqEyebrow: "質問",
      faqTitle: "よくある質問",
      faq1Q: "Markdown Explorer は無料ですか？",
      faq1A: "はい。プロジェクトは MIT ライセンスで、GitHub リポジトリは公開されています。",
      faq2Q: "インターネットなしで動作しますか？",
      faq2A: "はい。レンダリングと検索はローカルで行われます。ウェブサイトのダウンロードボタンは、最新のリリースファイルと公開ダウンロード合計を見つけるためだけに GitHub を使用します。",
      faq3Q: "どのデスクトップファイルをダウンロードすればよいですか？",
      faq3A: "Windows ユーザーは `.exe` を選択してください。Linux ユーザーは `.AppImage` または `.deb` を選択できます。macOS ユーザーは `.dmg` を選択し、Apple Silicon には `arm64`、Intel には `x64` を使用してください。",
      footerBy: "Markdown Explorer 作者",
      footerIssues: "問題",
      footerLicense: "ライセンス",
      releaseApiNote: "デスクトップダウンロードは GitHub Release を指します",
      releaseApiNoteFallback: "デスクトップダウンロードは GitHub Releases API から解決されます。",
      releaseApiFail: "現在 GitHub アセットを読み取れません。ボタンは最新リリースページを開きます。",
      download: "ダウンロード",
      downloads: "ダウンロード",
      acrossAllVersions: "全バージョンを通じて",
      acrossAllDesktop: "全デスクトップリリースを通じて。",
      seeChangelog: "GitHub で変更履歴を見る。",
    },
    ko: {
      label: "KO",
      skipToContent: "콘텐츠로 건너뛰기",
      navFeatures: "기능",
      navGallery: "갤러리",
      navDownload: "다운로드",
      navFaq: "자주 묻는 질문",
      heroEyebrow: "VS Code 확장 및 데스크톱 앱",
      heroCopy: "정확한 검색 점프, Mermaid, 수학, 비디오, 구문 강조, 대화형 테이블, 차트, 탭 및 실제 문서를 위한 차분한 레이아웃을 갖춘 개인 Markdown 워크스페이스 리더.",
      btnInstallVscode: "VS Code에 설치",
      btnDownloadDesktop: "데스크톱 앱 다운로드",
      stripVscodeMarketplace: "VS Code 마켓플레이스",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "최신 GitHub 릴리스",
      metric1: "검색 범위: 파일, 워크스페이스, 모든 탭",
      metric2: "강조 표시된 프로그래밍 언어",
      metric3: "행 테이블이 정렬 및 필터링 가능",
      metric4: "문서에서 렌더링된 Mermaid 다이어그램 스타일",
      featuresEyebrow: "AI 시대 Markdown을 위해 구축",
      featuresTitle: "문서가 앱이 됩니다",
      featuresSubtitle: "Markdown Explorer는 파일을 로컬에 유지하면서 대규모 Markdown 워크스페이스를 스캔, 검색, 이해, 발표하기 더 쉽게 만듭니다.",
      featureSearchKicker: "검색",
      featureSearchTitle: "모든 열린 워크스페이스 탭에서 콘텐츠 찾기",
      featureSearchBody: "현재 파일, 현재 워크스페이스 또는 모든 데스크톱 탭을 검색합니다. 결과는 집중된 발췌문을 표시하고 클릭한 정확한 일치 항목으로 이동합니다.",
      featureTablesKicker: "테이블",
      featureTablesTitle: "대형 테이블이 사용 가능한 상태 유지",
      featureTablesBody: "실제 행을 정렬하고 필터링하며, 다중 선택 필터를 사용하고, 필터링된 결과를 탐색하는 동안 긴 테이블을 축소 상태로 유지합니다.",
      featureChartsKicker: "차트",
      featureChartsTitle: "Markdown 데이터를 차트로 변환",
      featureChartsBody: "숫자 열이 감지되면 적합한 테이블을 막대, 선 또는 파이 보기로 전환합니다.",
      featureDiagramsKicker: "다이어그램",
      featureDiagramsTitle: "Mermaid 다이어그램이 깔끔하게 렌더링",
      featureDiagramsBody: "플로우차트, 타임라인, Git 그래프, 아키텍처 다이어그램 등이 로컬 Markdown 리더에서 렌더링됩니다.",
      featureMediaKicker: "미디어",
      featureMediaTitle: "Markdown도 비디오를 담을 수 있습니다",
      featureMediaBody: "문서를 별도의 웹사이트로 만들지 않고 로컬 비디오 또는 지원되는 스트리밍 링크를 삽입합니다.",
      galleryEyebrow: "최신 스크린샷",
      galleryTitle: "밀도 높은 문서를 위한 뷰어",
      gallerySubtitle: "AI 메모리 폴더, 엔지니어링 런북, 릴리스 노트, 다이어그램, 데모 및 지식 베이스에 Markdown Explorer를 사용하세요.",
      galleryCaption1: "언어 레이블, 줄 번호, 복사 컨트롤 및 강한 대비가 있는 읽기 쉬운 코드 블록.",
      galleryCaption2: "LaTeX 수학이 문서 흐름에 직접 렌더링됩니다.",
      galleryCaption3: "대화형 HTML 샌드박스가 격리된 미리보기에서 실행됩니다.",
      galleryCaption4: "집중된 미디어 모달에서 이미지나 다이어그램을 확대하고 검사합니다.",
      galleryCaption5: "데스크톱 모드는 최근 워크스페이스를 기억하고 폴더를 빠르게 엽니다.",
      privacyEyebrow: "기본적으로 비공개",
      privacyTitle: "오프라인, 로컬, 실제 프로젝트 폴더에 편안함",
      privacyBody: "Markdown Explorer는 Markdown 콘텐츠를 업로드하지 않습니다. 로컬에서 스캔하고 렌더링하여 개인 메모, AI 메모리 폴더, 엔지니어링 문서, 런북 및 프로젝트 지식 베이스에 유용합니다.",
      downloadEyebrow: "Markdown Explorer 받기",
      downloadTitle: "확장 프로그램 설치 또는 데스크톱 앱 다운로드",
      downloadSubtitle: "데스크톱 버튼은 페이지가 로드될 때 GitHub API에서 현재 릴리스 버전과 자산을 읽습니다.",
      dlVscodeTitle: "VS Code 마켓플레이스",
      dlVscodeBody: "VS Code 사용자에게 최선의 선택. 편집기 내에서 직접 문서 뷰어를 실행합니다.",
      dlVscodeBtn: "확장 프로그램 설치",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Open VSX를 사용하는 VSCodium 및 VS Code 호환 편집기에 사용합니다.",
      dlOvxBtn: "Open VSX에서 설치",
      dlWinTitle: "Windows 데스크톱",
      dlWinBody: "최신 릴리스에서 이식 가능한 `.exe`를 다운로드하여 직접 실행합니다.",
      dlWinBtn: "Windows 다운로드",
      dlMacTitle: "macOS 데스크톱",
      dlMacBody: "칩에 맞는 `.dmg`를 다운로드합니다. Apple Silicon에는 `arm64`, Intel Mac에는 `x64`를 사용합니다.",
      dlMacBtn: "macOS 다운로드",
      dlLinuxTitle: "Linux 데스크톱",
      dlLinuxBody: "이식 가능한 실행에는 `.AppImage`를, Debian 및 Ubuntu 기반 시스템에는 `.deb`를 사용합니다.",
      dlLinuxBtn: "Linux 다운로드",
      dlGhTitle: "최신 릴리스 페이지",
      dlGhBody: "각 GitHub 릴리스에는 파일 설명이 포함되어 있어 OS에 맞는 패키지를 선택할 수 있습니다.",
      dlGhBtn: "최신 릴리스 보기",
      releaseChecking: "최신 릴리스 자산 확인 중...",
      faqEyebrow: "질문",
      faqTitle: "자주 묻는 질문",
      faq1Q: "Markdown Explorer는 무료인가요?",
      faq1A: "예. 프로젝트는 MIT 라이선스이며 GitHub 저장소는 공개되어 있습니다.",
      faq2Q: "인터넷 없이 작동하나요?",
      faq2A: "예. 렌더링과 검색은 로컬에서 이루어집니다. 웹사이트 다운로드 버튼은 최신 릴리스 파일과 공개 다운로드 합계를 찾기 위해서만 GitHub를 사용합니다.",
      faq3Q: "어떤 데스크톱 파일을 다운로드해야 하나요?",
      faq3A: "Windows 사용자는 `.exe`를 선택해야 합니다. Linux 사용자는 `.AppImage` 또는 `.deb`를 선택할 수 있습니다. macOS 사용자는 Apple Silicon의 경우 `arm64`, Intel의 경우 `x64`를 사용하여 `.dmg`를 선택해야 합니다.",
      footerBy: "Markdown Explorer 제작자",
      footerIssues: "이슈",
      footerLicense: "라이선스",
      releaseApiNote: "데스크톱 다운로드가 GitHub Release를 가리킵니다",
      releaseApiNoteFallback: "데스크톱 다운로드는 GitHub Releases API에서 해결됩니다.",
      releaseApiFail: "지금은 GitHub 자산을 읽을 수 없습니다. 버튼이 최신 릴리스 페이지를 엽니다.",
      download: "다운로드",
      downloads: "다운로드",
      acrossAllVersions: "모든 버전에 걸쳐",
      acrossAllDesktop: "모든 데스크톱 릴리스에 걸쳐.",
      seeChangelog: "GitHub에서 변경 로그 보기.",
    },
    ru: {
      label: "RU",
      skipToContent: "Перейти к содержимому",
      navFeatures: "Функции",
      navGallery: "Галерея",
      navDownload: "Скачать",
      navFaq: "FAQ",
      heroEyebrow: "Расширение VS Code и настольное приложение",
      heroCopy: "Приватный читатель Markdown с точными прыжками по поиску, Mermaid, математикой, видео, подсветкой кода, интерактивными таблицами, графиками, вкладками и спокойным макетом для настоящей документации.",
      btnInstallVscode: "Установить для VS Code",
      btnDownloadDesktop: "Скачать настольное приложение",
      stripVscodeMarketplace: "VS Code Marketplace",
      stripOpenVsx: "Open VSX",
      stripLatestRelease: "Последний релиз GitHub",
      metric1: "области поиска: файл, рабочее пространство, все вкладки",
      metric2: "выделенных языков программирования",
      metric3: "строк таблиц остаются сортируемыми и фильтруемыми",
      metric4: "стилей диаграмм Mermaid отображаются в документах",
      featuresEyebrow: "Создан для Markdown эпохи ИИ",
      featuresTitle: "Ваши документы становятся приложением",
      featuresSubtitle: "Markdown Explorer хранит файлы локально, делая большие рабочие пространства Markdown более удобными для просмотра, поиска, понимания и презентации.",
      featureSearchKicker: "Поиск",
      featureSearchTitle: "Найдите контент во всех открытых вкладках",
      featureSearchBody: "Ищите в текущем файле, текущем рабочем пространстве или всех вкладках рабочего стола. Результаты показывают фрагменты и переходят к точному совпадению.",
      featureTablesKicker: "Таблицы",
      featureTablesTitle: "Большие таблицы остаются удобными",
      featureTablesBody: "Сортируйте и фильтруйте реальные строки, используйте фильтры с множественным выбором и держите длинные таблицы свёрнутыми при просмотре результатов.",
      featureChartsKicker: "Графики",
      featureChartsTitle: "Преобразуйте данные Markdown в графики",
      featureChartsBody: "Переключайте подходящие таблицы в вид столбчатых, линейных или круговых диаграмм при обнаружении числовых столбцов.",
      featureDiagramsKicker: "Диаграммы",
      featureDiagramsTitle: "Диаграммы Mermaid отображаются чисто",
      featureDiagramsBody: "Блок-схемы, временные шкалы, графики git, архитектурные диаграммы и многое другое отображаются в вашем локальном ридере Markdown.",
      featureMediaKicker: "Медиа",
      featureMediaTitle: "Markdown также может содержать видео",
      featureMediaBody: "Встраивайте локальное видео или поддерживаемые ссылки на потоковое видео, не превращая документацию в отдельный сайт.",
      galleryEyebrow: "Свежие скриншоты",
      galleryTitle: "Просмотрщик для насыщенных документов",
      gallerySubtitle: "Используйте Markdown Explorer для папок памяти ИИ, технических руководств, заметок о выпусках, диаграмм и баз знаний.",
      galleryCaption1: "Читаемые блоки кода с метками языка, номерами строк, элементами управления копированием и высоким контрастом.",
      galleryCaption2: "Математика LaTeX отображается прямо в потоке документа.",
      galleryCaption3: "Интерактивные HTML-песочницы работают в изолированных предварительных просмотрах.",
      galleryCaption4: "Увеличивайте и проверяйте изображения или диаграммы в сфокусированном медиамодале.",
      galleryCaption5: "Режим рабочего стола запоминает последние рабочие пространства и быстро открывает папки.",
      privacyEyebrow: "Приватность по умолчанию",
      privacyTitle: "Оффлайн, локально и удобно для реальных папок проектов",
      privacyBody: "Markdown Explorer не загружает содержимое Markdown. Он сканирует и отображает локально, что делает его полезным для частных заметок, папок памяти ИИ, технической документации, руководств и баз знаний проектов.",
      downloadEyebrow: "Получить Markdown Explorer",
      downloadTitle: "Установите расширение или скачайте настольное приложение",
      downloadSubtitle: "Кнопки рабочего стола читают текущую версию релиза и ресурсы из GitHub API при загрузке страницы.",
      dlVscodeTitle: "VS Code Marketplace",
      dlVscodeBody: "Лучший выбор для пользователей VS Code. Запустите просмотрщик документов прямо в редакторе.",
      dlVscodeBtn: "Установить расширение",
      dlOvxTitle: "Open VSX Registry",
      dlOvxBody: "Используйте для VSCodium и совместимых с VS Code редакторов, использующих Open VSX.",
      dlOvxBtn: "Установить из Open VSX",
      dlWinTitle: "Windows рабочий стол",
      dlWinBody: "Скачайте портативный `.exe` из последнего релиза и запустите напрямую.",
      dlWinBtn: "Скачать Windows",
      dlMacTitle: "macOS рабочий стол",
      dlMacBody: "Скачайте `.dmg` для вашего чипа. Используйте `arm64` для Apple Silicon и `x64` для Intel Mac.",
      dlMacBtn: "Скачать macOS",
      dlLinuxTitle: "Linux рабочий стол",
      dlLinuxBody: "Используйте `.AppImage` для портативного запуска или `.deb` на Debian и Ubuntu-системах.",
      dlLinuxBtn: "Скачать Linux",
      dlGhTitle: "Страница последнего релиза",
      dlGhBody: "Каждый GitHub Release содержит описания файлов, чтобы вы могли выбрать правильный пакет для своей ОС.",
      dlGhBtn: "Просмотреть последний релиз",
      releaseChecking: "Проверка ресурсов последнего релиза...",
      faqEyebrow: "Вопросы",
      faqTitle: "Частые вопросы",
      faq1Q: "Markdown Explorer бесплатный?",
      faq1A: "Да. Проект лицензирован по MIT, а репозиторий GitHub общедоступен.",
      faq2Q: "Работает ли без интернета?",
      faq2A: "Да. Рендеринг и поиск происходят локально. Кнопки загрузки на сайте используют GitHub только для поиска последних файлов релиза и общего числа загрузок.",
      faq3Q: "Какой файл рабочего стола мне скачать?",
      faq3A: "Пользователям Windows следует выбрать `.exe`. Пользователи Linux могут выбрать `.AppImage` или `.deb`. Пользователям macOS следует выбрать `.dmg`, с `arm64` для Apple Silicon и `x64` для Intel.",
      footerBy: "Markdown Explorer от",
      footerIssues: "Проблемы",
      footerLicense: "Лицензия",
      releaseApiNote: "Загрузки рабочего стола указывают на GitHub Release",
      releaseApiNoteFallback: "Загрузки рабочего стола разрешаются из GitHub Releases API.",
      releaseApiFail: "Не удалось прочитать ресурсы GitHub прямо сейчас. Кнопки открывают страницу последнего релиза.",
      download: "загрузка",
      downloads: "загрузки",
      acrossAllVersions: "по всем версиям",
      acrossAllDesktop: "по всем релизам рабочего стола.",
      seeChangelog: "Смотрите журнал изменений на GitHub.",
    },
  };

  /* ── State ────────────────────────────────────────────────────── */
  const LS_THEME = "mde-site-theme";
  const LS_LANG  = "mde-site-lang";
  const html = document.documentElement;

  let currentLang = localStorage.getItem(LS_LANG) || "en";
  if (!LANGS[currentLang]) currentLang = "en";

  /* ── Theme logic ──────────────────────────────────────────────── */
  const savedTheme = localStorage.getItem(LS_THEME) || "dark";
  html.setAttribute("data-theme", savedTheme);

  const themeBtn = document.getElementById("theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    });
  }

  /* ── Language logic ───────────────────────────────────────────── */
  const langBtn  = document.getElementById("lang-btn");
  const langMenu = document.getElementById("lang-menu");
  const langLabel = document.getElementById("lang-label");

  const applyLang = (lang) => {
    currentLang = lang;
    localStorage.setItem(LS_LANG, lang);
    const t = LANGS[lang];
    if (!t) return;
    langLabel.textContent = t.label;
    html.setAttribute("lang", lang);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) el.textContent = t[key];
    });
    // Mark active in menu
    document.querySelectorAll(".lang-menu button[data-lang]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  };

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      langMenu.hidden = !langMenu.hidden;
    });

    langMenu.querySelectorAll("button[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLang(btn.dataset.lang);
        langMenu.hidden = true;
      });
    });

    document.addEventListener("click", (e) => {
      if (!langMenu.contains(e.target) && e.target !== langBtn) {
        langMenu.hidden = true;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") langMenu.hidden = true;
    });
  }

  // Apply initial language
  applyLang(currentLang);

  /* ── GitHub release download logic ───────────────────────────── */
  const releaseUrl = "https://github.com/the-long-ride/markdown-explorer/releases/latest";
  const latestApiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases/latest";
  const releasesApiUrl = "https://api.github.com/repos/the-long-ride/markdown-explorer/releases?per_page=100";
  const changelogUrl = "https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md";
  const apiHeaders = { Accept: "application/vnd.github+json" };
  const note = document.querySelector("#release-note");
  const buttons = [...document.querySelectorAll(".release-download")];
  const baseButtonLabels = new Map(buttons.map((button) => [button, button.textContent.trim()]));
  const downloadCountLabels = new Map(
    buttons.map((button) => {
      const label = document.createElement("span");
      label.className = "release-download-count";
      label.setAttribute("aria-live", "polite");
      button.insertAdjacentElement("afterend", label);
      return [button, label];
    })
  );
  const numberFormatter = new Intl.NumberFormat();

  const assetMatchers = {
    windows: (name) => name.endsWith(".exe"),
    macos: (name) => name.endsWith(".dmg") || name.endsWith(".zip"),
    linux: (name) => name.endsWith(".appimage") || name.endsWith(".deb")
  };

  const preferredScore = {
    windows: (name) => name.endsWith(".exe") ? 10 : 0,
    macos: (name) => name.endsWith(".dmg") ? 10 : 5,
    linux: (name) => name.endsWith(".appimage") ? 10 : 5
  };

  const pickAsset = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return null;
    return assets
      .filter((asset) => matcher(asset.name.toLowerCase()))
      .sort((a, b) => preferredScore[platform](b.name.toLowerCase()) - preferredScore[platform](a.name.toLowerCase()))[0] || null;
  };

  const getPlatformAssets = (assets, platform) => {
    const matcher = assetMatchers[platform];
    if (!matcher) return [];
    return assets.filter((asset) => matcher(asset.name.toLowerCase()));
  };

  const getDownloadCount = (assets) => assets.reduce((total, asset) => {
    const count = Number(asset.download_count);
    return Number.isFinite(count) ? total + count : total;
  }, 0);

  const t = () => LANGS[currentLang] || LANGS.en;

  const appendHighlightedDownloads = (target, count, suffix) => {
    const number = document.createElement("strong");
    number.className = "release-download-number";
    number.textContent = numberFormatter.format(count);
    const word = count === 1 ? t().download : t().downloads;
    target.append(number, document.createTextNode(` ${word} ${suffix}`));
  };

  const setDownloadCountLabel = (label, count) => {
    if (!label) return;
    label.textContent = "";
    appendHighlightedDownloads(label, count, t().acrossAllVersions);
  };

  const setReleaseNote = (message, downloadCount = null) => {
    if (!note) return;
    note.textContent = "";
    note.append(document.createTextNode(`${message} `));
    if (Number.isFinite(downloadCount)) {
      appendHighlightedDownloads(note, downloadCount, t().acrossAllDesktop);
      note.append(document.createTextNode(" "));
    }
    const link = document.createElement("a");
    link.href = changelogUrl;
    link.rel = "noopener";
    link.textContent = t().seeChangelog;
    note.append(link);
  };

  const setFallback = (message) => {
    buttons.forEach((button) => {
      const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
      button.href = releaseUrl;
      button.textContent = baseLabel;
      button.setAttribute("aria-label", `${baseLabel}. Opens the latest GitHub Release.`);
      const countLabel = downloadCountLabels.get(button);
      if (countLabel) countLabel.textContent = "";
    });
    setReleaseNote(message);
  };

  const fetchJson = (url) => fetch(url, { headers: apiHeaders }).then((response) => {
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  });

  const getNextPageUrl = (linkHeader) => {
    if (!linkHeader) return "";
    const nextLink = linkHeader.split(",").find((link) => link.includes('rel="next"'));
    const match = nextLink && nextLink.match(/<([^>]+)>/);
    return match ? match[1] : "";
  };

  const fetchReleasePages = (url = releasesApiUrl, releases = []) => fetch(url, { headers: apiHeaders })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json().then((page) => {
        const combined = releases.concat(Array.isArray(page) ? page : []);
        const nextUrl = getNextPageUrl(response.headers.get("Link"));
        return nextUrl ? fetchReleasePages(nextUrl, combined) : combined;
      });
    });

  Promise.all([fetchJson(latestApiUrl), fetchReleasePages()])
    .then(([release, releases]) => {
      const latestAssets = Array.isArray(release.assets) ? release.assets : [];
      const allReleaseAssets = releases.flatMap((item) => Array.isArray(item.assets) ? item.assets : []);
      const releaseVersion = release.tag_name || release.name || "";
      let selectedDesktopDownloads = 0;
      buttons.forEach((button) => {
        const baseLabel = baseButtonLabels.get(button) || button.textContent.trim();
        const versionedLabel = releaseVersion ? `${baseLabel} ${releaseVersion}` : baseLabel;
        const platformAssets = getPlatformAssets(allReleaseAssets, button.dataset.platform);
        const asset = pickAsset(latestAssets, button.dataset.platform);
        const downloads = getDownloadCount(platformAssets);
        const countLabel = downloadCountLabels.get(button);
        button.textContent = versionedLabel;
        selectedDesktopDownloads += downloads;
        setDownloadCountLabel(countLabel, downloads);

        if (!asset) {
          button.href = release.html_url || releaseUrl;
          button.setAttribute("aria-label", `${versionedLabel}. Opens the GitHub Release page.`);
          return;
        }

        button.href = asset.browser_download_url;
        button.setAttribute("aria-label", `Download ${asset.name} from GitHub Release ${releaseVersion || "latest"}`);
        button.title = asset.name;
      });

      setReleaseNote(
        releaseVersion
          ? `${t().releaseApiNote} ${releaseVersion}.`
          : t().releaseApiNoteFallback,
        selectedDesktopDownloads
      );
    })
    .catch(() => {
      setFallback(t().releaseApiFail);
    });
})();
