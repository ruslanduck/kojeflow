/**
 * Public project settings. Both values ship to the browser by design — data is guarded
 * by Row Level Security, not by keeping these secret — so the project defaults live here
 * and the environment only overrides them (e.g. for a staging project).
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jqrautsnakleaduzhvnv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_G_vAJUOkM3xViTMrx8UYZg_e6KG6tOB';
