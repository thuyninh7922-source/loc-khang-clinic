(function attachLocationUtils(root, factory) {
  const utils = factory();
  if (typeof module === 'object' && module.exports) module.exports = utils;
  if (root) root.LocationUtils = utils;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createLocationUtils() {
  const EARTH_RADIUS_KM = 6371.0088;
  const radians = (degrees) => degrees * Math.PI / 180;
  const validCoordinate = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

  function distanceKm(pointA, pointB) {
    if (!pointA || !pointB
      || !validCoordinate(pointA.lat, -90, 90)
      || !validCoordinate(pointA.lng, -180, 180)
      || !validCoordinate(pointB.lat, -90, 90)
      || !validCoordinate(pointB.lng, -180, 180)) return Infinity;
    const lat1 = radians(Number(pointA.lat));
    const lat2 = radians(Number(pointB.lat));
    const deltaLat = lat2 - lat1;
    const deltaLng = radians(Number(pointB.lng) - Number(pointA.lng));
    const haversine = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
  }

  function nearestLocation(locations, point) {
    if (!Array.isArray(locations) || !point) return null;
    let closest = null;
    for (const location of locations) {
      const distance = distanceKm(point, location);
      if (!Number.isFinite(distance)) continue;
      if (!closest || distance < closest.distanceKm) closest = { ...location, distanceKm: distance };
    }
    return closest;
  }

  return { distanceKm, nearestLocation };
}));
