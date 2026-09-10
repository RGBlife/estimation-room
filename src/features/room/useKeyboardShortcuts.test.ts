import { renderHook, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';

function setup(overrides = {}) {
  const args = {
    isRevealed: false, allVoted: true, anyVote: true, isObserver: false,
    deckValues: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
    onReveal: vi.fn(), onStartNextRound: vi.fn(), onCastVote: vi.fn(), ...overrides,
  };
  const hook = renderHook(() => useKeyboardShortcuts(args));
  return { ...args, ...hook };
}

describe('room keyboard shortcuts', () => {
  it('preserves voting by card position and round progression', () => {
    const actions = setup();
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(actions.onCastVote.mock.calls).toEqual([['0'], ['☕']]);
    expect(actions.onReveal).toHaveBeenCalledOnce();
    actions.unmount();
    const revealed = setup({ isRevealed: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(revealed.onStartNextRound).toHaveBeenCalledOnce();
  });

  it.each(['input', 'textarea', 'select', 'button', 'a', 'summary', 'editable', 'dialog'])('respects focused %s controls and their children', (kind) => {
    const actions = setup();
    const element = document.createElement(['editable', 'dialog'].includes(kind) ? 'div' : kind);
    if (kind === 'a') element.setAttribute('href', '#');
    if (kind === 'editable') element.setAttribute('contenteditable', 'true');
    if (kind === 'dialog') element.setAttribute('role', 'dialog');
    document.body.append(element);
    const target = ['editable', 'dialog', 'button'].includes(kind) ? element.appendChild(document.createElement('span')) : element;
    fireEvent.keyDown(target, { key: 'Enter' });
    fireEvent.keyDown(target, { key: '1' });
    expect(actions.onReveal).not.toHaveBeenCalled();
    expect(actions.onCastVote).not.toHaveBeenCalled();
    element.remove();
  });

  it.each(['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat', 'isComposing'])('ignores %s events', (flag) => {
    const actions = setup();
    fireEvent.keyDown(window, { key: '1', [flag]: true });
    fireEvent.keyDown(window, { key: 'Enter', [flag]: true });
    expect(actions.onCastVote).not.toHaveBeenCalled();
    expect(actions.onReveal).not.toHaveBeenCalled();
  });

  it('respects prevented events and removes the listener on unmount', () => {
    const actions = setup();
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    actions.unmount();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(actions.onReveal).not.toHaveBeenCalled();
  });
});

it('supports early reveal from the keyboard after the first vote', () => {
  const actions = setup({ allVoted: false, anyVote: true });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(actions.onReveal).toHaveBeenCalledOnce();
});

it('allows a missing vote after reveal without Enter accidentally starting a new round', () => {
  const actions = setup({ isRevealed: true, canVoteAfterReveal: true });
  fireEvent.keyDown(window, { key: '6' });
  expect(actions.onCastVote).toHaveBeenCalledWith('8');
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(actions.onStartNextRound).not.toHaveBeenCalled();
});
