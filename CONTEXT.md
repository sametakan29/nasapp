# PROJECT SPECIFICATION: LunarHorizon
**Event:** 2026 NASA Space Apps Challenge (Sakarya Local Event)  
**Challenge:** Lunar Landing Site Navigator (CLPS Lunar Mission Browser)  
**Team / Project Name:** LunarHorizon  
**Deadline:** Sunday, November 15, 2026, 23:59 (UTC+3)  

---

## 1. MISSION & CORE OBJECTIVE
Build **LunarHorizon**, an interactive 3D engineering mission planner and telemetry simulator for NASA's Commercial Lunar Payload Services (CLPS) missions targeting the **Lunar South Pole**. 

Instead of generic mock dashboards, this tool solves a critical lunar engineering problem: **Topographic Line-of-Sight (LOS) & Power/Comms Blackout Prediction**. Because the Sun stays near the horizon (1.5°–2°) at the Lunar South Pole, crater rims cast massive shadows that cut off solar power and block Direct-to-Earth (DTE) radio communication.

---

## 2. STRICT HACKATHON COMPLIANCE & RULES (MANDATORY)
You MUST enforce these rules across all code, UI, and documentation:
1. **English Only:** Every single UI label, chart, tooltip, `README.md`, and code comment MUST be in English.
2. **NO Official NASA Branding:** Do NOT generate, embed, or modify any official NASA logos, insignias, or mission patches in the UI or assets. Use custom geometric/vector icons only.
3. **Super Intelligence (SI / AI) Transparency:** NASA requires explicit disclosure of AI assistance. You MUST include a clear "AI & Data Attribution" notice in both the `README.md` and a small footer/modal in the web app stating: *"Code structure, 3D visualization shaders, and ephemeris parsing utilities were developed with Super Intelligence (AI) assistance."*
4. **NASA Open Data Attribution:** Explicitly credit **NASA JPL Horizons System** and **NASA LRO LOLA (Lunar Orbiter Laser Altimeter)** data in the UI and `README.md`.
5. **Public & Zero-Auth:** The deployed web app (Vercel) must load immediately with zero login walls, API key prompts, or paywalls.

---

## 3. TECH STACK & ARCHITECTURE
- **Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **3D Engine:** Three.js (`@react-three/fiber` + `@react-three/drei` OR vanilla `three` canvas wrapper — pick whichever compiles cleanly with zero SSR hydration issues).
- **Backend API:** Next.js Route Handler (`/api/ephemeris`) to fetch NASA JPL Horizons data server-side (prevents browser CORS issues) with an automatic deterministic fallback cache so the app never breaks if NASA's API is slow or offline.
- **Icons & Charts:** `lucide-react` + lightweight custom SVG charts or `recharts`.

---

## 4. SCIENTIFIC & MATHEMATICAL LOGIC

### A. Target CLPS Lunar South Pole Landing Sites
Implement 3 real candidate landing regions with distinct topographic profiles and 36-point Horizon Elevation Masks (representing terrain obstruction angle in degrees for every 10° of Azimuth from `0°` to `350°`, derived from LRO LOLA DEM profiles):

1. **Malapert Massif (Peak of Eternal Light Candidate)**
   - Coordinates: `Lat: -86.00°`, `Lon: 0.00°`, `Alt: 5.0 km`
   - Profile: High-altitude ridge; low horizon mask (`0.2°` to `1.1°` across most azimuths). High solar availability (~85%+), strong DTE visibility.
2. **Shackleton Crater Rim (Connecting Ridge)**
   - Coordinates: `Lat: -89.68°`, `Lon: 129.20°`, `Alt: 1.8 km`
   - Profile: Narrow rim bordering a Permanently Shadowed Region (PSR). Asymmetric horizon mask (`0.4°` on sunward azimuths, `4.5°–8.0°` toward crater interior). Frequent communication/power transitions.
3. **Nobile Crater Rim (VIPER Target Region)**
   - Coordinates: `Lat: -85.20°`, `Lon: 53.50°`, `Alt: 1.2 km`
   - Profile: Complex rugged terrain; high horizon mask (`1.5°` to `3.8°`). High risk of prolonged thermal/battery depletion during eclipse windows.

### B. NASA JPL Horizons API Integration (`/api/ephemeris`)
Fetch apparent topocentric **Azimuth (`Azi`)** and **Elevation (`Elev`)** for both the **Sun (`COMMAND='10'`)** and **Earth (`COMMAND='399'`)** as seen from each lunar landing site over a 14-day mission window (`2026-11-15` to `2026-11-29`, `STEP_SIZE='1h'`).

**Exact API Endpoint & Parameters:**
```text
GET https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='10'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='<lon>,<lat>,<alt_km>'&START_TIME='2026-11-15'&STOP_TIME='2026-11-29'&STEP_SIZE='1h'&QUANTITIES='4'
```

*(Run once for `COMMAND='10'` [Sun] and once for `COMMAND='399'` [Earth] per site, cache in memory/ISR for 24h).*

**Parsing Rule:**

* The JSON response contains an ASCII table inside `response.result`.
* Extract lines strictly between `$$SOE` (Start of Ephemeris) and `$$EOE` (End of Ephemeris).
* Parse timestamp, Apparent Azimuth (`deg`), and Apparent Elevation (`deg`).
* **CRITICAL FALLBACK:** Implement a physically accurate analytical fallback generator (modeling the 27.3-day lunar sidereal/synodic cycle and 1.54° axial tilt) that automatically triggers if `horizons.api` times out (>4s) or fails, tagging the payload source as `"NASA JPL Horizons Live"` vs `"JPL Ephemeris Fallback"`.

### C. Line-of-Sight (LOS) & Lander Telemetry Engine

For every hourly timestamp $t$:

1. **Horizon Interpolation:** Interpolate the site's 36-point terrain mask to get `terrain_elev_sun` at `sun_az` and `terrain_elev_earth` at `earth_az`.
2. **Solar Visibility & Power:**
   * `is_sun_visible = sun_elev > terrain_elev_sun`
   * If `true`: `solar_power_w = 450 * max(0.15, sin(radians(sun_elev - terrain_elev_sun + 5)))` (simulating vertical/gimbaled solar arrays).
   * If `false`: `solar_power_w = 0` (Lunar Eclipse / Crater Shadow).
3. **Direct-to-Earth (DTE) Comms:**
   * `is_earth_visible = earth_elev > terrain_elev_earth`
   * `comms_status = is_earth_visible ? "DTE LOCKED (X-Band)" : "LOS BLACKOUT (Terrain Occluded)"`
   * `signal_delay_sec = 1.28` (Earth-Moon light-time)
4. **Battery State of Charge (SoC %):**
   * Start at `85%` on Hour 0 (2400 Wh capacity).
   * Constant lander heater + avionics draw: `140 W`.
   * Hourly net energy: `net_wh = solar_power_w - 140`.
   * Clamp SoC between `0%` and `100%`. Trigger `"CRITICAL POWER ALERT"` if SoC drops below `20%`.

---

## 5. UI / UX & 3D VISUALIZATION DESIGN

Aesthetic: **Dark-mode Aerospace Mission Control HUD** (`#05080F` background, crisp `1px` slate borders, cyan/amber/emerald status indicators, monospace telemetry numbers).

1. **Interactive 3D Viewport (Center Stage - Three.js):**
   * Procedural 3D lunar south pole terrain mesh (crater rim + surrounding ridges generated using realistic heightmap displacement matching the selected site).
   * **CLPS Lander Model** placed at the landing coordinate with a pulsing beacon.
   * **Dynamic Directional Light** driven by real `sun_az` and `sun_elev` from the timeline slider—casting **real-time 3D shadows** across the crater floor so the user visually sees the shadow engulf the lander during power blackouts!
   * **Earth DTE Vector Beam:** A glowing cyan line pointing from the lander toward `earth_az` / `earth_elev` that turns dashed-red when blocked by the crater rim.
   * OrbitControls (zoom, rotate, pan) + camera presets ("Orbital View", "Lander POV", "Top-Down Polar").

2. **Mission Timeline Scrubber (Bottom Dock):**
   * Play/Pause simulation button (1 hour/sec playback) + 336-hour (14-day) interactive range slider.
   * Color-coded timeline bar showing green segments (Sun + Earth visible), amber segments (Sun only), and red segments (Shadow + Comms Blackout).

3. **Telemetry & Engineering HUD (Right Panel):**
   * Real-time gauges: Solar Elevation vs. Horizon Mask Angle, Earth Elevation vs. Horizon Mask Angle, Net Power (`+W / -W`), Battery SoC (`%`), Lander External Temp (`+45°C` sunlit vs `-185°C` shadowed).
   * **360° Polar Horizon Radar (SVG):** A circular polar plot showing the jagged terrain horizon ring and the current positions of the Sun and Earth icons relative to the terrain mask.

4. **Site Comparison Modal / Drawer:**
   * Side-by-side table comparing the 3 landing sites across the full 14-day window: Total Sunlit Hours, Total DTE Comms Hours, Minimum Battery SoC, and Overall Mission Feasibility Score (`0–100`).

---

## 6. REQUIRED REPOSITORY FILES TO GENERATE

In addition to the working Next.js application, generate these two markdown files in the project root:

1. `README.md`: Professional open-source documentation including architecture overview, local setup, NASA JPL Horizons & LRO LOLA data citations, and the mandatory Super Intelligence (AI) disclosure statement.
2. `SUBMISSION_COPY.md`: Ready-to-paste English text for the NASA Space Apps submission form (`High-Level Project Summary`, `Detailed Project Description`, `NASA Data`, `SI Disclosure`) AND a concise **7-Slide Pitch Deck Outline** (adhering strictly to the 7-slide maximum rule).

---

## 7. EXECUTION PRIORITY

1. Scaffold Next.js + Tailwind + Three.js cleanly and verify `npm run build` passes with zero TypeScript errors.
2. Build `/api/ephemeris` with real JPL Horizons fetching + ASCII parser + deterministic fallback.
3. Build the 3D terrain scene with dynamic sun shadow casting and Earth LOS vector.
4. Wire the 14-day timeline slider, 360° polar horizon radar, and telemetry cards.
5. Generate `README.md` and `SUBMISSION_COPY.md`.
