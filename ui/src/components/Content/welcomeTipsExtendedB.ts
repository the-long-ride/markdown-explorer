import type { TipItem } from './welcomeTipsContent';

export const EXTENDED_TIPS_PART_B: Record<string, Record<string, TipItem>> = {
  es: {
    bookmarks: {
      badge: 'Marcadores',
      title: 'Marcadores de selección de texto y gestor',
      desc: 'Seleccione cualquier texto o encabezado de un documento para guardar un marcador con nombre. Abra la pestaña Marcadores en la barra lateral para buscar, filtrar, renombrar, saltar o eliminar marcadores guardados.',
    },
    tocAndSections: {
      badge: 'TOC y secciones',
      title: 'Índice interactivo y secciones de encabezado plegables',
      desc: 'Use la tabla de contenidos a la derecha para saltar a cualquier encabezado, haga clic en los chevrones del documento para plegar o desplegar secciones, o copie el Markdown completo de una sección desde su encabezado.',
    },
    liveAndSourceEditor: {
      badge: 'Editor Markdown',
      title: 'Edición Markdown en vivo y modo fuente pura',
      desc: 'Pulse (Ctrl+E) para editar bloques directamente con vista previa en vivo, o pulse (Ctrl+Alt+E) para abrir el editor de código fuente Markdown con barra de herramientas. Guarde cambios directamente en disco con (Ctrl+S).',
    },
    splitPaneView: {
      badge: 'Vista dividida',
      title: 'Comparación lado a lado en panel dividido',
      desc: 'Abra un segundo panel de documento desde el menú contextual de pestañas o la barra superior para leer, comparar o editar dos archivos Markdown lado a lado con pestañas y desplazamiento independientes.',
    },
    fileRevisionHistory: {
      badge: 'Historial de archivo',
      title: 'Historial de revisiones locales y diferencias visuales',
      desc: 'Haga clic en Historial en la barra superior para inspeccionar instantáneas locales automáticas, comparar cambios en modo Unificado, Fuente dividida o Diferencia renderizada, y restaurar cualquier versión.',
    },
    gitRepoHistory: {
      badge: 'Historial Git',
      title: 'Historial de repositorio Git e instantáneas de commits',
      desc: 'Cambie a la pestaña Historial en la barra lateral para explorar commits de Git, inspeccionar los archivos modificados por commit y previsualizar instantáneas del repositorio sin salir del espacio de trabajo.',
    },
    codeBlocksSelection: {
      badge: 'Bloques de código',
      title: 'Selección de líneas de código, copia y colapso',
      desc: 'Haga clic en un número de línea (o use (Shift+Click) para un rango) en un bloque de código para resaltar y copiar líneas específicas, copiar el fragmento completo en un clic o colapsar bloques largos.',
    },
    mermaidAndMath: {
      badge: 'Mermaid y matemáticas',
      title: 'Diagramas Mermaid, ZenUML y fórmulas matemáticas KaTeX',
      desc: 'Renderice diagramas de flujo, secuencia, ZenUML, clases, estados y ER 100% sin conexión junto con fórmulas matemáticas LaTeX ($...$ y $$...$$), con exportación de instantáneas en SVG/PNG con un clic.',
    },
    docConversion: {
      badge: 'Conversión doc',
      title: 'Conversión de documentos Office y PDF',
      desc: 'Active la conversión de documentos en Ajustes para previsualizar archivos .docx, .xlsx, .pptx y .pdf directamente como Markdown limpio y estructurado en su espacio de trabajo.',
    },
    knowledgeGraph: {
      badge: 'Grafo de conocimiento',
      title: 'Grafo de conocimiento interactivo y reparación de enlaces con IA',
      desc: 'Abra Estadísticas del espacio (pestaña Grafo) para visualizar enlaces entre documentos, enlaces entrantes, vecinos de 1.º/2.º grado y grupos de etiquetas, o copie un prompt de IA para reparar enlaces rotos.',
    },
    insightsSuite: {
      badge: 'Suite de análisis',
      title: 'Auditoría de enlaces, Linter Markdown, Documentos afines y Galería',
      desc: 'Use Estadísticas para auditar enlaces rotos internos/externos (Enlaces), revisar reglas de linter Markdown (Lint), descubrir archivos semánticamente afines (Relacionados) y explorar imágenes y diagramas (Galería).',
    },
    exportCenter: {
      badge: 'Centro de exportación',
      title: 'Centro de exportación multiformato',
      desc: 'Abra el Centro de exportación desde la barra superior para exportar el documento activo o un lote filtrado del espacio a HTML independiente, PDF, DOCX, PNG o SVG con estilos adaptados al tema.',
    },
    aiManualPrompt: {
      badge: 'Asistente IA',
      title: 'Manual listo para IA y prompt contextual',
      desc: 'Abra la pestaña Manual de usuario en la pantalla de bienvenida para copiar un prompt adaptado a la versión (basado en llm.txt y Changelog) en cualquier asistente de IA para una guía precisa paso a paso.',
    },
    visualThemeStyles: {
      badge: 'Temas visuales',
      title: 'Más de 8 temas visuales y mascotas interactivas',
      desc: 'Cambie entre los temas Por defecto, Glass, Bento, Raw Grid, Cyberpunk y mascotas interactivas (Corgi, Gato, Hámster), y alterne modo claro u oscuro en cualquier momento con (Ctrl+T).',
    },
    tourAndKeybindings: {
      badge: 'Recorrido y atajos',
      title: 'Atajos personalizados y recorrido interactivo guiado',
      desc: 'Reasigne o desactive atajos de teclado en Ajustes, exporte/importe su configuración (.json), y haga clic en Recorrido interactivo en el inicio para una visita completa de la aplicación.',
    },
  },
  zh: {
    bookmarks: {
      badge: '书签',
      title: '文本选区书签与书签管理器',
      desc: '在文档中选中任意文本或标题即可添加命名段落书签。打开侧边栏书签面板，可快速搜索、过滤、重命名、直接跳转或批量清理整个工作区中保存的书签。',
    },
    tocAndSections: {
      badge: '目录与小节',
      title: '交互式大纲目录与标题折叠',
      desc: '使用右侧目录大纲快速跳转到任意标题，点击文档正文中的小节折叠箭头展开或收起长章节，或点击标题右侧的复制按钮一键复制该章节的全部 Markdown 内容。',
    },
    liveAndSourceEditor: {
      badge: 'Markdown 编辑',
      title: '实时块级编辑与纯源码模式',
      desc: '按 (Ctrl+E) 即可就地编辑文档块并保持实时预览，或按 (Ctrl+Alt+E) 打开带有完整格式化工具栏的纯 Markdown 源码编辑器。随时按 (Ctrl+S) 将更改保存到本地磁盘。',
    },
    splitPaneView: {
      badge: '分屏视图',
      title: '双窗格并排对比与编辑',
      desc: '从标签页右键菜单或顶部栏开启第二文档窗格，并排阅读、对比或编辑两个 Markdown 文件，两个窗格具备独立的标签栏与滚动位置。',
    },
    fileRevisionHistory: {
      badge: '文件历史',
      title: '本地文件版本历史与直观对比',
      desc: '点击顶部栏历史按钮，查看本地自动保存的文件快照，支持以统一视图、分屏源码或渲染效果三种 Diff 模式对比差异，并可一键恢复至历史版本。',
    },
    gitRepoHistory: {
      badge: 'Git 历史',
      title: 'Git 仓库历史与提交快照',
      desc: '切换到侧边栏历史标签页，浏览 Git 提交记录，查看每次提交包含的修改文件清单，无需离开工作区即可预览历史快照内容。',
    },
    codeBlocksSelection: {
      badge: '代码块',
      title: '代码块行号多选、复制与折叠',
      desc: '在代码块中点击行号（或配合 (Shift+Click) 进行多行范围选择）高亮并复制特定行代码，一键复制整段代码，或折叠过长代码块以保持版面整洁。',
    },
    mermaidAndMath: {
      badge: 'Mermaid 与数学公式',
      title: 'Mermaid 图表、ZenUML 与 KaTeX 数学公式',
      desc: '完全离线渲染流程图、时序图、ZenUML、类图、状态机和实体关系图，完美支持 LaTeX 数学公式（$...$ 与 $$...$$），并支持一键导出为高清 SVG 或 PNG 图片。',
    },
    docConversion: {
      badge: '文档转换',
      title: 'Office 与 PDF 文档一键转换预览',
      desc: '在设置中启用文档转换功能后，即可直接在工作区中将 .docx、.xlsx、.pptx 及 .pdf 文档转换为排版整洁、结构规范的 Markdown 进行预览。',
    },
    knowledgeGraph: {
      badge: '知识图谱',
      title: '交互式知识图谱与 AI 修复链接',
      desc: '打开工作区洞察（图谱标签页），可视化文档内部引用、反向链接、一阶/二阶邻居关系及标签聚类，或一键复制 AI 提示词批量修复失效链接。',
    },
    insightsSuite: {
      badge: '洞察套件',
      title: '链接体检、Markdown 规范检查、关联推荐与媒体画廊',
      desc: '使用工作区洞察套件扫描内部/外部失效链接（链接）、运行 Markdown 语法规范检查（Lint）、根据内容语义推荐关联文档（相关），并集中浏览工作区中的所有图片与图表（画廊）。',
    },
    exportCenter: {
      badge: '导出中心',
      title: '多格式统一导出中心',
      desc: '从顶部栏打开导出中心，可将当前活动文档或按筛选条件批量将工作区文档导出为独立单文件 HTML、PDF、DOCX、PNG 或 SVG，完整保留主题配色。',
    },
    aiManualPrompt: {
      badge: 'AI 助手',
      title: '面向 AI 的用户手册与上下文提示词',
      desc: '打开主页用户手册标签页，一键复制针对当前版本的专属 AI 提示词（内嵌 llm.txt 和更新日志），发送给任何 AI 助手以获取准确、步骤详尽的操作指引。',
    },
    visualThemeStyles: {
      badge: '视觉主题',
      title: '8+ 款视觉主题风格与互动桌面宠物',
      desc: '可在默认、毛玻璃 (Glass)、便当盒 (Bento)、无修饰网格 (Raw Grid)、赛博朋克以及互动宠物主题（柯基、猫咪、仓鼠）间随时切换，按 (Ctrl+T) 快速切换浅色与深色模式。',
    },
    tourAndKeybindings: {
      badge: '导览与快捷键',
      title: '全按键自定义与全功能交互式导览',
      desc: '在设置中可自由修改或禁用任意键盘快捷键，支持导出/导入配置清单 (.json)；随时在主页点击交互式导览，开启带步骤引导的应用功能体验。',
    },
  },
  no: {
    bookmarks: {
      badge: 'Bokmerker',
      title: 'Tekstutvalgbokmerker og bokmerkebehandling',
      desc: 'Merk tekst eller en overskrift i et dokument for å lagre et navngitt avsnittsbokmerke. Åpne Bokmerker-fanen i sidemenyen for å søke, filtrere, gi nytt navn, hoppe til eller masseslette lagrede bokmerker.',
    },
    tocAndSections: {
      badge: 'Innholdsfortegnelse',
      title: 'Interaktiv innholdsfortegnelse og sammenleggbare seksjoner',
      desc: 'Bruk innholdsfortegnelsen til høyre for å hoppe til en overskrift, klikk på seksjonspilene i dokumentet for å skjule eller vise lange deler, eller kopier all Markdown for en hel seksjon fra overskriften.',
    },
    liveAndSourceEditor: {
      badge: 'Markdown-editor',
      title: 'Direkte Markdown-redigering og ren kildemodus',
      desc: 'Trykk (Ctrl+E) for å redigere blokker direkte med forhåndsvisning, eller (Ctrl+Alt+E) for å åpne kildeeditoren med formateringsverktøylinje. Lagre endringer til disk når som helst med (Ctrl+S).',
    },
    splitPaneView: {
      badge: 'Delt visning',
      title: 'Side-om-side sammenligning i delt rute',
      desc: 'Åpne et ekstra dokumentpanel fra fanemenyen eller topplinjen for å lese, sammenligne eller redigere to Markdown-filer side om side med uavhengige fanelinjer og rulling.',
    },
    fileRevisionHistory: {
      badge: 'Filhistorikk',
      title: 'Lokal revisjonshistorikk og visuelle endringer',
      desc: 'Klikk på Historikk i topplinjen for å undersøke automatiske lokale øyeblikksbilder, sammenligne endringer i samlet, delt kilde eller gjengitt visning, og gjenopprette tidligere versjoner.',
    },
    gitRepoHistory: {
      badge: 'Git-historikk',
      title: 'Git-depothistorikk og commit-øyeblikksbilder',
      desc: 'Bytt til Historikk-fanen i sidemenyen for å bla gjennom Git-commits, inspisere endrede filer per commit og forhåndsvise historiske øyeblikksbilder uten å forlate arbeidsområdet.',
    },
    codeBlocksSelection: {
      badge: 'Kodeblokker',
      title: 'Linjeutvalg i kodeblokk, kopiering og sammenslåing',
      desc: 'Klikk på et linjenummer (eller bruk (Shift+Click) for et intervall) i en kodeblokk for å markere og kopiere spesifikke linjer, kopiere hele kodesnutten med ett klikk, eller slå sammen lange blokker.',
    },
    mermaidAndMath: {
      badge: 'Mermaid & matematikk',
      title: 'Mermaid-diagrammer, ZenUML og KaTeX-matematikk',
      desc: 'Tegn flytskjemaer, sekvensdiagrammer, ZenUML, klassediagrammer og ER-diagrammer 100% offline sammen med LaTeX-formler ($...$ og $$...$$), med eksport til SVG/PNG med ett klikk.',
    },
    docConversion: {
      badge: 'Dokumentkonvertering',
      title: 'Konvertering av Office- og PDF-dokumenter',
      desc: 'Aktiver dokumentkonvertering i Innstillinger for å forhåndsvise .docx-, .xlsx-, .pptx- og .pdf-filer direkte som ren, strukturert Markdown i arbeidsområdet ditt.',
    },
    knowledgeGraph: {
      badge: 'Kunnskapsgraf',
      title: 'Interaktiv kunnskapsgraf og AI-lenkeverktøy',
      desc: 'Åpne Arbeidsområde-innsikt (Graf-fanen) for å visualisere dokumentlenker, tilbakekoblinger, 1./2.-grads naboer og tag-klynger, eller kopier en AI-ledetekst for å rette brutte lenker.',
    },
    insightsSuite: {
      badge: 'Innsiktspakke',
      title: 'Lenkerevisjon, Markdown-linter, relaterte filer og galleri',
      desc: 'Bruk Arbeidsområde-innsikt for å revidere brutte lenker (Lenker), kontrollere linter-regler (Lint), finne semantisk relaterte dokumenter (Relatert), og bla gjennom alle bilder og diagrammer (Galleri).',
    },
    exportCenter: {
      badge: 'Eksportsenter',
      title: 'Eksportsenter for flere formater',
      desc: 'Åpne Eksportsenter fra topplinjen for å eksportere det aktive dokumentet eller et filtrert utvalg til frittstående HTML, PDF, DOCX, PNG eller SVG med temastylet design.',
    },
    aiManualPrompt: {
      badge: 'AI-assistent',
      title: 'AI-klar brukerveiledning og kontekstinstruksjon',
      desc: 'Åpne Brukerveiledning-fanen på startsiden for å kopiere en versjonsspesifikk AI-instruksjon (med referanse til llm.txt og Changelog) inn i en valgfri AI-assistent for nøyaktig veiledning.',
    },
    visualThemeStyles: {
      badge: 'Visuelle temaer',
      title: 'Over 8 visuelle temastiler og interaktive kjæledyr',
      desc: 'Bytt mellom temaene Standard, Glass, Bento, Raw Grid, Cyberpunk og kjæledyrtemaer (Corgi, Katt, Hamster), og veksle mellom lys og mørk modus med (Ctrl+T).',
    },
    tourAndKeybindings: {
      badge: 'Omvisning og snarveier',
      title: 'Egendefinerte snarveier og interaktiv omvisning',
      desc: 'Tilpass eller deaktiver hurtigtaster i Innstillinger, eksporter/importer oppsettet ditt (.json), og start den interaktive omvisningen på startsiden for en fullstendig gjennomgang av appen.',
    },
  },
};
