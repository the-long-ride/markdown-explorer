import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserManualTab, buildAiHelpPrompt } from '../../../../ui/src/components/Content/UserManualTab';

describe('User Manual AI prompt', () => {
  const supportedLanguages = ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru'] as const;

  it('provides localized AI help prompt templates for all 9 supported languages', () => {
    for (const lang of supportedLanguages) {
      const prompt = buildAiHelpPrompt('1.7.0', lang);
      expect(prompt).toContain('Markdown Explorer v1.7.0');
      expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/website/llm.txt');
      expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md');
      expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer');
      expect(prompt.trim().length).toBeGreaterThan(100);
      if (lang !== 'en') {
        expect(prompt).not.toEqual(buildAiHelpPrompt('1.7.0', 'en'));
      }
    }
  });

  it('copies the versioned guidance prompt and reports success in English', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<UserManualTab language="en" settings={{ keybindings: {} } as any} version="1.7.0" />);

    expect(screen.getByRole('heading', { name: /ask an ai about markdown explorer/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const prompt = writeText.mock.calls[0][0] as string;
    expect(prompt).toContain('Markdown Explorer v1.7.0');
    expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/website/llm.txt');
    expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md');
    expect(prompt).toContain('https://github.com/the-long-ride/markdown-explorer');
    expect(prompt).toMatch(/platform|version/i);
    expect(screen.getByRole('button', { name: /prompt copied/i })).toBeInTheDocument();
  });

  it('renders localized prompt and copy button in Vietnamese', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<UserManualTab language="vi" settings={{ keybindings: {} } as any} version="1.7.0" />);

    expect(screen.getByRole('heading', { name: /hỏi ai về markdown explorer/i })).toBeInTheDocument();
    const copyBtn = screen.getByRole('button', { name: /sao chép lời nhắc/i });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const prompt = writeText.mock.calls[0][0] as string;
    expect(prompt).toContain('Tôi đang sử dụng Markdown Explorer v1.7.0');
    expect(screen.getByRole('button', { name: /đã sao chép lời nhắc/i })).toBeInTheDocument();
  });
});
