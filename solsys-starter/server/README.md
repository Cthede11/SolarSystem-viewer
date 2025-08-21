
# FastAPI backend

## Quick start
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

## Endpoints
- GET /api/ephem        -> Sampled state vectors for given targets via JPL Horizons
- GET /api/sbdb/neo     -> NEO shortlist from SBDB (fields subset)
- GET /api/sbdb/object  -> SBDB full record by designation or SPK id

## Notes
- Responses cached in-memory for 6 hours by query key.
- Horizons parser supports both JSON `data` and classic text tables (`$$SOE` ... `$$EOE`).
