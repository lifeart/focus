import { el } from '../renderer.js';

export interface ProgressBarOptions {
  value: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  color?: string;
}

export function renderProgressBar(
  container: HTMLElement,
  options: ProgressBarOptions,
): () => void {
  const { value, max, label, showPercent = true, color } = options;
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  const wrapper = el('div', { className: 'progress-bar' });

  if (label || showPercent) {
    const header = el('div', { className: 'progress-bar__header' });

    if (label) {
      header.appendChild(el('span', { className: 'progress-bar__label' }, [label]));
    }

    if (showPercent) {
      header.appendChild(el('span', { className: 'progress-bar__percent' }, [`${percent}%`]));
    }

    wrapper.appendChild(header);
  }

  const track = el('div', { className: 'progress-bar__track' });
  const fill = el('div', { className: 'progress-bar__fill' });

  if (color) {
    fill.style.backgroundColor = color;
  }

  // Start at 0 width, animate to target
  fill.style.width = '0%';
  fill.style.transition = 'width 0.6s ease-out';

  track.appendChild(fill);
  wrapper.appendChild(track);
  container.appendChild(wrapper);

  // Trigger animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.width = `${percent}%`;
    });
  });

  return () => {
    wrapper.remove();
  };
}
