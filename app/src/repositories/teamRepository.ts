import { check, db } from '@/lib/supabase/write';
import { ROLE_BY_DB } from '@/lib/supabase/snapshot';
import type { RoleName } from '@/domain/roles';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  active: boolean;
  /** Properties a house manager or client is limited to. */
  propertyIds: string[];
}

const ROLE_DB = Object.fromEntries(Object.entries(ROLE_BY_DB).map(([db, ui]) => [ui, db])) as Record<RoleName, string>;

/** The team as admins see it: every profile with its role, access and assigned properties. */
export const teamRepository = {
  async list(): Promise<TeamMember[]> {
    const supabase = db();
    const [profiles, links] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, is_active').order('full_name'),
      supabase.from('profile_properties').select('profile_id, property_id'),
    ]);
    const rows = check(profiles, 'Load team');
    const pairs = check(links, 'Load team');
    return rows.map((p) => ({
      id: p.id,
      name: p.full_name ?? '',
      email: p.email ?? '',
      role: ROLE_BY_DB[p.role] ?? 'Client',
      active: p.is_active,
      propertyIds: pairs.filter((l) => l.profile_id === p.id).map((l) => l.property_id),
    }));
  },

  async save(member: TeamMember): Promise<void> {
    const { error } = await db().rpc('admin_set_profile', {
      p_profile: member.id,
      p_role: ROLE_DB[member.role],
      p_active: member.active,
      p_property_ids: member.propertyIds,
    });
    if (error) throw new Error(error.message);
  },
};
