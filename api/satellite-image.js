import { satelliteImageUrl } from '../lib/satellite.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').end();
  let url;
  try {
    url = satelliteImageUrl(req.query.time);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('image/png')) {
      throw new Error('EUMETSAT did not return an imagery frame.');
    }
    if (/nearest|default value/i.test(upstream.headers.get('warning') || '')) {
      throw new Error('The requested capture time is unavailable; EUMETSAT substituted another frame.');
    }
    const image = Buffer.from(await upstream.arrayBuffer());
    if (image.length < 8 || image.length > 5_000_000 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('EUMETSAT returned an invalid imagery frame.');
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(image);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'This satellite frame could not be loaded.', detail: error.message });
  }
}
