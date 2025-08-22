# 🚀 Setup Guide for Enhanced Solar System Simulator

## 📋 Prerequisites

Before you begin, make sure you have:
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **Git** for cloning the repository
- **NASA API key** (free from [api.nasa.gov](https://api.nasa.gov/))

## 🔑 Getting Your NASA API Key

1. Visit [NASA API Portal](https://api.nasa.gov/)
2. Click "Get Started" or "Sign Up"
3. Fill out the simple form (name, email, intended use)
4. You'll receive your API key immediately
5. The key is free and allows up to 1000 requests per hour

## 🛠️ Backend Setup

### 1. Navigate to Server Directory
```bash
cd server
```

### 2. Create Virtual Environment
```bash
# Windows PowerShell
python -m venv .venv
. .venv\Scripts\Activate.ps1

# macOS/Linux
python -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the server directory:

```bash
# Windows PowerShell
echo "NASA_API_KEY=your_actual_api_key_here" > .env

# macOS/Linux
echo "NASA_API_KEY=your_actual_api_key_here" > .env
```

**Important**: Replace `your_actual_api_key_here` with your actual NASA API key!

### 5. Start the Backend Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see output like:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## 🌐 Frontend Setup

### 1. Open New Terminal & Navigate to Client
```bash
cd client
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

You should see output like:
```
  VITE v5.4.2  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

### 4. Open Your Browser
Navigate to: http://localhost:5173

## ✅ Verification

### Backend Health Check
Visit: http://localhost:8000/api/health

You should see:
```json
{
  "ok": true,
  "ts": 1234567890.123,
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
```

### Frontend Features
- **Data Manager**: Top-right panel showing data sources
- **Catalog Button**: Purple "📚 Catalog" button in header
- **Enhanced Controls**: Time controls, settings, and debug modes

## 🔧 Troubleshooting

### Common Issues

#### 1. "NASA_API_KEY not found" Error
**Solution**: Make sure your `.env` file exists and contains the correct API key
```bash
# Check if .env file exists
ls -la .env

# Verify content (don't share your actual key!)
cat .env
```

#### 2. "Failed to load data" Error
**Solution**: Check your internet connection and NASA API key validity
```bash
# Test NASA API directly
curl "https://api.nasa.gov/planetary/apod?api_key=YOUR_KEY"
```

#### 3. Port Already in Use
**Solution**: Use a different port
```bash
# Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Frontend (update vite.config.ts)
export default defineConfig({
  server: { port: 5174 }
})
```

#### 4. CORS Errors
**Solution**: Backend should handle CORS automatically, but if issues persist:
```python
# In main.py, verify CORS middleware is present
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Performance Issues

#### 1. Slow Loading
- **Check**: Network tab in browser dev tools
- **Solution**: Verify NASA APIs are responding quickly
- **Alternative**: Reduce data limits in API calls

#### 2. 3D Rendering Issues
- **Check**: Browser console for WebGL errors
- **Solution**: Update graphics drivers
- **Alternative**: Use lower quality settings

## 🚀 Next Steps

Once everything is working:

1. **Explore the Catalog**: Click the "📚 Catalog" button to browse celestial objects
2. **Test Time Controls**: Use the timeline scrubber to see orbital motion
3. **Try Different Scales**: Toggle between realistic and viewable scales
4. **Check Data Sources**: Monitor the Data Manager panel for live updates

## 📚 Additional Resources

- **NASA API Documentation**: [api.nasa.gov](https://api.nasa.gov/)
- **JPL Horizons**: [ssd-api.jpl.nasa.gov](https://ssd-api.jpl.nasa.gov/)
- **Three.js**: [threejs.org](https://threejs.org/)
- **FastAPI**: [fastapi.tiangolo.com](https://fastapi.tiangolo.com/)

## 🆘 Need Help?

If you're still having issues:

1. **Check the logs**: Both backend and frontend console output
2. **Verify API keys**: Test your NASA API key directly
3. **Check versions**: Ensure you have the required Python/Node.js versions
4. **Network issues**: Verify firewall and proxy settings

---

**Happy exploring!** 🌌 Your realistic solar system simulator is ready to take you on a journey through space and time.
