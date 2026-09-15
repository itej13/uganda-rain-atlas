# Rain Atlas — Uganda

A public, noncommercial Uganda rain explorer with hourly forecasts, animated Meteosat cloud imagery, a reproducible experimental model, and sourced dataset research.

**[Open the live website](https://uganda-rain-atlas.vercel.app/)** · **[GitHub repository](https://github.com/itej13/uganda-rain-atlas)**

## What works

- Hourly rain probability, rainfall amount, cloud cover, humidity, temperature and wind for 16 towns. Search a town or click a location within Uganda for a forecast.
- A 24-hour forecast timeline and chart, shown in East Africa Time (UTC+3).
- Country-wide EUMETSAT MTG infrared cloud animation: 12 captures at the advertised 10-minute cadence, capture times, feed age and error states.
- A research page with Uganda dataset sources and measured model results. The experimental model is visible here; the main map uses Open-Meteo operational forecasts.
- No login or API keys required for current public providers. No fabricated fallback weather, payment integration or paid subscription.

## Run and test

Node.js 22:

```sh
npm ci
npm run dev
npm test
npm run build
```

Open http://127.0.0.1:4180. Vite's development middleware runs the same handlers deployed as Vercel functions. `npm run preview` serves the static bundle only; use `npm run dev` to test API-backed behavior locally.

## Sources and interpretation

| Layer | Source | Meaning |
| --- | --- | --- |
| Forecast points | [Open-Meteo](https://open-meteo.com/en/docs), Best Match | Rain probability is the chance of **more than 0.1 mm in the hour ending at the returned timestamp**. Cloud/humidity/temperature/wind are model estimates, not station observations. |
| Cloud animation | [EUMETView](https://user.eumetsat.int/resources/user-guides/eumet-view-user-guide), `mtg_fd:ir105_hrfi` | Rendered infrared imagery reprojected to EPSG:3857. Colder cloud tops do not establish rain at the ground. Processing delays and acquisition gaps occur. |
| Basemap | [OpenStreetMap](https://www.openstreetmap.org/copyright) | Browser tiles used under the [tile policy](https://operations.osmfoundation.org/policies/tiles/); no offline prefetch. |
| Country boundary | [geoBoundaries](https://www.geoboundaries.org/api/current/gbOpen/UGA/ADM0/) / OpenStreetMap / Wambacher | Simplified ADM0, boundary ID `UGA-ADM0-62106908`, ODbL 1.0. Used for map context and land-location validation; includes detailed lake shoreline geometry. |

“Retrieved” means when the server fetched forecasts, not model initialization time. The satellite timestamp is the provider's advertised capture time. A feed older than 90 minutes is visibly delayed. Forecast dots do not imply weather observations or interpolation between towns. Probabilities are ensemble-scale estimates, roughly 0.25°; clicking a precise coordinate does not create street-level accuracy.

## Research and trained model

- [Dataset research](docs/DATA_RESEARCH.md): CHIRPS v3, IMERG, ERA5, TAMSAT, Uganda DMS, TAHMO and access restrictions.
- [Satellite implementation notes](docs/SATELLITE.md): endpoints, delay, coordinate system and attribution.
- [Model card](docs/MODEL_CARD.md): training, evaluation, limitations and reproduction.
- [Trained coefficients and provenance](model/model.json).

The logistic model uses five towns from 2023–2024 (87,715 hourly examples), tests on 2025 (43,800 examples), and holds out Moroto entirely (8,760 test examples). Temporal Brier score is **0.08222**, versus **0.08523** for learned persistence, a **3.54%** reduction in probability error. Moroto improvement is **2.09%**. These are real measurements against **ERA5 reanalysis**, not local station verification or demonstrated operational forecast skill. Calibration is imperfect. Live inputs come from a different model distribution. The cloud animation is not ingested by this baseline.

```sh
python3 -m venv .venv
.venv/bin/pip install -r model/requirements.txt
.venv/bin/python scripts/train-model.py --self-check
.venv/bin/python scripts/train-model.py
# Later, reuse the downloaded real data:
.venv/bin/python scripts/train-model.py --offline
```

Raw provider responses are cached under ignored `data/model-cache/`. Source URLs, requested/returned coordinates, retrieval timestamps and SHA-256 hashes are in the model artifact. The raw cache is not committed. The pinned model can be used without Python; JavaScript tests check parity with exported Python examples.

## Deployment

This is React + Vite with three Node.js Vercel functions. No database or background worker is required. The API bundles `public/uganda.geojson` for boundary checks.

```sh
vercel link --yes --project uganda-rain-atlas
vercel --prod
```

The GitHub repository is connected to the Vercel project: pushes to `main` deploy to production. The included GitHub workflow runs tests and builds each push and pull request.

`/api/forecast` returns the town batch; `?lat=0.35&lon=32.58` returns a validated Uganda point. `/api/satellite` discovers capture timestamps; `/api/satellite-image?time=<UTC-ISO>` retrieves a fixed-layer image. Fixed upstream hosts, bounded image/time parameters, request timeouts, null preservation and no-store error responses are enforced. Forecasts cache for 10 minutes and satellite metadata for 5 minutes. The website refreshes while open every 15 minutes; this does not imply providers generate new data on every refresh.

## Operational limits

The [Open-Meteo free API](https://open-meteo.com/en/terms) is for noncommercial use, with service limits and no uptime guarantee. Multi-location requests count toward provider quotas. Upgrade provider access before commercial use or substantial traffic. OSM tiles are a community service with separate limits. An in-memory cache is per serverless instance, with CDN caching in front; move to a shared quota/cache service if traffic warrants it.

No application database, analytics or location history is stored. On explicit location selection, coordinates are sent to the site's endpoint and Open-Meteo; hosting/provider request logs may retain them. Maps and fonts also make third-party requests. Do not use this independent research site as an official emergency warning service; consult [Uganda DMS](https://wids.mwe.go.ug/).

Code is MIT-licensed. Weather data, imagery and map data retain the attribution and licences described above; the code licence does not relicense them.
