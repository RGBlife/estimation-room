import { avatarPreviewUri, type AvatarCategory, type LooseAvatar } from './avatar.ts';

interface OptionTileProps {
  avatar: LooseAvatar;
  category: AvatarCategory;
  valueIdx: number;
  value: string;
  selected: boolean;
  onSelect: () => void;
}

export default function OptionTile({ avatar, category, valueIdx, value, selected, onSelect }: OptionTileProps) {
  const swatchColor = category.swatch ? '#' + value : null;
  const previewUrl = category.swatch
    ? null
    : avatarPreviewUri(avatar, category.key, valueIdx, category.optional);
  return (
    <button
      onClick={onSelect}
      title={value}
      className={`flex h-[72px] w-[72px] flex-none cursor-pointer items-center justify-center overflow-hidden rounded-[10px] ${swatchColor ? 'p-0' : 'p-[3px]'} ${swatchColor ? '' : 'bg-sp-panel-2'} ${selected ? 'border-2 border-sp-accent shadow-[0_0_0_2px_var(--sp-accent-panel-3)]' : 'border border-sp-border'}`}
      style={swatchColor ? { background: swatchColor } : undefined}
    >
      {previewUrl && <img src={previewUrl} alt={value} className="block h-full w-full rounded-md" />}
    </button>
  );
}
