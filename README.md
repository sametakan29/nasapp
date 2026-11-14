# LunarHorizon — CLPS Lunar South Pole Mission Navigator

**LunarHorizon** is an interactive 3D engineering mission planner and telemetry simulator built for NASA's Commercial Lunar Payload Services (CLPS) program targeting the **Lunar South Pole** (2026 Space Apps Challenge — Sakarya Local Event).

Because the Sun hovers within `1.5°–5°` of the horizon at the Lunar South Pole, crater rims cast long terrain-occluding shadows that simultaneously cut off solar array power generation and block Direct-to-Earth (DTE) X-band radio communications. LunarHorizon couples live **NASA JPL Horizons** topocentric ephemerides with **NASA LRO LOLA**–derived 36-point horizon elevation masks to forecast solar illumination, DTE link blackouts, thermal extremes, and battery survival over a 14-day mission window (`2026-11-15` to `2026-11-29`).

---

## Key Capabilities

1. **Interactive 3D Lunar Terrain & Real-Time Shadow Casting (`Three.js`)**
   - Procedural South Pole crater and ridge geometry displaced from each candidate site's 36-point Horizon Elevation Mask.
   - Articulated procedural CLPS lander model with gimbaled solar wings tracking Sun azimuth, an X-band dish tracking Earth azimuth, and a telemetry status beacon.
   - Dynamic directional solar lighting driving real-time 3D crater shadows across the landing pad so users visually observe shadows engulfing the lander during power blackouts.
   - Live Earth DTE vector beam transitioning from glowing **cyan** (`DTE LOCKED`) to **dashed red** (`LOS BLACKOUT`) whenever terrain occludes Earth.
   - Camera presets: **Orbital View**, **Lander POV**, and **Top-Down Polar**, plus full OrbitControls.

2. **Server-Side NASA JPL Horizons Integration (`/api/ephemeris`)**
   - Queries `https://ssd.jpl.nasa.gov/api/horizons.api` server-side (zero browser CORS issues) for apparent topocentric Azimuth and Elevation (`QUANTITIES='4'`, `DE441`) of both the **Sun (`COMMAND='10'`)** and **Earth (`COMMAND='399'`)** at each lunar site (`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`).
   - Parses ASCII tables strictly between `$$SOE` and `$$EOE` markers and caches results for 24 hours.
   - Includes a deterministic analytical synodic/sidereal fallback generator (`"JPL Ephemeris Fallback"`) that activates automatically if Horizons times out (`>4s`) or is unreachable.

3. **360° Polar Horizon Radar & Engineering Telemetry HUD**
   - Circular polar horizon plot showing the jagged 36-point terrain obstruction mask, 14-day Sun and Earth sky tracks, and live azimuth/elevation clearances.
   - Real-time gauges for Solar Elevation vs. Mask, Earth Elevation vs. Mask, Net Power (`+W / -W`), Battery State of Charge (`%` / `Wh`), External Temperature (`+45°C` sunlit vs `-185°C` shadowed), and `< 20%` Critical Power Alerts.
   - Color-coded 336-hour interactive timeline bar (`Nominal`, `Partial Link`, `Blackout`) with `1h/s`, `2h/s`, and `4h/s` simulation playback.

4. **Candidate Landing Site Comparison Matrix**
   - Side-by-side 14-day evaluation of **Malapert Massif** (*Artemis III / CLPS Candidate*, `-86.00°, 0.00°, 5.0 km`), **Shackleton Crater Rim** (*Intuitive Machines IM-2 Target*, `-89.68°, 129.20°, 1.8 km`), and **Nobile Crater Rim** (*NASA VIPER Target Region*, `-85.20°, 53.50°, 1.2 km`) across sunlit hours, DTE availability, minimum battery SoC, and overall Mission Feasibility Score (`0–100`).

---

## Scientific & Mathematical Model

For every hourly step $t \in [0, 335]$ across the 14-day mission window:

1. **Horizon Elevation Interpolation:**  
   Linearly interpolates the 36-point terrain elevation mask (`0°` to `350°` in `10°` increments) at `sun_az` and `earth_az` to obtain `terrain_elev_sun` and `terrain_elev_earth`.

2. **Solar Visibility & Power Generation:**
   - `is_sun_visible = sun_elev > terrain_elev_sun`
   - When sunlit (vertical/gimbaled solar arrays): `solar_power_w = 450 * max(0.15, sin(radians(min(90, (sun_elev - terrain_elev_sun) * 5 + 35))))`
   - When shadowed: `solar_power_w = 0 W`

3. **Direct-to-Earth (DTE) X-Band Link:**
   - `is_earth_visible = earth_elev > terrain_elev_earth`
   - Status: `"DTE LOCKED (X-Band)"` or `"LOS BLACKOUT (Terrain Occluded)"`
   - One-way Earth–Moon light-time: `1.28 s`

4. **Battery State of Charge (EPS) & Thermal State:**
   - Battery Capacity: `2400 Wh`, Initial SoC at Hour 0: `85%` (`2040 Wh`)
   - Constant Lander Avionics & Survival Heater Load: `140 W`
   - Hourly Net Energy: `net_wh = solar_power_w - 140` (clamped between `0%` and `100%`)
   - `"CRITICAL POWER ALERT"` triggered whenever `SoC < 20%`
   - Lander External Temperature: `+45°C` (sunlit) vs. `-185°C` (crater shadow)

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (Dark-Mode Aerospace HUD)
- **3D Graphics:** Three.js (`WebGLRenderer` with `PCFSoftShadowMap` & `OrbitControls`)
- **Icons:** `lucide-react` + custom geometric SVG assets

---

## Local Development & Verification

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Type-check & production build
npm run build
```

Open `http://localhost:3000` in your browser. The app is completely public with zero login walls or API key prompts, and deploys cleanly on Vercel.

---

## NASA Open Data Attribution & Modeling Scope

- **Data & Model Honesty:** Ephemeris data fetched live from NASA JPL Horizons System; terrain horizon masks are representative 360° profiles modeled after LRO LOLA South Pole elevation ranges; EPS battery telemetry uses a simplified 450W solar / 140W constant avionics load model.
- **NASA JPL Horizons System (`ssd.jpl.nasa.gov/api/horizons.api`):** Used for live topocentric apparent Azimuth and Elevation ephemerides (`DE441`) of the Sun and Earth relative to Lunar South Pole geodetic coordinates.
- **NASA LRO LOLA (Lunar Orbiter Laser Altimeter):** Elevation morphology and South Pole range parameters referenced to construct representative 36-point Horizon Elevation Masks for **Malapert Massif**, **Shackleton Crater Rim**, and **Nobile Crater Rim**.
- **Brand Compliance:** No official NASA logos, insignias, or mission patches are embedded in the application or assets.

## AI & Super Intelligence (SI) Transparency

> *Code structure, 3D visualization shaders, and ephemeris parsing utilities were developed with Super Intelligence (AI) assistance.*
