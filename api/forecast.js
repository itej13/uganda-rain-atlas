import { getForecast } from '../lib/forecast.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Use GET to request forecasts.' }));
  }
  try {
    const query = new URL(req.url, 'https://uganda-rain.local').searchParams;
    const forecast = await getForecast(query);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, must-revalidate');
    res.statusCode = 200;
    return res.end(JSON.stringify(forecast));
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = error.statusCode === 400 ? 400 : 503;
    if (res.statusCode === 503) res.setHeader('Retry-After', '60');
    return res.end(JSON.stringify({
      error: res.statusCode === 400 ? error.message : 'Live forecast data is temporarily unavailable. Please try again shortly.',
    }));
  }
}
