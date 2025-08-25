from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx, re, time, math
from typing import List, Dict, Any
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables for API keys
load_dotenv()

app = FastAPI(title="Solar System Viewer API", version="0.2.0")

# Allow local dev clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NASA API endpoints
HORIZONS = "https://ssd-api.jpl.nasa.gov/horizons.api"
SBDB_QUERY = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
SBDB_BULK = "https://ssd-api.jpl.nasa.gov/sbdb.api"
APOD_API = "https://api.nasa.gov/planetary/apod"
EXOPLANET_API = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
MARS_ROVER_API = "https://api.nasa.gov/mars-photos/api/v1"
SPACE_WEATHER_API = "https://api.nasa.gov/DONKI/WS"
ASTEROID_WATCH_API = "https://api.nasa.gov/neo/rest/v1"

# API Keys
NASA_API_KEY = os.getenv("NASA_API_KEY", "DEMO_KEY")  # Get from https://api.nasa.gov/
EXOPLANET_API_KEY = os.getenv("EXOPLANET_API_KEY", "")

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

# Comprehensive celestial object database with accurate orbital and physical parameters
CELESTIAL_OBJECTS = {
    # Sun
    "10": {
        "name": "Sun",
        "type": "star",
        "a": 0.0,  # Sun is at center
        "e": 0.0,
        "i": 0.0,
        "period": 0.0,
        "mass": 1.989e30,  # kg
        "radius": 696340.0,  # km
        "texture": "sun_texture",
        "color": 0xffd27d,
        "atmosphere": False,
        "rings": False
    },
    
    # Mercury
    "199": {
        "name": "Mercury",
        "type": "planet",
        "a": 57909050.0,  # km
        "e": 0.2056,
        "i": 7.00,
        "period": 87.97,
        "mass": 3.301e23,
        "radius": 2439.7,
        "texture": "mercury_texture",
        "color": 0x8c7853,
        "atmosphere": False,
        "rings": False,
        "moons": []
    },
    
    # Venus
    "299": {
        "name": "Venus",
        "type": "planet",
        "a": 108208000.0,
        "e": 0.0067,
        "i": 3.39,
        "period": 224.70,
        "mass": 4.867e24,
        "radius": 6051.8,
        "texture": "venus_texture",
        "color": 0xffcc33,
        "atmosphere": True,
        "rings": False,
        "moons": []
    },
    
    # Earth
    "399": {
        "name": "Earth",
        "type": "planet",
        "a": 149597870.7,
        "e": 0.0167,
        "i": 0.0,
        "period": 365.25,
        "mass": 5.972e24,
        "radius": 6371.0,
        "texture": "earth_texture",
        "color": 0x6ec6ff,
        "atmosphere": True,
        "rings": False,
        "moons": ["301"]  # Moon
    },
    
    # Moon
    "301": {
        "name": "Moon",
        "type": "moon",
        "parent": "399",
        "a": 384400.0,  # km from Earth
        "e": 0.0549,
        "i": 5.145,
        "period": 27.32,
        "mass": 7.342e22,
        "radius": 1737.4,
        "texture": "moon_texture",
        "color": 0xcccccc,
        "atmosphere": False,
        "rings": False
    },
    
    # Mars
    "499": {
        "name": "Mars",
        "type": "planet",
        "a": 227939200.0,
        "e": 0.0935,
        "i": 1.85,
        "period": 686.98,
        "mass": 6.417e23,
        "radius": 3389.5,
        "texture": "mars_texture",
        "color": 0xff785a,
        "atmosphere": True,
        "rings": False,
        "moons": ["401", "402"]  # Phobos, Deimos
    },
    
    # Phobos
    "401": {
        "name": "Phobos",
        "type": "moon",
        "parent": "499",
        "a": 421800.0,
        "e": 0.0151,
        "i": 1.075,
        "period": 0.3189,
        "mass": 1.0659e16,
        "radius": 11.267,
        "texture": "phobos_texture",
        "color": 0xcccccc,
        "atmosphere": False,
        "rings": False
    },
    
    # Deimos
    "402": {
        "name": "Deimos",
        "type": "moon",
        "parent": "499",
        "a": 23463.0,
        "e": 0.0002,
        "i": 0.93,
        "period": 1.2624,
        "mass": 1.4762e15,
        "radius": 6.2,
        "texture": "deimos_texture",
        "color": 0x888888,
        "atmosphere": False,
        "rings": False
    },
    
    # Jupiter
    "599": {
        "name": "Jupiter",
        "type": "planet",
        "a": 778299000.0,
        "e": 0.0489,
        "i": 1.31,
        "period": 4332.59,
        "mass": 1.898e27,
        "radius": 69911.0,
        "texture": "jupiter_texture",
        "color": 0xd8ca9d,
        "atmosphere": True,
        "rings": False,
        "moons": ["501", "502", "503", "504"]  # Galilean moons
    },
    
    # Io
    "501": {
        "name": "Io",
        "type": "moon",
        "parent": "599",
        "a": 421800.0,
        "e": 0.0041,
        "i": 0.036,
        "period": 1.7691,
        "mass": 8.932e22,
        "radius": 1821.6,
        "texture": "io_texture",
        "color": 0xffaa44,
        "atmosphere": False,
        "rings": False
    },
    
    # Europa
    "502": {
        "name": "Europa",
        "type": "moon",
        "parent": "599",
        "a": 671100.0,
        "e": 0.0094,
        "i": 0.466,
        "period": 3.5512,
        "mass": 4.800e22,
        "radius": 1560.8,
        "texture": "europa_texture",
        "color": 0xffffff,
        "atmosphere": False,
        "rings": False
    },
    
    # Ganymede
    "503": {
        "name": "Ganymede",
        "type": "moon",
        "parent": "599",
        "a": 1070400.0,
        "e": 0.0013,
        "i": 0.177,
        "period": 7.1546,
        "mass": 1.482e23,
        "radius": 1560.8,
        "texture": "ganymede_texture",
        "color": 0xcccccc,
        "atmosphere": False,
        "rings": False
    },
    
    # Callisto
    "504": {
        "name": "Callisto",
        "type": "moon",
        "parent": "599",
        "a": 1882700.0,
        "e": 0.0074,
        "i": 0.192,
        "period": 16.6890,
        "mass": 1.076e23,
        "radius": 2410.3,
        "texture": "callisto_texture",
        "color": 0x999999,
        "atmosphere": False,
        "rings": False
    },
    
    # Saturn
    "699": {
        "name": "Saturn",
        "type": "planet",
        "a": 1426666000.0,
        "e": 0.0565,
        "i": 2.49,
        "period": 10759.22,
        "mass": 5.683e26,
        "radius": 58232.0,
        "texture": "saturn_texture",
        "color": 0xfad5a5,
        "atmosphere": True,
        "rings": True,
        "moons": ["601", "602", "603", "604", "605", "606", "607", "608"]  # Major moons
    },
    
    # Titan
    "601": {
        "name": "Titan",
        "type": "moon",
        "parent": "699",
        "a": 1221870.0,
        "e": 0.0288,
        "i": 0.348,
        "period": 15.9454,
        "mass": 1.3452e23,
        "radius": 2574.7,
        "texture": "titan_texture",
        "color": 0xffaa44,
        "atmosphere": True,
        "rings": False
    },
    
    # Enceladus
    "602": {
        "name": "Enceladus",
        "type": "moon",
        "parent": "699",
        "a": 238020.0,
        "e": 0.0047,
        "i": 0.009,
        "period": 1.3702,
        "mass": 1.08e20,
        "radius": 252.1,
        "texture": "enceladus_texture",
        "color": 0xffffff,
        "atmosphere": False,
        "rings": False
    },
    
    # Uranus
    "799": {
        "name": "Uranus",
        "type": "planet",
        "a": 2870658000.0,
        "e": 0.0457,
        "i": 0.77,
        "period": 30688.5,
        "mass": 8.681e25,
        "radius": 25362.0,
        "texture": "uranus_texture",
        "color": 0x4fd0e4,
        "atmosphere": True,
        "rings": True,
        "moons": ["701", "702", "703", "704", "705"]  # Major moons
    },
    
    # Neptune
    "899": {
        "name": "Neptune",
        "type": "planet",
        "a": 4498396000.0,
        "e": 0.0113,
        "i": 1.77,
        "period": 60182.0,
        "mass": 1.024e26,
        "radius": 24622.0,
        "texture": "neptune_texture",
        "color": 0x4b70dd,
        "atmosphere": True,
        "rings": True,
        "moons": ["801"]  # Triton
    },
    
    # Triton
    "801": {
        "name": "Triton",
        "type": "moon",
        "parent": "899",
        "a": 354759.0,
        "e": 0.000016,
        "i": 156.885,
        "period": -5.8769,  # Negative for retrograde
        "mass": 1.4762e15,
        "radius": 1353.4,
        "texture": "triton_texture",
        "color": 0xffffff,
        "atmosphere": False,
        "rings": False
    },
    
    # Pluto (Dwarf Planet)
    "999": {
        "name": "Pluto",
        "type": "dwarf_planet",
        "a": 5906440628.0,
        "e": 0.2488,
        "i": 17.16,
        "period": 90520.0,
        "mass": 1.303e22,
        "radius": 1188.3,
        "texture": "pluto_texture",
        "color": 0xccaa88,
        "atmosphere": False,
        "rings": False,
        "moons": ["901"]  # Charon
    },
    
    # Charon
    "901": {
        "name": "Charon",
        "type": "moon",
        "parent": "999",
        "a": 19591.0,
        "e": 0.0002,
        "i": 0.080,
        "period": 6.3872,
        "mass": 1.586e21,
        "radius": 606.0,
        "texture": "charon_texture",
        "color": 0x999999,
        "atmosphere": False,
        "rings": False
    }
}

# Legacy support - keep ORBITAL_ELEMENTS for backward compatibility
ORBITAL_ELEMENTS = {k: {key: v[key] for key in ['name', 'a', 'e', 'i', 'period', 'mass', 'radius']} 
                    for k, v in CELESTIAL_OBJECTS.items() if v['type'] in ['planet', 'dwarf_planet']}

# High-resolution NASA texture URLs for realistic imagery
NASA_TEXTURES = {
    '10': 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg',  # Sun
    '199': 'https://images-assets.nasa.gov/image/PIA11245/PIA11245~orig.jpg',  # Mercury
    '299': 'https://images-assets.nasa.gov/image/PIA00271/PIA00271~orig.jpg',  # Venus
    '399': 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001362/GSFC_20171208_Archive_e001362~orig.jpg',  # Earth
    '301': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Moon
    '499': 'https://images-assets.nasa.gov/image/PIA03278/PIA03278~orig.jpg',  # Mars
    '401': 'https://images-assets.nasa.gov/image/PIA10368/PIA10368~orig.jpg',  # Phobos
    '402': 'https://images-assets.nasa.gov/image/PIA10369/PIA10369~orig.jpg',  # Deimos
    '599': 'https://images-assets.nasa.gov/image/PIA07782/PIA07782~orig.jpg',  # Jupiter
    '501': 'https://images-assets.nasa.gov/image/PIA00378/PIA00378~orig.jpg',  # Io
    '502': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Europa
    '503': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Ganymede
    '504': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Callisto
    '699': 'https://images-assets.nasa.gov/image/PIA11141/PIA11141~orig.jpg',  # Saturn
    '601': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Titan
    '602': 'https://images-assets.nasa.gov/image/PIA07752/PIA07752~orig.jpg',  # Enceladus
    '799': 'https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg',  # Uranus
    '899': 'https://images-assets.nasa.gov/image/PIA01492/PIA01492~orig.jpg',  # Neptune
    '801': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Triton
    '999': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg',  # Pluto
    '901': 'https://images-assets.nasa.gov/image/PIA00342/PIA00342~orig.jpg'   # Charon
}

def generate_orbital_positions(body_id: str, start: str, stop: str, step: str):
    """Generate orbital positions using Kepler's laws as fallback"""
    if body_id not in CELESTIAL_OBJECTS:
        print(f"No orbital elements for {body_id}, returning empty positions")
        return []
    
    obj = CELESTIAL_OBJECTS[body_id]
    
    # Handle moons - they orbit around their parent planet
    if obj['type'] == 'moon':
        parent_id = obj['parent']
        if parent_id not in CELESTIAL_OBJECTS:
            print(f"Parent {parent_id} not found for moon {body_id}")
            return []
        
        # Generate parent planet positions first
        parent_positions = generate_orbital_positions(parent_id, start, stop, step)
        if not parent_positions:
            return []
        
        # Generate moon positions relative to parent
        return generate_moon_positions(obj, parent_positions, start, stop, step)
    
    # Handle planets and other objects
    if obj['type'] not in ['planet', 'dwarf_planet', 'star']:
        print(f"Unsupported object type: {obj['type']}")
        return []
    
    elem = obj
    
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
            
            # Enhanced Kepler's equation solution with iterative refinement
            eccentric_anomaly = mean_anomaly
            for _ in range(5):  # 5 iterations for convergence
                eccentric_anomaly = mean_anomaly + elem["e"] * math.sin(eccentric_anomaly)
            
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
            
            # Calculate velocity components for more accurate simulation
            mu = 1.32712440018e11  # Sun's gravitational parameter (km³/s²)
            v_r = math.sqrt(mu / elem["a"]) * elem["e"] * math.sin(true_anomaly)
            v_t = math.sqrt(mu / elem["a"]) * (1 + elem["e"] * math.cos(true_anomaly))
            
            # Ensure we have valid numbers
            if not (math.isfinite(x) and math.isfinite(y_inclined) and math.isfinite(z_inclined)):
                print(f"Invalid position calculated for {body_id} at {current_time}")
                x, y_inclined, z_inclined = 0, 0, 0
            
            positions.append({
                "t": current_time.isoformat(),
                "r": [float(x), float(y_inclined), float(z_inclined)],
                "v": [float(v_r), float(v_t), 0.0]  # Enhanced velocity
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

def generate_moon_positions(moon_obj: dict, parent_positions: list, start: str, stop: str, step: str):
    """Generate moon positions relative to their parent planet"""
    try:
        start_date = datetime.fromisoformat(start)
        stop_date = datetime.fromisoformat(stop)
        
        # Parse step
        if "h" in step:
            step_hours = float(step.replace("h", "").strip())
        elif "d" in step:
            step_hours = float(step.replace("d", "").strip()) * 24
        else:
            step_hours = 6
        
        positions = []
        current_time = start_date
        max_positions = 1000
        position_count = 0
        
        while current_time <= stop_date and position_count < max_positions:
            # Calculate moon's orbital position relative to parent
            days_since_epoch = (current_time - datetime(2000, 1, 1)).total_seconds() / 86400
            mean_anomaly = (days_since_epoch / moon_obj["period"]) * 2 * math.pi
            
            # Enhanced Kepler's equation solution
            eccentric_anomaly = mean_anomaly
            for _ in range(5):
                eccentric_anomaly = mean_anomaly + moon_obj["e"] * math.sin(eccentric_anomaly)
            
            # True anomaly
            true_anomaly = 2 * math.atan2(
                math.sqrt(1 + moon_obj["e"]) * math.sin(eccentric_anomaly/2),
                math.sqrt(1 - moon_obj["e"]) * math.cos(eccentric_anomaly/2)
            )
            
            # Moon's distance from parent
            r_moon = moon_obj["a"] * (1 - moon_obj["e"] * math.cos(eccentric_anomaly))
            
            # Moon position in orbital plane
            x_moon = r_moon * math.cos(true_anomaly)
            y_moon = r_moon * math.sin(true_anomaly)
            z_moon = 0
            
            # Apply inclination
            inclination_rad = math.radians(moon_obj["i"])
            y_moon_inclined = y_moon * math.cos(inclination_rad) - z_moon * math.sin(inclination_rad)
            z_moon_inclined = y_moon * math.sin(inclination_rad) + z_moon * math.cos(inclination_rad)
            
            # Find corresponding parent position
            parent_pos = None
            for pos in parent_positions:
                if pos["t"] == current_time.isoformat():
                    parent_pos = pos
                    break
            
            if parent_pos:
                # Add moon position to parent position
                final_x = parent_pos["r"][0] + x_moon
                final_y = parent_pos["r"][1] + y_moon_inclined
                final_z = parent_pos["r"][2] + z_moon_inclined
                
                positions.append({
                    "t": current_time.isoformat(),
                    "r": [float(final_x), float(final_y), float(final_z)],
                    "v": [0.0, 0.0, 0.0]  # Simplified for moons
                })
            
            current_time += timedelta(hours=step_hours)
            position_count += 1
        
        print(f"Generated {len(positions)} moon positions for {moon_obj['name']}")
        return positions
        
    except Exception as e:
        print(f"Error generating moon positions for {moon_obj['name']}: {e}")
        return []

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

# ---- Health Check ----
@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ---- Core Ephemeris Endpoint ----
@app.get("/api/ephem")
async def ephem(
    horizons_ids: str = Query(..., description="Comma-separated Horizons COMMAND ids, e.g., '399,499'"),
    start: str = Query(..., description="START_TIME, e.g., '2025-08-20'"),
    stop: str = Query(..., description="STOP_TIME, e.g., '2025-08-27'"),
    step: str = Query("6 h", description="STEP_SIZE, e.g., '6 h'"),
    center: str = Query("500@0", description="CENTER, default Sun barycenter (500@0)"),
    include_moons: bool = Query(True, description="Include moons for planets"),
):
    key = ("ephem", horizons_ids, start, stop, step, center, include_moons)
    if (c := _get_cached(key)) is not None:
        return c

    ids = [s.strip() for s in horizons_ids.split(",") if s.strip()]
    # Ensure the Sun (10) is always included and first for center reference
    if "10" not in ids:
        ids = ["10", *ids]
    
    # Expand to include moons if requested
    expanded_ids = ids.copy()
    if include_moons:
        for obj_id in ids:
            if obj_id in CELESTIAL_OBJECTS and CELESTIAL_OBJECTS[obj_id]['type'] == 'planet':
                moons = CELESTIAL_OBJECTS[obj_id].get('moons', [])
                expanded_ids.extend(moons)
    
    out = []
    for hid in expanded_ids:
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
async def sbdb_neo(limit: int = 100):
    """Get Near-Earth Objects with enhanced data"""
    try:
        params = {
            "query": "neo=Y",
            "limit": str(limit),
            "fields": "full_name,des,orbit_class,albedo,diameter,H,moid_au,pha,period_yr,semimajor_au,eccentricity,inclination,arg_perihelion,long_asc_node,mean_anomaly,epoch_mjd"
        }
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_QUERY, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                # Return fallback data instead of crashing
                return {
                    "count": 0,
                    "data": [],
                    "error": f"SBDB API returned {r.status_code}: {r.text[:200]}"
                }
    except Exception as e:
        # Return fallback data instead of crashing
        return {
            "count": 0,
            "data": [],
            "error": f"Failed to fetch NEO data: {str(e)}"
        }

@app.get("/api/sbdb/comets")
async def sbdb_comets(limit: int = 50):
    """Get comet data"""
    try:
        params = {
            "query": "comet=Y",
            "limit": str(limit),
            "fields": "full_name,des,orbit_class,albedo,diameter,H,period_yr,semimajor_au,eccentricity,inclination,arg_perihelion,long_asc_node,mean_anomaly,epoch_mjd"
        }
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_QUERY, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                # Return fallback data instead of crashing
                return {
                    "count": 0,
                    "data": [],
                    "error": f"SBDB API returned {r.status_code}: {r.text[:200]}"
                }
    except Exception as e:
        # Return fallback data instead of crashing
        return {
            "count": 0,
            "data": [],
            "error": f"Failed to fetch comet data: {str(e)}"
        }

@app.get("/api/sbdb/asteroids")
async def sbdb_asteroids(limit: int = 100):
    """Get main belt asteroid data"""
    try:
        params = {
            "query": "asteroid=Y",
            "limit": str(limit),
            "fields": "full_name,des,orbit_class,albedo,diameter,H,period_yr,semimajor_au,eccentricity,inclination,arg_perihelion,long_asc_node,mean_anomaly,epoch_mjd"
        }
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_QUERY, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                # Return fallback data instead of crashing
                return {
                    "count": 0,
                    "data": [],
                    "error": f"SBDB API returned {r.status_code}: {r.text[:200]}"
                }
    except Exception as e:
        # Return fallback data instead of crashing
        return {
            "count": 0,
            "data": [],
            "error": f"Failed to fetch asteroid data: {str(e)}"
        }

@app.get("/api/sbdb/object")
async def sbdb_object(des: str):
    """Get detailed information about a specific object"""
    try:
        params = {"sstr": des}
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(SBDB_BULK, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        return {"error": str(e)}

# ---- NASA APOD (Astronomy Picture of the Day) ----
@app.get("/api/nasa/apod")
async def nasa_apod(date: str = None, count: int = 1):
    """Get Astronomy Picture of the Day"""
    try:
        params = {"api_key": NASA_API_KEY}
        if date:
            params["date"] = date
        if count > 1:
            params["count"] = count
        
        async with httpx.AsyncClient(timeout=30) as x:
            r = await x.get(APOD_API, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                return {"error": f"APOD API returned {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"error": f"Failed to fetch APOD data: {str(e)}"}

# ---- Exoplanet Data ----
@app.get("/api/nasa/exoplanets")
async def nasa_exoplanets(limit: int = 100):
    """Get exoplanet data from NASA Exoplanet Archive"""
    try:
        query = """
        SELECT TOP {} 
            pl_name, hostname, pl_orbper, pl_rade, pl_masse, pl_dens, 
            pl_eqt, pl_orbincl, pl_orbeccen, pl_orbsmax, 
            st_teff, st_rad, st_mass, st_dist, st_met, st_age
        FROM ps 
        WHERE pl_rade IS NOT NULL 
        ORDER BY pl_rade DESC
        """.format(limit)
        
        params = {"query": query, "format": "json"}
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(EXOPLANET_API, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                return {"error": f"Exoplanet API returned {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"error": f"Failed to fetch exoplanet data: {str(e)}"}

# ---- Mars Rover Photos ----
@app.get("/api/nasa/mars-rover")
async def nasa_mars_rover(rover: str = "curiosity", sol: int = None, earth_date: str = None, camera: str = None):
    """Get Mars rover photos"""
    try:
        endpoint = f"{MARS_ROVER_API}/rovers/{rover}/photos"
        params = {"api_key": NASA_API_KEY}
        
        if sol is not None:
            params["sol"] = sol
        elif earth_date:
            params["earth_date"] = earth_date
        else:
            # Default to latest available sol
            params["sol"] = 1000
        
        if camera:
            params["camera"] = camera
        
        async with httpx.AsyncClient(timeout=60) as x:
            r = await x.get(endpoint, params=params)
            if r.status_code == 200:
                return r.json()
            else:
                return {"error": f"Mars Rover API returned {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"error": f"Failed to fetch Mars rover data: {str(e)}"}

# ---- Space Weather and Solar Activity ----
@app.get("/api/nasa/space-weather")
async def nasa_space_weather():
    """Get space weather data including solar flares"""
    endpoints = {
        "flr": f"{SPACE_WEATHER_API}/FLR",
        "sep": f"{SPACE_WEATHER_API}/SEP", 
        "cme": f"{SPACE_WEATHER_API}/CME",
        "gst": f"{SPACE_WEATHER_API}/GST"
    }
    
    results = {}
    async with httpx.AsyncClient(timeout=60) as x:
        for event_type, url in endpoints.items():
            try:
                params = {"api_key": NASA_API_KEY, "startDate": "2024-01-01", "endDate": datetime.now().strftime("%Y-%m-%d")}
                r = await x.get(url, params=params)
                if r.status_code == 200:
                    results[event_type] = r.json()
                else:
                    results[event_type] = {"error": f"Status {r.status_code}"}
            except Exception as e:
                results[event_type] = {"error": str(e)}
    
    return results

# ---- Enhanced Asteroid Watch ----
@app.get("/api/nasa/asteroid-watch")
async def nasa_asteroid_watch(start_date: str = None, end_date: str = None):
    """Get asteroid watch data with enhanced information"""
    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    
    endpoint = f"{ASTEROID_WATCH_API}/feed"
    params = {
        "api_key": NASA_API_KEY,
        "start_date": start_date,
        "end_date": end_date
    }
    
    async with httpx.AsyncClient(timeout=60) as x:
        r = await x.get(endpoint, params=params)
        r.raise_for_status()
        return r.json()

# ---- Satellite and Spacecraft Tracking ----
@app.get("/api/satellites")
async def get_satellites():
    """Get major satellite and spacecraft positions"""
    # This would integrate with satellite tracking APIs like N2YO or Space-Track
    # For now, returning major spacecraft with known positions
    satellites = {
        "iss": {"name": "International Space Station", "type": "spacecraft", "orbit": "LEO"},
        "hubble": {"name": "Hubble Space Telescope", "type": "telescope", "orbit": "LEO"},
        "james_webb": {"name": "James Webb Space Telescope", "type": "telescope", "orbit": "L2"},
        "perseverance": {"name": "Perseverance Rover", "type": "rover", "location": "Mars"},
        "curiosity": {"name": "Curiosity Rover", "type": "rover", "location": "Mars"}
    }
    return satellites

# ---- Health ----
@app.get("/api/health")
async def health():
    return {
        "ok": True, 
        "ts": time.time(),
        "version": "0.2.0",
        "apis": {
            "horizons": "JPL Horizons",
            "sbdb": "JPL Small Body Database", 
            "apod": "NASA APOD",
            "exoplanets": "NASA Exoplanet Archive",
            "mars_rover": "NASA Mars Rover Photos",
            "space_weather": "NASA Space Weather",
            "asteroid_watch": "NASA Asteroid Watch"
        }
    }

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
    """Get comprehensive overview of the solar system including moons"""
    planets = []
    moons = []
    
    for obj_id, obj in CELESTIAL_OBJECTS.items():
        if obj['type'] == 'planet':
            au_distance = obj["a"] / 149597870.7
            planet_data = {
                "id": obj_id,
                "name": obj["name"],
                "type": obj["type"],
                "distance_au": round(au_distance, 2),
                "period_years": round(obj["period"] / 365.25, 2),
                "radius_km": obj["radius"],
                "mass_relative_to_earth": round(obj["mass"] / 5.972e24, 2),
                "atmosphere": obj["atmosphere"],
                "rings": obj["rings"],
                "moons": obj["moons"]
            }
            planets.append(planet_data)
        elif obj['type'] == 'moon':
            moon_data = {
                "id": obj_id,
                "name": obj["name"],
                "parent": obj["parent"],
                "distance_from_parent_km": obj["a"],
                "period_days": obj["period"],
                "radius_km": obj["radius"],
                "atmosphere": obj["atmosphere"]
            }
            moons.append(moon_data)
    
    # Sort by distance from Sun
    planets.sort(key=lambda p: p["distance_au"])
    
    return {
        "solar_system": {
            "star": {
                "name": "Sun",
                "type": "G-type main-sequence star",
                "age_billion_years": 4.6,
                "diameter_km": 1392700,
                "mass_kg": 1.989e30
            },
            "planets": planets,
            "moons": moons,
            "total_planets": len(planets),
            "total_moons": len(moons)
        }
    }

@app.get("/api/celestial-objects")
async def get_celestial_objects():
    """Get all celestial objects with their properties"""
    return {
        "objects": CELESTIAL_OBJECTS,
        "textures": NASA_TEXTURES,
        "total_count": len(CELESTIAL_OBJECTS)
    }

@app.get("/api/celestial-objects/{object_id}")
async def get_celestial_object(object_id: str):
    """Get detailed information about a specific celestial object"""
    if object_id not in CELESTIAL_OBJECTS:
        raise HTTPException(status_code=404, detail="Object not found")
    
    obj = CELESTIAL_OBJECTS[object_id]
    
    # Calculate additional derived information
    au_distance = obj["a"] / 149597870.7 if obj["a"] > 0 else 0
    escape_velocity = 0
    if obj["mass"] > 0 and obj["radius"] > 0:
        escape_velocity = math.sqrt(2 * 6.674e-11 * obj["mass"] / (obj["radius"] * 1000)) / 1000  # km/s
    
    # Get texture URL
    texture_url = NASA_TEXTURES.get(object_id, "")
    
    result = {
        "id": object_id,
        "name": obj["name"],
        "type": obj["type"],
        "texture_url": texture_url,
        "orbital_data": {
            "semi_major_axis_km": obj["a"],
            "semi_major_axis_au": round(au_distance, 6),
            "eccentricity": obj["e"],
            "inclination_degrees": obj["i"],
            "orbital_period_days": obj["period"],
            "orbital_period_years": round(obj["period"] / 365.25, 6) if obj["period"] > 0 else 0
        },
        "physical_data": {
            "mass_kg": obj["mass"],
            "radius_km": obj["radius"],
            "escape_velocity_km_s": round(escape_velocity, 2) if escape_velocity > 0 else None,
            "surface_gravity_earth": round((obj["mass"] / 5.972e24) * (6371.0 / obj["radius"])**2, 2) if obj["mass"] > 0 and obj["radius"] > 0 else None
        },
        "features": {
            "atmosphere": obj["atmosphere"],
            "rings": obj["rings"]
        }
    }
    
    # Add moon information for planets
    if obj["type"] == "planet" and "moons" in obj:
        result["moons"] = obj["moons"]
    
    # Add parent information for moons
    if obj["type"] == "moon" and "parent" in obj:
        result["parent"] = obj["parent"]
    
    return result