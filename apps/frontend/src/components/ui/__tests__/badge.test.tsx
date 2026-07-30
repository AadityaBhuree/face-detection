import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from '../badge';

describe('Badge', () => {
  // ─── Rendering ─────────────────────────────────────────────

  it('should render children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  // ─── Variants ──────────────────────────────────────────────

  it('should render default variant by default', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-primary');
  });

  it('should render secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText('Secondary');
    expect(badge.className).toContain('bg-secondary');
  });

  it('should render destructive variant', () => {
    render(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-destructive');
  });

  it('should render outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText('Outline');
    expect(badge.className).toContain('text-foreground');
  });

  it('should render success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('should render warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-amber-100');
  });

  it('should render error variant', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-red-100');
  });

  it('should render info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-ayutalk-100');
  });

  it('should render pending variant', () => {
    render(<Badge variant="pending">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-slate-100');
  });

  // ─── Sizes ─────────────────────────────────────────────────

  it('should render default size by default', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('text-xs');
  });

  it('should render sm size', () => {
    render(<Badge size="sm">Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge.className).toContain('text-[10px]');
  });

  it('should render lg size', () => {
    render(<Badge size="lg">Large</Badge>);
    const badge = screen.getByText('Large');
    expect(badge.className).toContain('text-sm');
  });

  // ─── className Merge ───────────────────────────────────────

  it('should merge custom className with variant classes', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('custom-class');
    expect(badge.className).toContain('bg-primary'); // default variant still applied
  });

  // ─── HTML Element ──────────────────────────────────────────

  it('should render as a div element', () => {
    render(<Badge>Element</Badge>);
    expect(screen.getByText('Element').tagName).toBe('DIV');
  });
});

describe('StatusBadge', () => {
  // ─── Status → Variant Mapping ──────────────────────────────

  it('should map "ready" to success variant', () => {
    render(<StatusBadge status="ready" />);
    const badge = screen.getByText('ready');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('should map "completed" to success variant', () => {
    render(<StatusBadge status="completed" />);
    const badge = screen.getByText('completed');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('should map "active" to info variant', () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText('active');
    expect(badge.className).toContain('bg-ayutalk-100');
  });

  it('should map "pending" to pending variant', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('pending');
    expect(badge.className).toContain('bg-slate-100');
  });

  it('should map "failed" to error variant', () => {
    render(<StatusBadge status="failed" />);
    const badge = screen.getByText('failed');
    expect(badge.className).toContain('bg-red-100');
  });

  it('should map "cancelled" to error variant', () => {
    render(<StatusBadge status="cancelled" />);
    const badge = screen.getByText('cancelled');
    expect(badge.className).toContain('bg-red-100');
  });

  it('should map "warning" to warning variant', () => {
    render(<StatusBadge status="warning" />);
    const badge = screen.getByText('warning');
    expect(badge.className).toContain('bg-amber-100');
  });

  it('should fallback to pending for unknown status', () => {
    render(<StatusBadge status="unknown_status" />);
    const badge = screen.getByText('unknown status');
    expect(badge.className).toContain('bg-slate-100');
  });

  // ─── Underscore Replacement ────────────────────────────────

  it('should replace underscores with spaces in the label', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });

  // ─── Icons ─────────────────────────────────────────────────

  it('should show checkmark for verified status', () => {
    render(<StatusBadge status="verified" />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
  });

  it('should show cross for error status', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByText('✕')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('should show no icon for pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  // ─── Case Insensitivity ────────────────────────────────────

  it('should handle mixed case status', () => {
    render(<StatusBadge status="Ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    const badge = screen.getByText('Ready');
    expect(badge.className).toContain('bg-emerald-100'); // mapped from lowercase "ready"
  });

  // ─── Capitalization ────────────────────────────────────────

  it('should apply capitalize class', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active').className).toContain('capitalize');
  });

  // ─── className Merge ───────────────────────────────────────

  it('should merge custom className', () => {
    render(<StatusBadge status="ready" className="my-class" />);
    const badge = screen.getByText('ready');
    expect(badge.className).toContain('my-class');
  });
});
