import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  BriefCard,
} from '../card';

describe('Card', () => {
  it('should render children', () => {
    render(
      <Card>
        <p>Content</p>
      </Card>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should apply default card classes', () => {
    render(<Card>Card</Card>);
    const card = screen.getByText('Card');
    expect(card.className).toContain('rounded-xl');
    expect(card.className).toContain('border-slate-200');
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('shadow-sm');
  });

  it('should merge custom className', () => {
    render(<Card className="custom-class">Card</Card>);
    expect(screen.getByText('Card').className).toContain('custom-class');
  });

  it('should forward ref as div', () => {
    render(<Card>Card</Card>);
    expect(screen.getByText('Card').tagName).toBe('DIV');
  });
});

describe('CardHeader', () => {
  it('should render children', () => {
    render(
      <CardHeader>
        <h2>Header</h2>
      </CardHeader>,
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('should apply flex column layout', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header').className).toContain('flex');
    expect(screen.getByText('Header').className).toContain('flex-col');
  });
});

describe('CardTitle', () => {
  it('should render children', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('should render as h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title').tagName).toBe('H3');
  });

  it('should apply title typography classes', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title').className).toContain('font-semibold');
    expect(screen.getByText('Title').className).toContain('text-slate-900');
  });
});

describe('CardDescription', () => {
  it('should render children', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should render as p element', () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText('Desc').tagName).toBe('P');
  });

  it('should apply muted text classes', () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText('Desc').className).toContain('text-slate-500');
  });
});

describe('CardContent', () => {
  it('should render children', () => {
    render(
      <CardContent>
        <span>Content</span>
      </CardContent>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('should render children', () => {
    render(
      <CardFooter>
        <button>Action</button>
      </CardFooter>,
    );
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('should apply border-top class', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer').className).toContain('border-t');
  });
});

describe('BriefCard (card variant)', () => {
  it('should render children with default variant', () => {
    render(<BriefCard>Content</BriefCard>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should apply default variant classes', () => {
    render(<BriefCard>Default</BriefCard>);
    const el = screen.getByText('Default');
    expect(el.className).toContain('rounded-xl');
    expect(el.className).toContain('border-slate-200');
    expect(el.className).toContain('bg-white');
  });

  it('should apply compact variant classes', () => {
    render(<BriefCard variant="compact">Compact</BriefCard>);
    const el = screen.getByText('Compact');
    expect(el.className).toContain('p-3');
  });

  it('should apply highlight variant classes', () => {
    render(<BriefCard variant="highlight">Highlight</BriefCard>);
    const el = screen.getByText('Highlight');
    expect(el.className).toContain('border-jeevandata-200');
    expect(el.className).toContain('bg-jeevandata-50');
  });

  it('should merge custom className', () => {
    render(<BriefCard className="custom-card">Custom</BriefCard>);
    expect(screen.getByText('Custom').className).toContain('custom-card');
  });
});
