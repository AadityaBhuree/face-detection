import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

function TrapHarness({ active }: { active: boolean }) {
  const trapRef = useFocusTrap<HTMLDivElement>(active);
  return (
    <div>
      <button>Before</button>
      <div ref={trapRef}>
        <button>First</button>
        <button>Second</button>
      </div>
      <button>After</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element when activated', () => {
    render(<TrapHarness active />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps focus forward from the last element back to the first on Tab', () => {
    render(<TrapHarness active />);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    // jsdom has no native Tab navigation, so we test the trap's own
    // boundary logic: Tab on the last focusable must wrap to the first.
    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('wraps focus backward from the first element to the last on Shift+Tab', () => {
    render(<TrapHarness active />);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    // Shift+Tab on the first focusable must wrap to the last.
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(second).toHaveFocus();
  });

  it('never lets focus escape to elements outside the trap', () => {
    render(<TrapHarness active />);
    const first = screen.getByRole('button', { name: 'First' });

    // Focus lands outside (simulating a focus bug) — next Tab must snap back inside
    screen.getByRole('button', { name: 'After' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    // Shift+Tab from outside wraps backward, landing on the last element
    screen.getByRole('button', { name: 'Before' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
  });

  it('restores focus to the previously focused element on deactivate', () => {
    const { rerender } = render(<TrapHarness active={false} />);

    const before = screen.getByRole('button', { name: 'Before' });
    before.focus();

    rerender(<TrapHarness active />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    rerender(<TrapHarness active={false} />);
    expect(before).toHaveFocus();
  });

  it('does not trap focus when inactive', () => {
    render(<TrapHarness active={false} />);
    const after = screen.getByRole('button', { name: 'After' });
    after.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(after).toHaveFocus();
  });
});
