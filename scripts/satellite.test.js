import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_BOUNDS, parseSatelliteMetadata, satelliteImageUrl } from '../lib/satellite.js';
import satelliteImageHandler from '../api/satellite-image.js';

test('satellite metadata uses provider time, marks stale observations, and constrains image requests', () => {
  const now = Date.parse('2026-09-15T14:45:00Z');
  const xml = '<Layer><Name>other</Name><Dimension name="time" default="2026-09-15T14:40:00Z">ignored</Dimension></Layer><Layer><Name>mtg_fd:ir105_hrfi</Name><Dimension name="time" default="2026-09-15T14:10:00Z" units="ISO8601">2024-09-23T00:00:00.000Z/2026-09-15T14:10:00.000Z/PT10M</Dimension></Layer>';
  const metadata = parseSatelliteMetadata(xml, now);
  assert.equal(metadata.latest, '2026-09-15T14:10:00.000Z');
  assert.equal(metadata.ageMinutes, 35);
  assert.equal(metadata.stale, false);
  assert.equal(metadata.frames.length, 12);
  assert.equal(metadata.frames[0].time, '2026-09-15T12:20:00.000Z');
  assert.equal(metadata.frames.at(-1).time, metadata.latest);
  assert.equal(parseSatelliteMetadata(xml, now + 7_200_000).stale, true);
  assert.throws(() => parseSatelliteMetadata(xml, Date.parse('2026-09-15T14:05:00Z')));
  assert.throws(() => parseSatelliteMetadata('<Layer/>', now));
  assert.throws(() => parseSatelliteMetadata(xml.replace('PT10M', 'PT1H'), now));
  const image = new URL(satelliteImageUrl(metadata.latest, now));
  assert.equal(image.hostname, 'view.eumetsat.int');
  assert.equal(image.searchParams.get('crs'), 'EPSG:3857');
  const bbox = image.searchParams.get('bbox').split(',').map(Number);
  for (let corner = 0; corner < 2; corner++) {
    const longitude = bbox[corner * 2] / 6378137 * 180 / Math.PI;
    const latitude = (2 * Math.atan(Math.exp(bbox[corner * 2 + 1] / 6378137)) - Math.PI / 2) * 180 / Math.PI;
    assert.ok(Math.abs(latitude - IMAGE_BOUNDS[corner][0]) < 0.000001);
    assert.ok(Math.abs(longitude - IMAGE_BOUNDS[corner][1]) < 0.000001);
  }
  assert.equal(image.searchParams.get('time'), metadata.latest);
  for (const invalid of ['https://evil.example/image', '2026-09-15T14:11:00Z', '2026-09-15T14:50:00Z', '2026-09-16T14:10:00Z', '2026-09-13T14:10:00Z', '2026-02-30T14:10:00Z', ['2026-09-15T14:10:00Z']]) {
    assert.throws(() => satelliteImageUrl(invalid, now));
  }
});

test('a provider-substituted frame is never shown under the requested timestamp', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', {
    headers: { 'Content-Type': 'image/png', Warning: '99 Nearest value used: TIME=2026-09-15T14:00:00Z' },
  }));
  const response = { status(code) { this.code = code; return this; }, setHeader() {}, json(body) { this.body = body; } };
  const time = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
  await satelliteImageHandler({ method: 'GET', query: { time } }, response);
  assert.equal(response.code, 502);
  assert.match(response.body.detail, /substituted/);
});
