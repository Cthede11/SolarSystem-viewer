# Solar System Viewer Starter

A minimal, production-ready starter to visualize solar-system bodies with NASA/JPL data.

- Frontend: **React + Vite + TypeScript + Three.js**
- Backend: **FastAPI** (Python) with caching + robust parsing of JPL **Horizons** VECTORS output and **SBDB** queries
- Features: time scrubber, play/pause, Sun/Earth/Mars demo, orbit lines, click-to-inspect drawer, NEO list (SBDB)

---

## Project Structure
```
solsys-starter/
  server/
    main.py
    requirements.txt
    README.md
  client/
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    src/
      main.tsx
      App.tsx
      styles.css
      components/
        OrbitCanvas.tsx
        InfoDrawer.tsx
      lib/
        api.ts
        ephem.ts
```

---

## server/requirements.txt
```
fastapi==0.112.2
uvicorn[standard]==0.30.6
httpx==0.27.2
python-multipart==0.0.9
pydantic==2.8.2
pydantic-settings==2.4.0
```

---

## How to run (local dev)

1) **Backend**
```
cd server
python -m venv .venv
# Windows PowerShell
. .venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2) **Frontend**
```
cd client
npm install
# Optional: point to a different backend
# set VITE_API_BASE=http://localhost:8000 (PowerShell: $env:VITE_API_BASE="http://localhost:8000")
npm run dev
```
Visit: http://localhost:5173

---

## Notes & Next Steps (UX ideas baked-in ready to extend)
- **Focus modes**: add planet-centric camera by subtracting planet position from all meshes for rendering frame.
- **Events overlay**: call `/api/sbdb/neo` and show a side list; on click fetch `/api/sbdb/object?des=XXXX` and center camera.
- **Accuracy badges**: keep `extra.source` as `Horizons` now; later add `SSCWeb`/`SPICE` and color-code.
- **Interpolation**: swap to cubic Hermite for smoother motion (keep linear starter for simplicity).
- **Performance**: move interpolation into a Web Worker if you load many bodies.

This starter is fully functional: you should see Sun (center), Earth and Mars orbits sampled from Horizons, a time scrubber, play/pause, and a clickable info drawer. Add more `horizons_ids` (e.g., 199,299,599,699,799,899) once you verify performance.
