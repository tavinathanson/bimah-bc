/**
 * Geocoding utilities for ZIP code to lat/lon conversion
 * All operations are client-side only
 */

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface ZipCodeLocation extends Coordinates {
  zip: string;
  source: "cache" | "api";
}


const CACHE_KEY_PREFIX = "bimah_bc_zip_";

/**
 * Validate ZIP code format (5-digit numeric)
 */
export function isValidZipCode(zip: string | unknown): boolean {
  if (typeof zip !== "string") return false;
  const trimmed = zip.trim();
  // Match 5 digits, optionally followed by +4 extension (which we ignore)
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

/**
 * Normalize ZIP code to 5 digits
 */
export function normalizeZipCode(zip: string): string {
  const trimmed = zip.trim();

  // If it's a 4-digit number, assume leading zero was stripped (e.g., "8550" -> "08550")
  if (/^\d{4}$/.test(trimmed)) {
    return "0" + trimmed;
  }

  // Extract first 5 digits (handles ZIP+4 format)
  const match = trimmed.match(/^(\d{5})/);
  return match ? match[1] : trimmed;
}

/**
 * Get cached coordinates for a ZIP code
 */
function getCachedCoordinates(zip: string): Coordinates | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${zip}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.lat && parsed.lon) {
        return { lat: parsed.lat, lon: parsed.lon };
      }
    }
  } catch {
    // Ignore cache errors
  }

  return null;
}

/**
 * Cache coordinates for a ZIP code
 */
function cacheCoordinates(zip: string, coords: Coordinates): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${zip}`,
      JSON.stringify(coords)
    );
  } catch {
    // Ignore cache errors
  }
}

/**
 * Fetch coordinates from zippopotam.us API
 */
async function fetchFromAPI(zip: string): Promise<Coordinates | null> {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.places && data.places[0]) {
      const place = data.places[0];
      const lat = parseFloat(place.latitude);
      const lon = parseFloat(place.longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
  } catch {
    // API call failed
  }

  return null;
}


/**
 * Geocode a ZIP code to coordinates
 * 1. Check localStorage cache
 * 2. Try API call to zippopotam.us
 * 3. Return null if both fail
 */
export async function geocodeZipCode(zip: string): Promise<ZipCodeLocation | null> {
  const normalized = normalizeZipCode(zip);

  if (!isValidZipCode(normalized)) {
    return null;
  }

  // Try cache first
  const cached = getCachedCoordinates(normalized);
  if (cached) {
    return {
      zip: normalized,
      ...cached,
      source: "cache",
    };
  }

  // Try API
  const apiCoords = await fetchFromAPI(normalized);
  if (apiCoords) {
    cacheCoordinates(normalized, apiCoords);
    return {
      zip: normalized,
      ...apiCoords,
      source: "api",
    };
  }

  return null;
}

/**
 * Haversine formula to calculate distance between two coordinates in miles
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 3959; // Earth's radius in miles

  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const deltaLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLon = ((coord2.lon - coord1.lon) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance from a reference point (e.g., synagogue)
 */
export function calculateDistanceFromPoint(
  referencePoint: Coordinates,
  targetCoords: Coordinates
): number {
  return calculateDistance(referencePoint, targetCoords);
}
