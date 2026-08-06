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
      style={{
        width: 72, height: 72, flex: 'none', borderRadius: 10, cursor: 'pointer', padding: swatchColor ? 0 : 3,
        background: swatchColor ?? 'var(--sp-panel-2)',
        border: selected ? '2px solid var(--sp-accent)' : '1px solid var(--sp-border)',
        boxShadow: selected ? '0 0 0 2px var(--sp-accent-panel-3)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {previewUrl && <img src={previewUrl} alt={value} style={{ width: '100%', height: '100%', borderRadius: 6, display: 'block' }} />}
    </button>
  );
}
