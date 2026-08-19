export function setFilteredSelection(
  current: ReadonlySet<string>,
  visible: readonly string[],
  selected: boolean,
): Set<string> {
  const next = new Set(current);
  for (const path of visible) {
    if (selected) next.add(path);
    else next.delete(path);
  }
  return next;
}
