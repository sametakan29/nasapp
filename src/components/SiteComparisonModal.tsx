'use client';

import React from 'react';
import { Award, CheckCircle2, MapPin, ShieldAlert, X } from 'lucide-react';
import { SITE_LIST, SiteId, SiteMissionPayload } from '@/lib/lunarScience';

interface SiteComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  sitesData: Partial<Record<SiteId, SiteMissionPayload>>;
  activeSiteId: SiteId;
  onSelectSite: (siteId: SiteId) => void;
}

export default function SiteComparisonModal({
  isOpen,
  onClose,
  sitesData,
  activeSiteId,
  onSelectSite,
}: SiteComparisonModalProps) {
  if (!isOpen) return null;

  const payloads = SITE_LIST.map((site) => sitesData[site.id]).filter(
    (p): p is SiteMissionPayload => Boolean(p)
  );

  const topScore = payloads.reduce(
    (max, item) => Math.max(max, item.summary.feasibilityScore),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-comparison-title"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-700 bg-[#080D1A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2
              id="site-comparison-title"
              className="flex items-center gap-2 text-base font-bold tracking-wide text-slate-100"
            >
              <Award className="h-4 w-4 text-cyan-400" />
              14-Day CLPS Landing Site Trade-Off Comparison
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-400">
              Evaluation Window: 2026-11-15 00:00 UTC to 2026-11-29 00:00 UTC (336 Hours)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white"
            aria-label="Close site comparison modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#05080F] font-mono text-[11px] uppercase text-slate-400">
                  <th className="px-4 py-3">Candidate Landing Region</th>
                  <th className="px-3 py-3">Coordinates &amp; Alt</th>
                  <th className="px-3 py-3">Total Sunlit Hours</th>
                  <th className="px-3 py-3">Total DTE Comms</th>
                  <th className="px-3 py-3">Min Battery SoC</th>
                  <th className="px-3 py-3">Feasibility Score</th>
                  <th className="px-4 py-3 text-right">Mission Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {payloads.map((payload) => {
                  const { site, summary, source } = payload;
                  const isActive = site.id === activeSiteId;
                  const isTop = summary.feasibilityScore === topScore && topScore > 0;
                  const hasCritical = summary.criticalAlertHours > 0;
                  const isThermalLoss = summary.minBatterySocPct <= 0;

                  return (
                    <tr
                      key={site.id}
                      className={`transition ${
                        isActive ? 'bg-cyan-950/25' : 'bg-[#0B1120] hover:bg-slate-900/70'
                      }`}
                    >
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-100">
                          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{site.name}</span>
                          {isTop && (
                            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                              RECOMMENDED
                            </span>
                          )}
                          {isThermalLoss && (
                            <span className="rounded border border-red-500/60 bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-300">
                              THERMAL FREEZE / MISSION LOSS
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {site.subtitle}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-slate-500">
                          Source: {source}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top font-mono text-[11px] text-slate-300">
                        <div>Lat: {site.lat.toFixed(2)}°</div>
                        <div>Lon: {site.lon.toFixed(2)}°</div>
                        <div>Alt: {site.altKm.toFixed(1)} km</div>
                      </td>

                      <td className="px-3 py-3.5 align-top font-mono">
                        <div className="text-sm font-semibold text-amber-300">
                          {summary.totalSunlitHours} h
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {summary.sunlitPct}% of mission
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Peak: {summary.maxSolarPowerW.toFixed(0)} W
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top font-mono">
                        <div className="text-sm font-semibold text-cyan-300">
                          {summary.totalDteHours} h
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {summary.dtePct}% X-Band Lock
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Nominal (Both): {summary.nominalSimultaneousHours} h
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top font-mono">
                        <div
                          className={`flex items-center gap-1 text-sm font-semibold ${
                            hasCritical ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {hasCritical && <ShieldAlert className="h-3.5 w-3.5" />}
                          {summary.minBatterySocPct.toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {hasCritical
                            ? `${summary.criticalAlertHours}h < 20% alert`
                            : 'Zero critical alerts'}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Avg Net: {summary.avgNetPowerW >= 0 ? '+' : ''}
                          {summary.avgNetPowerW.toFixed(0)} W
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top font-mono">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-base font-bold ${
                              summary.feasibilityScore >= 75
                                ? 'text-emerald-400'
                                : summary.feasibilityScore >= 50
                                  ? 'text-amber-300'
                                  : 'text-red-400'
                            }`}
                          >
                            {summary.feasibilityScore}
                          </span>
                          <span className="text-[10px] text-slate-500">/ 100</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full ${
                              summary.feasibilityScore >= 75
                                ? 'bg-emerald-400'
                                : summary.feasibilityScore >= 50
                                  ? 'bg-amber-400'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${summary.feasibilityScore}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSite(site.id);
                            onClose();
                          }}
                          className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                            isActive
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                              : 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              ACTIVE
                            </>
                          ) : (
                            'LOAD SITE'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Engineering Notes */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {payloads.map(({ site }) => (
              <div
                key={site.id}
                className="rounded-lg border border-slate-800 bg-[#0B1120] p-3 text-xs"
              >
                <div className="font-semibold text-slate-200">{site.name}</div>
                <div className="mt-1 text-[11px] text-slate-400">{site.terrainProfile}</div>
                <div className="mt-1.5 text-[11px] text-slate-500">{site.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
