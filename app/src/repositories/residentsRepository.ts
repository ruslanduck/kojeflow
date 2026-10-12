import { useEntityStore } from '@/store/entities';
import { useSessionStore } from '@/store/session';
import { check, db } from '@/lib/supabase/write';
import type { Gender, Resident, ResidentDocument } from '@/domain/types';

const BUCKET = 'tenant-documents';
const URL_SECONDS = 60 * 60 * 12;
const GENDER_DB: Record<Gender, string> = { M: 'male', F: 'female' };

export type DocumentKind = 'passport' | 'other';

export interface ResidentInput {
  name: string;
  gender: Gender | null;
  phone?: string;
  dob?: string;
  type?: 'internal' | 'commercial' | 'unknown';
}

function patchResident(id: string, patch: (r: Resident) => Partial<Resident>) {
  useEntityStore.setState((s) => ({ residents: s.residents.map((r) => (r.id === id ? { ...r, ...patch(r) } : r)) }));
}

/** Storage keys keep to safe characters; the original name stays in tenant_documents.file_name. */
function objectName(fileName: string): string {
  return `${crypto.randomUUID()}-${fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)}`;
}

/** Residents (public.tenants) and their files in the private tenant-documents bucket. */
export const residentsRepository = {
  async create(input: ResidentInput): Promise<Resident> {
    // The id is made here and the row is not read back: a house manager may insert a resident
    // they cannot read until the stay exists, and reading it back would fail the insert.
    const id = crypto.randomUUID();
    check(
      await db()
        .from('tenants')
        .insert({
          id,
          full_name: input.name,
          gender: input.gender ? GENDER_DB[input.gender] : null,
          phone: input.phone || null,
          birth_date: input.dob || null,
          type: input.type ?? 'unknown',
          source: 'app',
        }),
      'Save resident',
    );
    const resident: Resident = {
      id, name: input.name, gender: input.gender, phone: input.phone || undefined, dob: input.dob || undefined,
      passportDocs: [], otherDocs: [],
    };
    useEntityStore.setState((s) => ({ residents: [resident, ...s.residents] }));
    return resident;
  },

  async update(id: string, patch: Partial<ResidentInput>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.full_name = patch.name;
    if (patch.gender !== undefined) row.gender = patch.gender ? GENDER_DB[patch.gender] : null;
    if (patch.phone !== undefined) row.phone = patch.phone || null;
    if (patch.dob !== undefined) row.birth_date = patch.dob || null;
    check(await db().from('tenants').update(row).eq('id', id), 'Update resident');
    patchResident(id, () => ({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.gender !== undefined && { gender: patch.gender }),
      ...(patch.phone !== undefined && { phone: patch.phone || undefined }),
      ...(patch.dob !== undefined && { dob: patch.dob || undefined }),
    }));
  },

  async addDocuments(tenantId: string, kind: DocumentKind, files: File[]): Promise<ResidentDocument[]> {
    const supabase = db();
    const added: ResidentDocument[] = [];
    for (const file of files) {
      const path = `${tenantId}/${kind}/${objectName(file.name)}`;
      check(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined }), 'Upload document');
      const inserted = await supabase
        .from('tenant_documents')
        .insert({
          tenant_id: tenantId, kind, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size,
          uploaded_by: useSessionStore.getState().userId,
        })
        .select('id')
        .single();
      if (inserted.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(`Save document: ${inserted.error.message}`);
      }
      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_SECONDS);
      added.push({ id: inserted.data.id, path, name: file.name, url: signed.data?.signedUrl ?? '' });
    }
    const key = kind === 'passport' ? 'passportDocs' : 'otherDocs';
    patchResident(tenantId, (r) => ({ [key]: [...(r[key] ?? []), ...added] }));
    return added;
  },

  async removeDocument(tenantId: string, doc: ResidentDocument): Promise<void> {
    if (!doc.id) return;
    const supabase = db();
    // Row-level security filters a delete it refuses instead of failing it.
    const removed = check(await supabase.from('tenant_documents').delete().eq('id', doc.id).select('id'), 'Delete document');
    if (!removed.length) throw new Error('err_not_allowed');
    if (doc.path) await supabase.storage.from(BUCKET).remove([doc.path]);
    patchResident(tenantId, (r) => ({
      passportDocs: (r.passportDocs ?? []).filter((d) => d.id !== doc.id),
      otherDocs: (r.otherDocs ?? []).filter((d) => d.id !== doc.id),
    }));
  },

  /** Stores a new avatar (e.g. the portrait cut from the passport) and drops the previous file. */
  async setAvatar(tenantId: string, image: Blob): Promise<string> {
    const supabase = db();
    const previous = useEntityStore.getState().residents.find((r) => r.id === tenantId)?.avatarPath;
    const path = `${tenantId}/avatar-${crypto.randomUUID()}.jpg`;
    check(await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' }), 'Upload photo');
    check(await supabase.from('tenants').update({ avatar_path: path }).eq('id', tenantId), 'Save photo');
    if (previous) await supabase.storage.from(BUCKET).remove([previous]);
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_SECONDS);
    const url = signed.data?.signedUrl ?? '';
    patchResident(tenantId, () => ({ avatarUrl: url, avatarPath: path }));
    return url;
  },

  async clearAvatar(tenantId: string): Promise<void> {
    const supabase = db();
    const previous = useEntityStore.getState().residents.find((r) => r.id === tenantId)?.avatarPath;
    check(await supabase.from('tenants').update({ avatar_path: null }).eq('id', tenantId), 'Remove photo');
    if (previous) await supabase.storage.from(BUCKET).remove([previous]);
    patchResident(tenantId, () => ({ avatarUrl: undefined, avatarPath: undefined }));
  },
};
