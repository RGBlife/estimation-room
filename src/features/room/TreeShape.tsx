// Small hand-drawn tree, grown as a post-impact effect (see weapons.js
// `afterEffect`) after Bob Ross lands — a nod to "happy little trees".
export default function TreeShape() {
  return (
    <svg width="34" height="40" viewBox="0 0 34 40" style={{ display: 'block', overflow: 'visible' }}>
      <rect x="14.5" y="24" width="5" height="16" rx="1.5" fill="#8a5a34" />
      <ellipse cx="17" cy="20" rx="8" ry="9" fill="#4a9d5f" />
      <ellipse cx="10" cy="16" rx="6.5" ry="7" fill="#5cb372" />
      <ellipse cx="24" cy="17" rx="6" ry="6.5" fill="#3f8a52" />
      <ellipse cx="17" cy="9" rx="6.5" ry="7" fill="#5cb372" />
    </svg>
  );
}
