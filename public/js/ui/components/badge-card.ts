import { el } from '../renderer.js';
import type { BadgeDefinition, BadgeTier } from '../../types.js';

const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
};

const TIER_LABELS: Record<BadgeTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
};

export function renderBadgeCard(
  container: HTMLElement,
  badge: BadgeDefinition,
  earned: BadgeTier | null,
): () => void {
  const isLocked = earned === null;
  const displayTier: BadgeTier = earned || 'bronze';

  const card = el('div', {
    className: 'badge-card' + (isLocked ? ' badge-card--locked' : ''),
  });

  // Icon
  const iconEl = el('div', { className: 'badge-card__icon' }, [badge.icon]);
  if (!isLocked) {
    iconEl.style.filter = 'none';
  } else {
    iconEl.style.filter = 'grayscale(1)';
    iconEl.style.opacity = '0.5';
  }
  card.appendChild(iconEl);

  // Name
  const nameEl = el('div', { className: 'badge-card__name' }, [badge.name]);
  card.appendChild(nameEl);

  // Tier indicator
  if (!isLocked) {
    const tierEl = el('div', { className: 'badge-card__tier' }, [TIER_LABELS[earned!]]);
    tierEl.style.color = TIER_COLORS[earned!];
    card.appendChild(tierEl);
  }

  // Description / condition
  const descEl = el('div', { className: 'badge-card__desc' }, [
    badge.description[displayTier],
  ]);
  card.appendChild(descEl);

  container.appendChild(card);

  return () => {
    card.remove();
  };
}
