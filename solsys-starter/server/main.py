from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx, re, time
from typing import List, Dict, Any

app = FastAPI(title="Solar System Viewer API", version="0.1.1")

# Allow local dev clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HORIZONS = "https://ssd-api.jpl.nasa.gov/horizons.api"
SBDB_QUERY = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
SBDB_BULK = "https://ssd-api.jpl.nasa.gov/sbdb.api"

CACHE_TTL = 6 * 3600  # 6 hours
_cache: Dict[str, Dict[str, Any]] = {}

def _k(key: Any) -> str:
    return str(key)

def _get_cached(key: Any):
    skey = _k(key)
    v = _cache.get(skey)
    if v and time.time() - v["t"] < CACHE_TTL:
        return v["data"]
    return None

def _set_cached(key: Any, data: Any):
    _cache[_k(key)] = {"t": time.time(), "data": data}

# --- Horizons helpers ---

# When CSV_FORMAT=YES, rows look like:
#  "2025-Aug-21 00:00:00.0000, 1.234E+08, 2.345E+07, -9.876E+06, -12.34, 23.45, 0.67, ..."
# We only need datetime, x,y,z, vx,vy,vz  (first 7 CSV fields)
CSV_SPLIT = re.compile(r"\s*,\s*")

async def fetch_horizons_vectors(command: str, start: str, stop: str, step: str, center: str = "500@0") -> Dict[str, Any]:
    # Force CSV output so we can reliably parse from the text block as a fallback.
    params = {
        "format": "json",
        "COMMAND": command,
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "OBJ_DATA": "NO",
        "CENTER": center,
        "START_TIME": start,
        "STOP_TIME": stop,
        "STEP_SIZE": step,
        "CSV_FORMAT": "YES",
        "OUT_UNITS": "KM-S",   # kilometers & km/s
    }
    async with httpx.AsyncClient(timeout=90) as x:
        r = await x.get(HORIZONS, params=params)
        r.raise_for_status()
        j = r.json()

    # Try JSON 'data' first if present
    if isinstance(j, dict) and "data" in j:
        states = []
        data_rows = j["data"]
        # Some responses include a "fields" key; indexes are consistent: 0=datetime, 2..4=xyz, 5..7=vxvyvz
        for row in data_rows:
            try:
                t = row[0]
                xk, yk, zk = float(row[2]), float(row[3]), float(row[4])
                vx, vy, vz = float(row[5]), float(row[6]), float(row[7])
                states.append({"t": t, "r": [xk, yk, zk], "v": [vx, vy, vz]})
            except Exception:
                # Skip malformed rows
                continue
        if states:
            return {"id": command, "center": center, "states": states}

    # Fallback: parse classic text in 'result' between $$SOE/$$EOE
    text = j.get("result", "") if isinstance(j, dict) else ""
    if "$$SOE" in text:
        block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
        states = []
        for raw in block.strip().splitlines():
            raw = raw.strip()
            if not raw or raw.startswith("!"):
                continue
            parts = CSV_SPLIT.split(raw)
            if len(parts) < 7:
                # Not a data row we care about
                continue
            try:
                t = parts[0]
                xk, yk, zk = float(parts[1]), float(parts[2]), float(parts[3])
                vx, vy, vz = float(parts[4]), float(parts[5]), float(parts[6])
                states.append({"t": t, "r": [xk, yk, zk], "v": [vx, vy, vz]})
            except Exception:
                continue
        if states:
            return {"id": command, "center": center, "states": states}

    # If we got here, we couldn't parse anything useful
    raise HTTPException(status_code=502, detail="Horizons returned no vector data (check params or service status).")

@app.get("/api/ephem")
async def ephem(
    horizons_ids: str = Query(..., description="Comma-separated Horizons COMMAND ids, e.g., '399,499'"),
    start: str = Query(..., description="START_TIME, e.g., '2025-08-20'"),
    stop: str = Query(..., description="STOP_TIME, e.g., '2025-08-27'"),
    step: str = Query("6 h", description="STEP_SIZE, e.g., '6 h'"),
    center: str = Query("500@0", description="CENTER, default Sun barycenter (500@0)"),
):
    key = ("ephem", horizons_ids, start, stop, step, center)
    if (c := _get_cached(key)) is not None:
        return c

    ids = [s.strip() for s in horizons_ids.split(",") if s.strip()]
    out = []
    for hid in ids:
        try:
            res = await fetch_horizons_vectors(hid, start, stop, step, center=center)
            out.append(res)
        except Exception as e:
            # Partial failure shouldn't block all; return what we have + error field
            out.append({"id": hid, "error": str(e), "states": []})
    _set_cached(key, out)
    return out

# ---- SBDB endpoints ----
@app.get("/api/sbdb/neo")
async def sbdb_neo(limit: int = 50):
    params = {
        "neo": "Y",
        "limit": str(limit),
        "fields": "full_name,des,orbit_class,albedo,diameter,H,moid_au,pha"
    }
    async with httpx.AsyncClient(timeout=60) as x:
        r = await x.get(SBDB_QUERY, params=params)
        r.raise_for_status()
        return r.json()

@app.get("/api/sbdb/object")
async def sbdb_object(des: str):
    params = {"sstr": des}
    async with httpx.AsyncClient(timeout=60) as x:
        r = await x.get(SBDB_BULK, params=params)
        r.raise_for_status()
        return r.json()

# ---- Health ----
@app.get("/api/health")
async def health():
    return {"ok": True, "ts": time.time()}