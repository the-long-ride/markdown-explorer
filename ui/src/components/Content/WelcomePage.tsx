// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

import { useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { ACTIONS_LIST } from '../Settings/SettingsModal';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import './WelcomePage.css';

// =============================================================================
// Premium SVG Icon Components
// =============================================================================

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M7 16h10"/>
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6M10 22h4"/>
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function HighlightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Syntax Code brackets */}
      <path d="M8 18L2 12L8 6" />
      <path d="M16 6L22 12L16 18" />
      {/* Mermaid flowchart nodes */}
      <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="3" fill="var(--accent)" />
    </svg>
  );
}

function ModalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M16 2v4M12 7c-3.3 0-6 2.7-6 6v3h12v-3c0-3.3-2.7-6-6-6Z"/>
      <path d="M12 19v3M6 16H3M18 16h3M5 20l-3 1M19 20l3 1M8 10H5M16 10h3"/>
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

// =============================================================================
// Helper Utilities & Localized Labels (Emoji-free)
// =============================================================================

const cleanTitle = (text: string): string => {
  if (!text) return '';
  return text.replace(/^[✨⌨️🔒💡🔍🛠️📁📊📋🎨🖼️🐞🌐]\s*/u, '').replace(/\s*→\s*$/, '').trim();
};

const TAB_LABELS: Record<
  string,
  {
    features: string;
    shortcuts: string;
    privacy: string;
    tips: string;
    viewShortcuts: string;
    recentGuideEyebrow: string;
    recentGuideTitle: string;
  }
> = {
  en: {
    features: "Features",
    shortcuts: "Shortcuts",
    privacy: "Privacy",
    tips: "Tips & Practices",
    viewShortcuts: "View shortcuts",
    recentGuideEyebrow: "Recent feature guide",
    recentGuideTitle: "What is new since v1.5.0 — v1.5.3"
  },
  vi: {
    features: "Tính năng",
    shortcuts: "Phím tắt",
    privacy: "Riêng tư",
    tips: "Mẹo & Thực hành",
    viewShortcuts: "Xem phím tắt",
    recentGuideEyebrow: "Hướng dẫn tính năng mới",
    recentGuideTitle: "Các điểm mới kể từ v1.5.0 — v1.5.3"
  },
  fr: {
    features: "Fonctionnalités",
    shortcuts: "Raccourcis",
    privacy: "Confidentialité",
    tips: "Conseils",
    viewShortcuts: "Voir les raccourcis",
    recentGuideEyebrow: "Guide des nouvelles fonctionnalités",
    recentGuideTitle: "Quoi de neuf depuis la v1.5.0 — v1.5.3"
  },
  es: {
    features: "Funciones",
    shortcuts: "Atajos",
    privacy: "Privacidad",
    tips: "Consejos",
    viewShortcuts: "Ver atajos",
    recentGuideEyebrow: "Guía de funciones recientes",
    recentGuideTitle: "Novedades desde la v1.5.0 — v1.5.3"
  },
  zh: {
    features: "功能特性",
    shortcuts: "快捷键",
    privacy: "隐私",
    tips: "技巧与实践",
    viewShortcuts: "查看快捷键",
    recentGuideEyebrow: "近期功能指南",
    recentGuideTitle: "v1.5.0 — v1.5.3 新特性"
  },
  no: {
    features: "Funksjoner",
    shortcuts: "Snarveier",
    privacy: "Personvern",
    tips: "Tips",
    viewShortcuts: "Vis snarveier",
    recentGuideEyebrow: "Guide for nye funksjoner",
    recentGuideTitle: "Hva er nytt siden v1.5.0 — v1.5.3"
  },
  ja: {
    features: "功能一覧",
    shortcuts: "ショートカット",
    privacy: "プライバシー",
    tips: "ヒントとコツ",
    viewShortcuts: "ショートカットを表示",
    recentGuideEyebrow: "最近の機能ガイド",
    recentGuideTitle: "v1.5.0 — v1.5.3 の新機能"
  },
  ko: {
    features: "기능 소개",
    shortcuts: "단축키",
    privacy: "개인정보",
    tips: "팁 및 가이드",
    viewShortcuts: "단축키 보기",
    recentGuideEyebrow: "최근 기능 가이드",
    recentGuideTitle: "v1.5.0 — v1.5.3 변경 사항"
  },
  ru: {
    features: "Возможности",
    shortcuts: "Сочетания клавиш",
    privacy: "Конфиденциальность",
    tips: "Советы",
    viewShortcuts: "Посмотреть сочетания",
    recentGuideEyebrow: "Обзор новых функций",
    recentGuideTitle: "Что нового с версии 1.5.0 — 1.5.3"
  }
};

interface TipItem {
  title: string;
  desc: string;
  badge?: string;
}

const RECENT_FEATURE_GUIDE_CONTENT: Record<string, TipItem[]> = {
  vi: [
    {
      title: "Tab tài liệu & Tập trung phạm vi (Scope Focus)",
      desc: "Bật tùy chọn [Mở tệp trong tab] để giữ các tab tài liệu trong trình đọc. Sử dụng [Tập trung phạm vi] ở thanh bên để chỉ hiển thị các tệp hoặc thư mục bạn muốn thấy trong không gian làm việc hiện tại.",
      badge: "v1.4.9",
    },
    {
      title: "Xem trước tài liệu được chuyển đổi",
      desc: "Bật tùy chọn [Đọc tệp DOCX, PDF, Office và văn bản] trong Cài đặt để xem trước các định dạng DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS và RTF. Quá trình chuyển đổi diễn ra cục bộ và cố gắng tối đa, nên các bố cục phức tạp có thể không khớp chính xác với bản gốc.",
      badge: "v1.5.0",
    },
    {
      title: "Chế độ con trỏ thanh bên (Sidebar Cursor)",
      desc: "Nhấn [Alt+S] để tô sáng thanh bên, sau đó sử dụng các phím [Lên]/[Xuống] để di chuyển, [Enter] để mở rộng thư mục hoặc mở tệp, và [Esc], [Alt+S] hoặc nhấp ra ngoài để thoát chế độ.",
      badge: "v1.5.1",
    },
    {
      title: "Thu gọn bảng mục lục (TOC)",
      desc: "Nhấn nút [×] trên bảng mục lục để thu gọn hoàn toàn, giải phóng thêm không gian cho nội dung. Nhấn nút mũi tên ở góc để mở lại. Trạng thái được lưu lại giữa các phiên. Bạn cũng có thể dùng phím tắt tùy chỉnh để bật/tắt nhanh.",
      badge: "v1.5.2",
    },
    {
      title: "Định vị tệp hiện tại trong thanh bên",
      desc: "Nhấn nút kính ngắm trên tiêu đề thanh bên để cuộn đến và làm nổi bật tệp đang mở. Các thư mục cha sẽ tự động mở rộng nếu cần. Bạn cũng có thể gán phím tắt [Định vị tệp] trong Cài đặt phím tắt.",
      badge: "v1.5.2",
    },
    {
      title: "Chế độ đọc tập trung (Focus Mode)",
      desc: "Nhấp vào nút thu phóng ở góc trên cùng bên trái của thẻ tài liệu để bật/tắt Chế độ Tập trung, ẩn thanh bên, thanh trên cùng và mục lục để có giao diện đọc sạch sẽ. Bạn cũng có thể nhấn [Ctrl+Alt+F] để bật/tắt nhanh.",
      badge: "v1.5.2",
    },
    {
      title: "Hỗ trợ tệp TXT gốc",
      desc: "Xem trực tiếp nội dung các tệp .txt trong Markdown Explorer mà không cần bật chức năng chuyển đổi tài liệu.",
      badge: "v1.5.3",
    },
    {
      title: "Cập nhật tự động trên Windows (Self-Update)",
      desc: "Ứng dụng Desktop trên Windows có thể tải và áp dụng bản cập nhật trực tiếp mà không cần cài đặt lại. Vào Cài đặt để xem tiến trình tải xuống, lên lịch áp dụng khi thoát hoặc khởi động lại ngay. Quá trình cập nhật diễn ra hoàn toàn nội bộ và không cần quyền quản trị.",
      badge: "v1.5.3",
    },
    {
      title: "Theo dõi thay đổi thư mục làm việc & đồng bộ Scope Focus",
      desc: "Ứng dụng Desktop tự động theo dõi thay đổi trong thư mục làm việc (tạo, đổi tên, xóa tệp) và làm mới cây tệp sau 120 ms. Nếu bạn đang dùng [Tập trung phạm vi], danh sách tệp được chọn sẽ tự cập nhật — tệp mới trong thư mục đã chọn được thêm tự động, tệp đã xóa sẽ bị loại bỏ.",
      badge: "v1.5.3",
    },
    {
      title: "Khởi động nhanh hơn & tải thư viện theo yêu cầu",
      desc: "Quá trình quét thư mục và xây dựng chỉ mục tìm kiếm khi khởi động giờ được trì hoãn đến sau khi cửa sổ hiển thị, giúp giao diện xuất hiện nhanh hơn. Các thư viện Highlight.js, KaTeX, Mermaid và Chart.js được tách thành các chunk riêng và chỉ tải khi cần, giảm kích thước bundle ban đầu.",
      badge: "v1.5.3",
    },
  ],
  en: [
    {
      title: "Content File Tabs and Scope Focus",
      desc: "Turn on [Open Files in Tabs] to keep document tabs in the reader. Use [Scope Focus] in the sidebar to select only the files or folders you want visible for the current workspace.",
      badge: "v1.4.9",
    },
    {
      title: "Converted document previews",
      desc: "Turn on [Read DOCX, PDF, Office, and text files] in Settings to preview DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, and RTF. Conversion is local and best-effort, so complex layout may not match the source exactly.",
      badge: "v1.5.0",
    },
    {
      title: "Sidebar Cursor mode",
      desc: "Press [Alt+S] to highlight the sidebar, then use [Up]/[Down] to move, [Enter] to expand folders or open files, and [Esc], [Alt+S], or an outside click to leave the mode.",
      badge: "v1.5.1",
    },
    {
      title: "Collapsible TOC panel",
      desc: "Click the [×] button inside the TOC panel to collapse it and reclaim reading space. Click the arrow button at the content edge to reopen it. The state persists across sessions and can also be toggled with a customisable keyboard shortcut.",
      badge: "v1.5.2",
    },
    {
      title: "Locate current file in sidebar",
      desc: "Click the crosshair button in the sidebar header to scroll to and highlight the currently open file. Parent folders expand automatically if the file is nested. You can also assign a keyboard shortcut via Settings → Keyboard Shortcuts.",
      badge: "v1.5.2",
    },
    {
      title: "Focus mode reading view",
      desc: "Click the fullscreen toggle button in the top-left of the document content area to toggle Focus Mode, hiding the topbar, sidebar, and table of contents for a clean reading interface. You can also use [Ctrl+Alt+F] to toggle it instantly.",
      badge: "v1.5.2",
    },
    {
      title: "Native TXT file support",
      desc: "View .txt files directly in Markdown Explorer without needing to turn on document conversion.",
      badge: "v1.5.3",
    },
    {
      title: "Windows portable self-update",
      desc: "The Desktop app on Windows can now download and apply updates in-place without a reinstall. Open Settings to see the download progress card, schedule the update on exit, or restart and apply immediately. The update helper runs externally and writes a result code so the next launch can confirm success.",
      badge: "v1.5.3",
    },
    {
      title: "Workspace file watcher & live scope focus sync",
      desc: "The Desktop app now watches the active workspace folder for file-system changes and refreshes the sidebar automatically after a 120 ms debounce. If you use [Scope Focus], the selection is reconciled on every refresh — new files inside a focused folder are included automatically and deleted files are removed.",
      badge: "v1.5.3",
    },
    {
      title: "Faster startup & on-demand render libraries",
      desc: "Heavy startup work (workspace scan, search index build) is now deferred until after the window appears, making the app feel faster to open. Highlight.js, KaTeX, Mermaid, and Chart.js are split into separate async chunks and only loaded when needed, keeping the initial bundle smaller.",
      badge: "v1.5.3",
    },
  ],
  fr: [
    {
      title: "Onglets de fichiers & Focalisation de portée",
      desc: "Activez [Ouvrir les fichiers dans des onglets] pour conserver les onglets de documents dans le lecteur. Utilisez [Focalisation de portée] dans la barre latérale pour n'afficher que les fichiers ou dossiers souhaités.",
      badge: "v1.4.9",
    },
    {
      title: "Aperçu de documents convertis",
      desc: "Activez [Lire les fichiers DOCX, PDF, Office et texte] dans les Paramètres pour prévisualiser DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS et RTF. La conversion est locale et de type best-effort ; les mises en page complexes peuvent différer de l'original.",
      badge: "v1.5.0",
    },
    {
      title: "Mode curseur de barre latérale",
      desc: "Appuyez sur [Alt+S] pour activer la barre latérale, puis utilisez [Haut]/[Bas] pour naviguer, [Entrée] pour développer un dossier ou ouvrir un fichier, et [Échap], [Alt+S] ou un clic extérieur pour quitter le mode.",
      badge: "v1.5.1",
    },
    {
      title: "Panneau de table des matières rétractable",
      desc: "Cliquez sur [×] dans le panneau de table des matières pour le réduire et gagner de l'espace. Cliquez sur le bouton fléché au bord du contenu pour le rouvrir. L'état est conservé entre les sessions et peut être basculé avec un raccourci personnalisable.",
      badge: "v1.5.2",
    },
    {
      title: "Localiser le fichier actuel dans la barre latérale",
      desc: "Cliquez sur le bouton viseur dans l'en-tête de la barre latérale pour faire défiler jusqu'au fichier ouvert et le mettre en surbrillance. Les dossiers parents se développent automatiquement. Vous pouvez aussi assigner un raccourci clavier dans Paramètres → Raccourcis.",
      badge: "v1.5.2",
    },
    {
      title: "Mode lecture Focus",
      desc: "Cliquez sur le bouton plein écran en haut à gauche de la zone de contenu pour activer le mode Focus, masquant la barre supérieure, la barre latérale et la table des matières. Utilisez aussi [Ctrl+Alt+F] pour basculer instantanément.",
      badge: "v1.5.2",
    },
    {
      title: "Prise en charge native des fichiers TXT",
      desc: "Affichez les fichiers .txt directement dans Markdown Explorer sans activer la conversion de documents.",
      badge: "v1.5.3",
    },
    {
      title: "Mise à jour automatique portable Windows",
      desc: "L'application Desktop sur Windows peut télécharger et appliquer les mises à jour sans réinstallation. Ouvrez les Paramètres pour voir la progression du téléchargement, planifier la mise à jour à la fermeture ou redémarrer et appliquer immédiatement.",
      badge: "v1.5.3",
    },
    {
      title: "Surveillance du dossier de travail & synchronisation Scope Focus",
      desc: "L'application Desktop surveille maintenant les modifications du dossier de travail et actualise la barre latérale automatiquement après 120 ms. Si vous utilisez [Focalisation de portée], la sélection est réconciliée à chaque actualisation — les nouveaux fichiers dans un dossier ciblé sont inclus, les fichiers supprimés sont retirés.",
      badge: "v1.5.3",
    },
    {
      title: "Démarrage plus rapide & bibliothèques à la demande",
      desc: "Le travail lourd au démarrage (scan du dossier, construction de l'index) est différé après l'affichage de la fenêtre, rendant l'ouverture plus rapide. Highlight.js, KaTeX, Mermaid et Chart.js sont divisés en chunks asynchrones distincts et chargés uniquement quand nécessaire.",
      badge: "v1.5.3",
    },
  ],
  es: [
    {
      title: "Pestañas de archivos & Enfoque de ámbito",
      desc: "Activa [Abrir archivos en pestañas] para mantener las pestañas de documentos en el lector. Usa [Enfoque de ámbito] en la barra lateral para mostrar solo los archivos o carpetas que deseas ver.",
      badge: "v1.4.9",
    },
    {
      title: "Vista previa de documentos convertidos",
      desc: "Activa [Leer archivos DOCX, PDF, Office y texto] en Configuración para previsualizar DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS y RTF. La conversión es local y de mejor esfuerzo; los diseños complejos pueden no coincidir exactamente con el original.",
      badge: "v1.5.0",
    },
    {
      title: "Modo cursor de barra lateral",
      desc: "Pulsa [Alt+S] para resaltar la barra lateral, luego usa [Arriba]/[Abajo] para moverte, [Intro] para expandir carpetas o abrir archivos, y [Esc], [Alt+S] o un clic fuera para salir del modo.",
      badge: "v1.5.1",
    },
    {
      title: "Panel de tabla de contenidos plegable",
      desc: "Haz clic en [×] dentro del panel de tabla de contenidos para contraerlo y recuperar espacio de lectura. Haz clic en el botón de flecha en el borde del contenido para abrirlo de nuevo. El estado persiste entre sesiones y se puede cambiar con un atajo personalizable.",
      badge: "v1.5.2",
    },
    {
      title: "Localizar archivo actual en la barra lateral",
      desc: "Haz clic en el botón de retícula en el encabezado de la barra lateral para desplazarte y resaltar el archivo abierto. Las carpetas padre se expanden automáticamente. También puedes asignar un atajo de teclado en Configuración → Atajos de teclado.",
      badge: "v1.5.2",
    },
    {
      title: "Vista de lectura en modo enfoque",
      desc: "Haz clic en el botón de pantalla completa en la parte superior izquierda del área de contenido para activar el modo Enfoque, ocultando la barra superior, la barra lateral y la tabla de contenidos. También puedes usar [Ctrl+Alt+F] para alternarlo instantáneamente.",
      badge: "v1.5.2",
    },
    {
      title: "Soporte nativo de archivos TXT",
      desc: "Visualiza archivos .txt directamente en Markdown Explorer sin necesidad de activar la conversión de documentos.",
      badge: "v1.5.3",
    },
    {
      title: "Actualización automática portable de Windows",
      desc: "La aplicación Desktop en Windows puede descargar y aplicar actualizaciones sin reinstalación. Abre Configuración para ver el progreso de la descarga, programar la actualización al salir o reiniciar y aplicar inmediatamente.",
      badge: "v1.5.3",
    },
    {
      title: "Monitor de carpeta de trabajo & sincronización de Scope Focus",
      desc: "La aplicación Desktop ahora monitorea los cambios en la carpeta de trabajo y actualiza la barra lateral automáticamente tras 120 ms. Si usas [Enfoque de ámbito], la selección se reconcilia en cada actualización — los nuevos archivos en carpetas enfocadas se incluyen y los eliminados se descartan.",
      badge: "v1.5.3",
    },
    {
      title: "Inicio más rápido & bibliotecas bajo demanda",
      desc: "El trabajo pesado de inicio (escaneo de carpeta, construcción del índice) se pospone hasta después de que aparece la ventana, haciendo la apertura más rápida. Highlight.js, KaTeX, Mermaid y Chart.js se dividen en chunks asíncronos y solo se cargan cuando se necesitan.",
      badge: "v1.5.3",
    },
  ],
  zh: [
    {
      title: "文档标签页与作用域聚焦",
      desc: "开启 [在标签页中打开文件] 以在阅读器中保持文档标签。在侧边栏使用 [作用域聚焦] 仅显示当前工作区中所需的文件或文件夹。",
      badge: "v1.4.9",
    },
    {
      title: "转换文档预览",
      desc: "在设置中开启 [读取 DOCX、PDF、Office 和文本文件] 以预览 DOCX、PDF、HTML、XLSX、PPTX、ODT、ODP、ODS 和 RTF。转换在本地进行，复杂排版可能与原文件存在差异。",
      badge: "v1.5.0",
    },
    {
      title: "侧边栏光标模式",
      desc: "按 [Alt+S] 激活侧边栏，然后用 [上]/[下] 键移动，[回车] 展开文件夹或打开文件，[Esc]、[Alt+S] 或点击外部退出模式。",
      badge: "v1.5.1",
    },
    {
      title: "可折叠目录面板",
      desc: "点击目录面板中的 [×] 按钮将其折叠以释放阅读空间，点击内容边缘的箭头按钮重新打开。状态在会话间持久保存，也可通过自定义键盘快捷键切换。",
      badge: "v1.5.2",
    },
    {
      title: "在侧边栏定位当前文件",
      desc: "点击侧边栏标题中的准星按钮，滚动并高亮当前打开的文件。如果文件在嵌套目录中，父文件夹会自动展开。也可在设置 → 键盘快捷键中分配快捷键。",
      badge: "v1.5.2",
    },
    {
      title: "专注模式阅读视图",
      desc: "点击文档内容区左上角的全屏切换按钮，进入专注模式，隐藏顶栏、侧边栏和目录，获得干净的阅读界面。也可使用 [Ctrl+Alt+F] 快速切换。",
      badge: "v1.5.2",
    },
    {
      title: "原生 TXT 文件支持",
      desc: "无需开启文档转换功能，即可在 Markdown Explorer 中直接查看 .txt 文件。",
      badge: "v1.5.3",
    },
    {
      title: "Windows 便携版自动更新",
      desc: "Windows 桌面应用现在无需重新安装即可下载并应用更新。打开设置查看下载进度，选择退出时更新或立即重启应用。更新助手在外部运行并写入结果代码，下次启动时可确认更新成功。",
      badge: "v1.5.3",
    },
    {
      title: "工作区文件监听 & 作用域聚焦实时同步",
      desc: "桌面应用现在监听工作区文件夹的变化，在 120 ms 防抖后自动刷新侧边栏。如果您使用 [作用域聚焦]，选择会在每次刷新时自动同步——聚焦文件夹中的新文件自动加入，已删除的文件自动移除。",
      badge: "v1.5.3",
    },
    {
      title: "更快的启动 & 按需加载渲染库",
      desc: "繁重的启动工作（文件夹扫描、搜索索引构建）现在推迟到窗口出现后执行，使应用打开更快。Highlight.js、KaTeX、Mermaid 和 Chart.js 被拆分为独立的异步块，仅在需要时加载，减小初始包体积。",
      badge: "v1.5.3",
    },
  ],
  no: [
    {
      title: "Filflipere & Omfangsfokus",
      desc: "Slå på [Åpne filer i flipper] for å beholde dokumentflipperene i leseren. Bruk [Omfangsfokus] i sidefeltet for å vise bare de filene eller mappene du ønsker å se i gjeldende arbeidsområde.",
      badge: "v1.4.9",
    },
    {
      title: "Forhåndsvisning av konverterte dokumenter",
      desc: "Slå på [Les DOCX-, PDF-, Office- og tekstfiler] i Innstillinger for å forhåndsvise DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS og RTF. Konverteringen er lokal og beste-anstrengelse; komplekse oppsett kan avvike fra originalen.",
      badge: "v1.5.0",
    },
    {
      title: "Sidefelts-markørmodus",
      desc: "Trykk [Alt+S] for å aktivere sidefeltet, bruk deretter [Opp]/[Ned] for å navigere, [Enter] for å utvide mapper eller åpne filer, og [Esc], [Alt+S] eller et klikk utenfor for å forlate modus.",
      badge: "v1.5.1",
    },
    {
      title: "Sammenleggbart innholdsfortegnelsespanel",
      desc: "Klikk [×] inne i innholdsfortegnelsespanelet for å slå det sammen og frigjøre leseplass. Klikk pilknappen ved innholdskanten for å åpne det igjen. Tilstanden vedvarer mellom øktene og kan også veksles med en tilpassbar hurtigtast.",
      badge: "v1.5.2",
    },
    {
      title: "Finn gjeldende fil i sidefeltet",
      desc: "Klikk korshårknappen i sidefeltsoverskriften for å rulle til og fremheve den åpne filen. Overordnede mapper utvides automatisk. Du kan også tilordne en hurtigtast via Innstillinger → Tastatursnarveier.",
      badge: "v1.5.2",
    },
    {
      title: "Fokusmodul lesevisning",
      desc: "Klikk fullskjermvekslingsknappen øverst til venstre i innholdsområdet for å aktivere Fokusmodus, som skjuler topplinjen, sidefeltet og innholdsfortegnelsen. Du kan også bruke [Ctrl+Alt+F] for å veksle øyeblikkelig.",
      badge: "v1.5.2",
    },
    {
      title: "Innebygd TXT-filstøtte",
      desc: "Vis .txt-filer direkte i Markdown Explorer uten å aktivere dokumentkonvertering.",
      badge: "v1.5.3",
    },
    {
      title: "Bærbar selvoppdatering for Windows",
      desc: "Desktop-appen på Windows kan nå laste ned og bruke oppdateringer uten reinstallasjon. Åpne Innstillinger for å se nedlastingsfremdriften, planlegge oppdateringen ved avslutning eller starte på nytt og bruke umiddelbart.",
      badge: "v1.5.3",
    },
    {
      title: "Arbeidsområdekatalogvakt & live Omfangsfokus-synkronisering",
      desc: "Desktop-appen overvåker nå endringer i arbeidsområdemappen og oppdaterer sidefeltet automatisk etter 120 ms. Hvis du bruker [Omfangsfokus], avstemmes utvalget ved hver oppdatering — nye filer i fokuserte mapper inkluderes automatisk og slettede filer fjernes.",
      badge: "v1.5.3",
    },
    {
      title: "Raskere oppstart & biblioteker på forespørsel",
      desc: "Tungt oppstartsarbeid (mappeskanning, søkeindeksbygging) utsettes nå til etter at vinduet vises, noe som gjør appen raskere å åpne. Highlight.js, KaTeX, Mermaid og Chart.js deles i separate asynkrone chunks og lastes kun når det trengs.",
      badge: "v1.5.3",
    },
  ],
  ja: [
    {
      title: "ファイルタブ & スコープフォーカス",
      desc: "[ファイルをタブで開く] をオンにすると、リーダーにドキュメントタブを保持できます。サイドバーの [スコープフォーカス] を使って、現在のワークスペースで表示したいファイルやフォルダのみを絞り込めます。",
      badge: "v1.4.9",
    },
    {
      title: "変換ドキュメントのプレビュー",
      desc: "設定で [DOCX、PDF、Office、テキストファイルを読む] をオンにすると、DOCX、PDF、HTML、XLSX、PPTX、ODT、ODP、ODS、RTF をプレビューできます。変換はローカルでベストエフォート方式のため、複雑なレイアウトは原本と異なる場合があります。",
      badge: "v1.5.0",
    },
    {
      title: "サイドバーカーソルモード",
      desc: "[Alt+S] を押してサイドバーをアクティブにし、[上]/[下] キーで移動、[Enter] でフォルダの展開またはファイルを開き、[Esc]、[Alt+S]、または外側クリックでモードを終了します。",
      badge: "v1.5.1",
    },
    {
      title: "折りたたみ可能な目次パネル",
      desc: "目次パネル内の [×] ボタンをクリックして折りたたみ、読み取りスペースを確保します。コンテンツ端の矢印ボタンで再度開けます。状態はセッション間で保持され、カスタムキーボードショートカットでも切り替えられます。",
      badge: "v1.5.2",
    },
    {
      title: "サイドバーで現在のファイルを特定",
      desc: "サイドバーヘッダーの照準ボタンをクリックすると、現在開いているファイルにスクロールしてハイライト表示されます。ネストされたファイルは親フォルダが自動展開されます。設定 → キーボードショートカットでショートカットを割り当てることもできます。",
      badge: "v1.5.2",
    },
    {
      title: "フォーカスモード読書ビュー",
      desc: "ドキュメントコンテンツエリア左上の全画面切り替えボタンをクリックしてフォーカスモードに切り替え、トップバー、サイドバー、目次を非表示にします。[Ctrl+Alt+F] でも即座に切り替えられます。",
      badge: "v1.5.2",
    },
    {
      title: "ネイティブ TXT ファイルサポート",
      desc: "ドキュメント変換を有効にしなくても、.txt ファイルを Markdown Explorer で直接表示できます。",
      badge: "v1.5.3",
    },
    {
      title: "Windows ポータブル自己アップデート",
      desc: "Windows 版デスクトップアプリは、再インストールなしでアップデートをダウンロードして適用できるようになりました。設定を開いてダウンロードの進捗を確認し、終了時に更新をスケジュールするか、すぐに再起動して適用できます。",
      badge: "v1.5.3",
    },
    {
      title: "ワークスペースファイル監視 & ライブスコープフォーカス同期",
      desc: "デスクトップアプリがワークスペースフォルダの変更を監視し、120 ms デバウンス後にサイドバーを自動更新します。[スコープフォーカス] を使用している場合、更新のたびに選択が自動同期されます。フォーカスフォルダ内の新しいファイルは自動的に追加され、削除されたファイルは除外されます。",
      badge: "v1.5.3",
    },
    {
      title: "高速起動 & オンデマンドレンダリングライブラリ",
      desc: "重い起動処理（フォルダスキャン、検索インデックス構築）がウィンドウ表示後まで遅延されるようになり、アプリの起動が高速化されます。Highlight.js、KaTeX、Mermaid、Chart.js は個別の非同期チャンクに分割され、必要な時だけ読み込まれます。",
      badge: "v1.5.3",
    },
  ],
  ko: [
    {
      title: "파일 탭 & 범위 포커스",
      desc: "[탭에서 파일 열기]를 켜면 리더에 문서 탭을 유지할 수 있습니다. 사이드바의 [범위 포커스]를 사용하여 현재 워크스페이스에서 보고 싶은 파일이나 폴더만 표시할 수 있습니다.",
      badge: "v1.4.9",
    },
    {
      title: "변환된 문서 미리보기",
      desc: "설정에서 [DOCX, PDF, Office, 텍스트 파일 읽기]를 켜면 DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF를 미리볼 수 있습니다. 변환은 로컬에서 최선의 방식으로 수행되므로 복잡한 레이아웃은 원본과 다를 수 있습니다.",
      badge: "v1.5.0",
    },
    {
      title: "사이드바 커서 모드",
      desc: "[Alt+S]를 눌러 사이드바를 활성화한 후 [위]/[아래] 키로 이동하고, [Enter]로 폴더를 펼치거나 파일을 열고, [Esc], [Alt+S] 또는 외부 클릭으로 모드를 종료합니다.",
      badge: "v1.5.1",
    },
    {
      title: "접을 수 있는 목차 패널",
      desc: "목차 패널의 [×] 버튼을 클릭하면 패널이 접혀 읽기 공간이 넓어집니다. 콘텐츠 가장자리의 화살표 버튼을 클릭하면 다시 열 수 있습니다. 상태는 세션 간 유지되며 사용자 지정 단축키로도 전환할 수 있습니다.",
      badge: "v1.5.2",
    },
    {
      title: "사이드바에서 현재 파일 찾기",
      desc: "사이드바 헤더의 조준선 버튼을 클릭하면 현재 열린 파일로 스크롤하고 강조 표시합니다. 파일이 중첩된 경우 상위 폴더가 자동으로 펼쳐집니다. 설정 → 키보드 단축키에서 단축키를 지정할 수도 있습니다.",
      badge: "v1.5.2",
    },
    {
      title: "포커스 모드 읽기 보기",
      desc: "문서 콘텐츠 영역 왼쪽 상단의 전체 화면 토글 버튼을 클릭하면 포커스 모드가 활성화되어 상단 바, 사이드바, 목차가 숨겨집니다. [Ctrl+Alt+F]로도 즉시 전환할 수 있습니다.",
      badge: "v1.5.2",
    },
    {
      title: "네이티브 TXT 파일 지원",
      desc: "문서 변환을 활성화하지 않고도 Markdown Explorer에서 .txt 파일을 직접 볼 수 있습니다.",
      badge: "v1.5.3",
    },
    {
      title: "Windows 포터블 자동 업데이트",
      desc: "Windows 데스크탑 앱이 이제 재설치 없이 업데이트를 다운로드하고 적용할 수 있습니다. 설정을 열어 다운로드 진행 상황을 확인하고, 종료 시 업데이트를 예약하거나 즉시 재시작하여 적용할 수 있습니다.",
      badge: "v1.5.3",
    },
    {
      title: "워크스페이스 파일 감시 & 실시간 범위 포커스 동기화",
      desc: "데스크탑 앱이 이제 워크스페이스 폴더의 변경 사항을 감시하고 120 ms 디바운스 후 사이드바를 자동으로 새로 고침합니다. [범위 포커스]를 사용하는 경우 매 새로 고침마다 선택이 조정됩니다 — 포커스 폴더의 새 파일은 자동으로 포함되고 삭제된 파일은 제거됩니다.",
      badge: "v1.5.3",
    },
    {
      title: "더 빠른 시작 & 필요 시 렌더링 라이브러리 로드",
      desc: "무거운 시작 작업(폴더 스캔, 검색 인덱스 구축)이 창이 표시된 후로 지연되어 앱 실행 속도가 빨라집니다. Highlight.js, KaTeX, Mermaid, Chart.js는 별도의 비동기 청크로 분리되어 필요할 때만 로드되므로 초기 번들 크기가 줄어듭니다.",
      badge: "v1.5.3",
    },
  ],
  ru: [
    {
      title: "Вкладки файлов & Фокус на область",
      desc: "Включите [Открывать файлы во вкладках], чтобы сохранять вкладки документов в читалке. Используйте [Фокус на область] на боковой панели, чтобы видеть только нужные файлы и папки текущего рабочего пространства.",
      badge: "v1.4.9",
    },
    {
      title: "Предпросмотр конвертированных документов",
      desc: "Включите [Читать файлы DOCX, PDF, Office и текст] в Настройках для предпросмотра DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS и RTF. Конвертация выполняется локально в режиме максимальных усилий; сложные макеты могут отличаться от оригинала.",
      badge: "v1.5.0",
    },
    {
      title: "Режим курсора боковой панели",
      desc: "Нажмите [Alt+S] для активации боковой панели, затем используйте [Вверх]/[Вниз] для навигации, [Enter] для раскрытия папки или открытия файла, [Esc], [Alt+S] или клик вне панели для выхода из режима.",
      badge: "v1.5.1",
    },
    {
      title: "Сворачиваемая панель оглавления",
      desc: "Нажмите [×] в панели оглавления, чтобы свернуть её и освободить место для чтения. Нажмите кнопку со стрелкой у края контента, чтобы снова открыть. Состояние сохраняется между сессиями и переключается настраиваемым сочетанием клавиш.",
      badge: "v1.5.2",
    },
    {
      title: "Найти текущий файл на боковой панели",
      desc: "Нажмите кнопку с прицелом в заголовке боковой панели, чтобы прокрутить и выделить открытый файл. Родительские папки раскрываются автоматически. Также можно назначить сочетание клавиш в Настройках → Сочетания клавиш.",
      badge: "v1.5.2",
    },
    {
      title: "Режим чтения Focus",
      desc: "Нажмите кнопку полноэкранного режима в левом верхнем углу области контента, чтобы включить режим Focus, скрывающий верхнюю панель, боковую панель и оглавление. Также используйте [Ctrl+Alt+F] для мгновенного переключения.",
      badge: "v1.5.2",
    },
    {
      title: "Нативная поддержка TXT-файлов",
      desc: "Просматривайте файлы .txt прямо в Markdown Explorer без необходимости включать конвертацию документов.",
      badge: "v1.5.3",
    },
    {
      title: "Портативное самообновление для Windows",
      desc: "Десктопное приложение на Windows теперь может загружать и применять обновления без переустановки. Откройте Настройки, чтобы увидеть прогресс загрузки, запланировать обновление при выходе или перезапустить и применить немедленно.",
      badge: "v1.5.3",
    },
    {
      title: "Мониторинг рабочей папки & синхронизация Фокуса на область",
      desc: "Десктопное приложение теперь следит за изменениями в рабочей папке и автоматически обновляет боковую панель через 120 мс. При использовании [Фокуса на область] выделение согласуется при каждом обновлении — новые файлы в целевых папках добавляются автоматически, удалённые файлы убираются.",
      badge: "v1.5.3",
    },
    {
      title: "Быстрый запуск & библиотеки по требованию",
      desc: "Тяжёлые задачи запуска (сканирование папки, построение поискового индекса) теперь откладываются до появления окна, ускоряя открытие приложения. Highlight.js, KaTeX, Mermaid и Chart.js разделены на отдельные асинхронные чанки и загружаются только по необходимости.",
      badge: "v1.5.3",
    },
  ],
};

const TIPS_CONTENT: Record<string, TipItem[]> = {
  vi: [
    {
      title: "Tìm kiếm nhanh tức thì (Quick Search) vs. Tìm trong tệp (Find in File)",
      desc: "Để tăng tốc độ tìm kiếm tài liệu, Markdown Explorer phân biệt hai chế độ tìm kiếm siêu nhanh:\n" +
            "• Phiên bản Desktop: Nhấn [Ctrl+F] để mở thanh Tìm kiếm nhanh (Quick Search) toàn bộ dự án, [Ctrl+Shift+F] để tìm trên tất cả các tab. Nhấn phím đơn [F] (khi không trong chế độ nhập liệu) để mở khung tìm kiếm từ khóa trong chính tệp hiện tại.\n" +
            "• Phiên bản VS Code: Nhấn [Ctrl+K] để tìm kiếm nhanh, [Ctrl+Shift+K] để tìm trên tất cả các tab và nhấn phím đơn [K] để tìm từ khóa trong tệp hiện tại.",
      badge: "Phím tắt thông minh"
    },
    {
      title: "HTML Live Preview Sandbox & Tương tác trực tiếp",
      desc: "Khi bạn viết các khối mã HTML trong tài liệu Markdown (ví dụ ```html ... ```), Markdown Explorer tự động tạo một khung iframe Sandbox biệt lập và an toàn (sử dụng thuộc tính [sandbox=\"allow-scripts\"]). Nhấn nút [Show Preview] trên góc block để xem và tương tác trực tiếp với các phần tử giao diện, nút bấm, input, script chạy cục bộ mà không sợ ảnh hưởng đến ứng dụng chủ.",
      badge: "HTML Sandbox"
    },
    {
      title: "Kéo & Thả để mở Không gian làm việc nhanh",
      desc: "Bạn có biết rằng trên phiên bản Desktop, bạn không cần nhấn qua nhiều menu phức tạp để mở dự án? Chỉ cần kéo bất kỳ thư mục dự án hoặc tập tin Markdown nào từ máy tính của bạn (File Explorer hoặc Finder) và thả trực tiếp vào bất cứ đâu trên cửa sổ ứng dụng. Ứng dụng sẽ tự động tải thư mục đó làm Workspace mới hoặc mở file tức thì.",
      badge: "Độc quyền Desktop"
    },
    {
      title: "Phân tích & Trực quan hóa dữ liệu bảng kiểu Excel",
      desc: "Bảng dữ liệu của bạn có nhiều cột số? Hãy nhấp vào các nút [Bar], [Line] hoặc [Pie] ở phía trên bảng để chuyển đổi dữ liệu thô thành các biểu đồ Chart.js sinh động. Ngoài ra, bạn có thể nhấp vào đầu cột để sắp xếp tăng/giảm, sử dụng biểu tượng bộ lọc (funnel) để lọc các hàng theo giá trị cụ thể, hoặc gõ vào ô tìm kiếm để lọc nhanh nội dung.",
      badge: "Tương tác bảng"
    },
    {
      title: "Trình xem đa phương tiện cao cấp & Thu phóng sơ đồ",
      desc: "Click vào bất kỳ hình ảnh nào hoặc các sơ đồ Mermaid để khởi chạy khung modal phóng to với hiệu ứng làm mờ nền (backdrop-blur) cao cấp. Bạn có thể sử dụng bánh xe chuột ([Mouse Wheel]) để phóng to/thu nhỏ, click giữ chuột để kéo ([pan]) hình ảnh, và sử dụng các phím mũi tên [Trái/Phải] để chuyển đổi nhanh qua lại giữa các hình ảnh trong tài liệu."
    }
  ],
  en: [
    {
      title: "Quick Search vs. Find in Current File Shortcuts",
      desc: "To boost your documentation lookup speeds, Markdown Explorer separates global search from in-file finding:\n" +
            "• Desktop App: Press [Ctrl+F] to open global Quick Search, and [Ctrl+Shift+F] to search all tabs. Press the bare key [F] to search for keywords in the current file.\n" +
            "• VS Code: Press [Ctrl+K] to open global Quick Search, [Ctrl+Shift+K] to search all tabs, and the bare key [K] to find keywords inside the current file.",
      badge: "Smart Shortcuts"
    },
    {
      title: "HTML Live Preview Sandbox & Direct Interaction",
      desc: "When you write HTML code blocks in your Markdown documents (e.g. ```html ... ```), Markdown Explorer automatically spawns a secure and isolated iframe Sandbox using the [sandbox=\"allow-scripts\"] attribute. Click the [Show Preview] button on the block header to toggle interactive rendering and directly run buttons, inputs, or scripts safely inside the markdown document.",
      badge: "HTML Sandbox"
    },
    {
      title: "Drag & Drop for Instant Workspace Loading",
      desc: "On the Desktop application, you don't need to manually click open/browse dialogs. Simply grab any workspace folder or Markdown file from your OS Explorer or Finder, and drop it anywhere inside the app window. The app will immediately mount the dropped path as your active workspace or open the document.",
      badge: "Desktop Exclusive"
    },
    {
      title: "Excel-Style Table Interactions & Charts",
      desc: "Does your table contain numeric values? Toggle the [Bar], [Line], or [Pie] buttons above the table to instantly render dynamic Chart.js visualizations. You can also click column headers to Sort, click the filter (funnel) icon to filter rows by specific values, or search text globally inside the search bar above.",
      badge: "Table Actions"
    },
    {
      title: "Premium Media Modal & Diagram Zooming",
      desc: "Click any image or generated Mermaid diagram to launch a beautiful backdrop-blur modal. You can scroll your mouse wheel ([Mouse Wheel]) to zoom in/out, click and drag to [pan] across high-res graphics, and press [Left/Right] arrow keys to cycle through all images available in the current document."
    }
  ]
};

const getTipIcon = (index: number) => {
  switch (index) {
    case 0: return <SearchIcon className="tip-icon" />;
    case 1: return <WrenchIcon className="tip-icon" />;
    case 2: return <FolderIcon className="tip-icon" />;
    case 3: return <ChartIcon className="tip-icon" />;
    case 4: return <ModalIcon className="tip-icon" />;
    default: return <LightbulbIcon className="tip-icon" />;
  }
};

const renderShortcutKeys = (shortcutStr: string) => {
  if (!shortcutStr) return null;
  const parts = shortcutStr.split('+');
  return (
    <span className="shortcut-keys-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {parts.map((part, idx) => (
        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {idx > 0 && <span style={{ color: 'var(--tx3)', fontWeight: 500 }}>+</span>}
          <kbd style={{ margin: 0 }}>{part}</kbd>
        </span>
      ))}
    </span>
  );
};

export function WelcomePage() {
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isElectron || isChrome;
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);
  const t = getTranslations(currentLang);
  
  const [activeTab, setActiveTab] = useState<'features' | 'shortcuts' | 'privacy' | 'tips'>('features');
  const labels = TAB_LABELS[currentLang] || TAB_LABELS.en;
  
  // Fallback to English tips if language is not Vietnamese
  const tips = TIPS_CONTENT[currentLang] || TIPS_CONTENT.en;

  const renderDescription = (text: string) => {
    const parts = text.split(/(\[[^\]]+\])/);
    return parts.map((part, idx) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        const key = part.slice(1, -1);
        return <kbd key={idx}>{key}</kbd>;
      }
      return part;
    });
  };

  return (
    <div className="welcome-container">
      <InteractiveBackground />
      <div className="welcome-animate-wrapper">
        {/* Hero Section */}
        <div className="hero-section">
        <h1 className="hero-title">
          {wt.hero.title}
        </h1>
        <p className="hero-subtitle">
          {isElectron ? wt.hero.descDesktop : wt.hero.descVSCode}
        </p>
        <div className="hero-meta">
          {wt.hero.createdBy}{' '}
          <a
            href="https://github.com/the-long-ride"
            target="_blank"
            rel="noopener noreferrer"
          >
            the-long-ride
          </a>{' '}
          with ❤️ · {wt.hero.repository}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
          >
            markdown-explorer
          </a>{' '}
          · {wt.hero.license}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT
          </a>
        </div>
        <div className="homepage-link-container">
          <a
            href="https://the-long-ride.github.io/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="homepage-link"
          >
            <GlobeIcon className="link-icon" />
            <span>https://the-long-ride.github.io/markdown-explorer</span>
          </a>
          {isElectron && state.hostPlatform === 'macos' && (
            <a
              href="https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md"
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-link"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="link-icon"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>{wt.hero.macosInstallBtn}</span>
            </a>
          )}
          {!isElectron && (
            <div className="desktop-recommendation">
              {wt.hero.desktopRecommendation}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <SparklesIcon className="tab-icon" />
          {labels.features}
        </button>
        <button
          className={`tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
          onClick={() => setActiveTab('shortcuts')}
        >
          <KeyboardIcon className="tab-icon" />
          {labels.shortcuts}
        </button>
        <button
          className={`tab-btn ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          <LightbulbIcon className="tab-icon" />
          {labels.tips}
        </button>
        <button
          className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          <LockIcon className="tab-icon" />
          {labels.privacy}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'features' && (
          <div className="features-grid">

            {/* Feature 1: Navigation Tree */}
            <div className="feature-card">
              <div className="feature-card-title">
                <FolderIcon className="card-icon" />
                {cleanTitle(wt.features.tree.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.tree.desc}
              </div>
            </div>

            {/* Feature 2: Quick Search */}
            <div className="feature-card">
              <div className="feature-card-title">
                <SearchIcon className="card-icon" />
                {cleanTitle(wt.features.search.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.search.desc}
                <div style={{ marginTop: '8px' }}>
                  <strong>
                    {isElectron ? (
                      <>
                        <kbd>F</kbd> · <kbd>Ctrl+F</kbd> · <kbd>Ctrl+Shift+F</kbd>
                      </>
                    ) : (
                      <>
                        <kbd>K</kbd> · <kbd>Ctrl+K</kbd> · <kbd>Ctrl+Shift+K</kbd>
                      </>
                    )}
                  </strong>
                </div>
              </div>
            </div>

            {/* Feature 3: Interactive Tables */}
            <div className="feature-card">
              <div className="feature-card-title">
                <TableIcon className="card-icon" />
                {cleanTitle(wt.features.tables.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.tables.desc}
              </div>
            </div>

            {/* Feature 4: Table-to-Chart */}
            <div className="feature-card">
              <div className="feature-card-title">
                <ChartIcon className="card-icon" />
                {cleanTitle(wt.features.charts.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.charts.desc}
              </div>
            </div>

            {/* Feature 5: Syntax Highlighting & Mermaid */}
            <div className="feature-card">
              <div className="feature-card-title">
                <HighlightIcon className="card-icon" />
                {cleanTitle(wt.features.highlight.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.highlight.desc}
              </div>
            </div>

            {/* Feature 6: Media Modal */}
            <div className="feature-card">
              <div className="feature-card-title">
                <ModalIcon className="card-icon" />
                {cleanTitle(wt.features.modal.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.modal.desc}
              </div>
            </div>

            {/* Feature 7: Keyboard Shortcuts Guide Card */}
            <div className="feature-card">
              <div className="feature-card-title">
                <KeyboardIcon className="card-icon" />
                {cleanTitle(wt.features.shortcuts.title)}
              </div>
              <div className="feature-card-desc">
                {!isElectron && (
                  <div style={{ marginBottom: '8px' }}>
                    {wt.features.shortcuts.vscodeDesc}
                  </div>
                )}
                {wt.features.shortcuts.desc}
              </div>
              <div className="feature-card-action">
                <button
                  className="card-action-btn"
                  onClick={() => setActiveTab('shortcuts')}
                >
                  {cleanTitle(labels.viewShortcuts)}
                  <ArrowRightIcon className="action-btn-icon" />
                </button>
              </div>
            </div>

            <div className="recent-guide-card">
              <div className="recent-guide-header">
                <div>
                  <div className="recent-guide-eyebrow">{labels.recentGuideEyebrow}</div>
                  <h2>{labels.recentGuideTitle}</h2>
                </div>
                <button
                  className="card-action-btn"
                  onClick={() => setActiveTab('shortcuts')}
                >
                  {cleanTitle(labels.viewShortcuts)}
                  <ArrowRightIcon className="action-btn-icon" />
                </button>
              </div>
              <div className="recent-guide-list">
                {(RECENT_FEATURE_GUIDE_CONTENT[currentLang] || RECENT_FEATURE_GUIDE_CONTENT.en).map((item) => (
                  <div className="recent-guide-item" key={`${item.badge}-${item.title}`}>
                    {item.badge && <span className="recent-guide-badge">{item.badge}</span>}
                    <h3>{item.title}</h3>
                    <p>{renderDescription(item.desc)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="shortcuts-card">
            <h2 className="shortcuts-title">
              <KeyboardIcon className="section-icon" />
              {cleanTitle(wt.features.shortcuts.title)}
            </h2>
            {!isElectron && (
              <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--tx2)', lineHeight: '1.5' }}>
                {wt.features.shortcuts.vscodeDesc}
              </div>
            )}
            <table className="shortcuts-table">
              <thead>
                <tr>
                  <th>{wt.shortcutsTable.headers.action}</th>
                  <th>{wt.shortcutsTable.headers.shortcut}</th>
                </tr>
              </thead>
              <tbody>
                {ACTIONS_LIST.filter((act) => act.scope === 'both' || isDesktopLike).map((act) => {
                  const val = state.settings.keybindings?.[act.id] || "";
                  return (
                    <tr key={act.id}>
                      <td>{t.actions[act.id as keyof typeof t.actions] || act.label}</td>
                      <td>
                        {renderShortcutKeys(val)}
                      </td>
                    </tr>
                  );
                })}
                {/* Special non-customizable shortcuts */}
                <tr>
                  <td>{wt.shortcutsTable.rows.zoomModal}</td>
                  <td><kbd>{wt.shortcutsTable.rows.zoomModalShortcut}</kbd></td>
                </tr>
                <tr>
                  <td>Sidebar cursor mode details</td>
                  <td>
                    Use <kbd>Up</kbd> / <kbd>Down</kbd> to move, <kbd>Enter</kbd> to expand/open, <kbd>Esc</kbd> to leave
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="shortcuts-note">
              {wt.shortcutsTable.note}
            </div>
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="tips-container">
            {tips.map((item, idx) => (
              <div className="tip-card" key={idx}>
                <div className="tip-card-header">
                  <h3 className="tip-card-title">
                    {getTipIcon(idx)}
                    {item.title}
                  </h3>
                  {item.badge && <span className="tip-card-badge">{item.badge}</span>}
                </div>
                <div className="tip-card-desc" style={{ whiteSpace: 'pre-line' }}>
                  {renderDescription(item.desc)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="privacy-support-container">
            {/* Privacy Pledge */}
            <div className="privacy-card">
              <h2 className="privacy-title">
                <LockIcon className="section-icon" />
                {cleanTitle(wt.privacy.title)}
              </h2>
              <div className="privacy-desc">
                {wt.privacy.desc}
                <ul className="privacy-list">
                  {wt.privacy.bullets.map((bullet, idx) => (
                    <li key={idx}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Report Issues */}
            <div className="issues-card">
              <h2 className="issues-title">
                <BugIcon className="section-icon" />
                {cleanTitle(wt.issues.title)}
              </h2>
              <div className="issues-desc">
                {wt.issues.hint}{' '}
                <a
                  href="https://github.com/the-long-ride/markdown-explorer/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {wt.issues.linkText}
                </a>
              </div>
              <ul className="issues-list">
                {wt.issues.bullets.map((bullet, idx) => (
                  <li key={idx}>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
