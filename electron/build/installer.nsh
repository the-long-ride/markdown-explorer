!ifndef BUILD_UNINSTALLER
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

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
!macroend
