// Small formatting helpers shared across views.

import { t, locale } from './i18n.js';

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// House rule: a calendar day is the user's LOCAL day. Never take a day from
// toISOString().slice(0, 10) or parse a bare 'YYYY-MM-DD' with new Date(str) — both are UTC.
const pad2 = (n) => String(n).padStart(2, '0');
export function localDayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}
// A stored 'YYYY-MM-DD' back as local midnight of that day.
export const parseDayKey = (key) => new Date(`${key}T00:00:00`);

export function relativeDay(iso) {
  if (!iso) return '';
  // Whole local calendar days between then and today (not 24h blocks).
  const days = Math.round((parseDayKey(localDayKey()) - parseDayKey(localDayKey(iso))) / 86400000);
  if (days <= 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days < 7) return t.n('{n} day ago', '{n} days ago', days);
  if (days < 30) return t.n('{n} wk ago', '{n} wk ago', Math.round(days / 7));
  return t.n('{n} mo ago', '{n} mo ago', Math.round(days / 30));
}

export function formatDuration(sec) {
  if (!sec && sec !== 0) return '—';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function round(v, places = 0) {
  if (v == null || Number.isNaN(v)) return 0;
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

// 0..100 score -> qualitative band
export function scoreBand(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'needs-work';
}
