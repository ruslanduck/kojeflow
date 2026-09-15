'use client';

import { useState } from 'react';
import { useSessionStore } from '@/store/session';
import { useT } from '@/i18n/useT';
import { MONTHS, WEEKDAYS } from '@/domain/calendar';
import { TODAY } from '@/domain/logic';
import { formatDateDMY } from '@/lib/format';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

interface DatePopoverProps {
  value: string;
  onChange: (iso: string) => void;
  /** 'dashboard' = the pill-style "History ⌄" trigger; 'field' = a full-width form input look. */
  variant?: 'dashboard' | 'field';
  align?: 'left' | 'right';
}

export function DatePopover({ value, onChange, variant = 'field', align = 'left' }: DatePopoverProps) {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const base = ISO_RE.test(value || '') ? value : TODAY;
  const [view, setView] = useState(base.slice(0, 7));

  const openPopover = () => {
    setView(base.slice(0, 7));
    setOpen(true);
  };

  const [vy, vm] = view.split('-').map(Number);
  const lead = (new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  const cells: { iso: string | null; day: number | null }[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - lead + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ iso: null, day: null });
    } else {
      cells.push({ iso: `${vy}-${pad(vm)}-${pad(dayNum)}`, day: dayNum });
    }
  }

  const shiftMonth = (n: number) => {
    let y = vy,
      m = vm + n;
    if (m < 1) {
      m = 12;
      y--;
    }
    if (m > 12) {
      m = 1;
      y++;
    }
    setView(`${y}-${pad(m)}`);
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const triggerStyle: React.CSSProperties =
    variant === 'dashboard'
      ? { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid ' + (open ? '#141414' : 'var(--color-border)'), borderRadius: 11, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' }
      : { width: '100%', background: 'var(--color-bg)', border: '1px solid ' + (open ? '#141414' : 'var(--color-border)'), borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => (open ? setOpen(false) : openPopover())} style={triggerStyle}>
        {variant === 'dashboard' && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('history')}</span>
        )}
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{value ? formatDateDMY(value) : t('select')}</span>
        <span style={{ fontSize: 12, color: 'var(--color-faint)' }}>▾</span>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', zIndex: 90, top: 'calc(100% + 6px)', [align]: 0, width: 252, background: '#fff', border: '1px solid var(--color-border-strong)', borderRadius: 13, boxShadow: '0 14px 40px rgba(20,20,20,.16)', padding: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <button type="button" onClick={() => shiftMonth(-1)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, width: 26, height: 26, fontSize: 15, lineHeight: 1, cursor: 'pointer', color: 'var(--color-muted)', fontFamily: 'inherit' }}>
              ‹
            </button>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{MONTHS[lang][vm - 1]} {vy}</div>
            <button type="button" onClick={() => shiftMonth(1)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, width: 26, height: 26, fontSize: 15, lineHeight: 1, cursor: 'pointer', color: 'var(--color-muted)', fontFamily: 'inherit' }}>
              ›
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2, marginBottom: 3 }}>
            {WEEKDAYS[lang].map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-faint)', fontWeight: 700, letterSpacing: 0.3 }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2 }}>
            {cells.map((c, i) => {
              if (!c.iso) return <div key={i} style={{ height: 32 }} />;
              const sel = c.iso === value;
              const isToday = c.iso === TODAY;
              return (
                <div
                  key={i}
                  onClick={() => pick(c.iso as string)}
                  style={{
                    height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                    fontSize: 12.5, cursor: 'pointer', border: '1px solid ' + (sel ? '#141414' : isToday ? '#E0E0E8' : 'transparent'),
                    background: sel ? '#141414' : 'transparent', color: sel ? '#fff' : '#141414', fontWeight: sel || isToday ? 700 : 500,
                  }}
                >
                  {c.day}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => pick(TODAY)} style={{ width: '100%', marginTop: 9, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('d_today')}
          </button>
        </div>
      )}
    </div>
  );
}
