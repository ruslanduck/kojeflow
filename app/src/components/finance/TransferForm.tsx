'use client';

import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { useEntityStore } from '@/store/entities';
import { transfersRepository } from '@/repositories/transfersRepository';
import { TODAY } from '@/domain/logic';
import { FIELD_STYLE, FIELD_LABEL_STYLE } from '@/components/ui/formStyles';
import { Portal } from '@/components/ui/Portal';
import type { Transfer, TransferStatus } from '@/domain/types';

interface TransferFormProps {
  onClose: () => void;
  editing: Transfer | null;
  onSaved: (transfer: Transfer) => void;
}

export function TransferForm({ onClose, editing, onSaved }: TransferFormProps) {
  const t = useT();
  const properties = useEntityStore((s) => s.properties);

  const [propertyId, setPropertyId] = useState(editing?.propertyId ?? '');
  const [by, setBy] = useState(editing?.by ?? '');
  const [to, setTo] = useState(editing?.to ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.date ?? `${TODAY} 09:00`);
  const [status, setStatus] = useState<TransferStatus>(editing?.status ?? 'Handed over');
  const [error, setError] = useState('');

  const save = async () => {
    const amt = Number(amount);
    if (!amt) return setError(t('ff_amount') + ' required');
    const payload = { propertyId, by, to, amount: amt, date, status };
    const saved = editing ? await transfersRepository.update(editing.id, payload) : await transfersRepository.create(payload);
    onSaved(saved);
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 61, padding: 16 }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div className="hd" style={{ fontSize: 23 }}>{editing ? `${t('form_edit')} · ${t('ent_transfer')}` : `${t('form_add')} · ${t('ent_transfer')}`}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-faint-2)', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '18px 24px' }}>
            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <div style={FIELD_LABEL_STYLE}>{t('ff_hostel')}</div>
                <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={FIELD_STYLE}>
                  <option value="">{t('select')}</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_handedby')}</div>
                <input value={by} onChange={(e) => setBy(e.target.value)} placeholder={t('ph_whohanded')} style={FIELD_STYLE} />
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_to')}</div>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('ph_recipient')} style={FIELD_STYLE} />
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('ff_amount')}</div>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('ph_amount')} style={FIELD_STYLE} />
              </div>
              <div>
                <div style={FIELD_LABEL_STYLE}>{t('col_status')}</div>
                <select value={status} onChange={(e) => setStatus(e.target.value as TransferStatus)} style={FIELD_STYLE}>
                  <option value="Handed over">{t('st_HandedOver')}</option>
                  <option value="Accepted">{t('st_Accepted')}</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <div style={FIELD_LABEL_STYLE}>{t('ff_created')}</div>
                <input value={date} onChange={(e) => setDate(e.target.value)} placeholder={t('ph_datetime')} style={FIELD_STYLE} />
              </div>
            </div>
            {error && <div style={{ background: '#FDECEC', border: '1px solid #F6CBCB', color: '#C0392B', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, marginTop: 13, fontWeight: 500 }}>{error}</div>}
          </div>
          <div style={{ padding: '15px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 17px', fontSize: 13.5, cursor: 'pointer', color: 'var(--color-muted)' }}>{t('cancel')}</button>
            <button className="pbtn" onClick={() => void save()} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{t('save')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
