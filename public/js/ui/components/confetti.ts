import { el } from '../renderer.js';
import type { Disposables } from '../../types.js';

export const CONFETTI_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#9B59B6', '#FF8C42', '#00D2FF', '#FF4081',
];

export function createConfetti(container: HTMLElement, disposables: Disposables): void {
  const overlay = el('div', { className: 'confetti-container confetti-container--clickable' });

  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const duration = 2 + Math.random() * 2;

    piece.style.cssText = `
      left:${left}%;
      top:-10px;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    piece.style.opacity = '1';

    overlay.appendChild(piece);
  }

  container.appendChild(overlay);

  const dismiss = (): void => {
    overlay.remove();
  };

  disposables.addListener(overlay, 'click', dismiss);

  // Auto-remove after animations finish
  disposables.setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 5000);
}
