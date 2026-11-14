'use client';

import React, { useMemo } from 'react';
import { HourlyTelemetry, LandingSite } from '@/lib/lunarScience';

interface PolarHorizonRadarProps {
  site: LandingSite;
  telemetry: HourlyTelemetry[];
  current: HourlyTelemetry;
}

const CX = 140;
const CY = 140;
const MIN_ELEV = -4;
const MAX_ELEV = 10;
const MAX_R = 112;
const MIN_R = 8;

function elevToRadius(elevDeg: number): number {
  const clamped = Math.max(MIN_ELEV, Math.min(MAX_ELEV, elevDeg));
  const norm = (MAX_ELEV - clamped) / (MAX_ELEV - MIN_ELEV);
  return MIN_R + norm * (MAX_R - MIN_R);
}

function polarToCartesian(azDeg: number, elevDeg: number): { x: number; y: number } {
  // Azimuth 0 = North (top), 90 = East (right), 180 = South (bottom), 270 = West (left)
  const rad = ((azDeg - 90) * Math.PI) / 180;
  const r = elevToRadius(elevDeg);
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

export default function PolarHorizonRadar({
  site,
  telemetry,
  current,
}: PolarHorizonRadarProps) {
  const { terrainRingPath, terrainFillPath, sunTrackPath, earthTrackPath } = useMemo(() => {
    // Build 72-point smooth-stepped terrain mask contour (interpolated every 5 deg)
    const pts: string[] = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const idx0 = Math.floor(deg / 10) % 36;
      const idx1 = (idx0 + 1) % 36;
      const frac = (deg % 10) / 10;
      const maskElev = site.horizonMask[idx0] * (1 - frac) + site.horizonMask[idx1] * frac;
      const { x, y } = polarToCartesian(deg, maskElev);
      pts.push(`${deg === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    const innerRing = `${pts.join(' ')} Z`;

    // Outer boundary circle for evenodd fill representing occluded terrain band
    const outerCircle = `M ${CX} ${CY - MAX_R} A ${MAX_R} ${MAX_R} 0 1 0 ${CX} ${
      CY + MAX_R
    } A ${MAX_R} ${MAX_R} 0 1 0 ${CX} ${CY - MAX_R} Z`;

    const buildTrack = (extractor: (item: HourlyTelemetry) => { az: number; elev: number }) => {
      if (telemetry.length === 0) return '';
      return telemetry
        .filter((_, idx) => idx % 3 === 0 || idx === telemetry.length - 1)
        .map((item, idx) => {
          const { az, elev } = extractor(item);
          const { x, y } = polarToCartesian(az, elev);
          return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return {
      terrainRingPath: innerRing,
      terrainFillPath: `${outerCircle} ${innerRing}`,
      sunTrackPath: buildTrack((t) => ({ az: t.sunAz, elev: t.sunElev })),
      earthTrackPath: buildTrack((t) => ({ az: t.earthAz, elev: t.earthElev })),
    };
  }, [site.horizonMask, telemetry]);

  const sunPos = polarToCartesian(current.sunAz, current.sunElev);
  const earthPos = polarToCartesian(current.earthAz, current.earthElev);

  // Ordered from inside (high elevation) to outside (horizon) so labels match plotted geometry
  const ringLevels = [6, 4, 2, 0];

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
            360° Polar Horizon Radar
          </h3>
          <p className="text-[10px] text-slate-400">
            LRO LOLA Mask vs. Sun &amp; Earth Az/El
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-amber-300">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            SUN
          </span>
          <span className="flex items-center gap-1 text-cyan-300">
            <span className="inline-block h-2 w-2 rotate-45 bg-cyan-400" />
            EARTH
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox="0 0 280 280"
          className="h-56 w-56 select-none"
          role="img"
          aria-label="360 degree polar horizon radar comparing terrain elevation mask with Sun and Earth sky positions"
        >
          <defs>
            <pattern
              id="terrainHatch"
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="#f87171" strokeWidth="1" strokeOpacity="0.28" />
            </pattern>
            <radialGradient id="skyDomeGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#090f1d" />
            </radialGradient>
          </defs>

          {/* Sky background circle */}
          <circle
            cx={CX}
            cy={CY}
            r={MAX_R}
            fill="url(#skyDomeGrad)"
            stroke="#334155"
            strokeWidth="1.2"
          />

          {/* Shaded terrain occlusion zone */}
          <path
            d={terrainFillPath}
            fill="url(#terrainHatch)"
            fillRule="evenodd"
          />
          <path
            d={terrainFillPath}
            fill="#f87171"
            fillOpacity="0.12"
            fillRule="evenodd"
          />

          {/* Elevation concentric rings */}
          {ringLevels.map((elev) => {
            const r = elevToRadius(elev);
            return (
              <g key={elev}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke={elev === 0 ? '#64748b' : '#334155'}
                  strokeWidth={elev === 0 ? '1' : '0.8'}
                  strokeDasharray={elev === 0 ? '3 3' : undefined}
                />
                <text
                  x={CX + 3}
                  y={CY - r + 9}
                  fill="#94a3b8"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {elev}°
                </text>
              </g>
            );
          })}

          {/* Cardinal & intercardinal crosshairs */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
            const rad = ((az - 90) * Math.PI) / 180;
            const x2 = CX + MAX_R * Math.cos(rad);
            const y2 = CY + MAX_R * Math.sin(rad);
            return (
              <line
                key={az}
                x1={CX}
                y1={CY}
                x2={x2}
                y2={y2}
                stroke="#1e293b"
                strokeWidth="0.75"
              />
            );
          })}

          {/* Terrain horizon mask outline */}
          <path
            d={terrainRingPath}
            fill="none"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* 14-day Sun and Earth sky tracks */}
          {sunTrackPath && (
            <path
              d={sunTrackPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1"
              strokeOpacity="0.45"
              strokeDasharray="2 2"
            />
          )}
          {earthTrackPath && (
            <path
              d={earthTrackPath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.2"
              strokeOpacity="0.55"
              strokeDasharray="2 2"
            />
          )}

          {/* Azimuth bearing lines to live Sun & Earth */}
          <line
            x1={CX}
            y1={CY}
            x2={sunPos.x}
            y2={sunPos.y}
            stroke={current.isSunVisible ? '#fbbf24' : '#ef4444'}
            strokeWidth="1"
            strokeOpacity="0.65"
          />
          <line
            x1={CX}
            y1={CY}
            x2={earthPos.x}
            y2={earthPos.y}
            stroke={current.isEarthVisible ? '#06b6d4' : '#ef4444'}
            strokeWidth="1"
            strokeOpacity="0.65"
            strokeDasharray={current.isEarthVisible ? undefined : '3 2'}
          />

          {/* Lander center dot */}
          <circle cx={CX} cy={CY} r="3" fill="#e2e8f0" stroke="#06b6d4" strokeWidth="1" />

          {/* Sun marker */}
          <g transform={`translate(${sunPos.x}, ${sunPos.y})`}>
            <circle
              r="7.5"
              fill={current.isSunVisible ? '#fbbf24' : '#ef4444'}
              fillOpacity="0.22"
            />
            <circle
              r="4.2"
              fill={current.isSunVisible ? '#fbbf24' : '#1e293b'}
              stroke={current.isSunVisible ? '#fef08a' : '#ef4444'}
              strokeWidth="1.4"
            />
          </g>

          {/* Earth marker (diamond) */}
          <g transform={`translate(${earthPos.x}, ${earthPos.y})`}>
            <circle
              r="7.5"
              fill={current.isEarthVisible ? '#06b6d4' : '#ef4444'}
              fillOpacity="0.2"
            />
            <polygon
              points="0,-4.8 4.8,0 0,4.8 -4.8,0"
              fill={current.isEarthVisible ? '#22d3ee' : '#1e293b'}
              stroke={current.isEarthVisible ? '#a5f3fc' : '#ef4444'}
              strokeWidth="1.4"
            />
          </g>

          {/* Cardinal labels */}
          <text x={CX} y="15" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
            N 0°
          </text>
          <text x="266" y={CY + 3} textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
            E 90°
          </text>
          <text x={CX} y="272" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
            S 180°
          </text>
          <text x="15" y={CY + 3} textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
            W
          </text>
        </svg>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2 text-[10px] font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>Mask @ Sun Az:</span>
          <span className="text-orange-400">{current.terrainElevSun.toFixed(2)}°</span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Mask @ Earth Az:</span>
          <span className="text-orange-400">{current.terrainElevEarth.toFixed(2)}°</span>
        </div>
      </div>
    </div>
  );
}
