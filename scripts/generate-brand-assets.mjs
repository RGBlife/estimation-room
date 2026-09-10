import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Original vector artwork, rasterised for preview crawlers and older browsers.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#315CBC"/>
<rect x="12" y="14" width="29" height="38" rx="4" transform="rotate(-14 26 33)" fill="#FFFFFF"/>
<rect x="25" y="12" width="28" height="39" rx="4" transform="rotate(9 39 31)" fill="#F4D579" stroke="#213754" stroke-width="2"/>
<path d="m33 32 5 5 9-12" fill="none" stroke="#213754" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const card = (x, y, angle, value, selected = false) => `<g transform="translate(${x} ${y}) rotate(${angle} 90 126)">
<rect y="8" width="180" height="252" rx="16" fill="#213754" opacity=".12"/>
<rect width="180" height="252" rx="16" fill="${selected ? '#F4D579' : '#FFFFFF'}" stroke="${selected ? '#315CBC' : '#B7C5D9'}" stroke-width="3"/>
<text x="20" y="37" font-size="22">${value}</text><text x="90" y="153" text-anchor="middle" font-size="92" font-weight="700">${value}</text>
<text x="160" y="228" text-anchor="end" font-size="22">${value}</text></g>`;
const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#E8EDF5"/>
<g font-family="Arial, sans-serif" fill="#213754">
<svg x="72" y="64" width="60" height="60" viewBox="0 0 64 64">${icon.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
<text x="151" y="104" font-size="28" font-weight="700">Estimation Room</text>
<text x="72" y="263" font-size="66" font-weight="700">Planning poker.</text>
<text x="72" y="340" font-size="66" font-weight="700">Around one table.</text>
<text x="74" y="417" font-size="26">Share a room. Vote. Reveal together.</text>
<path d="M74 481h70" stroke="#315CBC" stroke-width="5" stroke-linecap="round"/>
<text x="74" y="538" font-size="21" fill="#526782">Real-time estimates for your team</text>
${card(748, 208, -16, '3')}${card(928, 218, 14, '8')}${card(838, 166, -1, '5', true)}
</g></svg>`;
await mkdir('public', { recursive: true });
await writeFile('public/favicon.svg', icon);
await writeFile('public/estimation-room-preview.svg', preview);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent('<style>html,body{margin:0}</style>' + preview);
  await page.screenshot({ path: 'public/estimation-room-preview-v2.png' });
  // Retain the old URL with the new artwork for existing external references.
  await page.screenshot({ path: 'public/og.png' });
  const sizes = [16, 32, 48, 180, 192, 512];
  const pngs = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>' + icon);
    const png = await page.screenshot({ path: size === 180 ? 'public/apple-touch-icon.png' : `public/icon-${size}.png`, omitBackground: true });
    if (size <= 48) pngs.push({ size, png });
  }
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, png }, i) => {
    const at = 6 + i * 16;
    header[at] = size; header[at + 1] = size;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  await writeFile('public/favicon.ico', Buffer.concat([header, ...pngs.map(p => p.png)]));
} finally { await browser.close(); }
