import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarkModeToggle } from '../dark-mode-toggle';
import { ThemeProvider } from '../theme-provider';

// Mock icons as text spans so we can assert the check indicator reliably
// (lucide-react renders <svg><path/></svg> with no text content).
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Sun: () => <span>☀</span>,
    Moon: () => <span>☾</span>,
    Monitor: () => <span>⌁</span>,
    Check: () => <span>✓</span>,
  };
});

// Deterministic system preference: default jsdom is light, so 'system' resolves to light
function renderToggle() {
  return render(
    <ThemeProvider>
      <DarkModeToggle />
    </ThemeProvider>,
  );
}

// Radix opens the menu asynchronously (portal + effects) — render the component,
// open it with userEvent, and wait until the content is actually mounted.
async function openMenu() {
  const user = userEvent.setup();
  renderToggle();
  const trigger = screen.getByRole('button', { name: /toggle theme/i });
  await user.click(trigger);
  await screen.findByRole('menu');
  return { user, trigger };
}

describe('DarkModeToggle — accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders a trigger with menu button semantics', () => {
    renderToggle();
    const trigger = screen.getByRole('button', { name: /toggle theme/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the menu on click and announces expansion', async () => {
    const { trigger } = await openMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('marks the current theme with a check indicator', async () => {
    await openMenu();
    // 'system' is the default theme
    expect(screen.getByRole('menuitem', { name: /system/i })).toHaveTextContent('✓');
    expect(screen.getByRole('menuitem', { name: /light/i })).not.toHaveTextContent('✓');
    expect(screen.getByRole('menuitem', { name: /dark/i })).not.toHaveTextContent('✓');
  });

  it('calls setTheme and closes when a theme is selected', async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /dark/i }));
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(localStorage.getItem('ayutalk-theme')).toBe('dark');
  });
});

describe('DarkModeToggle — keyboard navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('opens with Enter and focuses the first item', async () => {
    const user = userEvent.setup();
    renderToggle();
    const trigger = screen.getByRole('button', { name: /toggle theme/i });
    trigger.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /light/i })).toHaveFocus();
    });
  });

  it('supports arrow key navigation through the menu', async () => {
    const { user } = await openMenu();
    // Seed roving focus on the first item (jsdom doesn't move DOM focus on open)
    screen.getByRole('menuitem', { name: /light/i }).focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /dark/i })).toHaveAttribute('data-highlighted', '');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /system/i })).toHaveAttribute('data-highlighted', '');

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: /dark/i })).toHaveAttribute('data-highlighted', '');
  });

  it('wraps navigation at the ends', async () => {
    await openMenu();
    const menu = screen.getByRole('menu');

    // ArrowUp on the first item wraps to the last
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitem', { name: /system/i })).toHaveAttribute('data-highlighted', '');

    // ArrowDown on the last item wraps to the first
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: /light/i })).toHaveAttribute('data-highlighted', '');
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    const { user, trigger } = await openMenu();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(trigger).toHaveFocus();
  });

  it('selects a theme with Enter on a focused item', async () => {
    const { user } = await openMenu();
    // Move focus to Dark, then confirm with Enter
    const darkItem = screen.getByRole('menuitem', { name: /dark/i });
    darkItem.focus();
    fireEvent.keyDown(darkItem, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(localStorage.getItem('ayutalk-theme')).toBe('dark');
  });
});

describe('DarkModeToggle — behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('closes the menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <div>
          <button>Outside</button>
        </div>
        <DarkModeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: /toggle theme/i }));
    await screen.findByRole('menu');

    // Radix sets pointer-events:none + aria-hidden on sibling containers while the
    // menu is open, so user-event can't click them — dispatch the outside pointer
    // event directly on the document (outside the portal content) to trigger dismissal.
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('selects the theme and closes when clicking a menu item', async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /light/i }));
    expect(localStorage.getItem('ayutalk-theme')).toBe('light');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('keeps the menu open when mousing down on the trigger itself', async () => {
    const { user, trigger } = await openMenu();
    // Mousedown on the trigger is inside the component — the menu stays open
    fireEvent.mouseDown(trigger);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('applies the dark class to the document root when Dark is selected', async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /dark/i }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('removes the dark class when Light is selected', async () => {
    const { user } = await openMenu();
    // Switch to dark first
    await user.click(screen.getByRole('menuitem', { name: /dark/i }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Now back to light
    const user2 = userEvent.setup();
    await user2.click(screen.getByRole('button', { name: /toggle theme/i }));
    await screen.findByRole('menu');
    await user2.click(screen.getByRole('menuitem', { name: /light/i }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('persists the chosen theme to localStorage', async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /light/i }));
    await waitFor(() => {
      expect(localStorage.getItem('ayutalk-theme')).toBe('light');
    });
  });
});
