import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastLocations, normalizeLocation } from '../lib/forecast.js';
import { inUganda } from '../lib/country.js';
import handler from '../api/forecast.js';

test('forecast input, UTC rain intervals, missing data and API failures remain honest', async t => {
  assert.equal(forecastLocations().length, 16);
  assert.ok(forecastLocations().every(point => inUganda(point.latitude, point.longitude)));
  assert.equal(inUganda(0, 35), false); // In the old bounding box, but in Kenya.
  assert.equal(inUganda(0, NaN), false);
  assert.deepEqual(forecastLocations({ lat: '0.3476', lon: '32.5825' })[0], {
    id: 'selected-location', name: 'Selected location', region: 'Uganda', latitude: 0.34, longitude: 32.58,
  });
  for (const query of [{ lat: '', lon: '32' }, { lat: '0' }, { lat: '2', lon: 'Infinity' }, { lat: '51', lon: '32' }, { lat: '0', lon: '35' }, { url: 'https://example.com' }, new URLSearchParams('lat=0&lat=1&lon=32')]) {
    assert.throws(() => forecastLocations(query), error => error.statusCode === 400);
  }
  const start = Date.parse('2026-09-14T21:00:00Z') / 1000; // 00:00 East Africa Time.
  const raw = { hourly: {
    time: Array.from({ length: 24 }, (_, index) => start + index * 3600),
    precipitation_probability: Array(24).fill(0), precipitation: Array(24).fill(0),
    cloud_cover: Array(24).fill(null), relative_humidity_2m: Array(23).fill(80),
  } };
  raw.hourly.precipitation_probability[1] = null;
  raw.hourly.precipitation_probability[2] = '70';
  raw.hourly.precipitation_probability[3] = 101;
  const point = forecastLocations()[0];
  const normalized = normalizeLocation(raw, point, start * 1000);
  assert.equal(normalized.hourly[0].time, '2026-09-14T21:00:00.000Z');
  assert.equal(normalized.hourly[0].intervalStart, '2026-09-14T20:00:00.000Z');
  assert.equal(normalized.hourly[0].probability, 0);
  assert.equal(normalized.hourly[1].probability, null);
  assert.equal(normalized.hourly[2].probability, null);
  assert.equal(normalized.hourly[3].probability, null);
  assert.equal(normalized.hourly[0].humidity, null);
  assert.equal(normalized.hourly[0].temperature, null);
  assert.throws(() => normalizeLocation(raw, point, Date.parse('2026-09-17T00:00Z')), /upcoming/);
  const malformed = structuredClone(raw);
  malformed.hourly.time[1] += 1;
  assert.throws(() => normalizeLocation(malformed, point, start * 1000), /hourly times/);
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
  await handler({ method: 'POST', url: '/api/forecast' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  await handler({ method: 'GET', url: '/api/forecast?lat=99&lon=32' }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Provider unreachable'); });
  await handler({ method: 'GET', url: '/api/forecast' }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(res.body.error, /temporarily unavailable/);
});
