/**
 * Haversine formula — straight-line distance between two GPS coordinates.
 * Returns distance in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate delivery fee based on distance.
 * Formula: max(minFee, round(distKm * pricePerKm))
 * Returns fee in BRL (whole number, no cents).
 */
export function calcDeliveryFee(
  distKm: number,
  pricePerKm: number,
  minFee = 3
): number {
  return Math.max(minFee, Math.round(distKm * pricePerKm));
}
