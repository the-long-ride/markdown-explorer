import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import { useAppState } from "../../contexts/AppStateContext";
import type { SidebarTabId } from "../../contexts/appStateModel";
import { getHistoryTranslations } from "../../contexts/historyTranslations";
import { useRepositorySnapshot } from "../../contexts/RepositorySnapshotContext";
import { SearchIcon, FolderIcon } from "../shared/icons";
import { BookmarksPanel } from "../Bookmarks/BookmarksPanel";
import { BookmarkIcon } from "../Bookmarks/BookmarkIcons";
import { RepositoryHistoryPanel } from "../History/RepositoryHistoryPanel";
import type { BookmarkRecord, OpenBookmarkWorkspace } from "../../bookmarks/types.ts";
import { useBookmarks } from "../../bookmarks/useBookmarks.ts";
import { FileNode, FolderNodeView } from "./TreeNode";
import type { ScopeFocusTreeProps, SidebarItemMenuTarget, TreeOrderingProps } from "./TreeNode";
import { SidebarItemMenu } from "./SidebarItemMenu";
import { usePlatform } from "../../contexts/PlatformContext";
import { supportsShellLocation } from "../../desktop/shellLocation";
import { getTranslations } from "../../contexts/translations";
import { SidebarSearch, type RevisionSidebarSearch } from "./SidebarSearch";
import type { SidebarSearchStatus } from "./SidebarSearch";
import { useSidebarCursorNavigation } from "./useSidebarCursorNavigation";
import { getEnabledShortcut } from "../../utils/shortcuts";
import { supportsLocalFileBrowserOpen } from "../../dom/localFileBrowserSupport";
import { buildSidebarItemMenuItems } from "./sidebarItemMenuItems";
import { folderHasVisibleContent, getWorkspaceScopeKey, matchesFileSearch } from "./sidebarTreeFiltering";
import { getActiveFolderPaths } from "./sidebarActiveFolders";
import { useLocateActiveFile } from "./useLocateActiveFile";
import { SidebarFilesActions } from "./SidebarFilesActions";
import { useFolderExpansionCommand } from "./useFolderExpansionCommand";
import { collectHoistedPinnedItems, orderSidebarLevel } from "./sidebarTreeOrdering";
import { useSidebarPinnedSorting } from "./useSidebarPinnedSorting";
import { useSidebarScopeFocus } from "./useSidebarScopeFocus";
import { SidebarScopeControls } from "./SidebarScopeControls";
import { SidebarTabsHeader } from "./SidebarTabsHeader";
import { buildVisibleSidebarTabs, sidebarTabIndex } from "./sidebarTabs";

interface SidebarProps {
  cursorMode?: boolean;
  onCursorModeClose?: () => void;
  bookmarkViewMode?: 'focus' | 'tabs';
  bookmarkWorkspaces?: readonly OpenBookmarkWorkspace[];
  activeBookmarkWorkspaceKey?: string;
  onBookmarkNavigate?: (bookmark: BookmarkRecord) => void;
}

const EMPTY_PINNED_KEYS = new Set<string>();
const NOOP_FILE_SCOPE = (_filePath: string, _checked: boolean) => undefined;
const NOOP_FOLDER_SCOPE = (_filePaths: readonly string[], _checked: boolean) => undefined;

function HistorySidebarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function Sidebar({
  cursorMode = false,
  onCursorModeClose,
  bookmarkViewMode = 'focus',
  bookmarkWorkspaces = [],
  activeBookmarkWorkspaceKey = '',
  onBookmarkNavigate = () => {},
}: SidebarProps) {
  const { state, updateSettings, dispatch, navigate } = useAppState();
  const {
    state: snapshotState,
    capability: repositoryHistoryCapability,
    repositoryView,
    revisionWorkspace,
    openSnapshotFile,
    searchRevision,
  } = useRepositorySnapshot();
  const bridge = usePlatform();
  const bookmarkDocument = useBookmarks();
  const [filter, setFilter] = useState("");
  const [scopeFocusEditing, setScopeFocusEditing] = useState(false);
  const { folderExpansionCommand, collapseAllFolders, expandAllFolders } = useFolderExpansionCommand();
  const currentLang = state.settings.language || "en";
  const t = getTranslations(currentLang);
  const historyT = getHistoryTranslations(currentLang);
  const isRevisionMode = repositoryView.mode === 'revision';
  const displayedTree = isRevisionMode ? revisionWorkspace?.tree ?? null : state.tree;
  const displayedFileList = isRevisionMode ? revisionWorkspace?.fileList ?? [] : state.fileList;
  const displayedCurrentFile = isRevisionMode
    ? revisionWorkspace?.fileList.find((file) => file.relativePath === snapshotState.activePath)?.fsPath ?? null
    : state.currentFile;

  const navRef = useRef<HTMLElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const lastWorkspaceRef = useRef(state.workspaceName);
  const [itemMenu, setItemMenu] = useState<SidebarItemMenuTarget | null>(null);
  const canOpenItemLocations = supportsShellLocation(state.appRuntime);
  const canOpenHtmlInBrowser = supportsLocalFileBrowserOpen(state.appRuntime);

  const [searchStatus, setSearchStatus] = useState<SidebarSearchStatus>({
    isSearching: false,
    resultCount: 0,
    showCount: false,
  });

  const handleSearchStatus = useCallback((status: SidebarSearchStatus) => {
    setSearchStatus(status);
  }, []);

  const handleRequestItemMenu = useCallback((target: SidebarItemMenuTarget) => {
    setItemMenu((current) => current?.path === target.path ? null : target);
  }, []);

  const canRequestItemMenu = useCallback(() => !isRevisionMode, [isRevisionMode]);

  const isFiles = state.sidebarActiveTab === "files";
  const isSearch = state.sidebarActiveTab === "search";
  const isBookmarks = state.sidebarActiveTab === "bookmarks";
  const isHistory = state.sidebarActiveTab === "history";
  const bookmarkCount = bookmarkViewMode === 'tabs'
    ? bookmarkDocument.items.filter((item) => bookmarkWorkspaces.some((workspace) => workspace.workspaceKey === item.workspaceKey)).length
    : bookmarkDocument.items.filter((item) => item.workspaceKey === activeBookmarkWorkspaceKey).length;
  const historyEnabled = state.settings.historySidebarEnabled && repositoryHistoryCapability?.supported === true;
  const visibleTabs = useMemo(() => buildVisibleSidebarTabs({
    bookmarksEnabled: state.settings.bookmarksEnabled,
    historyEnabled,
    filesLabel: t.sidebar.files,
    searchLabel: t.sidebar.search,
    bookmarksLabel: t.bookmarks.tab,
    historyLabel: historyT.history,
    fileCount: displayedFileList.length,
    bookmarkCount,
    icons: {
      files: <FolderIcon size={14} />,
      search: <SearchIcon size={14} />,
      bookmarks: <BookmarkIcon size={14} />,
      history: <HistorySidebarIcon size={14} />,
    },
  }), [bookmarkCount, displayedFileList.length, historyEnabled, historyT.history, state.settings.bookmarksEnabled, t.bookmarks.tab, t.sidebar.files, t.sidebar.search]);
  const prevTabRef = useRef<SidebarTabId>(state.sidebarActiveTab);
  const [slideDirection, setSlideDirection] = useState<'from-right' | 'from-left'>('from-right');

  useEffect(() => {
    const prevTab = prevTabRef.current;
    const currentTab = state.sidebarActiveTab;
    if (currentTab !== prevTab) {
      const prevIdx = sidebarTabIndex(visibleTabs, prevTab);
      const currIdx = sidebarTabIndex(visibleTabs, currentTab);
      setSlideDirection(currIdx < prevIdx ? 'from-right' : 'from-left');
      prevTabRef.current = currentTab;
    }
  }, [state.sidebarActiveTab, visibleTabs]);

  useEffect(() => {
    if (!isFiles || isRevisionMode) setItemMenu(null);
  }, [isFiles, isRevisionMode]);
  useEffect(() => {
    const activeUnavailable = (isBookmarks && !state.settings.bookmarksEnabled) || (isHistory && !historyEnabled);
    if (activeUnavailable) dispatch({ type: "SET_SIDEBAR_ACTIVE_TAB", tab: "files" });
  }, [dispatch, historyEnabled, isBookmarks, isHistory, state.settings.bookmarksEnabled]);

  const scrollToActiveFile = useCallback(() => {
    if (!displayedCurrentFile) return;
    window.dispatchEvent(new CustomEvent("locate-active-file"));
  }, [displayedCurrentFile]);

  const locateRequest = useLocateActiveFile(treeRef);
  const onFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value), []);
  const scopeKey = getWorkspaceScopeKey(state.workspacePath, state.workspaceName);
  const {
    pinnedKeys,
    sortMode,
    hasPins,
    pinLimitReached,
    clearPins,
    togglePin,
    setSortMode,
  } = useSidebarPinnedSorting({
    tree: state.tree,
    workspaceKey: scopeKey,
    settings: state.settings,
    updateSettings,
  });
  const liveTreeOrdering = useMemo<TreeOrderingProps>(() => ({ pinnedKeys, sortMode }), [pinnedKeys, sortMode]);
  const displayedTreeOrdering = useMemo<TreeOrderingProps>(() => isRevisionMode
    ? { pinnedKeys: EMPTY_PINNED_KEYS, sortMode: 'name-asc' }
    : liveTreeOrdering, [isRevisionMode, liveTreeOrdering]);
  const {
    allFilePaths,
    selectedFilePaths,
    hideUnselected,
    hasScopeEntry,
    count: scopeFocusCount,
    allSelected: allFilesSelected,
    clear: clearScopeFocus,
    toggleAll: toggleAllScopeFiles,
    treeProps: scopeFocusTree,
  } = useSidebarScopeFocus({
    fileList: state.fileList,
    settings: state.settings,
    workspaceKey: scopeKey,
    editing: scopeFocusEditing,
    updateSettings,
  });
  const revisionScopeFocus = useMemo<ScopeFocusTreeProps>(() => ({
    editing: false,
    hideUnselected: false,
    selectedFilePaths: new Set(displayedFileList.map((file) => file.fsPath)),
    onFileChange: NOOP_FILE_SCOPE,
    onFolderChange: NOOP_FOLDER_SCOPE,
  }), [displayedFileList]);
  const displayedScopeFocus = isRevisionMode ? revisionScopeFocus : scopeFocusTree;
  const displayedSelectedPaths = isRevisionMode ? revisionScopeFocus.selectedFilePaths : selectedFilePaths;
  const displayedHideUnselected = isRevisionMode ? false : hideUnselected;
  const displayedHasScopeEntry = isRevisionMode ? false : hasScopeEntry;
  const cursorItemId = useSidebarCursorNavigation({
    cursorMode,
    currentFile: displayedCurrentFile,
    treeRef,
    filter,
    hideUnselected: displayedHideUnselected,
    scopeFocusEditing: isRevisionMode ? false : scopeFocusEditing,
    selectedFilePaths: displayedSelectedPaths,
    onCursorModeClose,
  });
  const activeFolderPaths = useMemo(
    () => getActiveFolderPaths(displayedCurrentFile, displayedFileList),
    [displayedCurrentFile, displayedFileList],
  );

  const { hoistedFiles, hoistedFolders } = useMemo(
    () => (!isRevisionMode && state.tree
      ? collectHoistedPinnedItems(state.tree, pinnedKeys)
      : { hoistedFiles: [], hoistedFolders: [] }),
    [isRevisionMode, state.tree, pinnedKeys],
  );

  const visibleRootFiles = useMemo(() => {
    const direct = displayedTree?.files.filter(
      (file) => matchesFileSearch(file, filter)
        && (!displayedHideUnselected || displayedSelectedPaths.has(file.fsPath)),
    ) ?? [];
    const hoisted = hoistedFiles.filter(
      (file) => matchesFileSearch(file, filter)
        && (!displayedHideUnselected || displayedSelectedPaths.has(file.fsPath)),
    );
    return [...direct, ...hoisted];
  }, [displayedTree, hoistedFiles, filter, displayedHideUnselected, displayedSelectedPaths]);

  const visibleRootChildren = useMemo(() => {
    const direct = displayedTree?.children.filter((child) =>
      folderHasVisibleContent(child, filter, displayedHideUnselected, displayedSelectedPaths),
    ) ?? [];
    const hoisted = hoistedFolders.filter((child) =>
      folderHasVisibleContent(child, filter, displayedHideUnselected, displayedSelectedPaths),
    );
    return [...direct, ...hoisted];
  }, [displayedTree, hoistedFolders, filter, displayedHideUnselected, displayedSelectedPaths]);

  const orderedRootItems = useMemo(
    () => orderSidebarLevel(visibleRootFiles, visibleRootChildren, {
      ...displayedTreeOrdering,
      showTitle: state.settings.showTitle,
    }),
    [state.settings.showTitle, displayedTreeOrdering, visibleRootChildren, visibleRootFiles],
  );
  const hasVisibleTreeItems = orderedRootItems.length > 0;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollPosRef.current = e.currentTarget.scrollTop;
  }, []);

  useLayoutEffect(() => {
    if (treeRef.current && isFiles) {
      if (lastWorkspaceRef.current !== state.workspaceName) {
        lastWorkspaceRef.current = state.workspaceName;
        scrollPosRef.current = 0;
        treeRef.current.scrollTop = 0;
      } else {
        treeRef.current.scrollTop = scrollPosRef.current;
      }
    }
  }, [displayedTree, state.workspaceName, isFiles]);

  const itemMenuItems = useMemo(() => isRevisionMode ? [] : buildSidebarItemMenuItems({
    state,
    target: itemMenu,
    canOpenHtmlInBrowser,
    canOpenItemLocations,
    translations: t,
    bridge,
    navigate,
    isPinned: itemMenu ? pinnedKeys.has(`${itemMenu.kind}:${itemMenu.path}`) : false,
    pinLimitReached,
    onTogglePin: togglePin,
  }), [
    bridge,
    canOpenHtmlInBrowser,
    canOpenItemLocations,
    isRevisionMode,
    itemMenu,
    navigate,
    pinLimitReached,
    pinnedKeys,
    state,
    t,
    togglePin,
  ]);

  const openRevisionFile = useCallback((file: { relativePath: string }) => {
    void openSnapshotFile(file.relativePath);
  }, [openSnapshotFile]);
  const revisionSearch = useMemo<RevisionSidebarSearch | undefined>(() => repositoryView.mode === 'revision'
    ? {
      oid: repositoryView.oid,
      run: (query, matchCase, signal) => searchRevision(query, matchCase, signal),
      openPath: (path) => { void openSnapshotFile(path); },
    }
    : undefined, [openSnapshotFile, repositoryView, searchRevision]);

  if (!displayedTree) return null;

  return (
    <nav
      ref={navRef}
      className={`sidebar${state.sidebarCollapsed ? " is-collapsed" : ""}${cursorMode ? " is-cursor-mode" : ""}${state.settings.bookmarksEnabled ? " has-bookmarks-feature" : ""}${isRevisionMode ? " is-revision-workspace" : ""}`}
      id="sidebar"
      aria-label={cursorMode ? t.ui.fileNavigationCursorMode : t.ui.fileNavigation}
    >
      <SidebarTabsHeader
        activeTab={state.sidebarActiveTab}
        tabs={visibleTabs}
        searchStatus={searchStatus}
        onSelect={(tab) => dispatch({ type: 'SET_SIDEBAR_ACTIVE_TAB', tab })}
      />

      <div className={`sidebar__tab-panel${isFiles ? ` is-active is-${slideDirection}` : " is-hidden"}`}>
        <div className="sidebar__header-fields">
          <div className="sidebar__search">
            <SearchIcon size={15} />
            <input type="text" placeholder={t.sidebar.filterPlaceholder} autoComplete="off" value={filter} onChange={onFilterChange} aria-label={t.sidebar.filterAriaLabel} />
          </div>
          {!isRevisionMode && (
            <>
              <div className="sidebar__files-second-row">
                <SidebarScopeControls editing={scopeFocusEditing} hasEntry={hasScopeEntry} count={scopeFocusCount} total={allFilePaths.length} allSelected={allFilesSelected} labels={{ focus: t.sidebar.scopeFocus, clear: t.sidebar.clearScopeFocus, checkAll: t.sidebar.checkAll, uncheckAll: t.sidebar.uncheckAll }} onToggleEditing={() => setScopeFocusEditing((editing) => !editing)} onToggleAll={toggleAllScopeFiles} onClear={clearScopeFocus} />
              </div>
              <SidebarFilesActions canLocate={Boolean(displayedCurrentFile)} hasPins={hasPins} locateLabel={t.tooltips.locateFile} clearPinsLabel={t.sidebar.clearPinnedItems} sortLabel={t.sidebar.sortFiles} sortNameAscLabel={t.sidebar.sortNameAsc} sortNameDescLabel={t.sidebar.sortNameDesc} sortModifiedDescLabel={t.sidebar.sortModifiedDesc} sortModifiedAscLabel={t.sidebar.sortModifiedAsc} collapseLabel={t.sidebar.collapseAllFolders} expandLabel={t.sidebar.expandAllFolders} locateShortcut={getEnabledShortcut(state.settings, 'locateFile')} sortMode={sortMode} onLocate={scrollToActiveFile} onClearPins={clearPins} onSortChange={setSortMode} onCollapseAll={collapseAllFolders} onExpandAll={expandAllFolders} />
            </>
          )}
        </div>
        <div className="sidebar__tree sidebar__tree--from-left" id="sidebarTree" role="tree" ref={treeRef} onScroll={handleScroll}>
          {orderedRootItems.map((item) => item.kind === "file" ? (
            <FileNode key={item.key} file={item.file} scopeFocus={displayedScopeFocus} ordering={displayedTreeOrdering} cursorMode={cursorMode} cursorItemId={cursorItemId} onRequestItemMenu={isRevisionMode ? undefined : handleRequestItemMenu} canRequestItemMenu={canRequestItemMenu} openMenuPath={itemMenu?.path ?? null} itemActionsLabel={isRevisionMode ? undefined : t.sidebarItemActions} pinnedLabel={t.sidebar.pinned} onNavigate={isRevisionMode ? openRevisionFile : undefined} />
          ) : (
            <FolderNodeView key={item.key} node={item.folder} filter={filter} scopeFocus={displayedScopeFocus} ordering={displayedTreeOrdering} cursorMode={cursorMode} cursorItemId={cursorItemId} onRequestItemMenu={isRevisionMode ? undefined : handleRequestItemMenu} canRequestItemMenu={canRequestItemMenu} openMenuPath={itemMenu?.path ?? null} itemActionsLabel={isRevisionMode ? undefined : t.sidebarItemActions} pinnedLabel={t.sidebar.pinned} activeFolderPaths={activeFolderPaths} locateRequest={locateRequest} expansionCommand={folderExpansionCommand} onNavigate={isRevisionMode ? openRevisionFile : undefined} />
          ))}
          {!hasVisibleTreeItems && <div className="sidebar__empty-scope">{displayedHasScopeEntry ? t.sidebar.noScopeFiles : t.sidebar.noFiles}</div>}
        </div>
      </div>

      <div className={`sidebar__tab-panel${isSearch ? ` is-active is-${slideDirection}` : " is-hidden"}`}>
        <SidebarSearch
          isVisible={isSearch}
          selectedFilePaths={isRevisionMode ? undefined : selectedFilePaths}
          hasScopeEntry={isRevisionMode ? false : hasScopeEntry}
          onStatusChange={handleSearchStatus}
          revisionSearch={revisionSearch}
        />
      </div>

      {state.settings.bookmarksEnabled && (
        <div className={`sidebar__tab-panel${isBookmarks ? ` is-active is-${slideDirection}` : " is-hidden"}`}>
          <BookmarksPanel visible={isBookmarks} viewMode={bookmarkViewMode} workspaces={bookmarkWorkspaces} activeWorkspaceKey={activeBookmarkWorkspaceKey} translations={t.bookmarks} onNavigate={onBookmarkNavigate} />
        </div>
      )}

      {historyEnabled && (
        <div className={`sidebar__tab-panel${isHistory ? ` is-active is-${slideDirection}` : " is-hidden"}`}>
          <RepositoryHistoryPanel visible={isHistory} language={currentLang} />
        </div>
      )}

      {!isRevisionMode && itemMenu && navRef.current && itemMenuItems.length > 0 && (
        <SidebarItemMenu
          anchor={itemMenu.anchor}
          sidebar={navRef.current}
          menuLabel={t.sidebarItemActions.replace("{name}", itemMenu.path.split(/[\\/]/).filter(Boolean).pop() ?? itemMenu.path)}
          items={itemMenuItems}
          onClose={() => setItemMenu(null)}
        />
      )}
    </nav>
  );
}
