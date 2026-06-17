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
    recentGuideTitle: "What is new since v1.5.0"
  },
  vi: {
    features: "Tính năng",
    shortcuts: "Phím tắt",
    privacy: "Riêng tư",
    tips: "Mẹo & Thực hành",
    viewShortcuts: "Xem phím tắt",
    recentGuideEyebrow: "Hướng dẫn tính năng mới",
    recentGuideTitle: "Các điểm mới kể từ v1.5.0"
  },
  fr: {
    features: "Fonctionnalités",
    shortcuts: "Raccourcis",
    privacy: "Confidentialité",
    tips: "Conseils",
    viewShortcuts: "Voir les raccourcis",
    recentGuideEyebrow: "Guide des nouvelles fonctionnalités",
    recentGuideTitle: "Quoi de neuf depuis la v1.5.0"
  },
  es: {
    features: "Funciones",
    shortcuts: "Atajos",
    privacy: "Privacidad",
    tips: "Consejos",
    viewShortcuts: "Ver atajos",
    recentGuideEyebrow: "Guía de funciones recientes",
    recentGuideTitle: "Novedades desde la v1.5.0"
  },
  zh: {
    features: "功能特性",
    shortcuts: "快捷键",
    privacy: "隐私",
    tips: "技巧与实践",
    viewShortcuts: "查看快捷键",
    recentGuideEyebrow: "近期功能指南",
    recentGuideTitle: "v1.5.0 以来的新特性"
  },
  no: {
    features: "Funksjoner",
    shortcuts: "Snarveier",
    privacy: "Personvern",
    tips: "Tips",
    viewShortcuts: "Vis snarveier",
    recentGuideEyebrow: "Guide for nye funksjoner",
    recentGuideTitle: "Hva er nytt siden v1.5.0"
  },
  ja: {
    features: "功能一覧",
    shortcuts: "ショートカット",
    privacy: "プライバシー",
    tips: "ヒントとコツ",
    viewShortcuts: "ショートカットを表示",
    recentGuideEyebrow: "最近の機能ガイド",
    recentGuideTitle: "v1.5.0 以降の新機能"
  },
  ko: {
    features: "기능 소개",
    shortcuts: "단축키",
    privacy: "개인정보",
    tips: "팁 및 가이드",
    viewShortcuts: "단축키 보기",
    recentGuideEyebrow: "최근 기능 가이드",
    recentGuideTitle: "v1.5.0 이후 변경 사항"
  },
  ru: {
    features: "Возможности",
    shortcuts: "Сочетания клавиш",
    privacy: "Конфиденциальность",
    tips: "Советы",
    viewShortcuts: "Посмотреть сочетания",
    recentGuideEyebrow: "Обзор новых функций",
    recentGuideTitle: "Что нового с версии 1.5.0"
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
      desc: "Bật tùy chọn [Đọc tệp DOCX, PDF, Office và văn bản] trong Cài đặt để xem trước các định dạng DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF và TXT. Quá trình chuyển đổi diễn ra cục bộ và cố gắng tối đa, nên các bố cục phức tạp có thể không khớp chính xác với bản gốc.",
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
  ],
  en: [
    {
      title: "Content File Tabs and Scope Focus",
      desc: "Turn on [Open Files in Tabs] to keep document tabs in the reader. Use [Scope Focus] in the sidebar to select only the files or folders you want visible for the current workspace.",
      badge: "v1.4.9",
    },
    {
      title: "Converted document previews",
      desc: "Turn on [Read DOCX, PDF, Office, and text files] in Settings to preview DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT. Conversion is local and best-effort, so complex layout may not match the source exactly.",
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
