# 🌌 Realistic Solar System Simulator

A comprehensive, scientifically accurate 3D solar system visualization tool that integrates multiple NASA APIs to create a realistic, navigatable model of our solar system and beyond.

## ✨ Features

### 🪐 **Comprehensive Celestial Objects**
- **Planets**: All 8 planets with accurate orbital mechanics
- **Dwarf Planets**: Pluto, Ceres, Eris, and more
- **Moons**: Major satellites of planets
- **Asteroids**: Main belt asteroids and Near-Earth Objects (NEOs)
- **Comets**: Periodic and non-periodic comets
- **Satellites**: ISS, Hubble, James Webb, and other spacecraft
- **Exoplanets**: Planets orbiting other stars

### 🌟 **Realistic Visuals**
- **High-Resolution Textures**: Real NASA imagery for planets and celestial bodies
- **Accurate Scaling**: Realistic vs. viewable scale modes
- **Atmospheric Effects**: Rings, atmospheric scattering, and space weather
- **Dynamic Lighting**: Realistic solar illumination and shadows

### 🔬 **Scientific Accuracy**
- **JPL Horizons Integration**: Precise orbital calculations
- **Real-Time Data**: Live updates from NASA APIs
- **Space Weather**: Solar flares, coronal mass ejections, and geomagnetic storms
- **Historical Data**: Past and future orbital positions

### 🎮 **Interactive Navigation**
- **3D Camera Controls**: Orbit, zoom, pan, and focus targeting
- **Time Travel**: Historical and future simulations
- **Object Tracking**: Follow specific celestial bodies
- **Search & Filter**: Find objects by name, type, or characteristics

## 🚀 **NASA API Integration**

### **Core APIs**
- **JPL Horizons**: Precise orbital mechanics and ephemeris data
- **JPL Small Body Database**: Comprehensive asteroid and comet information
- **NASA APOD**: Astronomy Picture of the Day for beautiful space imagery
- **NASA Exoplanet Archive**: Extrasolar planetary system data
- **NASA Mars Rover Photos**: Real Mars exploration imagery
- **NASA Space Weather**: Solar activity and space conditions
- **NASA Asteroid Watch**: Near-Earth object tracking

### **Data Sources**
- **Real-Time Updates**: Live data from multiple NASA sources
- **Comprehensive Coverage**: 1000+ asteroids, 100+ comets, 50+ NEOs
- **Historical Records**: Decades of astronomical observations
- **Mission Data**: Spacecraft trajectories and discoveries

## 🏗️ **Architecture**

### **Frontend**
- **React 18** + **TypeScript** for robust UI development
- **Three.js** for high-performance 3D graphics
- **Custom Shaders** for realistic space rendering
- **Responsive Design** for all device types

### **Backend**
- **FastAPI** (Python) for high-performance API server
- **Smart Caching** for efficient data management
- **Parallel Processing** for multiple API calls
- **Error Handling** with fallback mechanisms

### **Data Pipeline**
- **Multi-API Integration**: Parallel data fetching from NASA sources
- **Data Fusion**: Combining multiple data sources into unified models
- **Real-Time Updates**: Automatic refresh and data synchronization
- **Offline Support**: Cached data when APIs are unavailable

## 🛠️ **Installation & Setup**

### **Prerequisites**
- Python 3.8+ with pip
- Node.js 16+ with npm
- NASA API key (free from [api.nasa.gov](https://api.nasa.gov/))

### **1. Backend Setup**
```bash
cd server
python -m venv .venv

# Windows PowerShell
. .venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

# Create .env file with your NASA API key
echo "NASA_API_KEY=your_api_key_here" > .env

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### **2. Frontend Setup**
```bash
cd client
npm install

# Optional: Point to different backend
# set VITE_API_BASE=http://localhost:8000 (PowerShell)
# export VITE_API_BASE=http://localhost:8000 (macOS/Linux)

npm run dev
```

Visit: http://localhost:5173

## 🎯 **Usage Guide**

### **Basic Navigation**
- **Mouse**: Drag to orbit camera, scroll to zoom
- **Keyboard**: WASD for movement, QE for rotation
- **Touch**: Pinch to zoom, drag to rotate

### **Object Selection**
- **Click**: Select celestial objects for detailed information
- **Catalog**: Browse all available objects by category
- **Search**: Find specific objects by name or characteristics

### **Time Controls**
- **Timeline**: Scrub through time to see orbital changes
- **Playback**: Animate orbital motion at various speeds
- **Date Range**: View from 7 days to 1 year of data

### **Visual Modes**
- **Realistic Scale**: True astronomical distances and sizes
- **Viewable Scale**: Optimized for easy navigation
- **Orbit Lines**: Toggle orbital path visualization
- **Atmospheric Effects**: Enable realistic atmospheric rendering

## 🔧 **Advanced Features**

### **Data Management**
- **Auto-Refresh**: Automatic data updates every 5 minutes
- **Manual Refresh**: Force update from NASA APIs
- **Data Sources**: View which APIs are providing data
- **Error Handling**: Graceful fallbacks when APIs are unavailable

### **Performance Optimization**
- **Level of Detail**: Dynamic object complexity based on distance
- **Frustum Culling**: Only render visible objects
- **Texture Streaming**: Progressive texture loading
- **WebGL Optimization**: Efficient 3D rendering

### **Customization**
- **Settings Panel**: Configure visual preferences
- **Camera Presets**: Save and restore camera positions
- **Object Filtering**: Show/hide specific object types
- **Theme Support**: Light and dark mode options

## 🚀 **Next Steps & Roadmap**

### **Phase 2: Enhanced Visuals**
- [ ] **High-Resolution Textures**: 4K planetary imagery
- [ ] **Atmospheric Shaders**: Realistic atmospheric effects
- [ ] **Particle Systems**: Comet tails and asteroid trails
- [ ] **Post-Processing**: Bloom, depth of field, and motion blur

### **Phase 3: Extended Universe**
- [ ] **Exoplanet Systems**: Visualize distant planetary systems
- [ ] **Galaxy View**: Zoom out to see our galaxy
- [ ] **Mission Tracking**: Real-time spacecraft positions
- [ ] **Historical Events**: Major astronomical events

### **Phase 4: Advanced Physics**
- [ ] **Gravitational Effects**: N-body simulations
- [ ] **Relativistic Corrections**: Einstein's effects
- [ ] **Space Weather Visualization**: Real-time solar activity
- [ ] **Collision Detection**: Asteroid impact simulations

## 🤝 **Contributing**

This is an open-source project! We welcome contributions:

1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your improvements
4. **Test** thoroughly
5. **Submit** a pull request

### **Areas for Contribution**
- **3D Models**: Better celestial object representations
- **API Integration**: Additional data sources
- **Performance**: Rendering optimizations
- **Documentation**: User guides and tutorials
- **Testing**: Unit and integration tests

## 📚 **Resources & Learning**

### **NASA APIs**
- [NASA API Portal](https://api.nasa.gov/)
- [JPL Horizons](https://ssd-api.jpl.nasa.gov/)
- [Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)

### **3D Graphics**
- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [Space Visualization](https://svs.gsfc.nasa.gov/)

### **Astronomy Data**
- [JPL Small Body Database](https://ssd.jpl.nasa.gov/sbdb.cgi)
- [Minor Planet Center](https://minorplanetcenter.net/)
- [Space Weather Prediction Center](https://www.swpc.noaa.gov/)

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **NASA** for providing comprehensive space data APIs
- **JPL** for precise orbital mechanics calculations
- **Three.js** community for excellent 3D graphics library
- **Open Source Community** for tools and inspiration

---

**Ready to explore the cosmos?** 🚀 Start the simulator and navigate through our solar system with unprecedented detail and accuracy!
