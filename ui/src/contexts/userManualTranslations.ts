export type UserManualAction = 'workspace' | 'search' | 'bookmarks' | 'settings';

export interface UserManualCard {
  title: string;
  description: string;
  steps: readonly string[];
  action?: UserManualAction;
  shortcutAction?: string;
}

export interface UserManualCopy {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  noResults: string;
  actions: Record<UserManualAction, string>;
  sections: readonly { id: string; title: string; cards: readonly UserManualCard[] }[];
}

export const USER_MANUAL_TRANSLATIONS: Record<string, UserManualCopy> = {
  en: {
    title: 'User manual', subtitle: 'Find a task, learn the shortest path, and jump directly to the right tool.', searchPlaceholder: 'Search the manual…', noResults: 'No manual topics match your search.',
    actions: { workspace: 'Open workspace', search: 'Open search', bookmarks: 'Open Bookmarks', settings: 'Open Settings' },
    sections: [
      { id: 'start', title: 'Start here', cards: [{ title: 'Open your documentation', description: 'Open a folder or supported document, then use the sidebar tree to move through files.', steps: ['Open a workspace.', 'Choose a file in the Files tab.', 'Use Tabs or Focus view for your preferred reading layout.'], action: 'workspace' }] },
      { id: 'reading', title: 'Reading and previews', cards: [{ title: 'Read rich Markdown safely', description: 'Headings, tables, code, LaTeX, Mermaid, images, HTML, and supported office documents render locally.', steps: ['Click headings to collapse sections.', 'Open images and diagrams in the media viewer.', 'Switch HTML documents between preview and Markdown when needed.'] }] },
      { id: 'finding', title: 'Finding content', cards: [{ title: 'Search files and the current document', description: 'Search filenames, paths, titles, contents, or matches inside the active document.', steps: ['Open workspace search.', 'Type a phrase or symbol.', 'Select a result to jump and highlight it.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Bookmarks', cards: [{ title: 'Save exact text and objects', description: 'Select mixed formatting across multiple lines, including code and symbols, then right-click. You can also right-click whole LaTeX, Mermaid diagrams, images, or links.', steps: ['Enable Bookmark feature in Settings.', 'Select text or right-click an object and choose Add to saved bookmarks.', 'Open Bookmarks and jump to the exact saved occurrence, even when identical text appears many times.', 'After edits, a low-confidence match becomes Target changed instead of jumping to the wrong place.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Customization', cards: [{ title: 'Make the reader yours', description: 'Change themes, view modes, previews, labels, and every customizable keyboard shortcut.', steps: ['Open Settings.', 'Change a preference or record a shortcut.', 'Export settings when you want a portable backup.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Troubleshooting', cards: [{ title: 'Recover safely', description: 'Use refresh for stale previews, reopen moved workspaces, and review Target changed bookmarks before replacing them.', steps: ['Refresh the active file.', 'Check whether the workspace or file moved.', 'Recreate only bookmarks whose target can no longer be identified.'] }] },
    ],
  },
  vi: {
    title: 'Hướng dẫn sử dụng', subtitle: 'Tìm tác vụ, xem cách ngắn nhất và mở đúng công cụ ngay lập tức.', searchPlaceholder: 'Tìm trong hướng dẫn…', noResults: 'Không có chủ đề phù hợp.',
    actions: { workspace: 'Mở không gian làm việc', search: 'Mở tìm kiếm', bookmarks: 'Mở Dấu trang', settings: 'Mở Cài đặt' },
    sections: [
      { id: 'start', title: 'Bắt đầu', cards: [{ title: 'Mở tài liệu', description: 'Mở thư mục hoặc tài liệu được hỗ trợ rồi dùng cây tệp để điều hướng.', steps: ['Mở không gian làm việc.', 'Chọn tệp trong tab Tệp.', 'Chọn chế độ Tab hoặc Tập trung.'], action: 'workspace' }] },
      { id: 'reading', title: 'Đọc và xem trước', cards: [{ title: 'Đọc Markdown phong phú', description: 'Tiêu đề, bảng, mã, LaTeX, Mermaid, ảnh, HTML và tài liệu văn phòng được dựng cục bộ.', steps: ['Thu gọn phần bằng tiêu đề.', 'Mở ảnh và sơ đồ trong trình xem.', 'Chuyển HTML giữa xem trước và Markdown.'] }] },
      { id: 'finding', title: 'Tìm nội dung', cards: [{ title: 'Tìm trong tệp và tài liệu', description: 'Tìm tên, đường dẫn, tiêu đề, nội dung hoặc kết quả trong tệp hiện tại.', steps: ['Mở tìm kiếm.', 'Nhập từ, cụm từ hoặc ký hiệu.', 'Chọn kết quả để nhảy và tô sáng.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Dấu trang', cards: [{ title: 'Lưu chính xác văn bản và đối tượng', description: 'Chọn nội dung nhiều định dạng qua nhiều dòng, gồm mã và ký hiệu, rồi nhấp phải. Có thể nhấp phải toàn bộ LaTeX, Mermaid, ảnh hoặc liên kết.', steps: ['Bật tính năng Dấu trang trong Cài đặt.', 'Chọn nội dung hoặc nhấp phải đối tượng rồi thêm dấu trang.', 'Nhảy đúng lần xuất hiện đã lưu dù văn bản lặp lại.', 'Khi sửa tài liệu, mục không chắc chắn sẽ báo Mục tiêu đã thay đổi.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Tùy chỉnh', cards: [{ title: 'Cá nhân hóa trình đọc', description: 'Đổi giao diện, chế độ xem, xem trước, nhãn và phím tắt.', steps: ['Mở Cài đặt.', 'Đổi tùy chọn hoặc ghi phím tắt.', 'Xuất cài đặt để sao lưu.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Khắc phục sự cố', cards: [{ title: 'Khôi phục an toàn', description: 'Làm mới bản xem trước, mở lại không gian đã di chuyển và kiểm tra dấu trang bị thay đổi.', steps: ['Làm mới tệp.', 'Kiểm tra đường dẫn tệp hoặc thư mục.', 'Chỉ tạo lại dấu trang không thể xác định.'] }] },
    ],
  },
  fr: {
    title: 'Manuel utilisateur', subtitle: 'Recherchez une tâche et ouvrez directement le bon outil.', searchPlaceholder: 'Rechercher dans le manuel…', noResults: 'Aucun sujet ne correspond.',
    actions: { workspace: 'Ouvrir un espace', search: 'Ouvrir la recherche', bookmarks: 'Ouvrir les signets', settings: 'Ouvrir les réglages' },
    sections: [
      { id: 'start', title: 'Bien démarrer', cards: [{ title: 'Ouvrir la documentation', description: 'Ouvrez un dossier ou un document pris en charge, puis parcourez les fichiers.', steps: ['Ouvrez un espace de travail.', 'Choisissez un fichier.', 'Utilisez la vue Onglets ou Focus.'], action: 'workspace' }] },
      { id: 'reading', title: 'Lecture et aperçus', cards: [{ title: 'Lire un Markdown riche', description: 'Titres, tableaux, code, LaTeX, Mermaid, images, HTML et documents Office sont rendus localement.', steps: ['Réduisez les sections.', 'Ouvrez les médias dans la visionneuse.', 'Basculez les fichiers HTML selon vos besoins.'] }] },
      { id: 'finding', title: 'Trouver du contenu', cards: [{ title: 'Rechercher partout', description: 'Recherchez noms, chemins, titres, contenus et correspondances du document actif.', steps: ['Ouvrez la recherche.', 'Saisissez un texte ou un symbole.', 'Sélectionnez un résultat.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Signets', cards: [{ title: 'Enregistrer une cible exacte', description: 'Sélectionnez plusieurs lignes et formats, puis faites un clic droit. LaTeX, Mermaid, images et liens peuvent aussi être enregistrés en entier.', steps: ['Activez la fonction Signets.', 'Ajoutez le texte ou l’objet.', 'Revenez à l’occurrence exacte enregistrée.', 'Une cible ambiguë devient Cible modifiée.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Personnalisation', cards: [{ title: 'Adapter le lecteur', description: 'Modifiez thèmes, vues, aperçus, libellés et raccourcis.', steps: ['Ouvrez les réglages.', 'Changez une préférence.', 'Exportez les réglages pour les sauvegarder.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Dépannage', cards: [{ title: 'Récupérer sans risque', description: 'Actualisez les aperçus, rouvrez les espaces déplacés et vérifiez les cibles modifiées.', steps: ['Actualisez le fichier.', 'Vérifiez son chemin.', 'Recréez uniquement les signets introuvables.'] }] },
    ],
  },
  es: {
    title: 'Manual de usuario', subtitle: 'Busca una tarea y abre directamente la herramienta adecuada.', searchPlaceholder: 'Buscar en el manual…', noResults: 'No hay temas coincidentes.',
    actions: { workspace: 'Abrir espacio', search: 'Abrir búsqueda', bookmarks: 'Abrir Marcadores', settings: 'Abrir Ajustes' },
    sections: [
      { id: 'start', title: 'Primeros pasos', cards: [{ title: 'Abrir documentación', description: 'Abre una carpeta o documento compatible y navega con el árbol lateral.', steps: ['Abre un espacio de trabajo.', 'Elige un archivo.', 'Usa vista Pestañas o Enfoque.'], action: 'workspace' }] },
      { id: 'reading', title: 'Lectura y vistas previas', cards: [{ title: 'Leer Markdown enriquecido', description: 'Encabezados, tablas, código, LaTeX, Mermaid, imágenes, HTML y documentos se procesan localmente.', steps: ['Contrae secciones.', 'Abre medios en el visor.', 'Alterna la vista HTML.'] }] },
      { id: 'finding', title: 'Buscar contenido', cards: [{ title: 'Buscar archivos y texto', description: 'Busca nombres, rutas, títulos, contenido y coincidencias del documento.', steps: ['Abre la búsqueda.', 'Escribe texto o símbolos.', 'Selecciona un resultado.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Marcadores', cards: [{ title: 'Guardar el objetivo exacto', description: 'Selecciona varias líneas y formatos y haz clic derecho. También puedes guardar LaTeX, Mermaid, imágenes y enlaces completos.', steps: ['Activa Marcadores.', 'Añade el texto u objeto.', 'Vuelve a la aparición exacta guardada.', 'Una coincidencia dudosa se marca como Objetivo cambiado.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Personalización', cards: [{ title: 'Configurar el lector', description: 'Cambia temas, vistas, vistas previas, etiquetas y atajos.', steps: ['Abre Ajustes.', 'Cambia una opción.', 'Exporta los ajustes como copia.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Solución de problemas', cards: [{ title: 'Recuperar con seguridad', description: 'Actualiza vistas, reabre espacios movidos y revisa objetivos cambiados.', steps: ['Actualiza el archivo.', 'Comprueba la ruta.', 'Recrea solo los marcadores perdidos.'] }] },
    ],
  },
  zh: {
    title: '用户手册', subtitle: '搜索任务，快速了解步骤并直接打开对应工具。', searchPlaceholder: '搜索手册…', noResults: '没有匹配的手册主题。',
    actions: { workspace: '打开工作区', search: '打开搜索', bookmarks: '打开书签', settings: '打开设置' },
    sections: [
      { id: 'start', title: '开始使用', cards: [{ title: '打开文档', description: '打开文件夹或受支持的文档，并用侧栏文件树导航。', steps: ['打开工作区。', '在“文件”中选择文档。', '选择标签页或专注视图。'], action: 'workspace' }] },
      { id: 'reading', title: '阅读与预览', cards: [{ title: '阅读丰富 Markdown', description: '标题、表格、代码、LaTeX、Mermaid、图片、HTML 和办公文档均在本地渲染。', steps: ['折叠标题分组。', '在媒体查看器中打开图片和图表。', '按需切换 HTML 预览。'] }] },
      { id: 'finding', title: '查找内容', cards: [{ title: '搜索文件和当前文档', description: '搜索文件名、路径、标题、内容或当前文档匹配项。', steps: ['打开搜索。', '输入文本或符号。', '选择结果并跳转高亮。'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: '书签', cards: [{ title: '保存精确文本和对象', description: '可跨多行和多种格式选择内容后右键；也可右键保存整个 LaTeX、Mermaid、图片或链接。', steps: ['在设置中启用书签功能。', '添加选区或对象。', '即使有重复文本，也会跳到保存的准确位置。', '低可信度目标会显示“目标已更改”。'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: '自定义', cards: [{ title: '调整阅读器', description: '更改主题、视图、预览、标签和键盘快捷键。', steps: ['打开设置。', '修改选项或快捷键。', '导出设置作为备份。'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: '故障排除', cards: [{ title: '安全恢复', description: '刷新过期预览，重新打开已移动工作区，并检查目标已更改的书签。', steps: ['刷新文件。', '检查路径。', '仅重建无法定位的书签。'] }] },
    ],
  },
  no: {
    title: 'Brukerhåndbok', subtitle: 'Finn en oppgave og åpne riktig verktøy direkte.', searchPlaceholder: 'Søk i håndboken…', noResults: 'Ingen emner samsvarer.',
    actions: { workspace: 'Åpne arbeidsområde', search: 'Åpne søk', bookmarks: 'Åpne bokmerker', settings: 'Åpne innstillinger' },
    sections: [
      { id: 'start', title: 'Kom i gang', cards: [{ title: 'Åpne dokumentasjon', description: 'Åpne en mappe eller støttet fil og naviger i sidetreet.', steps: ['Åpne et arbeidsområde.', 'Velg en fil.', 'Bruk faner eller fokusvisning.'], action: 'workspace' }] },
      { id: 'reading', title: 'Lesing og forhåndsvisning', cards: [{ title: 'Les rik Markdown', description: 'Overskrifter, tabeller, kode, LaTeX, Mermaid, bilder, HTML og kontordokumenter gjengis lokalt.', steps: ['Skjul seksjoner.', 'Åpne medier i viseren.', 'Bytt HTML-visning ved behov.'] }] },
      { id: 'finding', title: 'Finn innhold', cards: [{ title: 'Søk i filer og dokument', description: 'Søk i navn, stier, titler, innhold og gjeldende dokument.', steps: ['Åpne søk.', 'Skriv tekst eller symboler.', 'Velg et resultat.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Bokmerker', cards: [{ title: 'Lagre nøyaktig mål', description: 'Marker flere linjer og formater og høyreklikk. Hele LaTeX-uttrykk, Mermaid-diagrammer, bilder og lenker kan også lagres.', steps: ['Aktiver bokmerkefunksjonen.', 'Legg til tekst eller objekt.', 'Gå tilbake til nøyaktig lagret forekomst.', 'Usikre treff merkes som Målet er endret.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Tilpasning', cards: [{ title: 'Tilpass leseren', description: 'Endre tema, visning, forhåndsvisning, etiketter og snarveier.', steps: ['Åpne innstillinger.', 'Endre et valg.', 'Eksporter innstillinger for sikkerhetskopi.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Feilsøking', cards: [{ title: 'Gjenopprett trygt', description: 'Oppdater visninger, åpne flyttede arbeidsområder og kontroller endrede mål.', steps: ['Oppdater filen.', 'Kontroller stien.', 'Opprett bare tapte bokmerker på nytt.'] }] },
    ],
  },
  ja: {
    title: 'ユーザーマニュアル', subtitle: '目的の操作を検索し、必要なツールをすぐに開けます。', searchPlaceholder: 'マニュアルを検索…', noResults: '一致する項目がありません。',
    actions: { workspace: 'ワークスペースを開く', search: '検索を開く', bookmarks: 'ブックマークを開く', settings: '設定を開く' },
    sections: [
      { id: 'start', title: 'はじめに', cards: [{ title: 'ドキュメントを開く', description: 'フォルダーまたは対応ファイルを開き、サイドバーで移動します。', steps: ['ワークスペースを開きます。', 'ファイルを選択します。', 'タブまたは集中表示を使います。'], action: 'workspace' }] },
      { id: 'reading', title: '閲覧とプレビュー', cards: [{ title: '豊富な Markdown を読む', description: '見出し、表、コード、LaTeX、Mermaid、画像、HTML、Office 文書をローカルで表示します。', steps: ['見出しを折りたたみます。', '画像や図をビューアーで開きます。', 'HTML 表示を切り替えます。'] }] },
      { id: 'finding', title: '検索', cards: [{ title: 'ファイルと文書を検索', description: '名前、パス、タイトル、内容、現在の文書内を検索できます。', steps: ['検索を開きます。', '文字列や記号を入力します。', '結果を選んで移動します。'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'ブックマーク', cards: [{ title: '正確な対象を保存', description: '複数行・複数書式を選択して右クリックできます。LaTeX、Mermaid、画像、リンク全体も保存できます。', steps: ['設定でブックマーク機能を有効にします。', '選択範囲またはオブジェクトを追加します。', '同じ文字列が複数あっても保存した位置へ移動します。', '不確かな対象は「対象が変更されました」と表示します。'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'カスタマイズ', cards: [{ title: 'リーダーを調整', description: 'テーマ、表示、プレビュー、ラベル、ショートカットを変更します。', steps: ['設定を開きます。', '項目を変更します。', '設定を書き出して保存します。'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'トラブルシューティング', cards: [{ title: '安全に復旧', description: '表示を更新し、移動したワークスペースを開き直し、変更された対象を確認します。', steps: ['ファイルを更新します。', 'パスを確認します。', '見つからないブックマークだけ作り直します。'] }] },
    ],
  },
  ko: {
    title: '사용자 설명서', subtitle: '작업을 검색하고 필요한 도구를 바로 여세요.', searchPlaceholder: '설명서 검색…', noResults: '일치하는 항목이 없습니다.',
    actions: { workspace: '작업 공간 열기', search: '검색 열기', bookmarks: '북마크 열기', settings: '설정 열기' },
    sections: [
      { id: 'start', title: '시작하기', cards: [{ title: '문서 열기', description: '폴더나 지원 문서를 열고 사이드바 트리로 이동합니다.', steps: ['작업 공간을 엽니다.', '파일을 선택합니다.', '탭 또는 집중 보기를 사용합니다.'], action: 'workspace' }] },
      { id: 'reading', title: '읽기와 미리 보기', cards: [{ title: '풍부한 Markdown 읽기', description: '제목, 표, 코드, LaTeX, Mermaid, 이미지, HTML 및 오피스 문서를 로컬에서 표시합니다.', steps: ['제목 섹션을 접습니다.', '미디어 뷰어를 엽니다.', 'HTML 보기를 전환합니다.'] }] },
      { id: 'finding', title: '콘텐츠 찾기', cards: [{ title: '파일과 문서 검색', description: '이름, 경로, 제목, 내용 및 현재 문서의 일치 항목을 찾습니다.', steps: ['검색을 엽니다.', '텍스트나 기호를 입력합니다.', '결과를 선택합니다.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: '북마크', cards: [{ title: '정확한 대상 저장', description: '여러 줄과 혼합 서식을 선택해 우클릭할 수 있습니다. LaTeX, Mermaid, 이미지와 링크 전체도 저장됩니다.', steps: ['설정에서 북마크 기능을 켭니다.', '선택 영역이나 객체를 추가합니다.', '반복된 텍스트에서도 저장한 정확한 위치로 이동합니다.', '불확실한 대상은 대상 변경으로 표시됩니다.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: '사용자 지정', cards: [{ title: '리더 맞춤 설정', description: '테마, 보기, 미리 보기, 레이블과 단축키를 바꿉니다.', steps: ['설정을 엽니다.', '옵션을 변경합니다.', '설정을 내보내 백업합니다.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: '문제 해결', cards: [{ title: '안전하게 복구', description: '미리 보기를 새로 고치고 이동한 작업 공간과 변경된 대상을 확인합니다.', steps: ['파일을 새로 고칩니다.', '경로를 확인합니다.', '찾을 수 없는 북마크만 다시 만듭니다.'] }] },
    ],
  },
  ru: {
    title: 'Руководство пользователя', subtitle: 'Найдите задачу и сразу откройте нужный инструмент.', searchPlaceholder: 'Поиск по руководству…', noResults: 'Подходящих тем нет.',
    actions: { workspace: 'Открыть рабочую область', search: 'Открыть поиск', bookmarks: 'Открыть закладки', settings: 'Открыть настройки' },
    sections: [
      { id: 'start', title: 'Начало работы', cards: [{ title: 'Открыть документацию', description: 'Откройте папку или поддерживаемый документ и используйте дерево файлов.', steps: ['Откройте рабочую область.', 'Выберите файл.', 'Используйте вкладки или режим фокуса.'], action: 'workspace' }] },
      { id: 'reading', title: 'Чтение и просмотр', cards: [{ title: 'Читать расширенный Markdown', description: 'Заголовки, таблицы, код, LaTeX, Mermaid, изображения, HTML и офисные документы отображаются локально.', steps: ['Сворачивайте разделы.', 'Открывайте медиа в просмотрщике.', 'Переключайте режим HTML.'] }] },
      { id: 'finding', title: 'Поиск содержимого', cards: [{ title: 'Искать в файлах и документе', description: 'Поиск по именам, путям, заголовкам, содержимому и текущему документу.', steps: ['Откройте поиск.', 'Введите текст или символ.', 'Выберите результат.'], action: 'search', shortcutAction: 'searchCurrent' }] },
      { id: 'bookmarks', title: 'Закладки', cards: [{ title: 'Сохранить точную цель', description: 'Выделите несколько строк и форматов и щёлкните правой кнопкой. Целиком сохраняются LaTeX, Mermaid, изображения и ссылки.', steps: ['Включите функцию закладок.', 'Добавьте текст или объект.', 'Переходите к точному сохранённому вхождению.', 'Неуверенное совпадение отмечается как Цель изменена.'], action: 'bookmarks', shortcutAction: 'openBookmarks' }] },
      { id: 'customization', title: 'Настройка', cards: [{ title: 'Настроить просмотрщик', description: 'Изменяйте темы, режимы, предпросмотр, подписи и сочетания клавиш.', steps: ['Откройте настройки.', 'Измените параметр.', 'Экспортируйте настройки для резервной копии.'], action: 'settings', shortcutAction: 'settings' }] },
      { id: 'troubleshooting', title: 'Устранение проблем', cards: [{ title: 'Безопасное восстановление', description: 'Обновляйте просмотр, повторно открывайте перемещённые области и проверяйте изменённые цели.', steps: ['Обновите файл.', 'Проверьте путь.', 'Пересоздайте только потерянные закладки.'] }] },
    ],
  },
};

export function getUserManualTranslations(language: string): UserManualCopy {
  return USER_MANUAL_TRANSLATIONS[language] ?? USER_MANUAL_TRANSLATIONS.en;
}
