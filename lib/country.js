import { readFileSync } from 'node:fs';

const boundary = JSON.parse(readFileSync(new URL('../public/uganda.geojson', import.meta.url), 'utf8'));
const polygons = boundary.features.flatMap(({ geometry }) => geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]);

function insideRing(longitude, latitude, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [x1, y1] = ring[previous];
    const [x2, y2] = ring[current];
    const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10 && longitude >= Math.min(x1, x2) && longitude <= Math.max(x1, x2)
      && latitude >= Math.min(y1, y2) && latitude <= Math.max(y1, y2)) return true;
    if ((y1 > latitude) !== (y2 > latitude) && longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export function inUganda(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return polygons.some(([outer, ...holes]) => insideRing(longitude, latitude, outer)
    && holes.every(hole => !insideRing(longitude, latitude, hole)));
}
