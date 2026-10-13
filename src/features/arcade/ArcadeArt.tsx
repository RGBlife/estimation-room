import type { ArcadeGame } from './catalogue.ts';

// Each game's cover: drawn from the game's own pieces, not pictured, on the
// surface the game is played on (set by the card's data-game in arcade.css).
export default function ArcadeArt({ game }: { game: ArcadeGame }) {
  switch (game) {
    case 'sorted':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          {[0, 1, 2, 3].map(level => <rect key={level} x="22" y={10 + level * 18} width="116" height="14" rx="4" fill={`var(--sp-level-${level})`} />)}
        </svg>
      );
    case 'rare':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          {[64, 50, 37, 22, 9].map((h, i) => <rect key={i} x={30 + i * 22} y={80 - h} width="14" height={h} rx="3" fill="currentColor" opacity={i === 4 ? 1 : 0.35} />)}
          <path d="M28 80h106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        </svg>
      );
    case 'reaction':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <rect x="26" y="20" width="44" height="50" rx="10" fill="var(--sp-react-wait)" opacity=".5" />
          <rect x="78" y="14" width="56" height="62" rx="12" fill="var(--sp-react-go)" />
          {[12, 20].map(r => <circle key={r} cx="106" cy="45" r={r} fill="none" stroke="#fff" strokeOpacity={r === 12 ? 0.8 : 0.4} strokeWidth="2" />)}
          <circle cx="106" cy="45" r="4" fill="#fff" />
        </svg>
      );
    case 'typing':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <text x="24" y="34" className="sp-art-code">{'const go = () =>'}</text>
          <path d="M131 23v14" stroke="var(--sp-accent)" strokeWidth="2.5" strokeLinecap="round" />
          {[0, 1, 2].map(row => Array.from({ length: 9 - row }, (_, k) => (
            <rect key={`${row}-${k}`} x={26 + row * 6 + k * 12.5} y={48 + row * 12} width="10" height="9" rx="2.5" fill="currentColor" opacity={row === 1 && k === 3 ? 0.9 : 0.25} />
          )))}
        </svg>
      );
    case 'maths':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <text x="80" y="54" textAnchor="middle" className="sp-art-sum">7 × 8 = ?</text>
          {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={35 + i * 10} cy="72" r="3" fill="currentColor" opacity={i < 6 ? 0.9 : 0.25} />)}
        </svg>
      );
    case 'pong':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <path d="M80 8v74" stroke="var(--sp-court-line)" strokeWidth="2" strokeDasharray="5 6" />
          <rect x="22" y="22" width="6" height="26" rx="3" fill="var(--sp-side-a)" />
          <rect x="132" y="44" width="6" height="26" rx="3" fill="var(--sp-side-b)" />
          {[0, 1, 2, 3].map(i => <circle key={i} cx={58 + i * 9} cy={58 - i * 6} r={2 + i * 0.6} fill="var(--sp-court-ball)" opacity={0.2 + i * 0.25} />)}
        </svg>
      );
    case 'cycles':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
          <path d="M20 70h46V30h30" stroke="var(--sp-side-a)" />
          <path d="M140 20h-30v44H88" stroke="var(--sp-side-b)" />
          <circle cx="96" cy="30" r="4" fill="#fff" stroke="none" />
          <circle cx="88" cy="64" r="4" fill="#fff" stroke="none" />
        </svg>
      );
    case 'ultimate':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M64 8c-1 25 1 50 0 74M96 8c1 25-1 50 1 74M38 33c28-2 56 1 84-1M38 58c28 2 56-1 84 1" strokeWidth="2.6" opacity=".4" />
          {[[51, 20], [80, 45], [109, 70], [80, 20], [51, 70]].map(([x, y], i) => (
            <g key={i} strokeWidth="1.2" opacity=".35">
              <path d={`M${x - 3} ${y - 9}v18M${x + 3} ${y - 9}v18M${x - 9} ${y - 3}h18M${x - 9} ${y + 3}h18`} />
            </g>
          ))}
          <path d="M44 13l14 14M58 13L44 27" strokeWidth="3.4" className="sp-art-x" />
          <path d="M73 38l14 14M87 38L73 52" strokeWidth="3.4" className="sp-art-x" />
          <circle cx="109" cy="45" r="8" strokeWidth="3.4" />
        </svg>
      );
    case 'connect':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <rect x="34" y="12" width="92" height="70" rx="8" fill="var(--sp-connect-frame)" />
          {Array.from({ length: 20 }, (_, i) => {
            const c = i % 5, r = Math.floor(i / 5);
            const counter = { 15: 'x', 16: 'o', 17: 'x', 11: 'x', 12: 'o', 7: 'x', 18: 'o', 13: 'o' }[i];
            return <circle key={i} cx={48 + c * 16} cy={26 + r * 16} r="6" fill={counter === 'x' ? 'var(--sp-counter-x)' : counter === 'o' ? 'var(--sp-counter-o)' : 'var(--sp-connect-hole)'} />;
          })}
        </svg>
      );
    case 'battleship':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true" fill="none">
          {[16, 30, 44].map(r => <circle key={r} cx="112" cy="45" r={r} stroke="var(--sp-sea-foam)" strokeOpacity=".35" />)}
          <rect x="34" y="40" width="62" height="12" rx="6" fill="var(--sp-sea-hull)" />
          <circle cx="112" cy="45" r="4" fill="var(--sp-sea-hit)" />
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <rect x="56" y="21" width="24" height="24" rx="3" fill="var(--sp-side-a)" opacity=".22" />
          <path d="M56 21h24v24H56zM80 45h24M104 21v24" stroke="var(--sp-side-a)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M32 45h24M80 21h24M32 69v-24M80 69h24" stroke="var(--sp-side-b)" strokeWidth="3" fill="none" strokeLinecap="round" />
          {Array.from({ length: 15 }, (_, i) => <circle key={i} cx={32 + (i % 5) * 24} cy={21 + Math.floor(i / 5) * 24} r="3.2" fill="currentColor" />)}
        </svg>
      );
    case 'words':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <path d="M44 31l24 26 24-26 24 26" stroke="var(--sp-react-go)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
          {['W', 'O', 'R', 'D'].map((letter, i) => (
            <g key={letter} transform={`translate(${30 + i * 24} ${i % 2 ? 43 : 17})`}>
              <rect width="28" height="28" rx="6" fill="var(--sp-tile)" stroke="var(--sp-tile-edge)" strokeWidth="1.5" />
              <text x="14" y="20" textAnchor="middle" className="sp-art-tile">{letter}</text>
            </g>
          ))}
        </svg>
      );
    case 'mancala':
      return (
        <svg viewBox="0 0 160 90" aria-hidden="true">
          <rect x="14" y="16" width="132" height="58" rx="29" fill="var(--sp-wood)" />
          <rect x="22" y="24" width="16" height="42" rx="8" fill="var(--sp-wood-pit)" />
          <rect x="122" y="24" width="16" height="42" rx="8" fill="var(--sp-wood-pit)" />
          {[0, 1, 2, 3].map(c => [0, 1].map(r => (
            <g key={`${c}${r}`}>
              <circle cx={56 + c * 16} cy={33 + r * 24} r="7" fill="var(--sp-wood-pit)" />
              {Array.from({ length: (c + r) % 3 + 1 }, (_, k) => <circle key={k} cx={54 + c * 16 + k * 2.5} cy={32 + r * 24 + (k % 2) * 2.5} r="2" fill={['#E7C86A', '#8FC4E8', '#E58C7A'][k]} />)}
            </g>
          )))}
        </svg>
      );
  }
}
