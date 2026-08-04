!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!define ME_PRODUCT_NAME "Markdown Explorer"
!define ME_VERB_NAME "MarkdownExplorer"
!define ME_FILE_CLASSES "Software\Classes\SystemFileAssociations"
!define ME_DIRECTORY_CLASSES "Software\Classes\Directory"

!macro ME_RemoveMarkdownContext
  DeleteRegKey HKCU "${ME_FILE_CLASSES}\.md\shell\${ME_VERB_NAME}"
  DeleteRegKey HKCU "${ME_FILE_CLASSES}\.mdx\shell\${ME_VERB_NAME}"
!macroend

!macro ME_RemoveFolderContext
  DeleteRegKey HKCU "${ME_DIRECTORY_CLASSES}\shell\${ME_VERB_NAME}"
  DeleteRegKey HKCU "${ME_DIRECTORY_CLASSES}\Background\shell\${ME_VERB_NAME}"
!macroend

!macro ME_NotifyShell
  ; SHCNE_ASSOCCHANGED | SHCNF_IDLIST
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!ifndef BUILD_UNINSTALLER
Var ME_CreateDesktopShortcut
Var ME_CreateStartMenuShortcut
Var ME_AddMarkdownContext
Var ME_AddFolderContext
Var ME_DesktopShortcutCheckbox
Var ME_StartMenuShortcutCheckbox
Var ME_MarkdownContextCheckbox
Var ME_FolderContextCheckbox

!macro ME_CheckIfEnabled Control State
  ${If} ${State} == ${BST_CHECKED}
    ${NSD_Check} ${Control}
  ${EndIf}
!macroend

!macro ME_RegisterFileContext Extension
  WriteRegStr HKCU "${ME_FILE_CLASSES}\${Extension}\shell\${ME_VERB_NAME}" "" "Open with ${ME_PRODUCT_NAME}"
  WriteRegStr HKCU "${ME_FILE_CLASSES}\${Extension}\shell\${ME_VERB_NAME}" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr HKCU "${ME_FILE_CLASSES}\${Extension}\shell\${ME_VERB_NAME}" "MultiSelectModel" "Single"
  WriteRegStr HKCU "${ME_FILE_CLASSES}\${Extension}\shell\${ME_VERB_NAME}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

Function MarkdownExplorerOptions
  IfSilent 0 +2
    Abort

  ; Updates intentionally preserve the choices from the original install.
  ${If} ${isUpdated}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "${ME_PRODUCT_NAME} options" "Choose the shortcuts and File Explorer integration to install."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 8u 100% 12u "Create desktop shortcut"
  Pop $ME_DesktopShortcutCheckbox
  !insertmacro ME_CheckIfEnabled $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut

  ${NSD_CreateCheckbox} 0 28u 100% 12u "Add ${ME_PRODUCT_NAME} to Start menu"
  Pop $ME_StartMenuShortcutCheckbox
  !insertmacro ME_CheckIfEnabled $ME_StartMenuShortcutCheckbox $ME_CreateStartMenuShortcut

  ${NSD_CreateCheckbox} 0 48u 100% 24u "Add ${ME_PRODUCT_NAME} to .md and .mdx context menus"
  Pop $ME_MarkdownContextCheckbox
  !insertmacro ME_CheckIfEnabled $ME_MarkdownContextCheckbox $ME_AddMarkdownContext

  ${NSD_CreateCheckbox} 0 78u 100% 24u "Add Open Folder in ${ME_PRODUCT_NAME} to File Explorer"
  Pop $ME_FolderContextCheckbox
  !insertmacro ME_CheckIfEnabled $ME_FolderContextCheckbox $ME_AddFolderContext

  nsDialogs::Show
FunctionEnd

Function MarkdownExplorerOptionsLeave
  ${NSD_GetState} $ME_DesktopShortcutCheckbox $ME_CreateDesktopShortcut
  ${NSD_GetState} $ME_StartMenuShortcutCheckbox $ME_CreateStartMenuShortcut
  ${NSD_GetState} $ME_MarkdownContextCheckbox $ME_AddMarkdownContext
  ${NSD_GetState} $ME_FolderContextCheckbox $ME_AddFolderContext
FunctionEnd

!macro customInit
  StrCpy $ME_CreateDesktopShortcut ${BST_UNCHECKED}
  StrCpy $ME_CreateStartMenuShortcut ${BST_CHECKED}
  StrCpy $ME_AddMarkdownContext ${BST_CHECKED}
  StrCpy $ME_AddFolderContext ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom MarkdownExplorerOptions MarkdownExplorerOptionsLeave
!macroend

!macro customInstall
  ${IfNot} ${isUpdated}
    ${If} $ME_CreateDesktopShortcut == ${BST_CHECKED}
      CreateShortCut "$DESKTOP\${ME_PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${Else}
      Delete "$DESKTOP\${ME_PRODUCT_NAME}.lnk"
    ${EndIf}

    ${If} $ME_CreateStartMenuShortcut == ${BST_CHECKED}
      CreateDirectory "$SMPROGRAMS\${ME_PRODUCT_NAME}"
      CreateShortCut "$SMPROGRAMS\${ME_PRODUCT_NAME}\${ME_PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${Else}
      Delete "$SMPROGRAMS\${ME_PRODUCT_NAME}\${ME_PRODUCT_NAME}.lnk"
      RMDir "$SMPROGRAMS\${ME_PRODUCT_NAME}"
    ${EndIf}

    ${If} $ME_AddMarkdownContext == ${BST_CHECKED}
      !insertmacro ME_RegisterFileContext ".md"
      !insertmacro ME_RegisterFileContext ".mdx"
    ${Else}
      !insertmacro ME_RemoveMarkdownContext
    ${EndIf}

    ${If} $ME_AddFolderContext == ${BST_CHECKED}
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\shell\${ME_VERB_NAME}" "" "Open Folder in ${ME_PRODUCT_NAME}"
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\shell\${ME_VERB_NAME}" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\shell\${ME_VERB_NAME}" "MultiSelectModel" "Single"
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\shell\${ME_VERB_NAME}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\Background\shell\${ME_VERB_NAME}" "" "Open Folder in ${ME_PRODUCT_NAME}"
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\Background\shell\${ME_VERB_NAME}" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
      WriteRegStr HKCU "${ME_DIRECTORY_CLASSES}\Background\shell\${ME_VERB_NAME}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
    ${Else}
      !insertmacro ME_RemoveFolderContext
    ${EndIf}

    !insertmacro ME_NotifyShell
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  Delete "$DESKTOP\${ME_PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${ME_PRODUCT_NAME}\${ME_PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${ME_PRODUCT_NAME}"
  !insertmacro ME_RemoveMarkdownContext
  !insertmacro ME_RemoveFolderContext
  !insertmacro ME_NotifyShell
!macroend
