import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomVoteInput from './CustomVoteInput.tsx';

describe('CustomVoteInput', () => {
  it('seeds the input from myVote', () => {
    render(<CustomVoteInput myVote="2 weeks" onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/^enter/i)).toHaveValue('2 weeks');
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
});
