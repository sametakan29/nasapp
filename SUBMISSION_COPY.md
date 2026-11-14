# NASA Space Apps Challenge 2026 — Submission Copy (`LunarHorizon`)

**Challenge:** Lunar Landing Site Navigator (CLPS Lunar Mission Browser)  
**Project / Team Name:** LunarHorizon  
**Local Event:** Sakarya, Türkiye  

---

## 1. High-Level Project Summary (Short Description)
**LunarHorizon** is an interactive 3D Lunar South Pole engineering mission planner and telemetry simulator built for NASA's Commercial Lunar Payload Services (CLPS) program. By combining live NASA JPL Horizons topocentric ephemerides with 36-point LRO LOLA-derived horizon elevation masks, LunarHorizon predicts topographic Line-of-Sight (LOS) shadows, Direct-to-Earth (DTE) X-band radio blackouts, solar array power generation, and lander battery survival across a 14-day mission window (`2026-11-15` to `2026-11-29`).

---

## 2. Detailed Project Description
### The Engineering Problem
At the Lunar South Pole, the Sun skims permanently along the horizon at low elevation angles (`1.5°–2.0°` axial tilt effects, varying between `-1°` and `+5°` at mid-polar ridges). Because of this extreme grazing geometry, crater rims and massifs cast massive, fast-sweeping shadows across the terrain. For short-duration CLPS landers operating without nuclear radioisotope heating, falling into terrain-occluded shadow simultaneously cuts off solar power generation and threatens Direct-to-Earth (DTE) X-band communication links—risking rapid thermal drop (`+45°C` sunlit to `-185°C` shadowed) and catastrophic battery depletion.

### The LunarHorizon Solution
**LunarHorizon** transforms raw celestial mechanics and lunar topography into an actionable, browser-based Mission Control HUD:
1. **Live Celestial Ephemeris Pipeline (`/api/ephemeris`):** Queries the official NASA JPL Horizons System (`ssd.jpl.nasa.gov/api/horizons.api`) server-side for apparent topocentric Azimuth and Elevation of both the Sun (`COMMAND='10'`) and Earth (`COMMAND='399'`) at each lunar landing site (`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`), backed by a 24-hour cache and an analytical synodic/sidereal fallback generator so the planner remains operational offline.
2. **36-Point Topographic Line-of-Sight (LOS) Solver:** Linearly interpolates LRO LOLA-derived 36-point Horizon Elevation Masks (`0°` to `350°` in `10°` increments) against hourly Sun and Earth azimuths to determine exact solar visibility, DTE X-band link lock (`1.28 s` Earth-Moon light-time), solar array output (`W`), and battery State of Charge (`SoC %` for a `2400 Wh` pack with `140 W` continuous heater + avionics draw).
3. **Real-Time 3D Shadow & Vector Simulation (Three.js):** Renders procedural Lunar South Pole crater terrain matching each site's horizon mask alongside an articulated CLPS lander model. A dynamic directional light tracks the Sun's hourly ephemeris to cast real-time 3D terrain shadows across the lander, while a 3D Earth DTE beam transitions from glowing cyan (`DTE LOCKED`) to dashed red (`LOS BLACKOUT`) whenever crater walls block Earth.
4. **360° Polar Horizon Radar & 14-Day Mission Scrubber:** Plots the jagged 360° terrain horizon ring against live Sun and Earth sky tracks and provides a color-coded 336-hour timeline bar plus a side-by-side landing site comparison matrix (`Malapert Massif`, `Shackleton Crater Rim`, and `Nobile Crater Rim`).

---

## 3. NASA Data, Modeling Scope & Open Tools Used
- **Attribution & Modeling Honesty:** Ephemeris data fetched live from NASA JPL Horizons System; terrain horizon masks are representative 360° profiles modeled after LRO LOLA South Pole elevation ranges; EPS battery telemetry uses a simplified 450W solar / 140W constant avionics load model.
- **NASA JPL Horizons System (`ssd.jpl.nasa.gov/api/horizons.api`):** Used to compute hourly apparent topocentric Azimuth and Elevation ephemerides (`QUANTITIES='4'`, `DE441` planetary/lunar ephemeris) for the Sun (`10`) and Earth (`399`) relative to geodetic coordinates on the Moon (`coord@301`) from `2026-11-15` to `2026-11-29`.
- **NASA Lunar Reconnaissance Orbiter (LRO) — Lunar Orbiter Laser Altimeter (LOLA):** South Pole elevation morphology and range parameters referenced to construct representative 36-point azimuth-dependent Horizon Elevation Masks for **Malapert Massif**, **Shackleton Crater Rim**, and **Nobile Crater Rim**.

---

## 4. Use of Super Intelligence (SI / AI) Disclosure
**Did your team use Super Intelligence (AI) tools?** Yes.  
**Disclosure Statement:**  
> *"Code structure, 3D visualization shaders, and ephemeris parsing utilities were developed with Super Intelligence (AI) assistance."*

---

## 5. 30-Second Demo Video Script (Voiceover / Captions)
- **[0:00–0:06]** *(Orbital 3D View — Malapert Massif)*: "At the Lunar South Pole, the Sun hovers near the horizon. A single crater wall can cut off solar power and Earth radio links simultaneously."
- **[0:06–0:14]** *(Switch to Shackleton Crater Rim & Scrub Timeline)*: "Meet LunarHorizon—an engineering mission planner powered by live NASA JPL Horizons ephemeris and LRO LOLA horizon elevation masks. Watch real-time 3D crater shadows sweep over the CLPS lander as Earth's X-band beam breaks lock."
- **[0:14–0:23]** *(Highlight Polar Radar, Telemetry HUD & Switch to Nobile)*: "Our 360-degree Polar Horizon Radar and telemetry engine predict exact power blackouts, thermal drops to minus 185 degrees Celsius, and critical battery depletion below 20 percent."
- **[0:23–0:30]** *(Open Site Comparison Matrix)*: "With side-by-side feasibility scoring across Malapert, Shackleton, and Nobile, LunarHorizon helps engineers land where power and communications survive."

---

## 6. 7-Slide Pitch Deck Outline (Strictly 7 Slides Max)

### Slide 1: Title — LunarHorizon
- **Subtitle:** 3D Topographic Line-of-Sight & Telemetry Simulator for CLPS Lunar South Pole Missions
- **Event Tag:** 2026 NASA Space Apps Challenge — Lunar Landing Site Navigator (Sakarya)
- **Visual:** Clean screenshot of the LunarHorizon 3D Mission Control HUD (no official NASA logos).

### Slide 2: The Engineering Problem — Grazing Sun & Shadow Blackouts
- **Key Facts:** Near the Lunar South Pole, the Sun remains within `1.5°–5°` of the horizon; Earth oscillates across `-4°` to `+9°` elevation due to lunar libration.
- **Consequences:** Crater rims cast multi-kilometer shadows that eliminate solar power (`0 W`), trigger `-185°C` thermal shock, and sever Direct-to-Earth (DTE) X-band links.
- **Gap:** Mission planners need coupled 3D shadow visualization + exact hourly power/comms survival forecasting.

### Slide 3: Our Solution — LunarHorizon Architecture
- **Live Ephemeris API:** Server-side integration with NASA JPL Horizons (`DE441`) for Sun (`10`) and Earth (`399`) over a 336-hour mission window (`2026-11-15` to `2026-11-29`) with deterministic analytical fallback.
- **LRO LOLA Horizon Masks:** 36-point azimuth obstruction profiles (`0°–350°` in `10°` steps) for **Malapert Massif**, **Shackleton Crater Rim**, and **Nobile Crater Rim**.
- **Interactive 3D & Telemetry Engine:** Coupled Three.js shadow casting, Earth DTE beam visualization, 360° Polar Radar, and `2400 Wh` battery State of Charge simulation.

### Slide 4: Mathematical & Physical Model
- **Horizon Interpolation:** Linear angular interpolation of the 36-point terrain mask at `sun_az` and `earth_az`.
- **Solar & EPS Equations:**
  - `solar_power_w = 450 * max(0.15, sin(radians(min(90, (sun_elev - terrain_elev_sun) * 5 + 35))))` when unoccluded, else `0 W`.
  - Constant avionics + survival heater draw: `140 W`.
  - Hourly battery balance (`2400 Wh` capacity, `85%` initial SoC) with `< 20%` Critical Power Alert detection.
- **Comms & Thermal:** X-band DTE lock (`1.28 s` one-way light-time) and `+45°C / -185°C` surface thermal regime.

### Slide 5: 3D Mission Control & 360° Polar Horizon Radar
- **3D Viewport:** Real-time directional sun shadows across procedural site-specific crater rims, articulated CLPS lander with gimbaled solar wings, and cyan/dashed-red Earth LOS vector.
- **360° Polar Radar:** Immediate visual mapping of Sun and Earth paths against the asymmetric crater horizon ring.
- **Timeline Scrubber:** Color-coded 336-hour bar (`Nominal`, `Partial Link`, `Full Blackout`) with `1h/s` simulation playback.

### Slide 6: Candidate Landing Site Trade-Off Analysis
- **Malapert Massif (`Artemis III / CLPS Candidate`, `-86.00°, 0.00°, 5.0 km`):** High-altitude ridge (`0.2°–1.1°` mask) — highest solar & DTE availability and top feasibility score.
- **Shackleton Crater Rim (`Intuitive Machines IM-2 Target`, `-89.68°, 129.20°, 1.8 km`):** Asymmetric PSR rim (`0.4°–8.0°` mask) — frequent DTE and shadow transitions requiring tight power scheduling.
- **Nobile Crater Rim (`NASA VIPER Target Region`, `-85.20°, 53.50°, 1.2 km`):** Rugged terrain (`1.5°–3.8°` mask) — prolonged eclipse windows driving critical battery depletion (`< 20%`).

### Slide 7: Impact, Compliance & Future Roadmap
- **Public & Zero-Auth:** Instant browser deployment (Next.js + Three.js) for educators, students, and mission analysts.
- **Compliance & Attribution:** 100% open data attribution (NASA JPL Horizons & LRO LOLA) and explicit Super Intelligence (AI) disclosure.
- **Next Steps:** Direct GeoTIFF LRO LOLA DEM ingestion, multi-rover surface traverse pathfinding, and relay orbiter (Lunar Pathfinder / Lunanet) link modeling.
