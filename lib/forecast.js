import { locations } from './locations.js';
import { inUganda } from './country.js';

const fields = {
  probability: ['precipitation_probability', 0, 100],
  precipitation: ['precipitation', 0, Infinity],
  cloudCover: ['cloud_cover', 0, 100],
  humidity: ['relative_humidity_2m', 0, 100],
  temperature: ['temperature_2m', -100, 70],
  windSpeed: ['wind_speed_10m', 0, Infinity],
};
const cache = new Map();
const cacheMilliseconds = 600_000;

function invalidInput(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function forecastLocations(input = {}) {
  const query = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  if ([...query.keys()].some(key => !['lat', 'lon'].includes(key))) {
    throw invalidInput('Only lat and lon parameters are supported.');
  }
  if (!query.has('lat') && !query.has('lon')) return locations;
  const coordinates = ['lat', 'lon'].map(key => {
    const values = query.getAll(key);
    if (values.length !== 1 || values[0].length > 25 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(values[0])) {
      throw invalidInput('Provide one numeric lat and lon coordinate.');
    }
    return Number(values[0]);
  });
  const [latitude, longitude] = coordinates;
  if (!inUganda(latitude, longitude)) {
    throw invalidInput('Choose a location within Uganda.');
  }
  const roundedLatitude = Math.round(latitude * 50) / 50;
  const roundedLongitude = Math.round(longitude * 50) / 50;
  const useRounded = inUganda(roundedLatitude, roundedLongitude);
  return [{
    id: 'selected-location', name: 'Selected location', region: 'Uganda',
    latitude: useRounded ? roundedLatitude : latitude,
    longitude: useRounded ? roundedLongitude : longitude,
  }];
}

export function normalizeLocation(raw, location, now = Date.now()) {
  const times = raw?.hourly?.time;
  if (!Array.isArray(times) || times.length < 24 || times.length > 120) {
    throw new Error('The forecast provider returned an incomplete timeline.');
  }
  const hourly = times.map((seconds, index) => {
    if (!Number.isFinite(seconds) || (index > 0 && seconds - times[index - 1] !== 3600)) {
      throw new Error('The forecast provider returned invalid hourly times.');
    }
    const row = {
      time: new Date(seconds * 1000).toISOString(),
      intervalStart: new Date((seconds - 3600) * 1000).toISOString(),
    };
    for (const [name, [providerName, min, max]] of Object.entries(fields)) {
      const values = raw.hourly[providerName];
      const value = Array.isArray(values) && values.length === times.length ? values[index] : null;
      row[name] = typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
    }
    return row;
  });
  if (times[0] * 1000 > now || !hourly.some(hour => Date.parse(hour.time) > now && (hour.probability !== null || hour.precipitation !== null))) {
    throw new Error('The forecast provider has no upcoming precipitation data.');
  }
  return {
    ...location,
    gridLatitude: Number.isFinite(raw.latitude) ? raw.latitude : null,
    gridLongitude: Number.isFinite(raw.longitude) ? raw.longitude : null,
    hourly,
  };
}

export async function getForecast(input = {}) {
  const selected = forecastLocations(input);
  const cacheKey = selected.map(point => `${point.latitude},${point.longitude}`).join(';');
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  if (cache.size >= 128) cache.delete(cache.keys().next().value);

  const promise = (async () => {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: selected.map(point => point.latitude).join(','),
      longitude: selected.map(point => point.longitude).join(','),
      hourly: Object.values(fields).map(([name]) => name).join(','),
      timezone: 'Africa/Kampala', timeformat: 'unixtime', forecast_days: '3', past_days: '1',
      temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`The forecast provider returned HTTP ${response.status}.`);
    const payload = await response.json();
    const forecasts = Array.isArray(payload) ? payload : [payload];
    if (forecasts.length !== selected.length) throw new Error('The forecast provider omitted requested locations.');
    const now = Date.now();
    return {
      fetchedAt: new Date(now).toISOString(),
      source: {
        name: 'Open-Meteo', url: 'https://open-meteo.com/en/docs', kind: 'forecast',
        model: 'Best Match', timezone: 'Africa/Kampala',
        probabilityDefinition: 'Chance of more than 0.1 mm precipitation during the preceding hour.',
        timeDefinition: 'Rain probability and amount cover intervalStart to time. Other variables are instantaneous at time.',
      },
      units: { probability: '%', precipitation: 'mm', cloudCover: '%', humidity: '%', temperature: '°C', windSpeed: 'km/h' },
      locations: forecasts.map((forecast, index) => normalizeLocation(forecast, selected[index], now)),
    };
  })();
  const entry = { expiresAt: Date.now() + cacheMilliseconds, promise };
  cache.set(cacheKey, entry);
  try {
    return await promise;
  } catch (error) {
    if (cache.get(cacheKey) === entry) cache.delete(cacheKey);
    throw error;
  }
}
