import { el } from '../renderer.js';

export interface AvatarOptions {
  level: number;
  color: string;
  size?: number;
}

function buildSvg(level: number, color: string, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const headR = size * 0.22;
  const bodyW = size * 0.3;
  const bodyH = size * 0.25;

  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;

  // Background glow for high levels
  if (level >= 8) {
    svg += `<circle cx="${cx}" cy="${cy}" r="${size * 0.45}" fill="${color}" opacity="0.15"/>`;
  }
  if (level >= 10) {
    svg += `<circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="none" stroke="${color}" stroke-width="2" opacity="0.3" stroke-dasharray="4 4"/>`;
  }

  // Crown for L8+
  if (level >= 8) {
    const crownY = cy - headR - size * 0.22;
    svg += `<polygon points="${cx - size * 0.12},${crownY + size * 0.1} ${cx - size * 0.08},${crownY} ${cx},${crownY + size * 0.06} ${cx + size * 0.08},${crownY} ${cx + size * 0.12},${crownY + size * 0.1}" fill="#FFD700" opacity="0.9"/>`;
  }

  // Body for L3+
  if (level >= 3) {
    const bodyY = cy + headR * 0.5;
    svg += `<rect x="${cx - bodyW / 2}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${size * 0.05}" fill="${color}" opacity="0.8"/>`;

    // Arms
    svg += `<line x1="${cx - bodyW / 2}" y1="${bodyY + bodyH * 0.3}" x2="${cx - bodyW / 2 - size * 0.1}" y2="${bodyY + bodyH * 0.6}" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
    svg += `<line x1="${cx + bodyW / 2}" y1="${bodyY + bodyH * 0.3}" x2="${cx + bodyW / 2 + size * 0.1}" y2="${bodyY + bodyH * 0.6}" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
  }

  // Cape for L5+
  if (level >= 5) {
    const capeY = cy + headR * 0.3;
    svg += `<path d="M${cx - bodyW / 2 - size * 0.03},${capeY} Q${cx},${capeY + size * 0.35} ${cx + bodyW / 2 + size * 0.03},${capeY}" fill="${color}" opacity="0.3"/>`;
  }

  // Head (always present)
  const headY = level >= 3 ? cy - headR * 0.2 : cy;
  svg += `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="${color}"/>`;

  // Eyes
  const eyeOffX = headR * 0.35;
  const eyeY = headY - headR * 0.1;
  const eyeR = headR * 0.12;
  svg += `<circle cx="${cx - eyeOffX}" cy="${eyeY}" r="${eyeR}" fill="white"/>`;
  svg += `<circle cx="${cx + eyeOffX}" cy="${eyeY}" r="${eyeR}" fill="white"/>`;

  // Smile
  const smileY = headY + headR * 0.2;
  const smileW = headR * 0.3;
  svg += `<path d="M${cx - smileW},${smileY} Q${cx},${smileY + headR * 0.25} ${cx + smileW},${smileY}" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`;

  // Star accessories for L5+
  if (level >= 5 && level < 8) {
    const starX = cx + headR + size * 0.05;
    const starY = headY - headR;
    svg += `<text x="${starX}" y="${starY}" font-size="${size * 0.1}" fill="#FFD700">&#9733;</text>`;
  }

  svg += `</svg>`;
  return svg;
}

export function renderAvatar(
  container: HTMLElement,
  options: AvatarOptions,
): () => void {
  const { level, color, size = 80 } = options;

  const wrapper = el('div', { className: 'avatar' });
  wrapper.innerHTML = buildSvg(level, color, size);

  container.appendChild(wrapper);

  return () => {
    wrapper.remove();
  };
}
