!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var ME_CreateDesktopShortcut
Var ME_CreateStartMenuShortcut
Var ME_AddMarkdownContext
Var ME_AddFolderContext
Var ME_DesktopShortcutCheckbox
Var ME_StartMenuShortcutCheckbox
Var ME_MarkdownContextCheckbox
Var ME_FolderContextCheckbox

!macro customPageAfterChangeDir
  Page custom MarkdownExplorerOptions MarkdownExplorerOptionsLeave
!macroend

Function MarkdownExplorerOptions
  !insertmacro MUI_HEADER_TEXT "Markdown Explorer options" "Choose shortcuts and File Explorer integration."
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateCheckbox} 0 8u 100% 12u "Create desktop shortcut"
  Pop $ME_DesktopShortcutCheckbox

  ${NSD_CreateCheckbox} 0 28u 100% 12u "Add Markdown Explorer to Start menu"
  Pop $ME_StartMenuShortcutCheckbox
  ${NSD_Check} $ME_StartMenuShortcutCheckbox

  ${NSD_CreateCheckbox} 0 48u 100% 24u "Add Markdown Explorer to .md and .mdx context menus"
  Pop $ME_MarkdownContextCheckbox
  ${NSD_Check} $ME_MarkdownContextCheckbox

  ${NSD_CreateCheckbox} 0 78u 100% 24u "Add Open Folder in Markdown Explorer to File Explorer"
  Pop $ME_FolderContextCheckbox
  ${NSD_Check} $ME_FolderContextCheckbox

  nsDialogs::Show
FunctionEnd

Function MarkdownExplorerOptionsLeave
  ${NSD_GetState} $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut
  ${NSD_GetState} $ME_StartMenuShortcutCheckbox $ME_CreateStartMenuShortcut
  ${NSD_GetState} $ME_MarkdownContextCheckbox $ME_AddMarkdownContext
  ${NSD_GetState} $ME_FolderContextCheckbox $ME_AddFolderContext
FunctionEnd

!macro customInstall
  ${If} $ME_CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Markdown Explorer.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${Else}
    Delete "$DESKTOP\Markdown Explorer.lnk"
  ${EndIf}

  ${If} $ME_CreateStartMenuShortcut == ${BST_CHECKED}
    CreateDirectory "$SMPROGRAMS\Markdown Explorer"
    CreateShortCut "$SMPROGRAMS\Markdown Explorer\Markdown Explorer.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${Else}
    Delete "$SMPROGRAMS\Markdown Explorer\Markdown Explorer.lnk"
    RMDir "$SMPROGRAMS\Markdown Explorer"
  ${EndIf}

  ${If} $ME_AddMarkdownContext == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer" "" "Open in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorerWithFolder" "" "Open in Markdown Explorer with this folder"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorerWithFolder" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorerWithFolder\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --open-with-folder "%1"'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer" "" "Open in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorerWithFolder" "" "Open in Markdown Explorer with this folder"
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorerWithFolder" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorerWithFolder\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --open-with-folder "%1"'
  ${EndIf}

  ${If} $ME_AddFolderContext == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer" "" "Open Folder in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\Directory\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer" "" "Open Folder in Markdown Explorer"
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
    WriteRegStr HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
  ${EndIf}
!macroend
!else
Var ME_UnCleanAppData
Var ME_UnCleanAppDataCheckbox

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.MarkdownExplorerUninstallOptions un.MarkdownExplorerUninstallOptionsLeave
!macroend

!macro customUnInit
  StrCpy $ME_UnCleanAppData "0"
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    StrCpy $ME_UnCleanAppData "${BST_CHECKED}"
  ${EndIf}
!macroend

Function un.MarkdownExplorerUninstallOptions
  ${if} ${isUpdated}
    Abort
  ${endif}

  !insertmacro MUI_HEADER_TEXT "Uninstall options" "Choose whether to remove Markdown Explorer application data and temporary files."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 8u 100% 24u "Delete all application data, settings, cache, and temporary files on this device"
  Pop $ME_UnCleanAppDataCheckbox
  ${If} $ME_UnCleanAppData == ${BST_CHECKED}
    ${NSD_Check} $ME_UnCleanAppDataCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function un.MarkdownExplorerUninstallOptionsLeave
  ${NSD_GetState} $ME_UnCleanAppDataCheckbox $ME_UnCleanAppData
FunctionEnd

Function un.RemoveTempEntries
  Exch $R0
  Push $R1
  Push $R2
  FindFirst $R1 $R2 "$TEMP\$R0"
  un_temp_loop:
    StrCmp $R2 "" un_temp_done
    StrCmp $R2 "." un_temp_next
    StrCmp $R2 ".." un_temp_next
    IfFileExists "$TEMP\$R2\*.*" 0 un_temp_file
      RMDir /r "$TEMP\$R2"
      Goto un_temp_next
    un_temp_file:
      Delete "$TEMP\$R2"
    un_temp_next:
      FindNext $R1 $R2
      Goto un_temp_loop
  un_temp_done:
    FindClose $R1
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd
!endif

!macro customUnInstall
  Delete "$DESKTOP\Markdown Explorer.lnk"
  Delete "$SMPROGRAMS\Markdown Explorer\Markdown Explorer.lnk"
  RMDir "$SMPROGRAMS\Markdown Explorer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\MarkdownExplorerWithFolder"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mdx\shell\MarkdownExplorerWithFolder"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\MarkdownExplorer"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\MarkdownExplorer"

  ${ifNot} ${isUpdated}
    ${If} $ME_UnCleanAppData == ${BST_CHECKED}
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}

      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      RMDir /r "$APPDATA\markdown-explorer"

      RMDir /r "$LOCALAPPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$LOCALAPPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}"
      !endif
      RMDir /r "$LOCALAPPDATA\markdown-explorer-updater"
      RMDir /r "$LOCALAPPDATA\markdown-explorer-electron-updater"

      RMDir /r "$TEMP\markdown-explorer-updater"
      Push "markdown-explorer-*"
      Call un.RemoveTempEntries
      Push "md-explorer-*"
      Call un.RemoveTempEntries
      Push "Markdown Explorer*"
      Call un.RemoveTempEntries
      Push "com.the-long-ride.markdown-explorer*"
      Call un.RemoveTempEntries
      Push "com.thelongride.markdownexplorer*"
      Call un.RemoveTempEntries

      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    ${EndIf}
  ${endif}
!macroend
