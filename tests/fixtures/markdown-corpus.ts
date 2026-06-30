export interface MarkdownFixture {
  name: string;
  markdown: string;
  isMdx: boolean;
  expectedTokens?: any[];
  expectedHtmlInvariants?: string[];
}

export const markdownCorpus: MarkdownFixture[] = [
  {
    name: 'empty',
    markdown: '',
    isMdx: false,
  },
  {
    name: 'heading-atx',
    markdown: '# Hello\n\n## World',
    isMdx: false,
    expectedHtmlInvariants: ['<h1', 'Hello', '<h2', 'World'],
  },
  {
    name: 'heading-setext',
    markdown: 'Title\n=====\n\nSubtitle\n-------',
    isMdx: false,
    expectedHtmlInvariants: ['<h1', 'Title', '<h2', 'Subtitle'],
  },
  {
    name: 'duplicate-headings',
    markdown: '## Section\n\n## Section',
    isMdx: false,
    expectedHtmlInvariants: ['<h2', 'Section'],
  },
  {
    name: 'paragraph',
    markdown: 'Just a paragraph of text.',
    isMdx: false,
    expectedHtmlInvariants: ['<p>', 'Just a paragraph of text.'],
  },
  {
    name: 'code-fence-backtick',
    markdown: '```js\nconsole.log("hello");\n```',
    isMdx: false,
    expectedHtmlInvariants: ['<pre', 'console.log'],
  },
  {
    name: 'code-fence-tilde',
    markdown: '~~~python\nprint("hi")\n~~~',
    isMdx: false,
    expectedHtmlInvariants: ['<pre', 'print'],
  },
  {
    name: 'code-fence-unclosed',
    markdown: '```\nno closing fence',
    isMdx: false,
  },
  {
    name: 'inline-code',
    markdown: 'Use `npm test` to run.',
    isMdx: false,
    expectedHtmlInvariants: ['<code>', 'npm test'],
  },
  {
    name: 'emphasis',
    markdown: '*italic* **bold** ~~strike~~',
    isMdx: false,
    expectedHtmlInvariants: ['<em>', 'italic', '<strong>', 'bold', '<del>', 'strike'],
  },
  {
    name: 'link',
    markdown: '[Google](https://google.com)',
    isMdx: false,
    expectedHtmlInvariants: ['<a', 'href="https://google.com"', 'Google'],
  },
  {
    name: 'image',
    markdown: '![Alt text](image.png)',
    isMdx: false,
    expectedHtmlInvariants: ['<img', 'src', 'Alt text'],
  },
  {
    name: 'unsafe-url',
    markdown: '[XSS](javascript:alert(1))',
    isMdx: false,
  },
  {
    name: 'ordered-list',
    markdown: '1. First\n2. Second\n3. Third',
    isMdx: false,
    expectedHtmlInvariants: ['<ol', '<li>', 'First', 'Second', 'Third'],
  },
  {
    name: 'unordered-list',
    markdown: '- One\n- Two\n- Three',
    isMdx: false,
    expectedHtmlInvariants: ['<ul', '<li>', 'One', 'Two', 'Three'],
  },
  {
    name: 'task-list',
    markdown: '- [ ] Todo\n- [x] Done',
    isMdx: false,
    expectedHtmlInvariants: ['<input', 'type="checkbox"'],
  },
  {
    name: 'nested-list',
    markdown: '- A\n  - A1\n  - A2\n- B',
    isMdx: false,
    expectedHtmlInvariants: ['<ul', '<li>', 'A', 'A1'],
  },
  {
    name: 'blockquote',
    markdown: '> Quote text\n> More quote',
    isMdx: false,
    expectedHtmlInvariants: ['<blockquote', 'Quote text'],
  },
  {
    name: 'horizontal-rule',
    markdown: '---\n\n***\n\n___',
    isMdx: false,
    expectedHtmlInvariants: ['<hr'],
  },
  {
    name: 'pipe-table',
    markdown: '| H1 | H2 |\n| --- | --- |\n| A | B |',
    isMdx: false,
    expectedHtmlInvariants: ['<table', '<th', 'H1', 'H2', '<td', 'A', 'B'],
  },
  {
    name: 'ragged-pipe-table',
    markdown: '| A | B |\n| --- |',
    isMdx: false,
    expectedHtmlInvariants: ['<table'],
  },
  {
    name: 'escaped-pipe-table',
    markdown: '| H\\|1 | H2 |\n| --- | --- |',
    isMdx: false,
  },
  {
    name: 'code-span-pipe-table',
    markdown: '| `a|b` | c |\n| --- | --- |',
    isMdx: false,
  },
  {
    name: 'tab-table',
    markdown: '\tH1\tH2\n\t---\t---\n\tA\tB',
    isMdx: false,
  },
  {
    name: 'math-dollar',
    markdown: '$E = mc^2$\n\n$$\n\\sum_{i=1}^{n} x_i\n$$',
    isMdx: false,
    expectedHtmlInvariants: ['E = mc^2'],
  },
  {
    name: 'math-bracket',
    markdown: '\\(x^2\\)\n\n\\[\\int_0^1 x dx\\]',
    isMdx: false,
  },
  {
    name: 'frontmatter',
    markdown: '---\ntitle: "Test Document"\nauthor: Jane\n---\n\nContent here.',
    isMdx: false,
    expectedTokens: [
      { type: 'paragraph', text: 'Content here.' },
    ],
  },
  {
    name: 'frontmatter-colon-value',
    markdown: '---\ntitle: "A: B & C"\n---\n\nBody.',
    isMdx: false,
  },
  {
    name: 'frontmatter-url-value',
    markdown: '---\ntitle: My Page\nurl: https://example.com:8080/path\n---\n\nContent.',
    isMdx: false,
  },
  {
    name: 'frontmatter-quotted-colon',
    markdown: '---\ndescription: "key: value"\n---\n\nText.',
    isMdx: false,
  },
  {
    name: 'mdx-import',
    markdown: 'import { Button } from "./components";\n\n<Button />',
    isMdx: true,
  },
  {
    name: 'mdx-export',
    markdown: 'export const name = "test";\n\n# {name}',
    isMdx: true,
  },
  {
    name: 'mdx-jsx',
    markdown: '<Box p={4}>Hello</Box>',
    isMdx: true,
  },
  {
    name: 'video-link',
    markdown: '[![Video](thumb.jpg)](video.mp4)',
    isMdx: false,
    expectedHtmlInvariants: ['<a', 'video.mp4'],
  },
  {
    name: 'youtube-link',
    markdown: '[![YouTube](thumb.jpg)](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    isMdx: false,
    expectedHtmlInvariants: ['youtube.com'],
  },
  {
    name: 'autolink',
    markdown: '<https://example.com>',
    isMdx: false,
    expectedHtmlInvariants: ['<a', 'https://example.com'],
  },
  {
    name: 'crlf-line-endings',
    markdown: 'Line one\r\n\r\nLine two\r\n',
    isMdx: false,
    expectedHtmlInvariants: ['Line one', 'Line two'],
  },
  {
    name: 'unicode-nfc',
    markdown: 'caf\u00E9',
    isMdx: false,
    expectedHtmlInvariants: ['caf\u00E9'],
  },
  {
    name: 'unicode-nfd',
    markdown: 'cafe\u0301',
    isMdx: false,
    expectedHtmlInvariants: ['cafe'],
  },
  {
    name: 'turkish-dotted-i',
    markdown: '\u0130stanbul',
    isMdx: false,
  },
  {
    name: 'german-sharp-s',
    markdown: 'Stra\u00DFe',
    isMdx: false,
  },
  {
    name: 'section-categories',
    markdown: '# Guide\n\n## API {data-category=reference}\n\nDetails.\n\n## Tutorial {data-category=learning}\n\nSteps.',
    isMdx: false,
  },
  {
    name: 'callout-note',
    markdown: '> [!NOTE]\n> This is a note callout.',
    isMdx: false,
    expectedHtmlInvariants: ['mdn-callout', 'mdn-callout--note', 'NOTE'],
    expectedTokens: [
      { type: 'blockquote', lines: ['[!NOTE]', 'This is a note callout.'] },
    ],
  },
  {
    name: 'callout-warning-with-body',
    markdown: '> [!WARNING]\n> Be careful.\n> Very careful.',
    isMdx: false,
    expectedHtmlInvariants: ['mdn-callout', 'mdn-callout--warning', 'WARNING'],
    expectedTokens: [
      { type: 'blockquote', lines: ['[!WARNING]', 'Be careful.', 'Very careful.'] },
    ],
  },
  {
    name: 'callout-tip-inline',
    markdown: '> [!TIP] Quick hint\n> Details here.',
    isMdx: false,
    expectedHtmlInvariants: ['mdn-callout', 'mdn-callout--tip', 'TIP'],
  },
  {
    name: 'callout-important',
    markdown: '> [!IMPORTANT]\n> Do not skip this.',
    isMdx: false,
    expectedHtmlInvariants: ['mdn-callout--important', 'IMPORTANT'],
  },
  {
    name: 'callout-caution',
    markdown: '> [!CAUTION]\n> Danger ahead.',
    isMdx: false,
    expectedHtmlInvariants: ['mdn-callout--caution', 'CAUTION'],
  },
  {
    name: 'nested-blockquote',
    markdown: '> Outer\n> > Inner\n> After',
    isMdx: false,
    expectedHtmlInvariants: ['blockquote'],
    expectedTokens: [
      { type: 'blockquote', lines: ['Outer', '> Inner', 'After'] },
    ],
  },
  {
    name: 'nested-blockquote-deep',
    markdown: '> Level 1\n> > Level 2\n> > > Level 3',
    isMdx: false,
    expectedHtmlInvariants: ['blockquote'],
  },
  {
    name: 'mixed-content',
    markdown: `# Getting Started

Welcome to the guide.

## Installation

1. Download the package
2. Run the installer

\`\`\`bash
npm install my-lib
\`\`\`

## Configuration

| Key | Default | Description |
| --- | ------- | ----------- |
| port | 3000 | Server port |
| host | localhost | Server host |

> This is a blockquote with **bold** text.

That is all.`,
    isMdx: false,
    expectedHtmlInvariants: [
      '<h1', 'Getting Started',
      '<h2', 'Installation',
      '<ol',
      '<pre',
      'npm install',
      '<table',
      '<blockquote',
      'bold',
    ],
    expectedTokens: [
      { type: 'heading', level: 1, text: 'Getting Started' },
      { type: 'heading', level: 2, text: 'Installation' },
      { type: 'list', ordered: true },
      { type: 'code', lang: 'bash' },
      { type: 'heading', level: 2, text: 'Configuration' },
      { type: 'table' },
      { type: 'blockquote' },
      { type: 'paragraph' },
    ],
  },
  {
    name: 'multi-section',
    markdown: `# API Reference

## Authentication

Use API keys.

## Endpoints

### Users

GET /users

### Posts

GET /posts

# Troubleshooting

Common issues here.`,
    isMdx: false,
    expectedHtmlInvariants: [
      'mdn-section--h1',
      'Authentication',
      'Endpoints',
      'Troubleshooting',
    ],
  },
];
