interface MermaidNode {
  readonly id: string;
  readonly label: string;
}

const DIAGRAM_HEADER_RE = /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4\w*)\b/i;
const IGNORED_LINE_RE = /^(?:style|classDef|class|click|linkStyle|subgraph|end|direction|title|accTitle|accDescr)\b/i;
const EDGE_RE = /\s*(?:<-->|-->|<--|---|-.->|==>|~~~|--x|--o|o--o|x--x)\s*(?:\|[^|]*\|\s*)?/g;

function cleanNodeLabel(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/^[\[({>]+|[\])}>]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNode(token: string): MermaidNode | null {
  const value = token.trim().replace(/[;,]+$/, '').trim();
  if (!value || value === '[*]') return null;

  const idAndLabel = /^([A-Za-z_][\w-]*)\s*(?:\[\((.*?)\)\]|\(\((.*?)\)\)|\[\[(.*?)\]\]|\{(.*?)\}|\[(.*?)\]|\((.*?)\)|>(.*?)\])/.exec(value);
  if (idAndLabel) {
    const id = idAndLabel[1];
    const rawLabel = idAndLabel.slice(2).find((item) => item !== undefined) ?? id;
    return { id, label: cleanNodeLabel(rawLabel) || id };
  }

  const stateAlias = /^state\s+["'](.+?)["']\s+as\s+([A-Za-z_][\w-]*)$/i.exec(value);
  if (stateAlias) return { id: stateAlias[2], label: cleanNodeLabel(stateAlias[1]) || stateAlias[2] };

  const id = /^([A-Za-z_][\w-]*)/.exec(value)?.[1] ?? '';
  if (!id) return null;
  return { id, label: cleanNodeLabel(id) || id };
}

function meaningfulStatements(source: string): string[] {
  return source
    .split(/\r?\n/)
    .flatMap((line) => line.split(';'))
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('%%') && !line.startsWith('%%{'));
}

function firstGraphEntrypoint(statements: readonly string[]): string {
  const labels = new Map<string, string>();
  const sourceOrder: string[] = [];
  const incoming = new Set<string>();
  const explicitEntrypoints: string[] = [];

  for (const statement of statements) {
    if (DIAGRAM_HEADER_RE.test(statement) || IGNORED_LINE_RE.test(statement)) continue;
    const parts = statement.split(EDGE_RE).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      const declaredNode = parseNode(statement);
      if (declaredNode && !labels.has(declaredNode.id)) labels.set(declaredNode.id, declaredNode.label);
      continue;
    }

    for (let index = 0; index < parts.length - 1; index += 1) {
      const rawSource = parts[index];
      const rawTarget = parts[index + 1].replace(/^\|[^|]*\|\s*/, '');
      const source = parseNode(rawSource);
      const target = parseNode(rawTarget);
      if (source) {
        if (!labels.has(source.id)) labels.set(source.id, source.label);
        if (!sourceOrder.includes(source.id)) sourceOrder.push(source.id);
      }
      if (target) {
        if (!labels.has(target.id)) labels.set(target.id, target.label);
        incoming.add(target.id);
        if (rawSource.trim() === '[*]' && !explicitEntrypoints.includes(target.id)) {
          explicitEntrypoints.push(target.id);
        }
      }
    }
  }

  const entryId = explicitEntrypoints[0]
    ?? sourceOrder.find((id) => !incoming.has(id))
    ?? sourceOrder[0];
  return entryId ? labels.get(entryId) ?? entryId : '';
}

export function getMermaidBookmarkDefaultName(source: string): string {
  const statements = meaningfulStatements(source);
  for (const statement of statements) {
    const participant = /^(?:participant|actor)\s+([^\s]+)(?:\s+as\s+(.+))?$/i.exec(statement);
    if (participant) return cleanNodeLabel(participant[2] || participant[1]);
  }

  const graphEntrypoint = firstGraphEntrypoint(statements);
  if (graphEntrypoint) return graphEntrypoint;

  for (const statement of statements) {
    if (DIAGRAM_HEADER_RE.test(statement) || IGNORED_LINE_RE.test(statement)) continue;
    const node = parseNode(statement);
    if (node) return node.label;
  }
  return '';
}
