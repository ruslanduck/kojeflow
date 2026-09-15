import type { CSSProperties } from 'react';

/** Matches Component.INP — the shared text input / select look used across every form. */
export const FIELD_STYLE: CSSProperties = {
  width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 9,
  padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};

export const FIELD_LABEL_STYLE: CSSProperties = { fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 5 };
