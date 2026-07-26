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


export function splitLeadingHtmlComments(html: string): { leadingCommentsHtml: string; bodyHtml: string } {
  const leadingComments: string[] = [];
  let remaining = html;
  const commentPattern = /^\s*(<div\s+class=(?:"[^"\n]*\bmdn-html-comment\b[^"\n]*"|\'[^\'\n]*\bmdn-html-comment\b[^\'\n]*\')[^>]*>[\s\S]*?<\/div>)\s*/;

  while (true) {
    const match = commentPattern.exec(remaining);
    if (!match) break;
    leadingComments.push(match[1]);
    remaining = remaining.slice(match[0].length);
  }

  return {
    leadingCommentsHtml: leadingComments.join('\n'),
    bodyHtml: remaining,
  };
}
