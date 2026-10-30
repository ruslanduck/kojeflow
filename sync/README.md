# Airtable → Supabase sync

One-way, while the team still works in Airtable: Airtable is the master, Supabase follows.

- **When:** every night at 02:00 UTC (`.github/workflows/airtable-sync.yml` on `main`, which runs
  the code from `dev`), or by hand: Actions → Airtable sync → Run workflow. A run takes ~10 min.
- **What it does:** imported rows are updated in place and new ones added; rows gone from Airtable
  are retired (stays/bookings cancelled, beds/rooms archived, registrations/transfers deleted).
  Data created in the app (payments, documents, floor plans, its own stays and residents) is never
  touched. An edit made in the app to an imported record is overwritten by the next run.
- **Secrets** (Settings → Secrets and variables → Actions):
  - `AIRTABLE_TOKEN` – personal access token, scopes `data.records:read` + `schema.bases:read`,
    access to the "Work Hotel" base only;
  - `DATABASE_URL` – Supabase connection string, **Session pooler** (GitHub runners have no IPv6).

## Running it locally

```bash
python sync/import_airtable.py --dry-run   # read Airtable, build everything, write nothing
python sync/import_airtable.py --sync      # bring Supabase up to date
```

`AIRTABLE_TOKEN` and `DATABASE_URL` come from the environment or from `../../db/.env`. Needs
`psycopg[binary]`.

## When a run fails

Open the run → `sync` → the `Sync` step and read the last lines:

- `Airtable answered 401/403` – the token is wrong, expired, or lacks scopes / base access;
- `AIRTABLE_TOKEN is not set` – the secret is missing or misnamed;
- a connection error from psycopg – check `DATABASE_URL` (must be the Session pooler string).
