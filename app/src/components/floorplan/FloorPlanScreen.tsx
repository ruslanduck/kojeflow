'use client';

import { useRef, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useSessionStore } from '@/store/session';
import { useEntityStore } from '@/store/entities';
import { floorPlansRepository } from '@/repositories/floorPlansRepository';
import { floorZonesRepository } from '@/repositories/floorZonesRepository';
import { ROLES } from '@/domain/roles';
import { occupancyColor } from '@/domain/logic';
import { translatePlace, BED_TILE_COLORS } from '@/domain/labels';
import { RoomZonePanel } from './RoomZonePanel';
import { MapZoneDialog } from './MapZoneDialog';
import { UploadPlanDialog } from './UploadPlanDialog';
import { PlanSettingsDialog } from './PlanSettingsDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { FloorPlan, FloorZone } from '@/domain/types';
import { MappingNotice } from '@/components/ui/Unmapped';

const OCC_COLOR_RGB: Record<string, string> = { '#22A06B': '34,160,107', '#F5A524': '245,165,36', '#E5484D': '229,72,77' };
type Rect = { x: number; y: number; w: number; h: number };
type ResizeMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const HANDLES: { mode: ResizeMode; cursor: string; rightSide: boolean; bottomSide: boolean }[] = [
  { mode: 'nw', cursor: 'nwse', rightSide: false, bottomSide: false },
  { mode: 'ne', cursor: 'nesw', rightSide: true, bottomSide: false },
  { mode: 'sw', cursor: 'nesw', rightSide: false, bottomSide: true },
  { mode: 'se', cursor: 'nwse', rightSide: true, bottomSide: true },
];

export function FloorPlanScreen() {
  const t = useT();
  const lang = useSessionStore((s) => s.lang);
  const role = useSessionStore((s) => s.role);
  const showToast = useSessionStore((s) => s.showToast);
  const roleConfig = ROLES[role];

  const properties = useEntityStore((s) => s.properties);
  const rooms = useEntityStore((s) => s.rooms);
  const beds = useEntityStore((s) => s.beds);
  const residents = useEntityStore((s) => s.residents);
  const floorPlans = useEntityStore((s) => s.floorPlans);
  const floorZones = useEntityStore((s) => s.floorZones);

  const [propertyId, setPropertyId] = useState(() => {
    if (roleConfig.ownHostel) return properties.find((p) => p.name === roleConfig.ownHostel)?.id ?? properties[0]?.id ?? '';
    return properties[0]?.id ?? '';
  });
  const [editMode, setEditMode] = useState(false);
  const [draw, setDraw] = useState<{ planId: string; rect: Rect } | null>(null);
  const [dragZoneId, setDragZoneId] = useState<string | null>(null);
  const [mapDialog, setMapDialog] = useState<{ planId: string; rect: Rect } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FloorPlan | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; sub: string; onYes: () => void } | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  const canEdit = !!roleConfig.planner;
  const wrapperRefs = useRef<Record<string, HTMLDivElement>>({});
  const residentsById = new Map(residents.map((r) => [r.id, r]));
  const visibleProperties = roleConfig.ownHostel ? properties.filter((p) => p.name === roleConfig.ownHostel) : properties;

  const plans = floorPlans.filter((p) => p.propertyId === propertyId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const propertyRooms = rooms.filter((r) => r.propertyId === propertyId);
  const mappedRoomIds = new Set(floorZones.filter((z) => plans.some((p) => p.id === z.planId)).map((z) => z.roomId));

  const legend = [
    { label: t('fp_legend_free'), ...toSwatch('free') },
    { label: t('fp_legend_occ'), ...toSwatch('occupied') },
    { label: t('booked_place'), ...toSwatch('booked') },
    { label: t('fp_legend_off'), ...toSwatch('unavailable') },
  ];
  function toSwatch(status: keyof typeof BED_TILE_COLORS) {
    const [bg, border] = BED_TILE_COLORS[status];
    return { bg, border };
  }

  // ---- drag/resize an existing zone ----
  const startZoneDrag = (plan: FloorPlan, zone: FloorZone, mode: ResizeMode, e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const wrapper = wrapperRefs.current[plan.id];
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    setDragZoneId(zone.id);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const onMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      let next: Rect;
      if (mode === 'move') {
        next = { x: clamp(orig.x + dx, 0, 100 - orig.w), y: clamp(orig.y + dy, 0, 100 - orig.h), w: orig.w, h: orig.h };
      } else {
        const MIN_W = 4, MIN_H = 5;
        let x = orig.x, y = orig.y, w = orig.w, h = orig.h;
        if (mode.includes('w')) { const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_W); w = orig.w + (orig.x - nx); x = nx; }
        if (mode.includes('e')) { w = clamp(orig.w + dx, MIN_W, 100 - orig.x); }
        if (mode.includes('n')) { const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_H); h = orig.h + (orig.y - ny); y = ny; }
        if (mode.includes('s')) { h = clamp(orig.h + dy, MIN_H, 100 - orig.y); }
        next = { x, y, w, h };
      }
      void floorZonesRepository.update(zone.id, next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragZoneId(null);
      showToast(t('toast_saved'));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- draw a new zone on empty canvas ----
  const startDraw = (plan: FloorPlan, wrapper: HTMLDivElement, e: React.MouseEvent) => {
    if (!editMode) return;
    const rect = wrapper.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * 100;
    const oy = ((e.clientY - rect.top) / rect.height) * 100;
    setDraw({ planId: plan.id, rect: { x: ox, y: oy, w: 0, h: 0 } });

    const onMove = (ev: MouseEvent) => {
      const cx = ((ev.clientX - rect.left) / rect.width) * 100;
      const cy = ((ev.clientY - rect.top) / rect.height) * 100;
      setDraw({ planId: plan.id, rect: { x: Math.min(ox, cx), y: Math.min(oy, cy), w: Math.abs(cx - ox), h: Math.abs(cy - oy) } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraw((d) => {
        if (d && d.rect.w >= 2 && d.rect.h >= 3) setMapDialog({ planId: d.planId, rect: d.rect });
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const unmappedRooms = propertyRooms.filter((r) => !mappedRoomIds.has(r.id));

  const confirmMap = async (roomId: string) => {
    if (!mapDialog) return;
    await floorZonesRepository.create({ planId: mapDialog.planId, roomId, ...mapDialog.rect });
    setMapDialog(null);
    showToast(t('toast_saved'));
  };

  const deleteZone = async (zoneId: string) => {
    await floorZonesRepository.remove(zoneId);
    setConfirm(null);
    showToast(t('toast_saved'));
  };
  const deletePlan = async (planId: string) => {
    for (const z of floorZones.filter((z) => z.planId === planId)) await floorZonesRepository.remove(z.id);
    await floorPlansRepository.remove(planId);
    setConfirm(null);
    showToast(t('toast_saved'));
  };

  return (
    <section className="screen">
      <MappingNotice
        items={[
          { entity: 'FloorPlan', field: 'imageUrl' },
          { entity: 'FloorZone', field: 'roomId' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div>
          <h1 className="hd ptitle" style={{ fontSize: 38 }}>{t('fp_title')}</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 13.5, marginTop: 2 }}>{t('fp_sub')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setEditMode(false); }} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 30px 10px 12px', fontSize: 13.5, outline: 'none', cursor: 'pointer', minWidth: 170 }}>
            {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {canEdit && (
            <>
              <button type="button" onClick={() => setEditMode(!editMode)} style={{ background: editMode ? '#141414' : '#fff', color: editMode ? '#fff' : 'var(--color-ink)', border: '1px solid ' + (editMode ? '#141414' : 'var(--color-border)'), borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {editMode ? t('fp_done') : t('fp_editmode')}
              </button>
              <button type="button" onClick={() => setUploadOpen(true)} style={{ background: '#141414', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                + {t('fp_upload')}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {legend.map((g) => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>
            <span style={{ width: 13, height: 13, borderRadius: 4, display: 'inline-block', flex: 'none', background: g.bg, border: `1px solid ${g.border}` }} />
            <span>{g.label}</span>
          </div>
        ))}
        {editMode && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8A6B00', background: '#FFF8D6', border: '1px solid #FFE88A', borderRadius: 8, padding: '5px 11px' }}>
            {t('fp_drawhint')} {t('fp_drag_hint')}
          </div>
        )}
      </div>

      {plans.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
          <div className="hd" style={{ fontSize: 19, marginBottom: 5 }}>{t('fp_empty')}</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t('fp_empty_sub')}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {plans.map((plan) => {
          const zones = floorZones.filter((z) => z.planId === plan.id);
          const drawing = draw?.planId === plan.id ? draw.rect : null;
          return (
            <div key={plan.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <div className="hd" style={{ fontSize: 17 }}>{plan.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', background: '#F1F1F5', borderRadius: 20, padding: '3px 9px' }}>#{plan.sort}</div>
                <div style={{ flex: 1 }} />
                {editMode && (
                  <>
                    <button type="button" onClick={() => setEditingPlan(plan)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '7px 13px', fontSize: 12.5, cursor: 'pointer' }}>{t('fp_planset')}</button>
                    <button type="button" onClick={() => setConfirm({ title: t('fp_delplan'), sub: t('fp_delplan_sub'), onYes: () => void deletePlan(plan.id) })} style={{ background: '#fff', border: '1px solid #F6CBCB', color: 'var(--color-red)', borderRadius: 9, padding: '7px 13px', fontSize: 12.5, cursor: 'pointer', marginLeft: 8 }}>{t('delete_w')}</button>
                  </>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div
                  ref={(el) => { if (el) wrapperRefs.current[plan.id] = el; }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.fpImg) startDraw(plan, e.currentTarget, e);
                  }}
                  style={{ position: 'relative', display: 'block', width: '100%', minWidth: 1080, userSelect: 'none', cursor: editMode ? 'crosshair' : 'default' }}
                >
                  <div data-fp-img="1" style={{ width: '100%', aspectRatio: '1539/679', backgroundImage: `url("${plan.imageUrl}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', pointerEvents: 'none' }} />
                  {zones.map((zone) => {
                    const room = rooms.find((r) => r.id === zone.roomId);
                    if (!room) return null;
                    const roomBeds = beds.filter((b) => b.roomId === room.id);
                    const available = roomBeds.filter((b) => b.status !== 'unavailable').length;
                    const occ = roomBeds.filter((b) => b.status === 'occupied').length;
                    const edgeColor = occupancyColor(available ? occ / available : 0);
                    const rgb = OCC_COLOR_RGB[edgeColor] ?? '229,72,77';
                    const active = dragZoneId === zone.id || openRoomId === room.id;
                    const badgeBg = edgeColor === '#22A06B' ? '#E4F6EC' : edgeColor === '#F5A524' ? '#FFF6DB' : '#FDECEC';
                    const badgeInk = edgeColor === '#22A06B' ? '#1B7F52' : edgeColor === '#F5A524' ? '#8A6B00' : '#C0392B';
                    return (
                      <div
                        key={zone.id}
                        onMouseDown={(e) => startZoneDrag(plan, zone, 'move', e)}
                        onClick={(e) => { if (editMode) return; e.stopPropagation(); setOpenRoomId(room.id); }}
                        style={{
                          position: 'absolute', left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%`,
                          border: `1.5px solid ${active ? 'var(--color-magenta)' : edgeColor}`, borderRadius: 9,
                          background: `rgba(${rgb},${active ? 0.24 : 0.13})`,
                          boxShadow: `inset 0 0 0 1px rgba(255,255,255,.65)${active ? ', 0 6px 20px rgba(20,20,20,.22)' : ''}`,
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 4,
                          overflow: editMode ? 'visible' : 'hidden', zIndex: editMode ? (active ? 30 : 10) : undefined,
                          cursor: editMode ? 'grab' : 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid rgba(20,20,20,.10)', borderRadius: 7, padding: '2px 5px', fontSize: 10.5, lineHeight: 1.25, boxShadow: '0 1px 4px rgba(20,20,20,.10)', maxWidth: '100%', pointerEvents: 'none' }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{translatePlace(room.name, lang)}</span>
                          <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 800, borderRadius: 20, padding: '0 5px', marginLeft: 'auto', color: badgeInk, background: badgeBg }}>{occ}/{available}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'flex-end', pointerEvents: 'none', overflow: 'hidden', maxHeight: '100%' }}>
                          {roomBeds.map((bed) => {
                            const resident = bed.residentId ? residentsById.get(bed.residentId) : undefined;
                            const [bg, border, fg] = BED_TILE_COLORS[bed.status];
                            return (
                              <span key={bed.id} title={`${bed.index} · ${resident ? resident.name : bed.status}`} style={{ minWidth: 17, height: 17, padding: '0 3px', borderRadius: 5, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, lineHeight: 1, background: bg, border: `1px solid ${border}`, color: fg, boxShadow: '0 1px 3px rgba(20,20,20,.14)' }}>
                                {bed.index}
                              </span>
                            );
                          })}
                        </div>
                        {editMode && (
                          <div style={{ position: 'absolute', left: '50%', top: -14, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 3, zIndex: 32, whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onMouseDown={(e) => startZoneDrag(plan, zone, 'move', e)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#141414', color: '#fff', border: '1.5px solid #fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, cursor: 'grab', boxShadow: '0 2px 8px rgba(20,20,20,.3)', lineHeight: 1.3 }}
                            >
                              <span>✥</span><span>{t('fp_move')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirm({ title: t('fp_delzone'), sub: t('fp_delzone_sub'), onYes: () => void deleteZone(zone.id) }); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ background: '#fff', border: '1.5px solid var(--color-red)', color: 'var(--color-red)', borderRadius: '50%', width: 21, height: 21, fontSize: 12, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(20,20,20,.28)', flex: 'none', padding: 0 }}
                            >
                              ×
                            </button>
                          </div>
                        )}
                        {editMode && HANDLES.map((h) => (
                          <div
                            key={h.mode}
                            onMouseDown={(e) => startZoneDrag(plan, zone, h.mode, e)}
                            style={{
                              position: 'absolute', width: 13, height: 13, borderRadius: 4, background: '#fff', border: '2px solid #141414',
                              boxShadow: '0 1px 5px rgba(20,20,20,.28)', zIndex: 32, cursor: `${h.cursor}-resize`,
                              right: h.rightSide ? -7 : undefined, left: h.rightSide ? undefined : -7,
                              bottom: h.bottomSide ? -7 : undefined, top: h.bottomSide ? undefined : -7,
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                  {drawing && (
                    <div style={{ position: 'absolute', left: `${drawing.x}%`, top: `${drawing.y}%`, width: `${drawing.w}%`, height: `${drawing.h}%`, border: '2px dashed #141414', background: 'rgba(255,214,0,.22)', pointerEvents: 'none', borderRadius: 6 }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {openRoomId && <RoomZonePanel propertyId={propertyId} roomId={openRoomId} onClose={() => setOpenRoomId(null)} />}
      {mapDialog && (
        <MapZoneDialog unmappedRooms={unmappedRooms} onCancel={() => setMapDialog(null)} onConfirm={(roomId) => void confirmMap(roomId)} />
      )}
      {uploadOpen && (
        <UploadPlanDialog propertyId={propertyId} nextSort={plans.length + 1} onClose={() => setUploadOpen(false)} onSaved={() => setUploadOpen(false)} />
      )}
      {editingPlan && (
        <PlanSettingsDialog plan={editingPlan} onClose={() => setEditingPlan(null)} onSaved={() => setEditingPlan(null)} />
      )}
      {confirm && (
        <ConfirmDialog title={confirm.title} sub={confirm.sub} onCancel={() => setConfirm(null)} onConfirm={confirm.onYes} />
      )}
    </section>
  );
}
