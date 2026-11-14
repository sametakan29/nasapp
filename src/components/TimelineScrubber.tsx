'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { HourlyTelemetry } from '@/lib/lunarScience';

interface TimelineScrubberProps {
  telemetry: HourlyTelemetry[];
  hourIndex: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: 1 | 2 | 4) => void;
  onSelectHour: (hour: number) => void;
}

function formatUtcDisplay(iso: string): string {
  // "2026-11-15T00:00:00.000Z" -> "2026-11-15 00:00 UTC"
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function formatMet(hourIndex: number): string {
  const days = Math.floor(hourIndex / 24);
  const hours = hourIndex % 24;
  return `T+${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h`;
}

export default function TimelineScrubber({
  telemetry,
  hourIndex,
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onChangeSpeed,
  onSelectHour,
}: TimelineScrubberProps) {
  const maxIdx = Math.max(0, telemetry.length - 1);
  const current = telemetry[hourIndex];

  const statusBadge =
    current?.timelineStatus === 'nominal'
      ? {
          label: 'NOMINAL (SUN + DTE)',
          cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        }
      : current?.timelineStatus === 'partial'
        ? {
            label: current.isSunVisible ? 'SUN ONLY (DTE OCCLUDED)' : 'DTE ONLY (SHADOW)',
            cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
          }
        : {
            label: 'BLACKOUT (SHADOW + LOS)',
            cls: 'border-red-500/40 bg-red-500/15 text-red-300',
          };

  return (
    <section
      aria-label="Mission Timeline Scrubber"
      className="border-t border-slate-800 bg-[#080D1A] px-4 py-2.5"
    >
      {/* Controls & Timestamp Row */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-1 font-mono text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/25"
            aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" /> PAUSE
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> PLAY
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectHour(Math.max(0, hourIndex - 1))}
            disabled={hourIndex <= 0}
            className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            title="Step back 1 hour"
            aria-label="Step back 1 hour"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectHour(Math.min(maxIdx, hourIndex + 1))}
            disabled={hourIndex >= maxIdx}
            className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            title="Step forward 1 hour"
            aria-label="Step forward 1 hour"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectHour(0)}
            className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 transition hover:border-slate-600"
            title="Reset timeline to Hour 0"
            aria-label="Reset timeline to Hour 0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="ml-1 flex items-center rounded border border-slate-800 bg-[#05080F] p-0.5 font-mono text-[10px]">
            {([1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onChangeSpeed(speed)}
                className={`rounded px-1.5 py-0.5 transition ${
                  playbackSpeed === speed
                    ? 'bg-cyan-500/25 font-bold text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`${speed} hour(s) per second`}
              >
                {speed}h/s
              </button>
            ))}
          </div>
        </div>

        {/* Timestamp & Status */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {current && (
            <>
              <span className="text-slate-200">
                {formatUtcDisplay(current.timestampUtc)}
              </span>
              <span className="rounded border border-slate-800 bg-[#05080F] px-2 py-0.5 text-[11px] text-cyan-300">
                {formatMet(hourIndex)} <span className="text-slate-500">(Hour {hourIndex + 1} / {telemetry.length})</span>
              </span>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}
              >
                {statusBadge.label}
              </span>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="hidden items-center gap-3 font-mono text-[10px] text-slate-400 xl:flex">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
            Sun + DTE
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" />
            Partial Link
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
            Shadow + Blackout
          </span>
        </div>
      </div>

      {/* Color-Coded 336-Hour Segment Bar + Interactive Slider */}
      <div className="relative flex flex-col gap-1">
        <div
          className="flex h-3 w-full overflow-hidden rounded border border-slate-800 bg-[#05080F]"
          aria-hidden="true"
        >
          {telemetry.map((item) => {
            const colorClass =
              item.timelineStatus === 'nominal'
                ? 'bg-emerald-500/85'
                : item.timelineStatus === 'partial'
                  ? 'bg-amber-500/85'
                  : 'bg-red-500/85';
            const isCurrent = item.hourIndex === hourIndex;
            return (
              <div
                key={item.hourIndex}
                onClick={() => onSelectHour(item.hourIndex)}
                className={`h-full flex-1 cursor-pointer transition-opacity hover:opacity-100 ${colorClass} ${
                  isCurrent ? 'ring-2 ring-white brightness-125' : 'opacity-80'
                }`}
              />
            );
          })}
        </div>

        <input
          type="range"
          min={0}
          max={maxIdx}
          step={1}
          value={hourIndex}
          onChange={(e) => onSelectHour(Number(e.target.value))}
          aria-label="Mission hour scrubber (0 to 335 hours)"
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
        />

        <div className="flex justify-between font-mono text-[9px] text-slate-500">
          <span>DAY 0 (Nov 15)</span>
          <span>DAY 3</span>
          <span>DAY 7</span>
          <span>DAY 10</span>
          <span>DAY 14 (Nov 29)</span>
        </div>
      </div>
    </section>
  );
}
