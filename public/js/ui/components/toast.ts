import { el } from '../renderer.js';

export function showToast(message: string, durationMs: number = 3000): void {
  const toast = el('div', { className: 'toast' });
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
  }, durationMs);
}
