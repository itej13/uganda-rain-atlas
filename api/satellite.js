import { CAPABILITIES_URL, parseSatelliteMetadata } from '../lib/satellite.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').end();
  try {
    const upstream = await fetch(CAPABILITIES_URL, { signal: AbortSignal.timeout(15_000) });
    if (!upstream.ok) throw new Error(`EUMETSAT metadata returned HTTP ${upstream.status}.`);
    const metadata = parseSatelliteMetadata(await upstream.text());
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.status(200).json(metadata);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Satellite imagery is temporarily unavailable.', detail: error.message });
  }
}
