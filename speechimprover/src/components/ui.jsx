// Shared presentational primitives.
/* eslint-disable react-refresh/only-export-components -- this module intentionally
   ships UI components alongside the toast hook/provider. */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ATTRIBUTES, ATTRIBUTE_MAP } from '../lib/analysis/attributes.js';
import { scoreBand } from '../lib/format.js';

export function ScoreBadge({ score, label }) {
  if (score == null) return <span className="badge">n/a</span>;
  const band = scoreBand(score);
  const text = label || band.replace('-', ' ');
  return <span className={`badge ${band}`}>{Math.round(score)} · {text}</span>;
}

function barColor(v) {
  if (v >= 85) return 'var(--good)';
  if (v >= 70) return 'var(--accent-2)';
  if (v >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

// scores: { attrKey: 0..100 | null }. Optionally compare against a second vector.
export function AttributeBars({ scores, compareScores, onSelect, highlight = [] }) {
  return (
    <div>
      {ATTRIBUTES.map((attr) => {
        const v = scores?.[attr.key];
        const cmp = compareScores?.[attr.key];
        const isHi = highlight.includes(attr.key);
        return (
          <div
            className="attr-row"
            key={attr.key}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && onSelect(attr.key)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: isHi ? 'var(--accent)' : 'var(--text)' }}>
                {attr.label}
              </span>
              {isHi && <span className="tag">focus</span>}
            </div>
            <div className="mono" style={{ fontWeight: 700 }}>
              {v == null ? '—' : Math.round(v)}
              {cmp != null && v != null && (
                <span
                  className="tiny"
                  style={{ marginLeft: 6, color: v - cmp >= 0 ? 'var(--good)' : 'var(--bad)' }}
                >
                  {v - cmp >= 0 ? '▲' : '▼'}{Math.abs(Math.round(v - cmp))}
                </span>
              )}
            </div>
            <div className="attr-bar-track" title={attr.blurb}>
              <div
                className="attr-bar-fill"
                style={{ width: `${v ?? 0}%`, background: v == null ? 'var(--border)' : barColor(v) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AttrLabel({ attrKey }) {
  return <>{ATTRIBUTE_MAP[attrKey]?.label || attrKey}</>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    // Move focus into the dialog and lock background scroll while open.
    // ponytail: initial focus + scroll-lock, not a full tab-trap — add one if AT users need it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={dialogRef} tabIndex={-1} className="modal" style={wide ? { width: 'min(920px, 100%)' } : undefined} role="dialog" aria-modal="true">
        {title && (
          <div className="card-head" style={{ marginBottom: 18 }}>
            <h2>{title}</h2>
            <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        {children}
        {footer && <div className="row spread" style={{ marginTop: 22 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '🎙️', title, children, action }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: 420, margin: '0 auto 16px' }}>{children}</p>}
      {action}
    </div>
  );
}

// ---- toast ----
// toast(text) or toast(text, { type: 'error'|'success', action: { label, onClick }, duration }).
// An action toast (e.g. Undo) lingers longer; screen readers get it via aria-live.
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [cur, setCur] = useState(null); // { text, type, action }
  const timerRef = useRef(null);
  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCur(null);
  }, []);
  const toast = useCallback((text, opts = {}) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = { text, type: opts.type || null, action: opts.action || null };
    setCur(t);
    const dur = opts.duration || (t.action ? 6000 : 2600);
    timerRef.current = setTimeout(() => setCur((m) => (m === t ? null : m)), dur);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {cur && (
        <div className={`toast ${cur.type || ''}`} role="status" aria-live="polite">
          <span>{cur.text}</span>
          {cur.action && (
            <button className="toast-action" onClick={() => { cur.action.onClick(); dismiss(); }}>
              {cur.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx) || (() => {});
}
