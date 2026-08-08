import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomVoteInput from './CustomVoteInput.tsx';

describe('CustomVoteInput', () => {
  it('shows an editable input when no vote has been cast yet', () => {
    render(<CustomVoteInput myVote={null} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/^enter/i)).toBeInTheDocument();
  });

  it('submits the trimmed value on Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CustomVoteInput myVote={null} onSubmit={onSubmit} />);
    await user.type(screen.getByPlaceholderText(/^enter/i), '  a sprint  {Enter}');
    expect(onSubmit).toHaveBeenCalledWith('a sprint');
  });

  it('submits on clicking Submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CustomVoteInput myVote={null} onSubmit={onSubmit} />);
    await user.type(screen.getByPlaceholderText(/^enter/i), 'depends on API');
    await user.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledWith('depends on API');
  });

  it('does not submit an empty/whitespace-only value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CustomVoteInput myVote={null} onSubmit={onSubmit} />);
    await user.type(screen.getByPlaceholderText(/^enter/i), '   {Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks the field (read-only display, no editable input) once a vote is set', () => {
    render(<CustomVoteInput myVote="2 weeks" onSubmit={vi.fn()} />);
    expect(screen.getByText('2 weeks')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^enter/i)).not.toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
  });

  it('clicking Change reopens an editable input seeded with the current vote', async () => {
    const user = userEvent.setup();
    render(<CustomVoteInput myVote="2 weeks" onSubmit={vi.fn()} />);
    await user.click(screen.getByText('Change'));
    expect(screen.getByPlaceholderText(/^enter/i)).toHaveValue('2 weeks');
  });

  it('submitting a changed value re-locks with the new value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CustomVoteInput myVote="2 weeks" onSubmit={onSubmit} />);
    await user.click(screen.getByText('Change'));
    const input = screen.getByPlaceholderText(/^enter/i);
    await user.clear(input);
    await user.type(input, 'a month{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('a month');
  });
});
