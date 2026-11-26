const test = require('node:test');
const assert = require('node:assert/strict');
const locations = require('../data/locations.json');
const { distanceKm, nearestLocation } = require('../public/location-utils');

test('sample locations cover northern, central, and southern Vietnam with unique IDs', () => {
  assert.equal(locations.length, 7);
  assert.equal(new Set(locations.map((location) => location.id)).size, locations.length);
  assert.ok(locations.every((location) => location.sample === true));
  assert.ok(locations.some((location) => location.city === 'Hà Nội'));
  assert.ok(locations.some((location) => location.city === 'Đà Nẵng'));
  assert.ok(locations.some((location) => location.city === 'TP. Hồ Chí Minh'));
});

test('Haversine distance is zero for equal points and symmetric for two cities', () => {
  const hanoi = locations.find((location) => location.city === 'Hà Nội');
  const hcmc = locations.find((location) => location.city === 'TP. Hồ Chí Minh');
  assert.equal(distanceKm(hanoi, hanoi), 0);
  assert.ok(Math.abs(distanceKm(hanoi, hcmc) - distanceKm(hcmc, hanoi)) < 1e-9);
  assert.ok(distanceKm(hanoi, hcmc) > 1000);
});

test('nearest location returns the closest branch and distance in kilometers', () => {
  const hanoi = locations.find((location) => location.city === 'Hà Nội');
  const nearest = nearestLocation(locations, { lat: hanoi.lat, lng: hanoi.lng });
  assert.equal(nearest.id, hanoi.id);
  assert.equal(nearest.distanceKm, 0);
  assert.equal(nearestLocation([], hanoi), null);
  assert.equal(distanceKm({ lat: 999, lng: 0 }, hanoi), Infinity);
});
