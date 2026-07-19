export function isWorkspaceNavigationHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#" || trimmed.startsWith("#")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  );
}

