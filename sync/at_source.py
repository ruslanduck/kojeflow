"""Records of the Airtable base "Work Hotel", for import_airtable.py.

Two sources, same shape:
- the Airtable REST API, when AIRTABLE_TOKEN is set (the daily sync; read-only token with
  data.records:read and schema.bases:read on the base);
  The token can also sit in ../../db/.env as AIRTABLE_TOKEN=... (running the sync by hand);
- otherwise a dump on disk (AIRTABLE_DUMP, default ../../db/airtable_dump): pages saved from the
  Airtable connector plus schema.json — how the first import was done.

load("Booking") -> [{"id": "rec...", "createdTime": "...", "fields": {"start date": ..., ...}}, ...]
Cell values look the way the connector returns them: a link is [{"id", "name"}], a select {"name"}.
"""

import glob
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path

DB = Path(__file__).resolve().parent.parent.parent / "db"


def _env_file_token():
    """AIRTABLE_TOKEN from ../../db/.env, for running the sync by hand on the office machine."""
    env = DB / ".env"
    if not env.is_file():
        return None
    for line in env.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == "AIRTABLE_TOKEN" and value.strip():
            return value.strip().strip('"').strip("'")
    return None


BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appB8CoTWVtmH4hbK")
TOKEN = os.environ.get("AIRTABLE_TOKEN") or _env_file_token()
DUMP = Path(os.environ.get("AIRTABLE_DUMP", DB / "airtable_dump"))
FILE_PREFIX = {"Money transfer": "MoneyTransfer"}
API = "https://api.airtable.com/v0"


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------
def _get(path, params=None):
    url = f"{API}/{path}" + ("?" + urllib.parse.urlencode(params, doseq=True) if params else "")
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                time.sleep(0.22)  # Airtable allows 5 requests a second per base
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 5:
                time.sleep(30 if e.code == 429 else 5)
                continue
            raise


@lru_cache(maxsize=None)
def _meta():
    tables = _get(f"meta/bases/{BASE_ID}/tables")["tables"]
    return {t["name"]: t for t in tables}, {t["id"]: t for t in tables}


def _records(table_id, fields=None):
    params = {"pageSize": 100, "returnFieldsByFieldId": "true"}
    if fields:
        params["fields[]"] = fields
    out, offset = [], None
    while True:
        page = _get(f"{BASE_ID}/{table_id}", {**params, **({"offset": offset} if offset else {})})
        out.extend(page["records"])
        offset = page.get("offset")
        if not offset:
            return out


@lru_cache(maxsize=None)
def _primary_names(table_id):
    """Record id -> the text of its primary field, which is what a link shows as its name."""
    table = _meta()[1][table_id]
    pf = table["primaryFieldId"]
    return {r["id"]: _plain(r["fields"].get(pf)) for r in _records(table_id, [pf])}


def _plain(value):
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v not in (None, ""))
    return value


def _api_load(table_name):
    by_name, _ = _meta()
    table = by_name[table_name]
    fields = {f["id"]: f for f in table["fields"]}
    raw = _records(table["id"])
    out = []
    for r in raw:
        cells = {}
        for fid, value in r["fields"].items():
            f = fields.get(fid)
            ftype = f["type"] if f else None
            if ftype == "multipleRecordLinks":
                names = _primary_names(f["options"]["linkedTableId"])
                value = [{"id": rid, "name": names.get(rid)} for rid in value]
            elif ftype == "singleSelect" and isinstance(value, str):
                value = {"name": value}
            elif ftype == "multipleSelects" and isinstance(value, list):
                value = [{"name": v} for v in value]
            elif ftype == "multipleLookupValues":
                # The connector gives lookups as an object the importer never reads; keep that.
                value = {"linkedRecordIds": [], "valuesByLinkedRecordId": {}}
            cells[f["name"] if f else fid] = value
        out.append({"id": r["id"], "createdTime": r.get("createdTime"), "fields": cells})
    return out


# ---------------------------------------------------------------------------
# dump on disk
# ---------------------------------------------------------------------------
@lru_cache(maxsize=None)
def _dump_schema():
    return {t["name"]: t for t in json.loads((DUMP / "schema.json").read_text(encoding="utf-8"))["tables"]}


def _dump_load(table):
    names = {f["id"]: f["name"] for f in _dump_schema()[table]["fields"]}
    prefix = FILE_PREFIX.get(table, table)
    pages = sorted(glob.glob(str(DUMP / "raw" / f"{prefix}_p*.json")), key=lambda p: int(p.rsplit("_p", 1)[1][:-5]))
    if not pages:
        raise FileNotFoundError(f"no dump pages for {table}")
    records = []
    for page in pages:
        for r in json.loads(Path(page).read_text(encoding="utf-8"))["records"]:
            cells = r.get("cellValuesByFieldId", {})
            records.append({"id": r["id"], "createdTime": r.get("createdTime"),
                            "fields": {names.get(k, k): v for k, v in cells.items()}})
    return records


@lru_cache(maxsize=None)
def load(table):
    return _api_load(table) if TOKEN else _dump_load(table)


def text(value):
    """Flatten Airtable cell values (select objects, lookups, link lists) to plain text."""
    if value is None:
        return None
    if isinstance(value, dict):
        return value.get("name") or value.get("text") or value.get("email") or value.get("id")
    if isinstance(value, list):
        parts = [text(v) for v in value]
        parts = [p for p in parts if p not in (None, "")]
        return ", ".join(str(p) for p in parts) if parts else None
    return value
