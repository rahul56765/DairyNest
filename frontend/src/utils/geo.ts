// Haversine distance in meters
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export type Coords = { lat: number; lng: number };

export function nearestAddress(coords: Coords, addresses: any[]): { addr: any; meters: number } | null {
  const withCoords = addresses.filter((a) => typeof a.lat === "number" && typeof a.lng === "number");
  if (withCoords.length === 0) return null;
  let best: { addr: any; meters: number } | null = null;
  for (const a of withCoords) {
    const m = haversineMeters(coords.lat, coords.lng, a.lat, a.lng);
    if (!best || m < best.meters) best = { addr: a, meters: m };
  }
  return best;
}
