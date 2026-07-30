import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Smoke Test — Test Setup', () => {
  it('should render a Button component', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should have jsdom environment', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
    expect(typeof window.document.createElement).toBe('function');
  });

  it('should have Next.js router mocked', async () => {
    // The mock is set up globally in setup.ts — just verify it works
    const { useRouter } = await import('next/navigation');
    const router = useRouter();
    expect(router.push).toBeDefined();
    expect(typeof router.push).toBe('function');
  });
});
