import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckSwitcher from './DeckSwitcher.tsx';

describe('DeckSwitcher', () => {
  it('shows the current deck name on the pill', () => {
    render(<DeckSwitcher currentDeckId="fibonacci" onSwitch={vi.fn()} />);
    expect(screen.getByText('Fibonacci')).toBeInTheDocument();
  });

  it('opens a dropdown listing the other decks, excluding the current one', async () => {
    const user = userEvent.setup();
    render(<DeckSwitcher currentDeckId="fibonacci" onSwitch={vi.fn()} />);
    await user.click(screen.getByText('Fibonacci'));
    expect(screen.getByText('T-shirt')).toBeInTheDocument();
    expect(screen.getByText('ROM')).toBeInTheDocument();
    // Custom is deliberately excluded from the dropdown -- see DECK_ORDER in decks.ts.
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    // "Fibonacci" appears only once (on the pill), not again in the dropdown.
    expect(screen.getAllByText('Fibonacci')).toHaveLength(1);
  });

  it('calls onSwitch with the picked deck id and closes the dropdown', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(<DeckSwitcher currentDeckId="fibonacci" onSwitch={onSwitch} />);
    await user.click(screen.getByText('Fibonacci'));
    await user.click(screen.getByText('T-shirt'));
    expect(onSwitch).toHaveBeenCalledWith('tshirt');
    expect(screen.queryByText('ROM')).not.toBeInTheDocument();
  });

  it('closes the dropdown on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DeckSwitcher currentDeckId="fibonacci" onSwitch={vi.fn()} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    await user.click(screen.getByText('Fibonacci'));
    expect(screen.getByText('T-shirt')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('T-shirt')).not.toBeInTheDocument();
  });
});
