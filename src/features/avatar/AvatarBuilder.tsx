import { useState } from 'react';
import { AVATAR_CATEGORIES, avatarDataUri, randomAvatar, type LooseAvatar } from './avatar.ts';
import { useViewportBreakpoint } from './useViewportBreakpoint.ts';
import { useProAccess } from './useProAccess.ts';
import ProUpsellModal from './ProUpsellModal.tsx';
import AvatarPreviewHeader from './AvatarPreviewHeader.tsx';
import AvatarCategoryPicker from './AvatarCategoryPicker.tsx';
import type { AvatarOptions } from '../../types/room.ts';

interface AvatarBuilderProps {
  avatar: AvatarOptions;
  onChange: (avatar: AvatarOptions) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function AvatarBuilder({ avatar, onChange, onExpandedChange }: AvatarBuilderProps) {
  const [expanded, setExpandedState] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [page, setPage] = useState(0);
  const { pro, showProModal, requestProGate, closeProModal, subscribe } = useProAccess();
  const breakpoint = useViewportBreakpoint();

  const setExpanded = (value: boolean) => {
    setExpandedState(value);
    onExpandedChange?.(value);
  };

  // Category keys are computed at runtime (category.key / `${key}On`), so
  // AvatarOptions' explicit interface can't index them -- loosely typed here
  // on purpose via avatar.ts's LooseAvatar.
  const avatarLoose = avatar as LooseAvatar;

  const avatarUrl = avatarDataUri(avatarLoose);
  const category = AVATAR_CATEGORIES[activeIdx];
  const pageSize = breakpoint.columns * breakpoint.rows;

  const shuffle = () => onChange(randomAvatar());

  const selectBg = (i: number) => onChange({ ...avatar, bgIdx: i });

  const selectCategory = (i: number) => {
    if (AVATAR_CATEGORIES[i].pro && !requestProGate()) return;
    setActiveIdx(i);
    setPage(0);
  };

  const selectValue = (valueIdx: number) => {
    const next: LooseAvatar = { ...avatarLoose, [category.key]: valueIdx };
    if (category.optional) next[`${category.key}On`] = true;
    onChange(next as unknown as AvatarOptions);
  };

  const toggleOptional = () => {
    const next: LooseAvatar = { ...avatarLoose, [`${category.key}On`]: !avatarLoose[`${category.key}On`] };
    onChange(next as unknown as AvatarOptions);
  };

  const subscribeToPro = () => {
    subscribe(() => {
      setActiveIdx(AVATAR_CATEGORIES.length - 1);
      setPage(0);
    });
  };

  const pageCount = Math.ceil(category.values.length / pageSize);
  const pageStart = page * pageSize;
  const pageValues = category.values.slice(pageStart, pageStart + pageSize);
  const selectedValueIdx = (avatarLoose[category.key] as number) ?? 0;
  const isOn = !category.optional || !!avatarLoose[`${category.key}On`];

  return (
    <div className="mb-6 flex w-full flex-col items-center gap-3.5">
      {showProModal && (
        <ProUpsellModal onSubscribe={subscribeToPro} onClose={closeProModal} />
      )}

      <AvatarPreviewHeader avatarUrl={avatarUrl} bgIdx={avatar.bgIdx} onShuffle={shuffle} onSelectBg={selectBg} />

      <button
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer border-none bg-transparent p-0 font-sp-font text-xs text-sp-accent-text underline"
      >
        {expanded ? 'Collapse ▲' : 'Customise ▾'}
      </button>

      <div
        className={`sp-collapse w-full self-stretch${expanded ? ' sp-collapse-open' : ''}`}
      >
        <div>
          <AvatarCategoryPicker
            avatar={avatarLoose}
            breakpoint={breakpoint}
            pro={pro}
            activeIdx={activeIdx}
            onSelectCategory={selectCategory}
            category={category}
            page={page}
            onPrevPage={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
            onNextPage={() => setPage((p) => (p + 1) % pageCount)}
            pageCount={pageCount}
            pageValues={pageValues}
            pageStart={pageStart}
            selectedValueIdx={selectedValueIdx}
            onSelectValue={selectValue}
            isOn={isOn}
            onToggleOptional={toggleOptional}
          />
        </div>
      </div>
    </div>
  );
}
