import { el } from '../renderer.js';
import { t } from '../../core/i18n.js';
import type { BadgeDefinition, BadgeTier } from '../../types.js';

const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
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

  // Name - use i18n key
  const nameText = t(`badge.${badge.id}.name` as any);
  const nameEl = el('div', { className: 'badge-card__name' }, [nameText]);
  card.appendChild(nameEl);

  // Tier indicator
  if (!isLocked) {
    const tierLabel = t(`badgeTier.${earned!}` as any);
    const tierEl = el('div', { className: 'badge-card__tier' }, [tierLabel]);
    tierEl.style.color = TIER_COLORS[earned!];
    card.appendChild(tierEl);
  }

  // Description / condition - use i18n key
  const descText = t(`badge.${badge.id}.${displayTier}` as any);
  const descEl = el('div', { className: 'badge-card__desc' }, [descText]);
  card.appendChild(descEl);

  container.appendChild(card);

  return () => {
    card.remove();
  };
}
