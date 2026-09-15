export const SATELLITE_LAYER = 'mtg_fd:ir105_hrfi';
export const SATELLITE_WMS = 'https://view.eumetsat.int/geoserver/wms';
export const IMAGE_BOUNDS = [[-1.6, 29], [4.4, 35.1]];
export const CAPABILITIES_URL = `${SATELLITE_WMS}?service=WMS&version=1.3.0&request=GetCapabilities`;

export function parseSatelliteMetadata(xml, now = Date.now()) {
  // ponytail: parse this one published WMS layer; use an XML parser if more schemas are needed.
  const name = xml.match(/<(?:\w+:)?Name>\s*mtg_fd:ir105_hrfi\s*<\/(?:\w+:)?Name>/);
  if (!name) throw new Error('The infrared layer is missing from EUMETSAT metadata.');
  const layer = xml.slice(name.index).split(/<\/(?:\w+:)?Layer>/, 1)[0];
  const dimension = layer.match(/<(?:\w+:)?Dimension\b([^>]*\bname=["']time["'][^>]*)>([^<]+)<\/(?:\w+:)?Dimension>/);
  const range = dimension?.[2].trim().split('/');
  const advertised = dimension?.[1].match(/\bdefault=["']([^"']+)["']/)?.[1];
  const latestMs = Date.parse(advertised || range?.[1]);
  const startMs = Date.parse(range?.[0]);
  if (range?.[2] !== 'PT10M' || !Number.isFinite(startMs) || !Number.isFinite(latestMs) || latestMs < startMs || latestMs > now) {
    throw new Error('EUMETSAT returned an invalid or unsupported imagery time range.');
  }
  const latest = new Date(latestMs).toISOString();
  const ageMinutes = Math.max(0, Math.floor((now - latestMs) / 60_000));
  const frames = Array.from({ length: 12 }, (_, i) => latestMs - (11 - i) * 600_000)
    .filter(time => time >= startMs)
    .map(time => {
      const timestamp = new Date(time).toISOString();
      return { time: timestamp, url: `/api/satellite-image?time=${encodeURIComponent(timestamp)}` };
    });
  return {
    source: 'EUMETSAT Meteosat Third Generation / EUMETView',
    attribution: `This service is based on EUMETSAT Meteosat imagery ${new Date(latestMs).getUTCFullYear()}.`,
    sourceUrl: 'https://user.eumetsat.int/resources/user-guides/eumet-view-user-guide',
    layer: SATELLITE_LAYER,
    latest,
    fetchedAt: new Date(now).toISOString(),
    ageMinutes,
    stale: ageMinutes > 90,
    cadenceMinutes: 10,
    frames,
    imageBounds: IMAGE_BOUNDS,
    description: 'Observed infrared cloud imagery. Brighter areas generally indicate colder, higher cloud tops; brightness is not rainfall intensity. Frames follow the published 10-minute cadence; occasional acquisition gaps are possible.',
  };
}

export function satelliteImageUrl(time, now = Date.now()) {
  if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(time)) {
    throw new Error('A UTC imagery timestamp is required.');
  }
  const timestamp = Date.parse(time);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().replace('.000Z', 'Z') !== time.replace('.000Z', 'Z') || timestamp % 600_000 !== 0 || timestamp > now || timestamp < now - 86_400_000) {
    throw new Error('Choose a 10-minute imagery timestamp within the past 24 hours.');
  }
  const parameters = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap',
    layers: SATELLITE_LAYER, styles: '', format: 'image/png',
    // EUMETSAT reprojects the geographic IMAGE_BOUNDS to Leaflet's default Web Mercator.
    crs: 'EPSG:3857', bbox: '3228265.233,-178134.339,3907314.127,490287.900', width: '732', height: '720',
    time: new Date(timestamp).toISOString(), transparent: 'true',
  });
  return `${SATELLITE_WMS}?${parameters}`;
}
