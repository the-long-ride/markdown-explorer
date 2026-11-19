import { useEffect, useRef, useState } from 'react';
import { CHANGELOG_URL, GITHUB_REPO_URL } from '../../constants/urls';
import type { AppSettings } from '../../types';
import { CopyIcon } from '../shared/icons';
import { TooltipButton } from '../shared/TooltipButton';
import './UserManualTab.css';

interface UserManualTabProps {
  language: string;
  settings?: AppSettings;
  version: string;
}

const LLM_GUIDE_URL = `${GITHUB_REPO_URL}/blob/main/website/llm.txt`;
const PROMPT_COPY: Record<string, { title: string; description: string; copy: string; copied: string; failed: string }> = {
  en: { title: 'Get help to using Markdown Explorer by any AI', description: 'Copy this prompt into any AI chat to get help with the version you use.', copy: 'Copy prompt', copied: 'Prompt copied', failed: 'Could not copy. Select and copy the prompt below.' },
  vi: { title: 'Nhận trợ giúp sử dụng Markdown Explorer bằng bất kỳ AI nào', description: 'Sao chép lời nhắc này vào bất kỳ cuộc trò chuyện AI nào để được hướng dẫn theo phiên bản của bạn.', copy: 'Sao chép lời nhắc', copied: 'Đã sao chép lời nhắc', failed: 'Không thể sao chép. Hãy chọn và sao chép lời nhắc bên dưới.' },
  fr: { title: 'Obtenir de l’aide pour utiliser Markdown Explorer avec n’importe quelle IA', description: 'Copiez cette demande dans une conversation IA pour obtenir de l’aide sur votre version.', copy: 'Copier la demande', copied: 'Demande copiée', failed: 'Copie impossible. Sélectionnez et copiez le texte ci-dessous.' },
  es: { title: 'Obtén ayuda para usar Markdown Explorer con cualquier IA', description: 'Copia este mensaje en cualquier chat de IA para obtener ayuda con tu versión.', copy: 'Copiar mensaje', copied: 'Mensaje copiado', failed: 'No se pudo copiar. Selecciona y copia el texto de abajo.' },
  zh: { title: '通过任意 AI 获取使用 Markdown Explorer 的帮助', description: '复制此提示词到任意 AI 聊天，获取适合当前版本的帮助。', copy: '复制提示词', copied: '已复制提示词', failed: '复制失败。请选择并复制下方提示词。' },
  no: { title: 'Få hjelp til å bruke Markdown Explorer med hvilken som helst KI', description: 'Kopier denne teksten til en KI-chat for hjelp med din versjon.', copy: 'Kopier tekst', copied: 'Tekst kopiert', failed: 'Kunne ikke kopiere. Merk og kopier teksten nedenfor.' },
  ja: { title: '任意の AI で Markdown Explorer の使い方のサポートを受ける', description: 'このプロンプトを AI チャットにコピーして、お使いのバージョンの使い方を確認できます。', copy: 'プロンプトをコピー', copied: 'コピーしました', failed: 'コピーできませんでした。下の文章を選択してコピーしてください。' },
  ko: { title: '모든 AI로 Markdown Explorer 사용 도움 받기', description: '이 프롬프트를 AI 채팅에 복사해 사용 중인 버전에 맞는 도움을 받으세요.', copy: '프롬프트 복사', copied: '복사됨', failed: '복사할 수 없습니다. 아래 내용을 선택해 복사하세요.' },
  ru: { title: 'Получите помощь по использованию Markdown Explorer с помощью любого ИИ', description: 'Скопируйте этот запрос в любой ИИ-чат, чтобы получить помощь для вашей версии.', copy: 'Скопировать запрос', copied: 'Запрос скопирован', failed: 'Не удалось скопировать. Выделите и скопируйте текст ниже.' },
};

const AI_PROMPT_TEMPLATES: Record<string, (cleanVersion: string) => string> = {
  en: (v) => `I use Markdown Explorer v${v}. Help me learn how to use this version of the app and answer my follow-up questions with practical, step-by-step instructions.\n\nRead these official sources first:\n- Product and feature guide: ${LLM_GUIDE_URL}\n- Changelog and version changes: ${CHANGELOG_URL}\n- Repository and README: ${GITHUB_REPO_URL}\n- Releases: ${GITHUB_REPO_URL}/releases\n\nUse the changelog to distinguish features available in my version from newer changes. Ask which platform I use (Electron or Tauri desktop, VS Code, or web app) before giving platform-specific steps. If you cannot access a link, tell me and ask me to paste its content. Do not invent features, shortcuts, or settings. Please start with a brief overview of what I can do, then ask what I want to accomplish.`,

  vi: (v) => `Tôi đang sử dụng Markdown Explorer v${v}. Hãy hướng dẫn tôi cách sử dụng phiên bản này và trả lời các câu hỏi tiếp theo bằng các bước thực hiện cụ thể, thực tế.\n\nHãy đọc các nguồn tài liệu chính thức này trước:\n- Hướng dẫn sản phẩm và tính năng: ${LLM_GUIDE_URL}\n- Nhật ký thay đổi và phiên bản: ${CHANGELOG_URL}\n- Kho mã nguồn và README: ${GITHUB_REPO_URL}\n- Các bản phát hành: ${GITHUB_REPO_URL}/releases\n\nHãy sử dụng nhật ký thay đổi để phân biệt các tính năng có trong phiên bản của tôi với những thay đổi mới hơn. Hãy hỏi tôi đang dùng nền tảng nào (Desktop Electron hoặc Tauri, VS Code, hoặc ứng dụng web) trước khi đưa ra các bước chi tiết cho nền tảng đó. Nếu bạn không thể truy cập liên kết, hãy báo cho tôi và yêu cầu tôi dán nội dung. Không tự bịa ra tính năng, phím tắt hoặc cài đặt. Vui lòng bắt đầu bằng phần tóm tắt ngắn gọn những gì tôi có thể làm, sau đó hỏi tôi muốn thực hiện tác vụ nào.`,

  fr: (v) => `J’utilise Markdown Explorer v${v}. Aidez-moi à apprendre à utiliser cette version de l’application et répondez à mes questions avec des instructions pratiques étape par étape.\n\nConsultez d’abord ces sources officielles :\n- Guide du produit et des fonctionnalités : ${LLM_GUIDE_URL}\n- Journal des modifications et versions : ${CHANGELOG_URL}\n- Dépôt et README : ${GITHUB_REPO_URL}\n- Versions publiées : ${GITHUB_REPO_URL}/releases\n\nUtilisez le journal des modifications pour distinguer les fonctionnalités disponibles dans ma version des ajouts plus récents. Demandez-moi quelle plateforme j’utilise (Desktop Electron ou Tauri, VS Code ou application web) avant de fournir des étapes spécifiques. Si vous ne pouvez pas accéder à un lien, signalez-le-moi et demandez-moi d’en coller le contenu. N’inventez pas de fonctionnalités, raccourcis ou paramètres. Veuillez commencer par un bref aperçu de ce que je peux faire, puis demandez-moi ce que je souhaite accomplir.`,

  es: (v) => `Uso Markdown Explorer v${v}. Ayúdame a aprender a usar esta versión de la aplicación y responde a mis preguntas con instrucciones prácticas paso a paso.\n\nConsulta primero estas fuentes oficiales:\n- Guía del producto y funciones: ${LLM_GUIDE_URL}\n- Registro de cambios y versiones: ${CHANGELOG_URL}\n- Repositorio y README: ${GITHUB_REPO_URL}\n- Lanzamientos: ${GITHUB_REPO_URL}/releases\n\nUsa el registro de cambios para distinguir las funciones disponibles en mi versión de los cambios más recientes. Pregúntame qué plataforma uso (Desktop Electron o Tauri, VS Code o aplicación web) antes de dar pasos específicos de la plataforma. Si no puedes acceder a un enlace, avísame y pídeme que pegue su contenido. No inventes funciones, atajos ni ajustes. Comienza con un breve resumen de lo que puedo hacer y luego pregúntame qué deseo lograr.`,

  zh: (v) => `我正在使用 Markdown Explorer v${v}。请帮助我学习使用该版本的应用，并提供清晰实用的逐步操作指南来回答我的后续问题。\n\n请先阅读以下官方资料：\n- 产品与功能指南：${LLM_GUIDE_URL}\n- 更新日志与版本变更：${CHANGELOG_URL}\n- 代码仓库与 README：${GITHUB_REPO_URL}\n- 发布版本列表：${GITHUB_REPO_URL}/releases\n\n请依据更新日志区分我当前版本中支持的功能与更新的变动。在给出平台专属的操作步骤前，请先询问我使用的是哪个平台（Electron 或 Tauri 桌面端、VS Code 扩展，还是 Web 网页端）。若你无法访问某个链接，请告知我并将内容粘贴给你。请勿编造任何功能、快捷键或设置项。请先简要概述我可以进行的操作，然后询问我想要完成的具体任务。`,

  no: (v) => `Jeg bruker Markdown Explorer v${v}. Hjelp meg med å lære å bruke denne versjonen av appen, og svar på oppfølgingsspørsmålene mine med praktiske, trinnvise instruksjoner.\n\nLes disse offisielle kildene først:\n- Produkt- og funksjonsguide: ${LLM_GUIDE_URL}\n- Endringslogg og versjonsendringer: ${CHANGELOG_URL}\n- Kodelager og README: ${GITHUB_REPO_URL}\n- Utgivelser: ${GITHUB_REPO_URL}/releases\n\nBruk endringsloggen til å skille funksjonene som er tilgjengelige i min versjon fra nyere endringer. Spør hvilken plattform jeg bruker (Electron eller Tauri desktop, VS Code eller nettapp) før du gir plattformspesifikke trinn. Hvis du ikke har tilgang til en lenke, gi meg beskjed og be meg lime inn innholdet. Ikke finn på funksjoner, hurtigtaster eller innstillinger. Start gjerne med en kort oversikt over hva jeg kan gjøre, og spør deretter hva jeg ønsker å oppnå.`,

  ja: (v) => `私は Markdown Explorer v${v} を使用しています。このバージョンのアプリの使い方を学び、実践的なステップごとの手順で質問に答えてください。\n\nまず以下の公式ドキュメントをお読みください：\n- 製品および機能ガイド：${LLM_GUIDE_URL}\n- 変更履歴とバージョン情報：${CHANGELOG_URL}\n- リポジトリと README：${GITHUB_REPO_URL}\n- リリース一覧：${GITHUB_REPO_URL}/releases\n\nお使いのバージョンで利用可能な機能と、より新しい変更点を区别するために変更履歴を活用してください。プラットフォーム固有の手順を案内する前に、どのプラットフォーム（Electron または Tauri デスクトップ、VS Code 拡張機能、または Web アプリ）を使用しているか確認してください。リンクにアクセスできない場合はその旨を伝え、内容を貼り付けるよう依頼してください。架空の機能、ショートカット、設定項目を作り出さないでください。まずは何ができるかの簡単な概要から始め、次に何を達成したいかを尋ねてください。`,

  ko: (v) => `저는 Markdown Explorer v${v}을(를) 사용하고 있습니다. 이 버전의 앱 사용법을 안내해 주시고, 실용적인 단계별 지침으로 후속 질문에 답변해 주세요.\n\n먼저 아래 공식 자료를 확인해 주세요:\n- 제품 및 기능 가이드: ${LLM_GUIDE_URL}\n- 변경 로그 및 버전 변경 사항: ${CHANGELOG_URL}\n- 저장소 및 README: ${GITHUB_REPO_URL}\n- 릴리스 목록: ${GITHUB_REPO_URL}/releases\n\n변경 로그를 참조하여 현재 버전에 지원되는 기능과 최신 변경 사항을 구분해 주세요. 플랫폼별 세부 단계를 안내하기 전에 어떤 플랫폼(Electron 또는 Tauri 데스크톱, VS Code 확장 프로그램, 웹 앱)을 사용하는지 먼저 물어보세요. 링크에 접근할 수 없다면 알려주시고 내용을 붙여넣도록 요청해 주세요. 없는 기능이나 단축키, 설정을 임의로 지어내지 마세요. 먼저 수행할 수 있는 작업에 대한 간략한 개요로 시작한 후, 무엇을 작업하고 싶은지 물어보세요.`,

  ru: (v) => `Я использую Markdown Explorer v${v}. Помогите мне освоить эту версию приложения и отвечайте на мои вопросы с практическими пошаговыми инструкциями.\n\nСначала ознакомьтесь с официальными источниками:\n- Руководство по продукту и функциям: ${LLM_GUIDE_URL}\n- Журнал изменений и версий: ${CHANGELOG_URL}\n- Репозиторий и README: ${GITHUB_REPO_URL}\n- Релизы: ${GITHUB_REPO_URL}/releases\n\nИспользуйте журнал изменений, чтобы отличить функции моей версии от более новых изменений. Уточните, какую платформу я использую (десктоп Electron или Tauri, VS Code или веб-приложение), прежде чем давать пошаговые инструкции для платформы. Если у вас нет доступа к ссылке, сообщите мне и попросите вставить её содержимое. Не придумывайте несуществующие функции, сочетания клавиш или настройки. Пожалуйста, начните с краткого обзора возможностей, а затем спросите, какую задачу я хочу решить.`,
};

export function buildAiHelpPrompt(version: string, language = 'en'): string {
  const cleanVersion = version.replace(/^v/i, '');
  const template = AI_PROMPT_TEMPLATES[language] ?? AI_PROMPT_TEMPLATES.en;
  return template(cleanVersion);
}

export function UserManualTab({ language, version }: UserManualTabProps) {
  const promptCopy = PROMPT_COPY[language] || PROMPT_COPY.en;
  const prompt = buildAiHelpPrompt(version, language);
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const copyPrompt = async () => {
    try {
      if ((window as any).PlatformBridge?.copyToClipboard) {
        (window as any).PlatformBridge.copyToClipboard(prompt);
      } else {
        await navigator.clipboard.writeText(prompt);
      }
      setIsCopied(true);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyResetTimerRef.current = null;
      }, 2000);
    } catch (err) {
      console.warn('Failed to copy prompt to clipboard:', err);
    }
  };

  return (
    <div className="user-manual">
      <section className="manual-ai-prompt" aria-labelledby="manual-ai-prompt-title">
        <div className="manual-ai-prompt__heading">
          <div>
            <h3 id="manual-ai-prompt-title">{promptCopy.title}</h3>
            <p>{promptCopy.description}</p>
          </div>
          <TooltipButton
            type="button"
            className={`manual-ai-prompt__copy-btn mdn-section-copy-btn${isCopied ? ' is-copied' : ''}`}
            onClick={copyPrompt}
            tooltip={isCopied ? promptCopy.copied : promptCopy.copy}
            tooltipPos="below"
            tooltipAlign="right"
            aria-label={isCopied ? promptCopy.copied : promptCopy.copy}
            icon={<CopyIcon size={13} />}
          />
        </div>
        <textarea aria-label={promptCopy.title} value={prompt} readOnly rows={8} />
        <div className="manual-ai-prompt__links">
          <a href={LLM_GUIDE_URL} target="_blank" rel="noopener noreferrer">llm.txt</a>
          <a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">Changelog</a>
          <a href={`${GITHUB_REPO_URL}/releases`} target="_blank" rel="noopener noreferrer">Releases</a>
        </div>
      </section>
    </div>
  );
}
