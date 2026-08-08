import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from './Toast.tsx';

describe('Toast', () => {
  it('renders nothing when not rendered', () => {
    render(<Toast message="Hello" rendered={false} closing={false} />);
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('renders nothing when message is null', () => {
    render(<Toast message={null} rendered={true} closing={false} />);
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('shows the message when rendered', () => {
    render(<Toast message="Deck switched to T-shirt" rendered={true} closing={false} />);
    expect(screen.getByText('Deck switched to T-shirt')).toBeInTheDocument();
  });
});
