import { NextRequest, NextResponse } from 'next/server';
import {
  computeMissionTelemetry,
  EphemerisPoint,
  generateFallbackEphemeris,
  LANDING_SITES,
  LandingSite,
  MISSION_HOURS,
  SITE_LIST,
  SiteId,
  SiteMissionPayload,
} from '@/lib/lunarScience';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HORIZONS_TIMEOUT_MS = 4000;

interface CacheEntry {
  payload: SiteMissionPayload;
  expiresAt: number;
}

const ephemerisCache = new Map<SiteId, CacheEntry>();

const MONTH_MAP: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

interface ParsedBodyRow {
  timestampUtc: string;
  azi: number;
  elev: number;
}

function buildHorizonsUrl(site: LandingSite, command: '10' | '399'): string {
  const siteCoord = `${site.lon.toFixed(2)},${site.lat.toFixed(2)},${site.altKm.toFixed(1)}`;
  return (
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=json` +
    `&COMMAND='${command}'` +
    `&OBJ_DATA='NO'` +
    `&MAKE_EPHEM='YES'` +
    `&EPHEM_TYPE='OBSERVER'` +
    `&CENTER='coord@301'` +
    `&COORD_TYPE='GEODETIC'` +
    `&SITE_COORD='${siteCoord}'` +
    `&START_TIME='2026-11-15'` +
    `&STOP_TIME='2026-11-29'` +
    `&STEP_SIZE='1h'` +
    `&QUANTITIES='4'`
  );
}

function formatCalTimestampToIso(calStr: string): string {
  // Expected format: "2026-Nov-15 00:00"
  const parts = calStr.trim().match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!parts) return calStr.trim();
  const [, year, monAbbr, day, hour, minute] = parts;
  const month = MONTH_MAP[monAbbr] ?? '11';
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

/**
 * Extracts apparent Azimuth and Elevation rows strictly between $$SOE and $$EOE markers.
 */
function parseHorizonsAscii(resultText: string): ParsedBodyRow[] {
  const soeIdx = resultText.indexOf('$$SOE');
  const eoeIdx = resultText.indexOf('$$EOE');
  if (soeIdx === -1 || eoeIdx === -1 || eoeIdx <= soeIdx) {
    throw new Error('Missing $$SOE / $$EOE ephemeris block in Horizons output');
  }

  const block = resultText.slice(soeIdx + 5, eoeIdx);
  const lines = block.split(/\r?\n/);
  const rows: ParsedBodyRow[] = [];

  const rowRegex =
    /^\s*(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}).*?([+-]?\d+\.\d+)\s+([+-]?\d+\.\d+)\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(rowRegex);
    if (!match) continue;

    const timestampUtc = formatCalTimestampToIso(match[1]);
    const azi = Number.parseFloat(match[2]);
    const elev = Number.parseFloat(match[3]);

    if (Number.isFinite(azi) && Number.isFinite(elev)) {
      rows.push({ timestampUtc, azi, elev });
    }
  }

  return rows;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHorizonsBody(
  site: LandingSite,
  command: '10' | '399'
): Promise<ParsedBodyRow[]> {
  const url = buildHorizonsUrl(site, command);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LunarHorizon-CLPS-MissionPlanner/1.0',
      },
      signal: AbortSignal.timeout(HORIZONS_TIMEOUT_MS),
      cache: 'no-store',
    });

    if ((response.status === 503 || response.status === 429) && attempt < maxAttempts) {
      await sleep(350 * attempt);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Horizons API HTTP ${response.status} for command ${command}`);
    }

    const data = (await response.json()) as { result?: string; error?: string };
    if (!data || typeof data.result !== 'string') {
      throw new Error(data?.error ?? 'Malformed Horizons JSON payload');
    }

    const parsed = parseHorizonsAscii(data.result);
    if (parsed.length < MISSION_HOURS) {
      throw new Error(
        `Insufficient Horizons rows (${parsed.length} < ${MISSION_HOURS}) for command ${command}`
      );
    }

    return parsed.slice(0, MISSION_HOURS);
  }

  throw new Error(`Horizons API retry exhausted for command ${command}`);
}

async function getSiteMissionPayload(
  siteId: SiteId,
  forceRefresh = false
): Promise<SiteMissionPayload> {
  const now = Date.now();
  const cached = ephemerisCache.get(siteId);
  if (
    !forceRefresh &&
    cached &&
    cached.expiresAt > now &&
    cached.payload.source === 'NASA JPL Horizons Live'
  ) {
    return cached.payload;
  }

  const site = LANDING_SITES[siteId];
  const fetchedAtUtc = new Date().toISOString();

  try {
    // Sequential per-body fetch avoids JPL Horizons concurrent burst HTTP 503 rate limits
    const sunRows = await fetchHorizonsBody(site, '10');
    const earthRows = await fetchHorizonsBody(site, '399');

    const ephemeris: EphemerisPoint[] = [];
    for (let i = 0; i < MISSION_HOURS; i++) {
      const sun = sunRows[i];
      const earth = earthRows[i];
      ephemeris.push({
        hourIndex: i,
        timestampUtc: sun.timestampUtc,
        sunAz: sun.azi,
        sunElev: sun.elev,
        earthAz: earth.azi,
        earthElev: earth.elev,
      });
    }

    const payload = computeMissionTelemetry(
      site,
      ephemeris,
      'NASA JPL Horizons Live',
      fetchedAtUtc
    );

    ephemerisCache.set(siteId, {
      payload,
      expiresAt: now + CACHE_TTL_MS,
    });

    return payload;
  } catch (err) {
    console.warn(
      `[LunarHorizon] Horizons fetch failed for ${siteId}, activating analytical fallback:`,
      err instanceof Error ? err.message : err
    );

    // Return cached live data if available even if stale, otherwise analytical fallback
    if (cached && cached.payload.source === 'NASA JPL Horizons Live') {
      return cached.payload;
    }

    const fallbackPoints = generateFallbackEphemeris(site);
    const fallbackPayload = computeMissionTelemetry(
      site,
      fallbackPoints,
      'JPL Ephemeris Fallback',
      fetchedAtUtc
    );

    // Short 2-minute TTL on fallback so live Horizons recovers quickly once reachable
    ephemerisCache.set(siteId, {
      payload: fallbackPayload,
      expiresAt: now + 120_000,
    });

    return fallbackPayload;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteParam = (searchParams.get('site') ?? 'all').toLowerCase();
  const forceRefresh = searchParams.get('refresh') === '1';

  if (siteParam === 'all') {
    const sitesRecord = {} as Record<SiteId, SiteMissionPayload>;
    for (const site of SITE_LIST) {
      sitesRecord[site.id] = await getSiteMissionPayload(site.id, forceRefresh);
    }

    return NextResponse.json(
      {
        sites: sitesRecord,
        fetchedAtUtc: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  }

  if (siteParam === 'malapert' || siteParam === 'shackleton' || siteParam === 'nobile') {
    const payload = await getSiteMissionPayload(siteParam, forceRefresh);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  return NextResponse.json(
    { error: 'Invalid site parameter. Expected malapert, shackleton, nobile, or all.' },
    { status: 400 }
  );
}
