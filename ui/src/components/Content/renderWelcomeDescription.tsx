export function renderWelcomeDescription(text: string) {
  const parts = text.split(/(\[[^\]]+\])/);
  return parts.map((part, idx) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const key = part.slice(1, -1);
      return <kbd key={idx}>{key}</kbd>;
    }
    return part;
  });
}
