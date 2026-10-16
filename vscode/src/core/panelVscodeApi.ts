let _vscode: any = null;

export function getVscode(): typeof import('vscode') {
  if (!_vscode) {
    _vscode = require('vscode');
  }
  return _vscode;
}

export function overrideVscodeForTest(mock: any): void {
  _vscode = mock;
}
