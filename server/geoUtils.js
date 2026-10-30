/**
 * Geolocation & Haversine Distance Utilities for Vaayu
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate Great-Circle distance between two coordinates using the Haversine formula
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate compass bearing from point 1 to point 2 (in degrees 0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  const initialBearing = Math.atan2(y, x);
  return (toDegrees(initialBearing) + 360) % 360;
}

/**
 * Linear interpolation between two coordinates
 * @param {{lat: number, lng: number}} p1
 * @param {{lat: number, lng: number}} p2
 * @param {number} fraction Number between 0 and 1
 */
function interpolatePoint(p1, p2, fraction) {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * fraction,
    lng: p1.lng + (p2.lng - p1.lng) * fraction,
  };
}

module.exports = {
  EARTH_RADIUS_METERS,
  haversineDistance,
  calculateBearing,
  interpolatePoint,
};
