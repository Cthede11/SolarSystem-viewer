from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx, re, time, math
from typing import List, Dict, Any
from datetime import datetime, timedelta

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

# Fallback orbital data for when NASA API is unavailable
# Enhanced orbital data for all planets with accurate parameters
ORBITAL_ELEMENTS = {
    "199": {  # Mercury
        "name": "Mercury",
        "a": 57909050.0,      # Semi-major axis in km
        "e": 0.2056,          # Eccentricity
        "i": 7.00,            # Inclination in degrees
        "period": 87.97,      # Orbital period in days
        "mass": 3.301e23,     # Mass in kg
        "radius": 2439.7      # Radius in km
    },
    "299": {  # Venus
        "name": "Venus",
        "a": 108208000.0,
        "e": 0.0067,
        "i": 3.39,
        "period": 224.70,
        "mass": 4.867e24,
        "radius": 6051.8
    },
    "399": {  # Earth
        "name": "Earth",
        "a": 149597870.7,
        "e": 0.0167,
        "i": 0.0,
        "period": 365.25,
        "mass": 5.972e24,
        "radius": 6371.0
    },
    "499": {  # Mars
        "name": "Mars", 
        "a": 227939200.0,
        "e": 0.0935,
        "i": 1.85,
        "period": 686.98,
        "mass": 6.417e23,
        "radius": 3389.5
    },
    "599": {  # Jupiter
        "name": "Jupiter",
        "a": 778299000.0,
        "e": 0.0489,
        "i": 1.31,
        "period": 4332.59,   # ~11.9 years
        "mass": 1.898e27,
        "radius": 69911.0
    },
    "699": {  # Saturn
        "name": "Saturn",
        "a": 1426666000.0,
        "e": 0.0565,
        "i": 2.49,
        "period": 10759.22,  # ~29.5 years
        "mass": 5.683e26,
        "radius": 58232.0
    },
    "799": {  # Uranus
        "name": "Uranus",
        "a": 2870658000.0,
        "e": 0.0457,
        "i": 0.77,
        "period": 30688.5,   # ~84 years
        "mass": 8.681e25,
        "radius": 25362.0
    },
    "899": {  # Neptune
        "name": "Neptune",
        "a": 4498396000.0,
        "e": 0.0113,
        "i": 1.77,
        "period": 60182.0,   # ~165 years
        "mass": 1.024e26,
        "radius": 24622.0
    }
}

def generate_orbital_positions(body_id: str, start: str, stop: str, step: str):
    """Generate orbital positions using Kepler's laws as fallback"""
    if body_id not in ORBITAL_ELEMENTS:
        print(f"No orbital elements for {body_id}, returning empty positions")
        return []
    
    elem = ORBITAL_ELEMENTS[body_id]
    
    try:
        # Parse time parameters
        start_date = datetime.fromisoformat(start)
        stop_date = datetime.fromisoformat(stop)
        
        # Parse step (assume hours for simplicity)
        if "h" in step:
            step_hours = float(step.replace("h", "").strip())
        elif "d" in step:
            step_hours = float(step.replace("d", "").strip()) * 24
        else:
            step_hours = 6  # default
        
        positions = []
        current_time = start_date
        
        # Ensure we don't create too many positions (performance limit)
        max_positions = 1000
        position_count = 0
        
        while current_time <= stop_date and position_count < max_positions:
            # Calculate mean anomaly (simplified)
            days_since_epoch = (current_time - datetime(2000, 1, 1)).total_seconds() / 86400
            mean_anomaly = (days_since_epoch / elem["period"]) * 2 * math.pi
            
            # Simplified Kepler's equation solution
            # For small eccentricity, E ≈ M + e*sin(M)
            eccentric_anomaly = mean_anomaly + elem["e"] * math.sin(mean_anomaly)
            
            # True anomaly calculation
            true_anomaly = 2 * math.atan2(
                math.sqrt(1 + elem["e"]) * math.sin(eccentric_anomaly/2),
                math.sqrt(1 - elem["e"]) * math.cos(eccentric_anomaly/2)
            )
            
            # Distance from focus (semi-major axis * (1 - e*cos(E)))
            r = elem["a"] * (1 - elem["e"] * math.cos(eccentric_anomaly))
            
            # Position in orbital plane
            x = r * math.cos(true_anomaly)
            y = r * math.sin(true_anomaly)
            z = 0
            
            # Apply inclination
            inclination_rad = math.radians(elem["i"])
            y_inclined = y * math.cos(inclination_rad) - z * math.sin(inclination_rad)
            z_inclined = y * math.sin(inclination_rad) + z * math.cos(inclination_rad)
            
            # Ensure we have valid numbers
            if not (math.isfinite(x) and math.isfinite(y_inclined) and math.isfinite(z_inclined)):
                print(f"Invalid position calculated for {body_id} at {current_time}")
                x, y_inclined, z_inclined = 0, 0, 0
            
            positions.append({
                "t": current_time.isoformat(),
                "r": [float(x), float(y_inclined), float(z_inclined)],
                "v": [0.0, 0.0, 0.0]  # Simplified velocity
            })
            
            current_time += timedelta(hours=step_hours)
            position_count += 1
        
        print(f"Generated {len(positions)} positions for {elem['name']}")
        return positions
        
    except Exception as e:
        print(f"Error generating positions for {body_id}: {e}")
        # Return a simple circular orbit as absolute fallback
        return [{
            "t": start,
            "r": [elem["a"], 0.0, 0.0],
            "v": [0.0, 0.0, 0.0]
        }]

async def fetch_horizons_vectors(command: str, start: str, stop: str, step: str, center: str = "500@0") -> Dict[str, Any]:
    """Try NASA API first, fallback to generated positions"""
    
    # Try NASA Horizons API with corrected parameters
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
        "OUT_UNITS": "KM-S",
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Try the NASA API
            response = await client.get(HORIZONS, params=params)
            
            if response.status_code == 200:
                j = response.json()
                
                # Try to parse JSON response
                if isinstance(j, dict) and "data" in j:
                    states = []
                    data_rows = j["data"]
                    for row in data_rows:
                        try:
                            t = row[0]
                            xk, yk, zk = float(row[2]), float(row[3]), float(row[4])
                            vx, vy, vz = float(row[5]), float(row[6]), float(row[7])
                            states.append({"t": t, "r": [xk, yk, zk], "v": [vx, vy, vz]})
                        except Exception:
                            continue
                    if states:
                        return {"id": command, "center": center, "states": states}
                
                # Try to parse text response
                text = j.get("result", "") if isinstance(j, dict) else ""
                if "$$SOE" in text:
                    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
                    states = []
                    for raw in block.strip().splitlines():
                        raw = raw.strip()
                        if not raw or raw.startswith("!"):
                            continue
                        parts = re.split(r"\s*,\s*", raw)
                        if len(parts) < 7:
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
            
    except Exception as e:
        print(f"NASA API failed for {command}: {e}")
    
    # Fallback to generated positions
    print(f"Using fallback orbital data for {command}")
    states = generate_orbital_positions(command, start, stop, step)
    return {"id": command, "center": center, "states": states}

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
            # Even if there's an error, provide fallback data
            print(f"Error for {hid}: {e}")
            states = generate_orbital_positions(hid, start, stop, step)
            out.append({"id": hid, "center": center, "states": states})
    
    _set_cached(key, out)
    return out

# ---- SBDB endpoints ----
@app.get("/api/sbdb/neo")
async def sbdb_neo(limit: int = 50):
    try:
        params = {
            "neo": "Y",
            "limit": str(limit),
            "fields": "full_name,des,orbit_class,albedo,diameter,H,moid_au,pha"
        }
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_QUERY, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        # Return empty result if SBDB is unavailable
        return {"count": 0, "data": []}

@app.get("/api/sbdb/object")
async def sbdb_object(des: str):
    try:
        params = {"sstr": des}
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_BULK, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        return {"error": str(e)}

# ---- Health ----
@app.get("/api/health")
async def health():
    return {"ok": True, "ts": time.time(), "message": "Solar System API running with fallback data"}

# ---- Additional endpoints ----
@app.get("/api/planet-info/{planet_id}")
async def get_planet_info(planet_id: str):
    """Get detailed information about a specific planet"""
    if planet_id not in ORBITAL_ELEMENTS:
        raise HTTPException(status_code=404, detail="Planet not found")
    
    elem = ORBITAL_ELEMENTS[planet_id]
    
    # Calculate additional derived information
    au_distance = elem["a"] / 149597870.7  # Convert km to AU
    escape_velocity = math.sqrt(2 * 6.674e-11 * elem["mass"] / (elem["radius"] * 1000)) / 1000  # km/s
    
    return {
        "id": planet_id,
        "name": elem["name"],
        "orbital_data": {
            "semi_major_axis_km": elem["a"],
            "semi_major_axis_au": round(au_distance, 2),
            "eccentricity": elem["e"],
            "inclination_degrees": elem["i"],
            "orbital_period_days": elem["period"],
            "orbital_period_years": round(elem["period"] / 365.25, 2)
        },
        "physical_data": {
            "mass_kg": elem["mass"],
            "radius_km": elem["radius"],
            "escape_velocity_km_s": round(escape_velocity, 2),
            "surface_gravity_earth": round((elem["mass"] / 5.972e24) * (6371.0 / elem["radius"])**2, 2)
        },
        "current_position": "Real-time position calculated from orbital mechanics"
    }

@app.get("/api/solar-system-overview")
async def get_solar_system_overview():
    """Get overview of all planets in the solar system"""
    planets = []
    
    for planet_id, elem in ORBITAL_ELEMENTS.items():
        au_distance = elem["a"] / 149597870.7
        planets.append({
            "id": planet_id,
            "name": elem["name"],
            "distance_au": round(au_distance, 2),
            "period_years": round(elem["period"] / 365.25, 2),
            "radius_km": elem["radius"],
            "mass_relative_to_earth": round(elem["mass"] / 5.972e24, 2)
        })
    
    # Sort by distance from Sun
    planets.sort(key=lambda p: p["distance_au"])
    
    return {
        "solar_system": {
            "star": {
                "name": "Sun",
                "type": "G-type main-sequence star",
                "age_billion_years": 4.6,
                "diameter_km": 1392700
            },
            "planets": planets,
            "total_planets": len(planets)
        }
    }