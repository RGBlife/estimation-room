import { AVATAR_BG } from './avatar.ts';

interface AvatarPreviewHeaderProps {
  avatarUrl: string;
  bgIdx: number;
  onShuffle: () => void;
  onSelectBg: (i: number) => void;
}

export default function AvatarPreviewHeader({ avatarUrl, bgIdx, onShuffle, onSelectBg }: AvatarPreviewHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-[104px] w-[104px] flex-none overflow-hidden rounded-full border border-sp-card-idle-border bg-sp-bg">
          <img src={avatarUrl} alt="avatar preview" className="block h-full w-full" />
        </div>
        <button
          onClick={onShuffle}
          title="Randomise"
          className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-lg border border-sp-border bg-sp-panel-2 text-sp-text-dim"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>

      <div>
        <div className="mb-1.5 text-center text-[10px] font-bold tracking-[0.05em] text-sp-text-faintest uppercase">Background</div>
        <div className="flex flex-wrap justify-center gap-[7px]">
          {AVATAR_BG.map((hex, i) => (
            <button
              key={hex}
              onClick={() => onSelectBg(i)}
              className="relative h-6 w-6 cursor-pointer rounded-full border-2 border-transparent p-0"
              style={{ background: '#' + hex }}
            >
              {bgIdx === i && (
                <div className="absolute -inset-1 rounded-full border-[1.5px] border-sp-accent" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
