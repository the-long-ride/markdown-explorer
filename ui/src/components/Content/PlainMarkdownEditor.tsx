interface PlainMarkdownEditorProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function PlainMarkdownEditor({
  value,
  disabled,
  onChange,
  onSave,
}: PlainMarkdownEditorProps) {
  return (
    <textarea
      className="markdown-plain-editor"
      aria-label="Markdown source"
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
