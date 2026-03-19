import type { AppData } from '../../types.js';
import { el } from '../renderer.js';
import { getLevel, getLevelTitle } from '../../core/progression.js';
import { createDisposables } from '../../core/disposables.js';

function getWeekRange(): { start: Date; end: Date; label: string } {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date): string =>
    `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;

  return {
    start: monday,
    end: sunday,
    label: `${fmt(monday)} \u2013 ${fmt(sunday)}`,
  };
}

function getWeeklyStats(data: AppData, start: Date, end: Date) {
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const weekResults = data.exerciseHistory.filter((r) => {
    const d = new Date(r.timestamp).toISOString().slice(0, 10);
    return d >= startStr && d <= endStr;
  });

  const daysSet = new Set<string>();
  const dailySessions = new Map<string, number>();
  let bestScore = 0;
  let totalXP = 0;

  for (const r of weekResults) {
    const d = new Date(r.timestamp).toISOString().slice(0, 10);
    daysSet.add(d);
    dailySessions.set(d, (dailySessions.get(d) || 0) + 1);
    if (r.score > bestScore) bestScore = r.score;
    totalXP += r.xpEarned;
  }

  // Build daily activity array (Mon=0 .. Sun=6)
  const dailyActivity: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    dailyActivity.push(dailySessions.get(ds) || 0);
  }

  return {
    daysTrained: daysSet.size,
    totalSessions: weekResults.length,
    bestScore,
    totalXP,
    dailyActivity,
  };
}

function drawRecapCanvas(
  canvas: HTMLCanvasElement,
  data: AppData,
  weekLabel: string,
  stats: ReturnType<typeof getWeeklyStats>,
  level: number,
  levelTitle: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = 400;
  const h = 500;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Purple gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#6C5CE7');
  grad.addColorStop(1, '#341f97');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // App title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Focus', w / 2, 45);

  // Week dates
  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(weekLabel, w / 2, 70);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 85);
  ctx.lineTo(w - 40, 85);
  ctx.stroke();

  // Stats
  const statsData = [
    { label: '\u0414\u043D\u0435\u0439 \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043E\u043A', value: String(stats.daysTrained) },
    { label: '\u0421\u0435\u0441\u0441\u0438\u0439', value: String(stats.totalSessions) },
    { label: '\u041B\u0443\u0447\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442', value: `${stats.bestScore}%` },
    { label: 'XP \u0437\u0430 \u043D\u0435\u0434\u0435\u043B\u044E', value: `+${stats.totalXP}` },
  ];

  let y = 115;
  ctx.textAlign = 'left';
  for (const stat of statsData) {
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(stat.label, 40, y);

    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(stat.value, w - 40, y);
    ctx.textAlign = 'left';
    y += 35;
  }

  // Bar chart - daily activity
  y += 10;
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u043F\u043E \u0434\u043D\u044F\u043C', w / 2, y);

  y += 15;
  const dayLabels = ['\u041F\u043D', '\u0412\u0442', '\u0421\u0440', '\u0427\u0442', '\u041F\u0442', '\u0421\u0431', '\u0412\u0441'];
  const barMaxHeight = 80;
  const barWidth = 30;
  const barGap = 12;
  const totalBarWidth = dayLabels.length * barWidth + (dayLabels.length - 1) * barGap;
  const barStartX = (w - totalBarWidth) / 2;
  const maxActivity = Math.max(...stats.dailyActivity, 1);

  for (let i = 0; i < 7; i++) {
    const x = barStartX + i * (barWidth + barGap);
    const barH = (stats.dailyActivity[i] / maxActivity) * barMaxHeight;

    // Bar background
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, barWidth, barMaxHeight);

    // Bar fill
    ctx.fillStyle = '#A29BFE';
    ctx.fillRect(x, y + barMaxHeight - barH, barWidth, barH);

    // Day label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabels[i], x + barWidth / 2, y + barMaxHeight + 15);
  }

  // Level & title
  const levelY = y + barMaxHeight + 50;
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`\u0423\u0440\u043E\u0432\u0435\u043D\u044C ${level} \u2014 ${levelTitle}`, w / 2, levelY);

  // Footer branding
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Focus Training App', w / 2, h - 15);
}

export function renderWeeklyRecap(container: HTMLElement, data: AppData): (() => void) | void {
  const disposables = createDisposables();

  const { start, end, label: weekLabel } = getWeekRange();
  const stats = getWeeklyStats(data, start, end);
  const level = getLevel(data.progression.totalXP);
  const levelTitle = getLevelTitle(level);

  const section = el('div', { className: 'card weekly-recap' }, [
    el('h2', { className: 'card__title' }, ['\u041D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442']),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 500;
  canvas.className = 'weekly-recap__canvas';

  drawRecapCanvas(canvas, data, weekLabel, stats, level, levelTitle);
  section.appendChild(canvas);

  // Buttons
  const btnContainer = el('div', {
    className: 'weekly-recap__actions',
  });

  const downloadBtn = el('button', { className: 'btn btn--primary' }, [
    '\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443',
  ]);
  disposables.addListener(downloadBtn, 'click', () => {
    const link = document.createElement('a');
    link.download = `focus-weekly-${start.toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  const copyBtn = el('button', { className: 'btn btn--secondary' }, [
    '\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C',
  ]);
  disposables.addListener(copyBtn, 'click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      try {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]).then(() => {
          copyBtn.textContent = '\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E!';
          setTimeout(() => {
            copyBtn.textContent = '\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C';
          }, 2000);
        });
      } catch {
        // Clipboard API not available
      }
    }, 'image/png');
  });

  btnContainer.appendChild(downloadBtn);
  btnContainer.appendChild(copyBtn);
  section.appendChild(btnContainer);

  container.appendChild(section);

  return () => {
    disposables.dispose();
    section.remove();
  };
}
