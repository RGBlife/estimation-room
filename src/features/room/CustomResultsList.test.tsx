import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomResultsList from './CustomResultsList.tsx';
import type { CustomVoteGroup } from './stats.ts';

describe('CustomResultsList', () => {
  it('renders each group with its display text and count', () => {
    const groups: CustomVoteGroup[] = [
      { key: '2 weeks', display: '2 weeks', count: 3, isTop: true },
      { key: 'a sprint', display: 'about a sprint', count: 1, isTop: false },
    ];
    render(<CustomResultsList groups={groups} onStartNextRound={vi.fn()} />);
    expect(screen.getByText('“2 weeks”')).toBeInTheDocument();
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.getByText('“about a sprint”')).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  it('shows a Start next round button that calls onStartNextRound', async () => {
    const user = userEvent.setup();
    const onStartNextRound = vi.fn();
    render(<CustomResultsList groups={[]} onStartNextRound={onStartNextRound} />);
    await user.click(screen.getByText('Start next round'));
    expect(onStartNextRound).toHaveBeenCalledOnce();
  });
});
