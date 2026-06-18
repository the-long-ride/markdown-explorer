function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").toLowerCase();
}

function collectFolderFilePaths(node) {
  return [
    ...(Array.isArray(node.files) ? node.files.map((file) => file.fsPath) : []),
    ...(Array.isArray(node.children) ? node.children.flatMap(collectFolderFilePaths) : []),
  ];
}

export function collectSelectedFolderPaths(tree, selectedFilePaths) {
  if (!tree || !selectedFilePaths) return [];

  const selectedFolderPaths = [];

  for (const child of tree.children ?? []) {
    const descendantFilePaths = collectFolderFilePaths(child);
    if (
      descendantFilePaths.length > 0 &&
      descendantFilePaths.every((filePath) => selectedFilePaths.has(filePath))
    ) {
      selectedFolderPaths.push(child.path);
    }
    selectedFolderPaths.push(...collectSelectedFolderPaths(child, selectedFilePaths));
  }

  return [...new Set(selectedFolderPaths)];
}

export function reconcileScopeFocusPaths({
  savedScopePaths,
  previousFilePaths,
  nextFilePaths,
  selectedFolderPaths = [],
}) {
  if (!savedScopePaths) return null;

  const nextFilePathSet = new Set(nextFilePaths);
  const previousFilePathSet = new Set(previousFilePaths);
  const selectedFolderPathSet = new Set(selectedFolderPaths);
  const nextSelection = new Set(
    savedScopePaths.filter(
      (filePath) => nextFilePathSet.has(filePath) || selectedFolderPathSet.has(filePath),
    ),
  );

  const normalizedSelectedFolderPaths = selectedFolderPaths.map(normalizePath);
  for (const filePath of nextFilePaths) {
    if (previousFilePathSet.has(filePath)) continue;
    nextSelection.add(filePath);
    const normalizedFilePath = normalizePath(filePath);
    if (
      normalizedSelectedFolderPaths.some(
        (folderPath) =>
          normalizedFilePath === folderPath ||
          normalizedFilePath.startsWith(`${folderPath}/`) ||
          normalizedFilePath.startsWith(`${folderPath}\\`),
      )
    ) {
      nextSelection.add(filePath);
    }
  }

  return [...nextSelection];
}
