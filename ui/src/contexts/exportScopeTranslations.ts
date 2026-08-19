import type { AppLanguage } from './languageOptions';

type Localized = readonly [string, string, string, string, string, string, string, string, string];
const l = (...values: Localized): Localized => values;
const LANGUAGES: readonly AppLanguage[] = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'];

export interface ExportCenterFeatureTranslations {
  title: string; description: string; close: string; export: string; exporting: string; exportDocumentsTooltip: string;
  source: {
    region: string; title: string; mode: string; current: string; selected: string; folder: string; workspace: string;
    noCurrent: string; documentsToExport: string; searchDocuments: string; folderToExport: string; searchFolders: string;
    documentCount: string; renderableCount: string;
  };
  extras: {
    title: string; description: string; selectedCount: string; search: string; selectAll: string; unselectAll: string;
    loading: string; fileCount: string; includeFolder: string; bytes: string; includeFile: string; noMatches: string;
  };
  options: {
    format: string; htmlDescription: string; pdfDescription: string; staticWebsite: string; staticWebsiteDescription: string;
    visualLayout: string; documentOnly: string; documentOnlyDescription: string; fullExplorerLayout: string;
    fullExplorerLayoutDescription: string; batchMode: string; batchOutput: string; separateOutputs: string; mergedOutput: string;
    documentsSelected: string; activity: string; activityEmpty: string; artifactSite: string; artifactPdfFiles: string;
    artifactPdf: string; artifactHtmlPackage: string; artifactHtml: string;
  };
  status: {
    unableList: string; unableCreate: string; selectAtLeastOne: string; cancelled: string; partial: string;
    failedCount: string; complete: string; failed: string;
  };
}

export interface ScopeViewFeatureTranslations {
  dialogLabel: string; previous: string; next: string; level: string; close: string; loading: string; maximumDepth: string;
  unableOpen: string; outsideWorkspace: string; linkMenu: string; openInBrowser: string; copyLink: string; openAsScope: string;
}

export interface ExportScopeTranslations {
  exportCenter: ExportCenterFeatureTranslations;
  scopeView: ScopeViewFeatureTranslations;
}

const TEXT = {
  exportCenter: {
    title: l('Export Center', 'Trung tâm xuất', 'Centre d’exportation', 'Centro de exportación', '导出中心', 'Eksportsenter', 'エクスポートセンター', '내보내기 센터', 'Центр экспорта'),
    description: l('Export documents with the current Markdown Explorer theme and layout.', 'Xuất tài liệu với chủ đề và bố cục Markdown Explorer hiện tại.', 'Exportez les documents avec le thème et la mise en page Markdown Explorer actuels.', 'Exporta documentos con el tema y el diseño actuales de Markdown Explorer.', '使用当前 Markdown Explorer 主题和布局导出文档。', 'Eksporter dokumenter med gjeldende Markdown Explorer-tema og oppsett.', '現在の Markdown Explorer のテーマとレイアウトでドキュメントをエクスポートします。', '현재 Markdown Explorer 테마와 레이아웃으로 문서를 내보냅니다.', 'Экспортируйте документы с текущей темой и макетом Markdown Explorer.'),
    close: l('Close Export Center', 'Đóng Trung tâm xuất', 'Fermer le centre d’exportation', 'Cerrar el centro de exportación', '关闭导出中心', 'Lukk eksportsenter', 'エクスポートセンターを閉じる', '내보내기 센터 닫기', 'Закрыть центр экспорта'),
    export: l('Export', 'Xuất', 'Exporter', 'Exportar', '导出', 'Eksporter', 'エクスポート', '내보내기', 'Экспортировать'),
    exporting: l('Exporting…', 'Đang xuất…', 'Exportation…', 'Exportando…', '正在导出…', 'Eksporterer…', 'エクスポート中…', '내보내는 중…', 'Экспорт…'),
    exportDocumentsTooltip: l('Export documents', 'Xuất tài liệu', 'Exporter des documents', 'Exportar documentos', '导出文档', 'Eksporter dokumenter', 'ドキュメントをエクスポート', '문서 내보내기', 'Экспорт документов'),
    source: {
      region: l('Export source', 'Nguồn xuất', 'Source d’exportation', 'Origen de exportación', '导出来源', 'Eksportkilde', 'エクスポート元', '내보내기 원본', 'Источник экспорта'),
      title: l('Source', 'Nguồn', 'Source', 'Origen', '来源', 'Kilde', 'ソース', '원본', 'Источник'),
      mode: l('Source mode', 'Chế độ nguồn', 'Mode de source', 'Modo de origen', '来源模式', 'Kildemodus', 'ソースモード', '원본 모드', 'Режим источника'),
      current: l('Current document', 'Tài liệu hiện tại', 'Document actuel', 'Documento actual', '当前文档', 'Gjeldende dokument', '現在のドキュメント', '현재 문서', 'Текущий документ'),
      selected: l('Selected documents', 'Tài liệu đã chọn', 'Documents sélectionnés', 'Documentos seleccionados', '已选文档', 'Valgte dokumenter', '選択したドキュメント', '선택한 문서', 'Выбранные документы'),
      folder: l('Folder', 'Thư mục', 'Dossier', 'Carpeta', '文件夹', 'Mappe', 'フォルダー', '폴더', 'Папка'),
      workspace: l('Whole workspace', 'Toàn bộ không gian làm việc', 'Tout l’espace de travail', 'Todo el espacio de trabajo', '整个工作区', 'Hele arbeidsområdet', 'ワークスペース全体', '전체 작업 영역', 'Всё рабочее пространство'),
      noCurrent: l('No current document', 'Không có tài liệu hiện tại', 'Aucun document actuel', 'No hay documento actual', '没有当前文档', 'Ingen gjeldende dokument', '現在のドキュメントはありません', '현재 문서 없음', 'Нет текущего документа'),
      documentsToExport: l('Documents to export', 'Tài liệu cần xuất', 'Documents à exporter', 'Documentos para exportar', '要导出的文档', 'Dokumenter som skal eksporteres', 'エクスポートするドキュメント', '내보낼 문서', 'Документы для экспорта'),
      searchDocuments: l('Search documents', 'Tìm tài liệu', 'Rechercher des documents', 'Buscar documentos', '搜索文档', 'Søk i dokumenter', 'ドキュメントを検索', '문서 검색', 'Поиск документов'),
      folderToExport: l('Folder to export', 'Thư mục cần xuất', 'Dossier à exporter', 'Carpeta para exportar', '要导出的文件夹', 'Mappe som skal eksporteres', 'エクスポートするフォルダー', '내보낼 폴더', 'Папка для экспорта'),
      searchFolders: l('Search folders', 'Tìm thư mục', 'Rechercher des dossiers', 'Buscar carpetas', '搜索文件夹', 'Søk i mapper', 'フォルダーを検索', '폴더 검색', 'Поиск папок'),
      documentCount: l('Documents: {count}', 'Tài liệu: {count}', 'Documents : {count}', 'Documentos: {count}', '文档：{count}', 'Dokumenter: {count}', 'ドキュメント: {count}', '문서: {count}', 'Документы: {count}'),
      renderableCount: l('Renderable documents: {count}', 'Tài liệu có thể hiển thị: {count}', 'Documents affichables : {count}', 'Documentos renderizables: {count}', '可渲染文档：{count}', 'Visbare dokumenter: {count}', 'レンダリング可能なドキュメント: {count}', '렌더링 가능한 문서: {count}', 'Отображаемые документы: {count}'),
    },
    extras: {
      title: l('Additional workspace files', 'Tệp bổ sung trong không gian làm việc', 'Fichiers supplémentaires de l’espace de travail', 'Archivos adicionales del espacio de trabajo', '其他工作区文件', 'Ekstra arbeidsområdefiler', '追加のワークスペースファイル', '추가 작업 영역 파일', 'Дополнительные файлы рабочего пространства'),
      description: l('Optional files packaged with web exports', 'Tệp tùy chọn được đóng gói cùng bản xuất web', 'Fichiers facultatifs inclus dans les exports web', 'Archivos opcionales incluidos con las exportaciones web', '随 Web 导出一起打包的可选文件', 'Valgfrie filer pakket med webeksport', 'Web エクスポートに同梱する任意ファイル', '웹 내보내기에 포함할 선택적 파일', 'Необязательные файлы в веб-экспорте'),
      selectedCount: l('Selected: {count}', 'Đã chọn: {count}', 'Sélectionnés : {count}', 'Seleccionados: {count}', '已选：{count}', 'Valgt: {count}', '選択済み: {count}', '선택됨: {count}', 'Выбрано: {count}'),
      search: l('Search workspace files', 'Tìm tệp trong không gian làm việc', 'Rechercher dans les fichiers de l’espace de travail', 'Buscar archivos del espacio de trabajo', '搜索工作区文件', 'Søk i arbeidsområdefiler', 'ワークスペースファイルを検索', '작업 영역 파일 검색', 'Поиск файлов рабочего пространства'),
      selectAll: l('Select all', 'Chọn tất cả', 'Tout sélectionner', 'Seleccionar todo', '全选', 'Velg alle', 'すべて選択', '모두 선택', 'Выбрать все'),
      unselectAll: l('Unselect all', 'Bỏ chọn tất cả', 'Tout désélectionner', 'Deseleccionar todo', '取消全选', 'Fjern alle valg', 'すべて選択解除', '모두 선택 해제', 'Снять выбор со всех'),
      loading: l('Loading workspace files…', 'Đang tải tệp trong không gian làm việc…', 'Chargement des fichiers de l’espace de travail…', 'Cargando archivos del espacio de trabajo…', '正在加载工作区文件…', 'Laster arbeidsområdefiler…', 'ワークスペースファイルを読み込み中…', '작업 영역 파일 로드 중…', 'Загрузка файлов рабочего пространства…'),
      fileCount: l('Files: {count}', 'Tệp: {count}', 'Fichiers : {count}', 'Archivos: {count}', '文件：{count}', 'Filer: {count}', 'ファイル: {count}', '파일: {count}', 'Файлы: {count}'),
      includeFolder: l('Include folder {path}', 'Bao gồm thư mục {path}', 'Inclure le dossier {path}', 'Incluir carpeta {path}', '包含文件夹 {path}', 'Inkluder mappe {path}', 'フォルダー {path} を含める', '폴더 {path} 포함', 'Включить папку {path}'),
      bytes: l('{count} bytes', '{count} byte', '{count} octets', '{count} bytes', '{count} 字节', '{count} byte', '{count} バイト', '{count}바이트', '{count} байт'),
      includeFile: l('Include {path}', 'Bao gồm {path}', 'Inclure {path}', 'Incluir {path}', '包含 {path}', 'Inkluder {path}', '{path} を含める', '{path} 포함', 'Включить {path}'),
      noMatches: l('No matches', 'Không có kết quả', 'Aucun résultat', 'Sin resultados', '无匹配项', 'Ingen treff', '一致する項目はありません', '일치 항목 없음', 'Нет совпадений'),
    },
    options: {
      format: l('Format', 'Định dạng', 'Format', 'Formato', '格式', 'Format', '形式', '형식', 'Формат'),
      htmlDescription: l('Standalone themed document', 'Tài liệu độc lập theo chủ đề', 'Document autonome avec thème', 'Documento temático independiente', '独立主题文档', 'Frittstående dokument med tema', 'テーマ付きスタンドアロンドキュメント', '독립형 테마 문서', 'Автономный документ с темой'),
      pdfDescription: l('Direct themed PDF export', 'Xuất PDF trực tiếp theo chủ đề', 'Export PDF direct avec thème', 'Exportación PDF directa con tema', '直接导出主题 PDF', 'Direkte PDF-eksport med tema', 'テーマを反映した PDF を直接エクスポート', '테마가 적용된 PDF 직접 내보내기', 'Прямой экспорт PDF с темой'),
      staticWebsite: l('Static Website', 'Trang web tĩnh', 'Site statique', 'Sitio web estático', '静态网站', 'Statisk nettsted', '静的 Web サイト', '정적 웹사이트', 'Статический сайт'),
      staticWebsiteDescription: l('Portable site ZIP with internal links', 'ZIP trang web di động với liên kết nội bộ', 'ZIP de site portable avec liens internes', 'ZIP de sitio portátil con enlaces internos', '带内部链接的便携站点 ZIP', 'Flyttbar nettsted-ZIP med interne lenker', '内部リンク付きのポータブルサイト ZIP', '내부 링크가 포함된 휴대용 사이트 ZIP', 'Переносимый ZIP сайта с внутренними ссылками'),
      visualLayout: l('Visual Layout', 'Bố cục hiển thị', 'Mise en page visuelle', 'Diseño visual', '视觉布局', 'Visuelt oppsett', '表示レイアウト', '시각적 레이아웃', 'Визуальный макет'),
      documentOnly: l('Document only', 'Chỉ tài liệu', 'Document uniquement', 'Solo documento', '仅文档', 'Kun dokument', 'ドキュメントのみ', '문서만', 'Только документ'),
      documentOnlyDescription: l('Theme, typography, diagrams and content without app chrome', 'Chủ đề, kiểu chữ, sơ đồ và nội dung không có khung ứng dụng', 'Thème, typographie, diagrammes et contenu sans interface de l’application', 'Tema, tipografía, diagramas y contenido sin la interfaz de la aplicación', '主题、排版、图表和内容，不含应用外壳', 'Tema, typografi, diagrammer og innhold uten app-ramme', 'アプリの外枠を除いたテーマ、文字、図、コンテンツ', '앱 외형 없이 테마, 타이포그래피, 다이어그램 및 콘텐츠', 'Тема, типографика, диаграммы и содержимое без интерфейса приложения'),
      fullExplorerLayout: l('Full Explorer layout', 'Bố cục Explorer đầy đủ', 'Mise en page Explorer complète', 'Diseño completo de Explorer', '完整 Explorer 布局', 'Fullt Explorer-oppsett', '完全な Explorer レイアウト', '전체 Explorer 레이아웃', 'Полный макет Explorer'),
      fullExplorerLayoutDescription: l('Export-safe topbar, document navigation and TOC shell', 'Thanh trên, điều hướng tài liệu và khung mục lục an toàn cho bản xuất', 'Barre supérieure, navigation et sommaire adaptés à l’export', 'Barra superior, navegación y tabla de contenido seguras para exportación', '适用于导出的顶部栏、文档导航和目录外壳', 'Eksportsikker topplinje, dokumentnavigasjon og innholdsfortegnelse', 'エクスポート向けのトップバー、ドキュメントナビゲーション、目次', '내보내기용 상단 바, 문서 탐색 및 목차 셸', 'Безопасные для экспорта верхняя панель, навигация и оглавление'),
      batchMode: l('Batch mode', 'Chế độ hàng loạt', 'Mode par lot', 'Modo por lotes', '批处理模式', 'Samlemodus', 'バッチモード', '일괄 처리 모드', 'Пакетный режим'),
      batchOutput: l('Batch Output', 'Đầu ra hàng loạt', 'Sortie par lot', 'Salida por lotes', '批量输出', 'Samlet utdata', 'バッチ出力', '일괄 출력', 'Пакетный вывод'),
      separateOutputs: l('Separate outputs', 'Đầu ra riêng biệt', 'Sorties séparées', 'Salidas separadas', '单独输出', 'Separate utdata', '個別出力', '개별 출력', 'Отдельные файлы'),
      mergedOutput: l('Merged output', 'Đầu ra hợp nhất', 'Sortie fusionnée', 'Salida combinada', '合并输出', 'Sammenslått utdata', '結合出力', '병합 출력', 'Объединённый файл'),
      documentsSelected: l('Documents selected: {count}', 'Tài liệu đã chọn: {count}', 'Documents sélectionnés : {count}', 'Documentos seleccionados: {count}', '已选文档：{count}', 'Valgte dokumenter: {count}', '選択したドキュメント: {count}', '선택한 문서: {count}', 'Выбрано документов: {count}'),
      activity: l('Export activity', 'Hoạt động xuất', 'Activité d’exportation', 'Actividad de exportación', '导出活动', 'Eksportaktivitet', 'エクスポート状況', '내보내기 활동', 'Ход экспорта'),
      activityEmpty: l('Export progress and saved outputs will appear here.', 'Tiến trình xuất và đầu ra đã lưu sẽ xuất hiện tại đây.', 'La progression et les sorties enregistrées apparaîtront ici.', 'El progreso y las salidas guardadas aparecerán aquí.', '导出进度和已保存的输出将显示在这里。', 'Eksportfremdrift og lagrede utdata vises her.', 'エクスポートの進行状況と保存先がここに表示されます。', '내보내기 진행 상황과 저장된 출력이 여기에 표시됩니다.', 'Здесь появятся ход экспорта и сохранённые файлы.'),
      artifactSite: l('Static Website (.zip)', 'Trang web tĩnh (.zip)', 'Site statique (.zip)', 'Sitio web estático (.zip)', '静态网站 (.zip)', 'Statisk nettsted (.zip)', '静的 Web サイト (.zip)', '정적 웹사이트 (.zip)', 'Статический сайт (.zip)'),
      artifactPdfFiles: l('PDF files', 'Các tệp PDF', 'Fichiers PDF', 'Archivos PDF', 'PDF 文件', 'PDF-filer', 'PDF ファイル', 'PDF 파일', 'PDF-файлы'),
      artifactPdf: l('PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)', 'PDF (.pdf)'),
      artifactHtmlPackage: l('HTML package (.zip)', 'Gói HTML (.zip)', 'Paquet HTML (.zip)', 'Paquete HTML (.zip)', 'HTML 包 (.zip)', 'HTML-pakke (.zip)', 'HTML パッケージ (.zip)', 'HTML 패키지 (.zip)', 'Пакет HTML (.zip)'),
      artifactHtml: l('HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)', 'HTML (.html)'),
    },
    status: {
      unableList: l('Unable to list workspace files', 'Không thể liệt kê tệp trong không gian làm việc', 'Impossible de lister les fichiers de l’espace de travail', 'No se pueden listar los archivos del espacio de trabajo', '无法列出工作区文件', 'Kan ikke vise arbeidsområdefiler', 'ワークスペースファイルを一覧できません', '작업 영역 파일을 나열할 수 없습니다', 'Не удалось получить список файлов рабочего пространства'),
      unableCreate: l('Unable to create export job', 'Không thể tạo tác vụ xuất', 'Impossible de créer la tâche d’exportation', 'No se puede crear la tarea de exportación', '无法创建导出任务', 'Kan ikke opprette eksportjobb', 'エクスポートジョブを作成できません', '내보내기 작업을 만들 수 없습니다', 'Не удалось создать задачу экспорта'),
      selectAtLeastOne: l('Select at least one document', 'Chọn ít nhất một tài liệu', 'Sélectionnez au moins un document', 'Selecciona al menos un documento', '请至少选择一个文档', 'Velg minst ett dokument', '少なくとも 1 つのドキュメントを選択してください', '문서를 하나 이상 선택하세요', 'Выберите хотя бы один документ'),
      cancelled: l('Export cancelled.', 'Đã hủy xuất.', 'Exportation annulée.', 'Exportación cancelada.', '导出已取消。', 'Eksport avbrutt.', 'エクスポートをキャンセルしました。', '내보내기가 취소되었습니다.', 'Экспорт отменён.'),
      partial: l('Export finished — successful: {success}, errors: {failure}.', 'Xuất hoàn tất — thành công: {success}, lỗi: {failure}.', 'Export terminé — réussites : {success}, erreurs : {failure}.', 'Exportación terminada — correctas: {success}, errores: {failure}.', '导出完成 — 成功：{success}，错误：{failure}。', 'Eksport fullført — vellykket: {success}, feil: {failure}.', 'エクスポート完了 — 成功: {success}、エラー: {failure}。', '내보내기 완료 — 성공: {success}, 오류: {failure}.', 'Экспорт завершён — успешно: {success}, ошибок: {failure}.'),
      failedCount: l('Export failed — errors: {count}.', 'Xuất thất bại — lỗi: {count}.', 'Échec de l’export — erreurs : {count}.', 'Error de exportación — errores: {count}.', '导出失败 — 错误：{count}。', 'Eksport mislyktes — feil: {count}.', 'エクスポート失敗 — エラー: {count}。', '내보내기 실패 — 오류: {count}.', 'Ошибка экспорта — ошибок: {count}.'),
      complete: l('Export complete — outputs: {count}.', 'Xuất hoàn tất — đầu ra: {count}.', 'Export terminé — sorties : {count}.', 'Exportación completa — salidas: {count}.', '导出完成 — 输出：{count}。', 'Eksport fullført — utdata: {count}.', 'エクスポート完了 — 出力: {count}。', '내보내기 완료 — 출력: {count}.', 'Экспорт завершён — файлов: {count}.'),
      failed: l('Export failed', 'Xuất thất bại', 'Échec de l’export', 'Error de exportación', '导出失败', 'Eksport mislyktes', 'エクスポートに失敗しました', '내보내기 실패', 'Ошибка экспорта'),
    },
  },
  scopeView: {
    dialogLabel: l('Scope view', 'Chế độ xem phạm vi', 'Vue de portée', 'Vista de ámbito', '范围视图', 'Omfangsvisning', 'スコープビュー', '범위 보기', 'Просмотр области'),
    previous: l('Previous scope', 'Phạm vi trước', 'Portée précédente', 'Ámbito anterior', '上一个范围', 'Forrige omfang', '前のスコープ', '이전 범위', 'Предыдущая область'),
    next: l('Next scope', 'Phạm vi tiếp theo', 'Portée suivante', 'Ámbito siguiente', '下一个范围', 'Neste omfang', '次のスコープ', '다음 범위', 'Следующая область'),
    level: l('Scope level {depth} of {max}', 'Mức phạm vi {depth} trên {max}', 'Niveau de portée {depth} sur {max}', 'Nivel de ámbito {depth} de {max}', '范围级别 {depth}/{max}', 'Omfangsnivå {depth} av {max}', 'スコープレベル {depth}/{max}', '범위 수준 {depth}/{max}', 'Уровень области {depth} из {max}'),
    close: l('Close scope', 'Đóng phạm vi', 'Fermer la portée', 'Cerrar ámbito', '关闭范围', 'Lukk omfang', 'スコープを閉じる', '범위 닫기', 'Закрыть область'),
    loading: l('Loading scope…', 'Đang tải phạm vi…', 'Chargement de la portée…', 'Cargando ámbito…', '正在加载范围…', 'Laster omfang…', 'スコープを読み込み中…', '범위 로드 중…', 'Загрузка области…'),
    maximumDepth: l('Maximum scope depth reached', 'Đã đạt độ sâu phạm vi tối đa', 'Profondeur maximale de portée atteinte', 'Se alcanzó la profundidad máxima del ámbito', '已达到最大范围深度', 'Maksimal omfangsdybde er nådd', 'スコープの最大深度に達しました', '최대 범위 깊이에 도달했습니다', 'Достигнута максимальная глубина области'),
    unableOpen: l('Unable to open scope', 'Không thể mở phạm vi', 'Impossible d’ouvrir la portée', 'No se puede abrir el ámbito', '无法打开范围', 'Kan ikke åpne omfang', 'スコープを開けません', '범위를 열 수 없습니다', 'Не удалось открыть область'),
    outsideWorkspace: l('This link is outside the current scope workspace', 'Liên kết này nằm ngoài không gian làm việc của phạm vi hiện tại', 'Ce lien est hors de l’espace de travail de la portée actuelle', 'Este enlace está fuera del espacio de trabajo del ámbito actual', '此链接位于当前范围工作区之外', 'Denne lenken er utenfor arbeidsområdet for gjeldende omfang', 'このリンクは現在のスコープのワークスペース外です', '이 링크는 현재 범위 작업 영역 밖에 있습니다', 'Эта ссылка находится вне рабочего пространства текущей области'),
    linkMenu: l('Scope link menu', 'Trình đơn liên kết phạm vi', 'Menu de lien de portée', 'Menú de enlace de ámbito', '范围链接菜单', 'Lenkemeny for omfang', 'スコープリンクメニュー', '범위 링크 메뉴', 'Меню ссылки области'),
    openInBrowser: l('Open in browser', 'Mở trong trình duyệt', 'Ouvrir dans le navigateur', 'Abrir en el navegador', '在浏览器中打开', 'Åpne i nettleser', 'ブラウザーで開く', '브라우저에서 열기', 'Открыть в браузере'),
    copyLink: l('Copy link', 'Sao chép liên kết', 'Copier le lien', 'Copiar enlace', '复制链接', 'Kopier lenke', 'リンクをコピー', '링크 복사', 'Копировать ссылку'),
    openAsScope: l('Open as scope', 'Mở dưới dạng phạm vi', 'Ouvrir comme portée', 'Abrir como ámbito', '作为范围打开', 'Åpne som omfang', 'スコープとして開く', '범위로 열기', 'Открыть как область'),
  },
};

function resolveLocalized(value: unknown, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, resolveLocalized(child, index)]));
}

export const EXPORT_SCOPE_TRANSLATIONS = Object.fromEntries(
  LANGUAGES.map((language, index) => [language, resolveLocalized(TEXT, index)]),
) as Record<AppLanguage, ExportScopeTranslations>;

export function getExportScopeTranslations(language?: string): ExportScopeTranslations {
  return EXPORT_SCOPE_TRANSLATIONS[language as AppLanguage] ?? EXPORT_SCOPE_TRANSLATIONS.en;
}

export function formatFeatureText(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.split(`{${key}}`).join(String(value)), template);
}
