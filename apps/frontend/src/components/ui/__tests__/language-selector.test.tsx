import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSelector } from '../language-selector';

const defaultProps = {
  currentLocale: 'en' as const,
  onLocaleChange: vi.fn(),
};

describe('LanguageSelector — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a trigger with menu button semantics', () => {
    render(<LanguageSelector {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the menu on click and announces expansion', () => {
    render(<LanguageSelector {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('marks the current locale with aria-checked', () => {
    render(<LanguageSelector {...defaultProps} currentLocale="hi" />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    expect(screen.getByRole('menuitemradio', { name: /हिन्दी/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: /english/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls onLocaleChange and closes when a language is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    await user.click(screen.getByRole('menuitemradio', { name: /हिन्दी/i }));
    expect(defaultProps.onLocaleChange).toHaveBeenCalledWith('hi');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens with ArrowDown and focuses the first item', async () => {
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /select language/i }), {
      key: 'ArrowDown',
    });
    await waitFor(() => {
      expect(screen.getByRole('menuitemradio', { name: /english/i })).toHaveFocus();
    });
  });

  it('supports arrow key navigation through the menu', () => {
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: /हिन्दी/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: /मराठी/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitemradio', { name: /हिन्दी/i })).toHaveFocus();
  });

  it('wraps navigation at the ends with Home and End', () => {
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitemradio', { name: /español/i })).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(screen.getByRole('menuitemradio', { name: /english/i })).toHaveFocus();
  });

  it('closes with Escape and returns focus to the trigger', () => {
    render(<LanguageSelector {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('selects a language with Enter on a focused item', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    const menu = screen.getByRole('menu');
    // Move to the last item (Español) with End, then confirm with Enter
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitemradio', { name: /español/i })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(defaultProps.onLocaleChange).toHaveBeenCalledWith('es');
  });
});

describe('LanguageSelector — behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Click-outside behavior ───────────────────────────────────

  it('closes the menu when clicking outside', () => {
    render(
      <div>
        <button>Outside</button>
        <LanguageSelector {...defaultProps} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.mouseDown(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the menu open when clicking inside it', () => {
    render(<LanguageSelector {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));

    fireEvent.mouseDown(screen.getByRole('menuitemradio', { name: /english/i }));
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('keeps the menu open when mousing down on the trigger itself', () => {
    render(<LanguageSelector {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(trigger);
    fireEvent.mouseDown(trigger);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  // ─── Compact vs full mode ─────────────────────────────────────

  it('renders the full trigger with flag and native language name', () => {
    render(<LanguageSelector {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    expect(trigger).toHaveTextContent('🇬🇧');
    expect(trigger).toHaveTextContent('English');
  });

  it('renders the compact trigger with flag but no native name', () => {
    render(<LanguageSelector {...defaultProps} compact />);
    const trigger = screen.getByRole('button', { name: /select language/i });
    expect(trigger).toHaveTextContent('🇬🇧');
    expect(trigger).not.toHaveTextContent('English');
  });

  it('hides the English label sub-text in compact menu items', () => {
    render(<LanguageSelector {...defaultProps} compact />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    const hindiItem = screen.getByRole('menuitemradio', { name: /हिन्दी/i });
    expect(hindiItem).not.toHaveTextContent('Hindi');
  });

  // ─── Locale-change callback in compact mode ───────────────────

  it('calls onLocaleChange when selecting in compact mode', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector {...defaultProps} compact />);
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    await user.click(screen.getByRole('menuitemradio', { name: /मराठी/i }));
    expect(defaultProps.onLocaleChange).toHaveBeenCalledWith('mr');
  });
});
