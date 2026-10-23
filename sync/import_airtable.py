"""Import the Airtable base "Work Hotel" into Supabase (see at_source.py for where records come from).

Usage:
    python sync/import_airtable.py --dry-run     # build and report, write nothing
    python sync/import_airtable.py --sync        # daily: bring Supabase up to date with Airtable
    python sync/import_airtable.py --reset       # first import only: replace everything imported

--sync updates imported rows in place and adds new ones; it never touches what the app created
(payments, documents, floor plans, stays and residents added in Kojeflow). Records gone from
Airtable are retired, not deleted: a stay or booking is cancelled, a bed or room archived.
Airtable is the master during the transition, so a change made in the app to an imported record
is overwritten by the next sync. DATABASE_URL comes from the environment (or ../../db/.env).

Links follow Airtable record ids, so nothing is matched by name. Ids are deterministic (uuid5 of the
record id): re-running on a fresher dump keeps the same ids. Everything loads in one transaction.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

from at_source import load, text

ROOT = Path(__file__).resolve().parent.parent.parent / "db"
NS = uuid.UUID("6f1c2a3e-0b7d-4c55-9a51-2f6d8f0e4b10")

ROOM_TYPE = {"Кімната": "room", "Квартира": "apartment", "Вагончик": "trailer"}
ROOM_STATUS = {"Доступна": "available", "Недоступна": "unavailable"}
ROOM_GENDER = {"Ч": "male", "Ж": "female", "СП": "family"}
PLACE_STATUS = {"Доступне": "available", "Недоступне": "unavailable"}
GENDER = {"Чоловік": "male", "Жінка": "female"}
TENANT_TYPE = {"Внутрішній": "internal", "Комерційний": "commercial", "Біженець": "refugee", "Невідомий": "unknown"}
PRICE_TYPE = {
    "Внутрішня": "internal", "Внутрішній": "internal",
    "Комерційна": "commercial", "Комерційний": "commercial", "Зовнішня": "commercial",
    "Біженець": "refugee",
}
BOOKING_STATUS = {"Новий": "new", "Заселен": "checked_in", "Скасовано": "cancelled"}
REGISTRATION_TYPE = {"Безкоштовна": "free", "Платна": "paid"}
REGISTRATION_STATUS = {"Нова": "new", "Оформлена": "registered", "Завершена": "expired",
                       "Вiдхилена": "rejected", "Відхилена": "rejected"}
TRANSFER_STATUS = {"Передано": "handed_over", "Отримано": "received"}

LEGACY_TABLES = ["Hostels", "Rooms", "Places", "Tenants", "Booking", "Requests", "Residences", "Money transfer"]


def uid(kind, key):
    return str(uuid.uuid5(NS, f"{kind}|{key}"))


def clean(value):
    value = text(value)
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    value = re.sub(r"\s+", " ", value.replace(" ", " ")).strip()
    return value or None


def multiline(value):
    value = text(value)
    if isinstance(value, str):
        return value.strip() or None
    return value


def num(value):
    if isinstance(value, dict) or isinstance(value, bool) or value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def phone(value):
    value = clean(value)
    return value if value and len(re.sub(r"\D", "", value)) >= 6 else None


def first_id(value):
    return value[0]["id"] if isinstance(value, list) and value and isinstance(value[0], dict) else None


class Report(list):
    def __call__(self, msg):
        self.append(msg)
        print(msg)


def build():
    rep = Report()
    out = defaultdict(list)

    # --- properties ---------------------------------------------------------
    prop = {}
    for r in load("Hostels"):
        f = r["fields"]
        row = {
            "id": uid("property", r["id"]),
            "name": clean(f.get("hostel")),
            "legacy_number": f.get("hostel id"),
            "address": clean(f.get("adress")),
            "city": clean(f.get("City")),
            "lat": num(f.get("Lat")),
            "lon": num(f.get("Lon")),
            "commandant_name": clean(f.get("commandant")),
            "commandant_phone": clean(f.get("commandant's phone")),
            "commandant_tg_id": f.get("commandant_tg_id"),
            "is_active": f.get("show") == 1,
            "is_hidden": bool(f.get("hide")),
            "restrict_registrations": bool(f.get("restrict_registrations")),
            "show_registrations": bool(f.get("show_registrations")),
            "registrations_capacity": f.get("MAXnumberOfRegistrations"),
            "is_commercial": bool(f.get("commercial")),
            "map_link": clean(f.get("map_link")),
            "guid": clean(f.get("hostel GUID")),
            "airtable_id": r["id"],
        }
        out["properties"].append(row)
        prop[r["id"]] = row["id"]

    # --- rooms --------------------------------------------------------------
    room, seen = {}, {}
    for r in load("Rooms"):
        f = r["fields"]
        number = f"{f.get('room number')}{clean(f.get('room letter')) or ''}"
        row = {
            "id": uid("room", r["id"]),
            "property_id": prop[first_id(f.get("hostel rel"))],
            "number": number,
            "type": ROOM_TYPE[text(f.get("type"))],
            "status": ROOM_STATUS.get(text(f.get("status")), "available"),
            "gender": ROOM_GENDER.get(clean(f.get("gender"))),
            "is_roof": text(f.get("roof?")) == "Дах",
            "internal_price": num(f.get("internal price")),
            "external_price": num(f.get("external price")),
            "internal_price_month": num(f.get("internal_price_per_month")),
            "external_price_month": num(f.get("external_price_per_month")),
            "airtable_id": r["id"],
        }
        key = (row["property_id"], row["type"], number, row["is_roof"])
        if key in seen:
            sys.exit(f"rooms: {clean(f.get('room'))!r} collides with {seen[key]!r}")
        seen[key] = clean(f.get("room"))
        out["rooms"].append(row)
        room[r["id"]] = row["id"]

    # --- places (duplicate bed numbers fold into the first record) ----------
    place, kept = {}, {}
    for r in sorted(load("Places"), key=lambda r: r["createdTime"] or ""):
        f = r["fields"]
        room_id = room.get(first_id(f.get("Room")))
        if not room_id or not clean(f.get("Place number")):
            rep(f"places: {r['id']} has no room or number, skipped")
            continue
        number = int(clean(f.get("Place number")))
        if (room_id, number) in kept:
            place[r["id"]] = kept[(room_id, number)]
            rep(f"places: duplicate {clean(f.get('Place'))} ({r['id']}) folded into the first record")
            continue
        row = {
            "id": uid("place", r["id"]),
            "room_id": room_id,
            "number": number,
            "status": PLACE_STATUS.get(text(f.get("status")), "available"),
            "internal_price": num(f.get("inernal price")),
            "external_price": num(f.get("external price")),
            "airtable_id": r["id"],
        }
        out["places"].append(row)
        place[r["id"]] = kept[(room_id, number)] = row["id"]

    # --- tenants ------------------------------------------------------------
    tenant = {}
    for r in load("Tenants"):
        f = r["fields"]
        row = {
            "id": uid("tenant", r["id"]),
            "full_name": clean(f.get("name")) or clean(f.get("name_inp")) or f"(no name) {r['id']}",
            "phone": phone(f.get("phone")),
            "gender": GENDER.get(text(f.get("gender"))),
            "birth_date": f.get("birthday"),
            "type": TENANT_TYPE.get(text(f.get("type")), "unknown"),
            "external_id": clean(f.get("id")),
            "passport_number": clean(f.get("passport")),
            "citizenship": clean(f.get("citizenship")),
            "foreign_address": clean(f.get("foreign_address")),
            "project_name": clean(f.get("project")),
            "field_manager_name": clean(f.get("field manager")),
            "job_manager_name": clean(f.get("job manager")),
            "job": clean(f.get("job")),
            "is_blacklisted": bool(f.get("black_list")),
            "blacklist_comment": multiline(f.get("black_list_comment")),
            "source": "airtable",
            "needs_review": False,
            "airtable_id": r["id"],
            "created_at": f.get("created time") or r["createdTime"],
        }
        out["tenants"].append(row)
        tenant[r["id"]] = row["id"]

    name_only = {}

    def tenant_from_name(name, rec_id, price_type, created):
        key = (name or "").lower()
        if key and key in name_only:
            return name_only[key]
        row = {
            "id": uid("tenant-from-booking", rec_id),
            "full_name": name or f"(no name) {rec_id}",
            "phone": None, "gender": None, "birth_date": None,
            "type": {"internal": "internal", "commercial": "commercial", "refugee": "refugee"}.get(price_type, "unknown"),
            "external_id": None, "passport_number": None, "citizenship": None, "foreign_address": None,
            "project_name": None, "field_manager_name": None, "job_manager_name": None, "job": None,
            "is_blacklisted": False, "blacklist_comment": None,
            "source": "airtable_booking", "needs_review": True, "airtable_id": None, "created_at": created,
        }
        out["tenants"].append(row)
        if key:
            name_only[key] = row["id"]
        return row["id"]

    # --- bookings (Requests) ------------------------------------------------
    booking = {}
    for r in load("Requests"):
        f = r["fields"]
        pct = num(f.get("discount_percentage"))
        row = {
            "id": uid("booking", r["id"]),
            "property_id": prop[first_id(f.get("hostel"))],
            "room_id": room.get(first_id(f.get("Book The Entire Room"))),
            "tenant_id": tenant.get(first_id(f.get("tenant"))),
            "payer_tenant_id": tenant.get(first_id(f.get("payer"))),
            "tenant_name": clean(f.get("tenant name")),
            "tenant_phone": clean(f.get("tenant phone")),
            "tenant_gender": GENDER.get(text(f.get("tenant's gender"))),
            "start_date": f.get("start date"),
            "status": BOOKING_STATUS.get(text(f.get("status")), "new"),
            "price_type": PRICE_TYPE.get(clean(f.get("price type"))),
            "discount": num(f.get("discount")),
            "discount_percent": round(pct * 100, 2) if pct is not None else None,
            "booked_places": f.get("booked_places"),
            "is_family": bool(f.get("family")),
            "registration_needed": bool(f.get("registration_needed")),
            "manager_name": clean(f.get("manager")),
            "manager_project": clean(f.get("manager project")),
            "responsible_name": clean(f.get("responsible")),
            "creator_name": clean(f.get("creator")),
            "customer": clean(f.get("customer")),
            "length_of_stay": clean(f.get("length of stay")),
            "children": multiline(f.get("child_text")),
            "note": multiline(f.get("note")),
            "comment": multiline(f.get("comment")),
            "legacy_log": multiline(f.get("Log")),
            "airtable_id": r["id"],
            "created_at": f.get("created") or r["createdTime"],
        }
        out["bookings"].append(row)
        booking[r["id"]] = row["id"]

    # --- stays (Booking) ----------------------------------------------------
    records = load("Booking")
    junk = [r for r in records if not r["fields"].get("start date")]
    rep(f"stays: {len(junk)} rows without a start date skipped "
        f"(with tenant {sum(1 for r in junk if r['fields'].get('tenant'))}, "
        f"with beds {sum(1 for r in junk if r['fields'].get('Places'))})")
    records = [r for r in records if r["fields"].get("start date")]
    stay = {r["id"]: uid("stay", r["id"]) for r in records}

    taken = {}
    # newest active stay keeps a contested bed
    for r in sorted(records, key=lambda r: r["createdTime"] or "", reverse=True):
        f = r["fields"]
        active = f.get("activity status") == "Активнi"
        happened = clean(f.get("what happend?")) or ""
        status = "active" if active else "relocated" if happened.startswith("Переселено") else "checked_out"
        price_type = PRICE_TYPE.get(clean(f.get("price type")))
        notes, review = [multiline(f.get("note"))], False

        tenant_id = tenant.get(first_id(f.get("tenant")))
        if not tenant_id:
            tenant_id = tenant_from_name(clean(f.get("tenant name")), r["id"], price_type, r["createdTime"])
            review = True

        check_in, check_out = f.get("start date"), None if active else f.get("end date")
        if check_out and check_out < check_in:
            notes.append(f"Airtable end date {check_out} is before the start date")
            check_out, review = check_in, True

        beds = []
        for p in f.get("Places") or []:
            pid = place.get(p["id"])
            if not pid:
                continue
            if active and pid in taken:
                notes.append("bed already held by a newer active stay in Airtable")
                review = True
                continue
            if active:
                taken[pid] = stay[r["id"]]
            if pid not in beds:
                beds.append(pid)

        out["stays"].append({
            "id": stay[r["id"]],
            "tenant_id": tenant_id,
            "property_id": prop.get(first_id(f.get("hostel rel"))),
            "booking_id": booking.get(first_id(f.get("Requests"))),
            "payer_tenant_id": tenant.get(first_id(f.get("payer"))),
            "status": status,
            "check_in_date": check_in,
            "original_check_in_date": f.get("original_start_date"),
            "check_out_date": check_out,
            "price_type": price_type,
            "internal_price": num(f.get("price in ")),
            "external_price": num(f.get("price ext")),
            "price_per_day": num(f.get("price per day")),
            "discount": num(f.get("discount")),
            "manager_name": clean(f.get("manger")),
            "responsible_name": clean(f.get("responsible")),
            "project_name": clean(f.get("projectName")),
            "job_manager_name": clean(f.get("jobManager")),
            "customer": clean(f.get("customer")),
            "second_tenant_name": clean(f.get("tenant2 name")),
            "registration_needed": bool(f.get("registration_needed")),
            "note": "\n".join(n for n in notes if n) or None,
            "legacy_log": multiline(f.get("logs")),
            "legacy_paid_total": num(f.get("paid")),
            "legacy_debt": num(f.get("debt")),
            "legacy_overpaid": num(f.get("overpaid")),
            "legacy_payments_count": f.get("numberOfPayments"),
            "needs_review": review,
            "source": "airtable",
            "airtable_id": r["id"],
            "created_at": r["createdTime"],
        })
        for pid in beds:
            out["stay_places"].append({"stay_id": stay[r["id"]], "place_id": pid})
        prev, nxt = stay.get(clean(f.get("prevBookingID"))), stay.get(clean(f.get("relocatedBookingID")))
        if prev or nxt:
            out["stay_links"].append({"id": stay[r["id"]], "prev_stay_id": prev, "relocated_to_stay_id": nxt})

    # --- registrations (Residences) -----------------------------------------
    for r in load("Residences"):
        f = r["fields"]
        out["registrations"].append({
            "id": uid("registration", r["id"]),
            "tenant_id": tenant.get(first_id(f.get("Tenant"))),
            "property_id": prop.get(first_id(f.get("Hostel"))),
            "booking_id": booking.get(first_id(f.get("Requests"))),
            "full_name": clean(f.get("name")) or f"(no name) {r['id']}",
            "type": REGISTRATION_TYPE.get(text(f.get("type"))),
            "status": REGISTRATION_STATUS.get(text(f.get("status")), "new"),
            "purpose": clean(f.get("purpose")),
            "start_date": f.get("start_date"),
            "expiration_date": f.get("expiration_date"),
            "paid_start_date": f.get("paid_residence_start_date"),
            "update_date": f.get("Update_date"),
            "project_name": clean(f.get("project")),
            "creator_name": clean(f.get("creator")),
            "creator_role": clean(f.get("creator_role")),
            "visa_manager_name": clean(f.get("visa_manager_name")),
            "last_status_modified_by": clean(f.get("lastStatusModifyBy")),
            "is_prolonged": bool(f.get("prologated")),
            "is_moved": bool(f.get("moved")),
            "passport_number": clean(f.get("Passport_series/number")),
            "visa_number": clean(f.get("Visa_number")),
            "citizenship": clean(f.get("Citizenship")),
            "origin_address": clean(f.get("Address of residence in the country of origin")),
            "residence_permit_code": clean(f.get("Residence_permit_code")),
            "employer_company": clean(f.get("Employer_company")),
            "employment_period": clean(f.get("Employment_from-to")),
            "hours_for_2_months": num(f.get("hours_for_2month")),
            "files": clean(f.get("files")),
            "file_names": clean(f.get("fileNames")),
            "comment": multiline(f.get("comment")),
            "airtable_id": r["id"],
            "created_at": f.get("created") or r["createdTime"],
        })

    # --- money transfers ----------------------------------------------------
    for r in load("Money transfer"):
        f = r["fields"]
        out["money_transfers"].append({
            "id": uid("transfer", r["id"]),
            "property_id": prop.get(first_id(f.get("Hostels"))),
            "sender_name": clean(f.get("sender")),
            "courier_name": clean(f.get("courier")),
            "receiver_name": clean(f.get("reciever")),
            "amount": num(f.get("sum")) or 0,
            "status": TRANSFER_STATUS.get(text(f.get("status")), "handed_over"),
            "created_via_eworks": bool(f.get("created_via_eWorks")),
            "airtable_id": r["id"],
            "created_at": f.get("created") or r["createdTime"],
        })

    # --- legacy raw rows ----------------------------------------------------
    for table in LEGACY_TABLES:
        for i, r in enumerate(load(table), start=1):
            out["legacy"].append({"source_table": table, "row_no": i, "airtable_id": r["id"],
                                  "data": json.dumps(r["fields"], ensure_ascii=False)})

    active = [s for s in out["stays"] if s["status"] == "active"]
    rep(f"stays by status: {dict(Counter(s['status'] for s in out['stays']))}; "
        f"active on beds {sum(1 for s in active if any(sp['stay_id'] == s['id'] for sp in out['stay_places']))}, "
        f"active without a bed {sum(1 for s in active if not any(sp['stay_id'] == s['id'] for sp in out['stay_places']))}")
    rep(f"occupied beds: {len(taken)}; tenants created from a booking name: {sum(1 for t in out['tenants'] if t['source'] == 'airtable_booking')}")
    rep("totals: " + ", ".join(f"{k} {len(v)}" for k, v in out.items()))
    return out, rep


# ---------------------------------------------------------------------------
# loading
# ---------------------------------------------------------------------------
LOAD_ORDER = ["properties", "rooms", "places", "tenants", "bookings", "stays", "stay_places",
              "registrations", "money_transfers"]
IMPORTED = ["public.stay_places", "public.stays", "public.registrations", "public.bookings",
            "public.money_transfers", "public.tenants", "public.places", "public.rooms", "public.properties",
            "legacy.airtable_rows"]
APP_ONLY = ["public.payments", "public.tenant_documents", "public.floor_zones", "public.floor_plans",
            "public.profile_properties"]


def database_url():
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("DATABASE_URL is not set in .env")


def copy_rows(cur, table, rows):
    if not rows:
        return
    cols = list(rows[0])
    with cur.copy(f"copy {table} ({', '.join(cols)}) from stdin") as cp:
        for row in rows:
            cp.write_row([row[c] for c in cols])


def load_db(out, reset):
    import psycopg

    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        cur.execute("select " + " + ".join(f"(select count(*) from {t})" for t in APP_ONLY))
        app_rows = cur.fetchone()[0]
        cur.execute("select (select count(*) from public.properties) + (select count(*) from public.tenants)")
        imported_rows = cur.fetchone()[0]
        if imported_rows and not reset:
            sys.exit("tables are not empty, rerun with --reset to replace the imported data")
        if reset:
            if app_rows:
                sys.exit("app-only tables (payments, documents, floor plans) already hold data; refusing to reset")
            cur.execute(f"truncate {', '.join(IMPORTED + APP_ONLY)}")

        copy_rows(cur, "legacy.airtable_rows", out["legacy"])
        for name in LOAD_ORDER:
            copy_rows(cur, f"public.{name}", out[name])

        cur.execute("create temp table stay_links (id uuid, prev_stay_id uuid, relocated_to_stay_id uuid) on commit drop")
        copy_rows(cur, "stay_links", out["stay_links"])
        cur.execute("""update public.stays s
                       set prev_stay_id = l.prev_stay_id, relocated_to_stay_id = l.relocated_to_stay_id
                       from stay_links l where l.id = s.id""")
    print("import committed")


# Imported tables whose rows can be updated in place (all keyed by a deterministic id).
UPSERT_ORDER = ["properties", "rooms", "places", "tenants", "bookings", "stays", "registrations", "money_transfers"]
# What happens to an imported row that is gone from Airtable.
RETIRE = {
    "stays": "update public.stays set status = 'cancelled' where status <> 'cancelled' and {gone}",
    "bookings": "update public.bookings set status = 'cancelled' where status <> 'cancelled' and {gone}",
    "places": "update public.places set is_archived = true where not is_archived and {gone}",
    "rooms": "update public.rooms set is_archived = true, status = 'unavailable' where not is_archived and {gone}",
    "registrations": "delete from public.registrations where {gone}",
    "money_transfers": "delete from public.money_transfers where {gone}",
}
# Guards meant for people editing in the app; Airtable's state is taken as it is.
SYNC_TRIGGERS = [("public.stay_places", "stay_places_assert_place_free"),
                 ("public.places", "guard_occupied_place"),
                 ("public.rooms", "guard_occupied_room")]


def upsert(cur, table, rows):
    if not rows:
        return 0
    cols = list(rows[0])
    tmp = f"_sync_{table}"
    cur.execute(f"create temp table {tmp} (like public.{table} including defaults) on commit drop")
    copy_rows(cur, tmp, rows)
    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c != "id")
    cur.execute(f"""insert into public.{table} ({', '.join(cols)})
                    select {', '.join(cols)} from {tmp}
                    on conflict (id) do update set {updates}""")
    return cur.rowcount


def sync_db(out):
    import psycopg

    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        # One transaction of a few minutes: the pooler's per-statement limit would cut the big copies.
        cur.execute("set statement_timeout = 0")
        for table, trigger in SYNC_TRIGGERS:
            cur.execute(f"alter table {table} disable trigger {trigger}")

        cur.execute("truncate legacy.airtable_rows")
        copy_rows(cur, "legacy.airtable_rows", out["legacy"])

        for name in UPSERT_ORDER:
            n = upsert(cur, name, out[name])
            ids = [r["id"] for r in out[name]]
            if name in RETIRE:
                cur.execute(RETIRE[name].format(gone="airtable_id is not null and not (id = any(%s::uuid[]))"), (ids,))
                print(f"{name}: {n} upserted, {cur.rowcount} retired")
            else:
                print(f"{name}: {n} upserted")

        # Beds of imported stays follow Airtable exactly; stays made in the app keep theirs.
        cur.execute("delete from public.stay_places sp using public.stays s where s.id = sp.stay_id and s.airtable_id is not null")
        copy_rows(cur, "public.stay_places", out["stay_places"])

        cur.execute("create temp table stay_links (id uuid, prev_stay_id uuid, relocated_to_stay_id uuid) on commit drop")
        copy_rows(cur, "stay_links", out["stay_links"])
        cur.execute("""update public.stays s
                       set prev_stay_id = l.prev_stay_id, relocated_to_stay_id = l.relocated_to_stay_id
                       from stay_links l where l.id = s.id""")

        for table, trigger in SYNC_TRIGGERS:
            cur.execute(f"alter table {table} enable trigger {trigger}")
    print("sync committed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reset", action="store_true", help="replace previously imported data")
    ap.add_argument("--sync", action="store_true", help="update Supabase from Airtable, keeping the app's own data")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    out, report = build()
    # The report names residents: kept next to the local dump, never in the repository or CI logs.
    if (ROOT / "import").is_dir():
        (ROOT / "import" / "last_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    if args.dry_run:
        return
    if args.sync:
        sync_db(out)
    else:
        load_db(out, args.reset)


if __name__ == "__main__":
    main()
