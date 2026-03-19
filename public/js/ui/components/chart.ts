import { el } from '../renderer.js';
import { t } from '../../core/i18n.js';
import type { TranslationKey } from '../../i18n/keys.js';

export interface LineChartData {
  labels: string[];
  values: number[];
}

export interface LineChartOptions {
  width?: number;
  height?: number;
  lineColor?: string;
  pointColor?: string;
  gridColor?: string;
  padding?: number;
}

export function renderLineChart(
  canvas: HTMLCanvasElement,
  data: LineChartData,
  options: LineChartOptions = {},
): void {
  const {
    lineColor = '#6C5CE7',
    pointColor = '#A29BFE',
    gridColor = 'rgba(255,255,255,0.1)',
    padding = 40,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.scale(dpr, dpr);

  const w = cssW;
  const h = cssH;

  // Clear
  ctx.clearRect(0, 0, w, h);

  const { labels, values } = data;
  if (values.length === 0) return;

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const plotW = w - padding * 2;
  const plotH = h - padding * 2;

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
  }

  // Plot points
  const points: { x: number; y: number }[] = values.map((v, i) => ({
    x: padding + (values.length > 1 ? (plotW * i) / (values.length - 1) : plotW / 2),
    y: padding + plotH - ((v - minVal) / range) * plotH,
  }));

  // Line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x, points[i].y);
    else ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Points
  ctx.fillStyle = pointColor;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels on X axis
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < labels.length; i++) {
    const x = padding + (labels.length > 1 ? (plotW * i) / (labels.length - 1) : plotW / 2);
    ctx.fillText(labels[i], x, h - 10);
  }
}

const MONTH_KEYS: TranslationKey[] = [
  'month.0', 'month.1', 'month.2', 'month.3', 'month.4', 'month.5',
  'month.6', 'month.7', 'month.8', 'month.9', 'month.10', 'month.11',
];

const DAY_HEADER_KEYS: TranslationKey[] = [
  'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat', 'day.sun',
];

export function renderCalendarHeatmap(
  container: HTMLElement,
  activeDates: string[],
  month: number, // 0-indexed
  year: number,
): () => void {
  const wrapper = el('div', { className: 'calendar-heatmap' });

  const activeSet = new Set(activeDates);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Day-of-week offset (Monday = 0)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const title = el('div', { className: 'calendar-heatmap__title' }, [
    `${t(MONTH_KEYS[month])} ${year}`,
  ]);
  wrapper.appendChild(title);

  const grid = el('div', { className: 'calendar-heatmap__grid' });

  // Day headers
  for (const key of DAY_HEADER_KEYS) {
    grid.appendChild(el('div', { className: 'calendar-heatmap__header' }, [t(key)]));
  }

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    grid.appendChild(el('div', { className: 'calendar-heatmap__cell calendar-heatmap__cell--empty' }));
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isActive = activeSet.has(dateStr);
    const cell = el('div', {
      className: 'calendar-heatmap__cell' + (isActive ? ' calendar-heatmap__cell--active' : ''),
    }, [String(d)]);
    grid.appendChild(cell);
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);

  return () => {
    wrapper.remove();
  };
}
