'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  BatteryWarning,
  Radio,
  Sun,
  Thermometer,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  BATTERY_CAPACITY_WH,
  CONSTANT_LOAD_W,
  CRITICAL_SOC_PCT,
  HourlyTelemetry,
  LandingSite,
} from '@/lib/lunarScience';
import PolarHorizonRadar from './PolarHorizonRadar';

interface TelemetryHUDProps {
  site: LandingSite;
  telemetry: HourlyTelemetry[];
  current: HourlyTelemetry;
  onSelectHour: (hourIndex: number) => void;
}

export default function TelemetryHUD({
  site,
  telemetry,
  current,
  onSelectHour,
}: TelemetryHUDProps) {
  const { socPath, socAreaPath, criticalY } = useMemo(() => {
    const w = 320;
    const h = 76;
    const padY = 6;
    const usableH = h - padY * 2;
    const len = Math.max(1, telemetry.length - 1);

    const points = telemetry.map((item, idx) => {
      const x = (idx / len) * w;
      const y = padY + (1 - item.batterySocPct / 100) * usableH;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const linePath = points.join(' ');
    const areaPath =
      points.length > 0 ? `${linePath} L ${w} ${h - padY} L 0 ${h - padY} Z` : '';

    const critY = padY + (1 - CRITICAL_SOC_PCT / 100) * usableH;

    return {
      socPath: linePath,
      socAreaPath: areaPath,
      criticalY: critY,
    };
  }, [telemetry]);

  const playheadX =
    telemetry.length > 1 ? (current.hourIndex / (telemetry.length - 1)) * 320 : 0;
  const playheadY = 6 + (1 - current.batterySocPct / 100) * (76 - 12);

  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (telemetry.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSelectHour(Math.round(ratio * (telemetry.length - 1)));
  };

  return (
    <aside className="flex h-full flex-col gap-2.5 overflow-y-auto pr-0.5">
      {/* Critical Power Alert Banner */}
      {current.criticalPowerAlert && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-red-500/80 bg-red-950/70 px-3 py-2 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.28)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-red-400" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-bold tracking-wider text-red-300">
              CRITICAL POWER ALERT — SoC &lt; {CRITICAL_SOC_PCT}%
            </div>
            <div className="font-mono text-[10px] text-red-200/80">
              Reserve at {current.batterySocPct.toFixed(1)}% ({current.batteryWh.toFixed(0)} Wh). Survival heaters threatened.
            </div>
          </div>
        </div>
      )}

      {/* 1. Solar Illumination & Power Card */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sun
              className={`h-3.5 w-3.5 ${
                current.isSunVisible ? 'text-amber-400' : 'text-slate-400'
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              Solar Illumination &amp; Array
            </span>
          </div>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              current.isSunVisible
                ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border border-red-500/40 bg-red-500/15 text-red-300'
            }`}
          >
            {current.isSunVisible ? 'SUNLIT' : 'CRATER SHADOW'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Sun Elev</div>
            <div
              className={`text-sm font-semibold ${
                current.isSunVisible ? 'text-amber-300' : 'text-red-400'
              }`}
            >
              {current.sunElev >= 0 ? '+' : ''}
              {current.sunElev.toFixed(2)}°
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Horizon Mask</div>
            <div className="text-sm font-semibold text-orange-400">
              {current.terrainElevSun.toFixed(2)}°
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Solar Output</div>
            <div
              className={`text-sm font-semibold ${
                current.solarPowerW > 0 ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {current.solarPowerW.toFixed(0)} W
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-300">
          <span>Azimuth: {current.sunAz.toFixed(1)}°</span>
          <span>
            Clearance:{' '}
            <span
              className={
                current.solarClearanceDeg > 0 ? 'text-emerald-400' : 'text-red-400'
              }
            >
              {current.solarClearanceDeg >= 0 ? '+' : ''}
              {current.solarClearanceDeg.toFixed(2)}°
            </span>
          </span>
        </div>
      </div>

      {/* 2. Direct-to-Earth (DTE) Comms Card */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {current.isEarthVisible ? (
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-400" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              DTE X-Band Link
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-300">
            Delay: {current.signalDelaySec.toFixed(2)}s
          </span>
        </div>

        <div
          className={`mb-2 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold ${
            current.isEarthVisible
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {current.commsStatus}
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Earth Elev</div>
            <div
              className={`text-sm font-semibold ${
                current.isEarthVisible ? 'text-cyan-300' : 'text-red-400'
              }`}
            >
              {current.earthElev >= 0 ? '+' : ''}
              {current.earthElev.toFixed(2)}°
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Horizon Mask</div>
            <div className="text-sm font-semibold text-orange-400">
              {current.terrainElevEarth.toFixed(2)}°
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Earth Az</div>
            <div className="text-sm font-semibold text-slate-100">
              {current.earthAz.toFixed(1)}°
            </div>
          </div>
        </div>
      </div>

      {/* 3. Battery SoC, Net Power & Thermal Card */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {current.criticalPowerAlert ? (
              <BatteryWarning className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
              EPS &amp; Thermal State
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-300">
            Load: {CONSTANT_LOAD_W} W
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] uppercase text-slate-400">
              <Zap className="h-2.5 w-2.5" /> Net Pwr
            </div>
            <div
              className={`text-sm font-semibold ${
                current.netPowerW >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {current.netPowerW >= 0 ? '+' : ''}
              {current.netPowerW.toFixed(0)} W
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="text-[9px] uppercase text-slate-400">Battery SoC</div>
            <div
              className={`text-sm font-semibold ${
                current.criticalPowerAlert
                  ? 'text-red-400'
                  : current.batterySocPct < 45
                    ? 'text-amber-300'
                    : 'text-emerald-400'
              }`}
            >
              {current.batterySocPct.toFixed(1)}%
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/60 bg-slate-800/65 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] uppercase text-slate-400">
              <Thermometer className="h-2.5 w-2.5" /> Ext Temp
            </div>
            <div
              className={`text-sm font-semibold ${
                current.externalTempC > 0 ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {current.externalTempC > 0 ? '+' : ''}
              {current.externalTempC}°C
            </div>
          </div>
        </div>

        {/* Battery progress bar with 20% critical line */}
        <div className="mt-2.5">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-200 ${
                current.criticalPowerAlert
                  ? 'bg-red-500'
                  : current.batterySocPct < 45
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, current.batterySocPct))}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-red-400/90"
              style={{ left: `${CRITICAL_SOC_PCT}%` }}
              title="20% Critical Power Threshold"
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
            <span>
              {current.batteryWh.toFixed(0)} / {BATTERY_CAPACITY_WH} Wh
            </span>
            <span>Crit Threshold: {CRITICAL_SOC_PCT}%</span>
          </div>
        </div>
      </div>

      {/* 4. 360-deg Polar Horizon Radar */}
      <PolarHorizonRadar site={site} telemetry={telemetry} current={current} />

      {/* 5. 14-Day Battery SoC Trend Chart */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 shadow-md">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">
            14-Day Battery Profile
          </span>
          <span className="font-mono text-[10px] text-slate-400">Click to scrub</span>
        </div>
        <svg
          viewBox="0 0 320 76"
          onClick={handleChartClick}
          className="h-20 w-full cursor-pointer rounded-lg border border-slate-700/70 bg-slate-950/80"
          role="img"
          aria-label="14-day battery state of charge curve"
        >
          <defs>
            <linearGradient id="socAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Day reference gridlines (D3, D7, D10) */}
          {[72, 160, 238].map((xPos) => (
            <line
              key={xPos}
              x1={xPos}
              y1="4"
              x2={xPos}
              y2="72"
              stroke="#1e293b"
              strokeWidth="0.8"
            />
          ))}

          {/* 20% critical threshold line */}
          <line
            x1="0"
            y1={criticalY}
            x2="320"
            y2={criticalY}
            stroke="#ef4444"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text x="4" y={criticalY - 3} fill="#f87171" fontSize="8" fontFamily="monospace">
            20% CRIT
          </text>

          {/* SoC Gradient Area & Curve */}
          {socAreaPath && <path d={socAreaPath} fill="url(#socAreaGrad)" />}
          <path
            d={socPath}
            fill="none"
            stroke="#34d399"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />

          {/* Current hour playhead */}
          <line
            x1={playheadX}
            y1="0"
            x2={playheadX}
            y2="76"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeOpacity="0.7"
          />
          <circle cx={playheadX} cy={playheadY} r="3" fill="#22d3ee" />
        </svg>
      </div>
    </aside>
  );
}
