/**
 * Reverse geocode via Nominatim (OpenStreetMap). Used to derive a place label
 * (Office, Cafe, Home, Other) when capturing location at session start.
 * One request per session start; use with User-Agent per Nominatim policy.
 *
 * Coordinates are snapped to ~11m grid before geocoding so sessions a few
 * metres apart (GPS jitter) resolve to the same place and label.
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "deepwork-ai/1.0";
/** ~11m precision: same building/spot gets same label. */
const SNAP_DECIMALS = 4;

function snapCoord(value: number): number {
  const factor = 10 ** SNAP_DECIMALS;
  return Math.round(value * factor) / factor;
}

export type LocationLabel = "Office" | "Cafe" | "Home" | "Other";

function normalizeLabel(type: string | undefined, displayName: string): LocationLabel {
  const lower = (type ?? "").toLowerCase();
  const name = (displayName ?? "").toLowerCase();
  const combined = `${lower} ${name}`;

  if (/office|workplace|company|corporate|business\s*(park|center)/.test(combined)) return "Office";
  if (/cafe|coffee|starbucks|restaurant|bar|pub|bakery/.test(combined)) return "Cafe";
  if (/home|house|residential|apartment|flat|dwelling/.test(combined)) return "Home";

  return "Other";
}

export interface ReverseGeocodeResult {
  location_label: LocationLabel;
  display_name?: string;
}

/**
 * Reverse geocode (lat, lon) to a place label. Returns null on error or timeout.
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const snappedLat = snapCoord(lat);
    const snappedLon = snapCoord(lon);
    const params = new URLSearchParams({
      lat: String(snappedLat),
      lon: String(snappedLon),
      format: "json",
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      type?: string;
      class?: string;
      display_name?: string;
    };
    const type = data.type ?? data.class;
    const displayName = data.display_name ?? "";
    const location_label = normalizeLabel(type, displayName);
    return { location_label, display_name: displayName || undefined };
  } catch {
    return null;
  }
}
