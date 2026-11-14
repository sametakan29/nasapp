'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart3,
  Info,
  MapPin,
  RefreshCw,
  SatelliteDish,
} from 'lucide-react';
import {
  computeMissionTelemetry,
  generateFallbackEphemeris,
  SITE_LIST,
  SiteId,
  SiteMissionPayload,
} from '@/lib/lunarScience';
import TelemetryHUD from '@/components/TelemetryHUD';
import TimelineScrubber from '@/components/TimelineScrubber';
import SiteComparisonModal from '@/components/SiteComparisonModal';
import AttributionModal from '@/components/AttributionModal';

const LunarViewport3D = dynamic(() => import('@/components/LunarViewport3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-800 bg-[#05080F] font-mono text-xs text-slate-400">
      INITIALIZING 3D LUNAR TERRAIN ENGINE...
    </div>
  ),
});

function buildInitialFallbackMap(): Record<SiteId, SiteMissionPayload> {
  const result = {} as Record<SiteId, SiteMissionPayload>;
  for (const site of SITE_LIST) {
    result[site.id] = computeMissionTelemetry(
      site,
      generateFallbackEphemeris(site),
      'JPL Ephemeris Fallback'
    );
  }
  return result;
}

export default function HomePage() {
  const [sitesData, setSitesData] = useState<Record<SiteId, SiteMissionPayload>>(
    () => buildInitialFallbackMap()
  );
  const [activeSiteId, setActiveSiteId] = useState<SiteId>('malapert');
  const [hourIndex, setHourIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [comparisonOpen, setComparisonOpen] = useState<boolean>(false);
  const [attributionOpen, setAttributionOpen] = useState<boolean>(false);

  const fetchAllSites = useCallback(async (forceRefresh = false) => {
    const endpoint = forceRefresh
      ? '/api/ephemeris?site=all&refresh=1'
      : '/api/ephemeris?site=all';
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      sites?: Record<SiteId, SiteMissionPayload>;
    };
    if (data?.sites?.malapert && data?.sites?.shackleton && data?.sites?.nobile) {
      return data.sites;
    }
    return null;
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      const nextSites = await fetchAllSites(true);
      if (nextSites) setSitesData(nextSites);
    } catch (err) {
      console.warn('Live ephemeris refresh fallback active:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchAllSites]);

  useEffect(() => {
    let active = true;
    fetchAllSites(false)
      .then((nextSites) => {
        if (active && nextSites) {
          setSitesData(nextSites);
        }
      })
      .catch((err) => {
        console.warn('Live ephemeris fetch fallback active:', err);
      })
      .finally(() => {
        if (active) setIsSyncing(false);
      });
    return () => {
      active = false;
    };
  }, [fetchAllSites]);

  const activePayload = sitesData[activeSiteId];
  const maxHourIndex = Math.max(0, activePayload.telemetry.length - 1);
  const safeHourIndex = Math.min(hourIndex, maxHourIndex);
  const currentTelemetry = useMemo(
    () => activePayload.telemetry[safeHourIndex] ?? activePayload.telemetry[0],
    [activePayload, safeHourIndex]
  );

  // Playback timer: 1 hour/sec at 1x speed (adjusted for 2x / 4x speeds)
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.round(1000 / playbackSpeed);
    const timer = window.setInterval(() => {
      setHourIndex((prev) => {
        if (prev >= maxHourIndex) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, maxHourIndex]);

  const handleSelectHour = useCallback((nextHour: number) => {
    setIsPlaying(false);
    setHourIndex(nextHour);
  }, []);

  const handleSelectSite = useCallback((siteId: SiteId) => {
    setActiveSiteId(siteId);
  }, []);

  const isLiveHorizons = activePayload.source === 'NASA JPL Horizons Live';

  return (
    <div className="flex min-h-screen flex-col bg-[#070B14] text-slate-100 lg:h-screen lg:overflow-hidden">
      {/* Top Aerospace Mission Control Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 bg-slate-900/95 px-4 py-2.5">
        {/* Custom Geometric Brand Icon + Title (No official NASA branding) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/50">
            <svg
              viewBox="0 0 32 32"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <path
                d="M5 20 Q16 14 27 20"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.6"
              />
              <circle cx="22" cy="11" r="2.2" fill="#fbbf24" />
              <polygon points="16,13 18.5,19 13.5,19" fill="#22d3ee" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-widest text-slate-100">
                LUNARHORIZON
              </h1>
              <span className="rounded border border-slate-600/80 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                CLPS MISSION NAVIGATOR
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-400">
              South Pole Topographic Line-of-Sight &amp; Telemetry Simulator (Nov 15–29, 2026)
            </p>
          </div>
        </div>

        {/* Landing Site Switcher Pills */}
        <nav
          aria-label="Candidate CLPS Landing Sites"
          className="flex flex-wrap items-center gap-1.5"
        >
          {SITE_LIST.map((site) => {
            const payload = sitesData[site.id];
            const isSelected = site.id === activeSiteId;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => handleSelectSite(site.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                  isSelected
                    ? 'border-cyan-500/70 bg-cyan-500/15 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.18)]'
                    : 'border-slate-700/80 bg-slate-800/65 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <MapPin
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSelected ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="text-[11px] font-semibold leading-tight">
                    {site.name}
                  </div>
                  <div className="text-[9px] leading-tight text-cyan-300/85">
                    {site.subtitle}
                  </div>
                  <div className="font-mono text-[9px] text-slate-400">
                    Sun {payload.summary.sunlitPct}% · DTE {payload.summary.dtePct}%
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Action & Ephemeris Source Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setComparisonOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-300"
          >
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
            Compare Sites
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold transition ${
              isLiveHorizons
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Refresh live NASA JPL Horizons ephemeris"
          >
            {isSyncing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <SatelliteDish className="h-3 w-3" />
            )}
            <span>{isSyncing ? 'SYNCING JPL...' : activePayload.source}</span>
          </button>

          <button
            type="button"
            onClick={() => setAttributionOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 py-1.5 font-mono text-[10px] text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            AI &amp; Data Attribution
          </button>
        </div>
      </header>

      {/* Main Mission Control Workspace */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 lg:grid-cols-[1fr_370px]">
        {/* Center Stage: 3D Lunar South Pole Terrain Viewport */}
        <div className="min-h-[420px] lg:min-h-0">
          <LunarViewport3D site={activePayload.site} current={currentTelemetry} />
        </div>

        {/* Right Panel: Telemetry & Engineering HUD */}
        <div className="min-h-0">
          <TelemetryHUD
            site={activePayload.site}
            telemetry={activePayload.telemetry}
            current={currentTelemetry}
            onSelectHour={handleSelectHour}
          />
        </div>
      </main>

      {/* Bottom Dock: 14-Day Mission Timeline Scrubber */}
      <TimelineScrubber
        telemetry={activePayload.telemetry}
        hourIndex={safeHourIndex}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onTogglePlay={() => setIsPlaying((prev) => !prev)}
        onChangeSpeed={setPlaybackSpeed}
        onSelectHour={handleSelectHour}
      />

      {/* Persistent Compliance Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-[#05080F] px-4 py-1.5 font-mono text-[10px] text-slate-400">
        <div>
          Ephemeris data fetched live from <span className="text-slate-300">NASA JPL Horizons System</span>; terrain horizon masks are representative 360° profiles modeled after <span className="text-slate-300">LRO LOLA</span> South Pole elevation ranges; EPS battery telemetry uses a simplified 450W solar / 140W constant avionics load model.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            Code structure, 3D visualization shaders, and ephemeris parsing utilities were developed with Super Intelligence (AI) assistance.
          </span>
          <button
            type="button"
            onClick={() => setAttributionOpen(true)}
            className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
          >
            Details
          </button>
        </div>
      </footer>

      {/* Modals */}
      <SiteComparisonModal
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        sitesData={sitesData}
        activeSiteId={activeSiteId}
        onSelectSite={handleSelectSite}
      />
      <AttributionModal
        isOpen={attributionOpen}
        onClose={() => setAttributionOpen(false)}
      />
    </div>
  );
}
