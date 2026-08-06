import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarBuilder from './AvatarBuilder.tsx';
import { randomAvatar } from './avatar.ts';

function baseProps() {
  return {
    avatar: randomAvatar(),
    onChange: vi.fn(),
    onExpandedChange: vi.fn(),
  };
}

function renderAvatarBuilder(overrides: Partial<ReturnType<typeof baseProps>> = {}) {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<AvatarBuilder {...props} />), props };
}

describe('AvatarBuilder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('calls onChange with a new avatar when the shuffle button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderAvatarBuilder();
    await user.click(screen.getByTitle('Randomise'));
    expect(props.onChange).toHaveBeenCalledOnce();
    expect(props.onChange.mock.calls[0][0]).toHaveProperty('seed');
  });

  it('expands the customize panel and calls onExpandedChange', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    renderAvatarBuilder({ onExpandedChange });

    expect(screen.getByText('Customise ▾')).toBeInTheDocument();
    await user.click(screen.getByText('Customise ▾'));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Collapse ▲')).toBeInTheDocument();
  });

  it('shows Hair as the default category and switches category on rail click', async () => {
    const user = userEvent.setup();
    renderAvatarBuilder();
    await user.click(screen.getByText('Customise ▾'));

    expect(screen.getByText(/^Hair ·/)).toBeInTheDocument();
    await user.click(screen.getByText('Hair Color'));
    expect(screen.getByText(/^Hair Color ·/)).toBeInTheDocument();
  });

  it('opens the Pro upsell modal when selecting the gated Extras category, and unlocks it on subscribe', async () => {
    const user = userEvent.setup();
    renderAvatarBuilder();
    await user.click(screen.getByText('Customise ▾'));

    await user.click(screen.getByText('Extras'));
    expect(screen.getByText('Unlock Estimation Room Pro')).toBeInTheDocument();

    await user.click(screen.getByText('Subscribe Now'));
    expect(screen.queryByText('Unlock Estimation Room Pro')).not.toBeInTheDocument();
    expect(screen.getByText(/^Extras ·/)).toBeInTheDocument();
  });

  it('calls onChange with a background index when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderAvatarBuilder({ avatar: { ...randomAvatar(), bgIdx: 0 } });
    // Background swatches are unlabeled buttons in the preview header; the
    // second one (index 1) differs from the current bgIdx: 0.
    const swatchButtons = document.querySelectorAll('button[style*="background"]');
    expect(swatchButtons.length).toBeGreaterThan(1);
    await user.click(swatchButtons[1] as HTMLElement);
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ bgIdx: 1 }));
  });
});
