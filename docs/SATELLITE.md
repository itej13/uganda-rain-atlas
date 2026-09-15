# Satellite cloud imagery

The map displays EUMETSAT Meteosat Third Generation infrared imagery from the public EUMETView layer `mtg_fd:ir105_hrfi`. It covers Uganda during daylight and darkness. The published layer describes 1 km sampling at nadir and a ten-minute acquisition cadence. Bright pixels generally represent colder cloud tops, not rain intensity. The image is an observation, not a rain forecast. [EUMETView documentation](https://user.eumetsat.int/resources/user-guides/eumet-view-user-guide), [published service metadata](https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetCapabilities).

## Time and availability

`GET /api/satellite` obtains the latest time from the provider's capabilities document and returns twelve frame requests at ten-minute intervals. `latest` is the provider time; `fetchedAt` is our retrieval time. `ageMinutes` and `stale` describe freshness at retrieval. More than 90 minutes is treated as stale; this is our display threshold, not a provider guarantee. A browser must continue computing age from `latest` while open and show the capture time, including when replaying older frames. Metadata cache life is five minutes.

Capabilities describe a cadence, so individual acquisitions can still be missing. The image proxy rejects provider warnings that a nearest/default time was substituted, and returns a visible error on failed or invalid imagery. It accepts only past, ten-minute UTC timestamps within 24 hours. [WMS time and nearest-value behavior](https://portal.ogc.org/files/?artifact_id=14416).

Live checks on **15 September 2026 UTC** (16 September in India): capabilities and the projected Uganda PNG both returned HTTP 200 without an API key. At **19:39 UTC**, the latest advertised acquisition was **19:10 UTC**, an observed delay of **29 minutes**. The 732 × 720 PNG was 121,662 bytes. This records one successful check, not an uptime or latency promise.

## Geographic alignment

The geographic image bounds are `[[−1.6, 29], [4.4, 35.1]]` in `[latitude, longitude]` order. WMS 1.3.0 requests use `EPSG:3857` with the corresponding metre bounds `3228265.233,-178134.339,3907314.127,490287.900`. EUMETSAT performs the reprojection, matching Leaflet's default map coordinate system. An EPSG:4326 raster stretched over these bounds would differ by approximately 0.26 pixel at this image size; requesting the matching projection removes that mismatch. [Leaflet map CRS](https://leafletjs.com/reference.html#map-crs).

## Access, licence and credit

EUMETView documents unauthenticated access to its imagery and APIs, including integration into other applications. This website displays its rendered WMS visualisations. EUMETSAT distinguishes Core products licensed under CC BY 4.0 from Recommended products requiring specific licences, including some original Meteosat Level 1 data. Public visualisation access does not establish unrestricted redistribution rights for original numerical satellite data. [EUMETView access](https://user.eumetsat.int/resources/user-guides/eumet-view-user-guide), [data registration and licensing](https://user.eumetsat.int/resources/user-guides/data-registration-and-licensing).

Display the attribution returned by the API beside the map: **This service is based on EUMETSAT Meteosat imagery 2026.** The year follows the acquisition. Link the credit to EUMETSAT. The application's source-code licence does not relicense upstream imagery.

Run the focused checks with `node --test scripts/satellite.test.js`.
