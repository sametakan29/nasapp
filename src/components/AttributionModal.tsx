'use client';

import React from 'react';
import { Cpu, Database, ShieldCheck, X } from 'lucide-react';

interface AttributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AttributionModal({ isOpen, onClose }: AttributionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attribution-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-[#080D1A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2
            id="attribution-title"
            className="flex items-center gap-2 text-base font-bold tracking-wide text-slate-100"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            AI &amp; Data Attribution Notice
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white"
            aria-label="Close attribution modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs leading-relaxed text-slate-300">
          {/* Mandatory NASA Open Data Attribution */}
          <div className="rounded-lg border border-slate-800 bg-[#0B1120] p-4">
            <div className="mb-1.5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Database className="h-4 w-4" />
              NASA Open Data Attribution
            </div>
            <ul className="list-disc space-y-1.5 pl-4 text-slate-300">
              <li>
                <strong>NASA JPL Horizons System:</strong> Ephemeris data fetched live from NASA JPL Horizons System (<span className="font-mono text-slate-400">DE441</span>) for topocentric apparent Azimuth and Elevation of the Sun (Target 10) and Earth (Target 399) at lunar geodetic coordinates.
              </li>
              <li>
                <strong>Terrain &amp; EPS Modeling Scope:</strong> Terrain horizon masks are representative 360° profiles modeled after NASA LRO LOLA (Lunar Orbiter Laser Altimeter) South Pole elevation ranges; EPS battery telemetry uses a simplified 450W solar / 140W constant avionics load model.
              </li>
            </ul>
          </div>

          {/* Mandatory Super Intelligence Disclosure */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="mb-1.5 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Cpu className="h-4 w-4" />
              Super Intelligence (SI / AI) Transparency
            </div>
            <p className="text-slate-200">
              &ldquo;Code structure, 3D visualization shaders, and ephemeris parsing utilities were developed with Super Intelligence (AI) assistance.&rdquo;
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#05080F] px-4 py-3 font-mono text-[11px] text-slate-400">
            Compliance Note: LunarHorizon uses custom geometric vector icons only and displays no official NASA logos, insignias, or mission patches. Public, zero-authentication engineering tool for the 2026 Space Apps Challenge (Sakarya).
          </div>
        </div>
      </div>
    </div>
  );
}
