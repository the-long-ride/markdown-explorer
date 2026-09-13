interface PlainMarkdownEditorProps {
  value: string;
  disabled: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function PlainMarkdownEditor({
  value,
  disabled,
  ariaLabel = 'Markdown source',
  onChange,
  onSave,
}: PlainMarkdownEditorProps) {
  return (
    <textarea
      className="markdown-plain-editor"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      spellCheck={false}
      onChange={(event) => {
        if (!disabled) onChange(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (
          !disabled
          && (event.ctrlKey || event.metaKey)
          && event.key.toLowerCase() === 's'
        ) {
          event.preventDefault();
          onSave();
        }
      }}
    />
  );
}
