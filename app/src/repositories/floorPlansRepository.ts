import { useEntityStore } from '@/store/entities';
import { check, db } from '@/lib/supabase/write';
import type { FloorPlan } from '@/domain/types';

const BUCKET = 'floor-plans';
const SIGNED_URL_SECONDS = 60 * 60 * 12;

export interface NewFloorPlan {
  propertyId: string;
  name: string;
  sort: number;
  file: File;
  imageWidth?: number;
  imageHeight?: number;
}

/** Floor plans in Supabase: the image goes to the private bucket, the plan to public.floor_plans. */
export const floorPlansRepository = {
  async create(input: NewFloorPlan): Promise<FloorPlan> {
    const supabase = db();
    const ext = input.file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${input.propertyId}/${crypto.randomUUID()}.${ext}`;
    check(await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: input.file.type || undefined }), 'Upload plan image');

    const inserted = await supabase
      .from('floor_plans')
      .insert({
        property_id: input.propertyId,
        name: input.name,
        sort_order: input.sort,
        image_path: path,
        image_width: input.imageWidth ?? null,
        image_height: input.imageHeight ?? null,
      })
      .select('id')
      .single();
    if (inserted.error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(`Save plan: ${inserted.error.message}`);
    }

    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    const plan: FloorPlan = {
      id: inserted.data.id,
      propertyId: input.propertyId,
      name: input.name,
      sort: input.sort,
      imageUrl: signed.data?.signedUrl ?? '',
      imagePath: path,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
    };
    useEntityStore.setState((s) => ({ floorPlans: [plan, ...s.floorPlans] }));
    return plan;
  },

  async update(id: string, patch: { name?: string; sort?: number }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sort !== undefined) row.sort_order = patch.sort;
    check(await db().from('floor_plans').update(row).eq('id', id), 'Update plan');
    useEntityStore.setState((s) => ({ floorPlans: s.floorPlans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  },

  /** Deletes the plan (its zones cascade in the database) and its image. */
  async remove(id: string): Promise<void> {
    const plan = useEntityStore.getState().floorPlans.find((p) => p.id === id);
    const supabase = db();
    check(await supabase.from('floor_plans').delete().eq('id', id), 'Delete plan');
    if (plan?.imagePath) await supabase.storage.from(BUCKET).remove([plan.imagePath]);
    useEntityStore.setState((s) => ({
      floorPlans: s.floorPlans.filter((p) => p.id !== id),
      floorZones: s.floorZones.filter((z) => z.planId !== id),
    }));
  },
};
