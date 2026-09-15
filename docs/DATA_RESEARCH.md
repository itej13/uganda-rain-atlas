# Uganda rain: data research and model development

**Verified against primary sources on 15 September 2026.** Resolution and latency below describe the source products, not the apparent detail of a web map. Availability does not mean a source has been downloaded, licensed for every use, or integrated into this project.

## Findings

Uganda has several open, country-wide historical datasets and near-real-time satellite coverage. A useful public forecast website can be built now. Demonstrating that a new Uganda-specific model improves rain predictions requires a separate, independently verified experiment.

Rainfall is difficult to predict locally, but it is not random throughout the year. Uganda's current official seasonal outlook identifies March–May and September–December as the main rainy seasons, with substantial June–August rainfall in northern and parts of eastern Uganda. Water bodies and highlands modify local convection. The official service is now the **Department of Meteorological Services (DMS), Ministry of Water and Environment**; the old UNMA website redirects to the ministry. [DMS weather portal](https://wids.mwe.go.ug/), [department information](https://www.mwe.go.ug/about/departments/meteorological-services).

Around Lake Victoria, lake/land breezes and terrain create a strong daily cycle of convection, including overnight and morning storms over the lake. A nationwide model therefore needs location, time of day, season, elevation, and proximity to water, rather than a single national rainfall average. [Met Office research on Lake Victoria basin convection](https://www.metoffice.gov.uk/api/assets/file/williams15victoriabasinrcmperformancepdf?prefix=assets).

## Historical data available for Uganda

| Dataset | Coverage and resolution | Delay / updates | Access and reuse | Best role |
|---|---|---|---|---|
| **CHIRPS v3** | Land, 60°S–60°N; 1981–near present; 0.05° (about 5.5 km); daily, pentad, dekad, monthly and longer aggregates | Preliminary: about 2 days after each pentad; final: typically third week of following month | Public HTTP files in GeoTIFF, NetCDF, BIL and COG; attribution required as a conservative interpretation of the provider's public-domain/CC-BY wording | Seasonal climatology, drought context, accumulated-rainfall comparisons |
| **NASA GPM IMERG V07** | Global, including Uganda and surrounding lakes; 0.1° (about 11 km); half-hourly; current directory advertises January 1998 onward | Early about 4 hours; Late about 14 hours; Final about 3.5 months after observation month; actual delivery may differ | Free NASA data; Earthdata login or PPS registration for relevant download routes; HDF5, NetCDF, GeoTIFF and subsetting | Subdaily rainfall labels and delayed rainfall monitoring |
| **ERA5** | Global; 1940–present; hourly; CDS atmosphere grid 0.25° (about 28 km) | ERA5T about 5 days; final may replace early release 2–3 months later | CDS account, personal access token and dataset terms acceptance; CDS catalogue lists CC-BY | Historical atmospheric context and reproducible experimental baselines |
| **TAMSAT v3.1** | Africa; 1 January 1983–present; 0.0375° (about 4 km); daily and longer aggregates | Within about 2 days after each pentad | Public NetCDF/HTTP, CSV subsetting; CC-BY 4.0 permits operational, research and commercial use | Independent algorithm comparison for daily rainfall and drought |
| **DMS / former UNMA stations** | Uganda station observations; record length and sampling depend on station | Station-dependent; no open nationwide raw observation API verified here | Request data and terms from DMS; do not infer open redistribution rights from public forecasts | Local ground truth, calibration, independent evaluation |
| **TAHMO stations** | Ground observations at participating stations; Uganda access, active station list, period and sampling require confirmation | Station/connection dependent | Research CSV access is conditional; continuous application API requires an agreed access class; redistribution and derived products require written permission | Valuable independent gauge validation after a suitable agreement |
| **ICPAC data services** | Regional CHIRPS, TAMSAT, ARC2 and other products covering Uganda; some gauge-blended archives | Product-specific, mostly daily or longer | Public catalogue and data request service; check each resource's licence | Regional comparison and discovery; not an independent observation when repackaging the same upstream dataset |

Table sources: [CHIRPS v3](https://www.chc.ucsb.edu/data/chirps3), [IMERG directory](https://gpm.nasa.gov/data/directory), [IMERG technical documentation](https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation), [NASA data policy](https://gpm.nasa.gov/data/policy), [ERA5 catalogue](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview), [CDS API setup](https://cds.climate.copernicus.eu/how-to-api), [TAMSAT rainfall specification](https://research.reading.ac.uk/tamsat/rainfall/), [Uganda hydromet diagnostic](https://www.un-soff.org/wp-content/uploads/2024/06/DEF-FINAL-CHD-UGANDA-signed.pdf), [TAHMO access policy](https://usercontent.one/wp/tahmo.org/wp-content/uploads/2022/10/TAHMO-Data-Policy-V1.0.pdf), [ICPAC data centre](https://www.icpac.net/data-center/).

### Important dataset pitfalls

- **Use CHIRPS v3 for new work.** CHIRPS v2 production is scheduled to end after December 2026. [CHIRPS transition notice](https://www.chc.ucsb.edu/data/chirps).
- **CHIRPS daily data are derived.** The underlying product is pentadal/monthly. Daily `rnl` partitions pentad totals using ERA5; daily `sat` uses IMERG Late V07. Comparing one of these daily products against the same disaggregation source is not independent verification. CHIRPS is also a land product, so check lake masks. [Daily product README](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily/readme.txt).
- **IMERG is an estimate, not a gauge or instantaneous radar measurement.** Check whether a downloaded field is a rate in mm/hour or an accumulation in mm; a 30-minute rate must be integrated over 0.5 hour to obtain its accumulation. GIS products can also have scale factors. Early/Late/Final processing differs; use the exact run/version that would have been available at prediction time. [IMERG product guide](https://gpm.nasa.gov/data/imerg).
- **ERA5 is reanalysis.** It assimilates observations with hindsight and is delayed. Its precipitation is a model estimate, not an independent set of observed gauge measurements. Retrospective ERA5-to-ERA5 prediction scores are useful research diagnostics but do not establish live forecast skill. [ERA5 description](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview).
- **TAMSAT exposes missing-data provenance.** `rfe_filled` includes recovered missing days; `rfe` omits those recovered estimates and is recommended by its producer for validation. Do not silently treat infilled rainfall as a measured event. [TAMSAT specification](https://research.reading.ac.uk/tamsat/rainfall/).
- **Gauge data need agreements and quality control.** The 2024 Uganda diagnostic describes access by request and a proprietary station archive; it should not be mistaken for a live 2026 API audit. The current official portal publishes forecasts, marine information, seasonal outlooks and alerts, but this research did not find documented open raw station downloads there. TAHMO's policy restricts onward sharing, including derived products; confirm current terms before publishing such data or models. [Uganda diagnostic](https://www.un-soff.org/wp-content/uploads/2024/06/DEF-FINAL-CHD-UGANDA-signed.pdf), [DMS portal](https://wids.mwe.go.ug/), [TAHMO policy](https://usercontent.one/wp/tahmo.org/wp-content/uploads/2022/10/TAHMO-Data-Policy-V1.0.pdf).

## Country-wide cloud changes and current forecasts

### EUMETSAT Meteosat / EUMETView

Meteosat-12 is the primary full-disc service as of the official May 2026 operations schedule. MTG imagery covers Africa, including Uganda, with a nominal 10-minute full-disc cycle. Infrared imagery works at night and can show evolving cold cloud tops. **Cloud-top appearance is not a surface rainfall measurement.** A cloud can grow, dissipate, move, or produce rain differently from a simple motion extrapolation. [MTG operations](https://user.eumetsat.int/resources/user-guides/mtg-in-operations), [MTG imaging description](https://www.eumetsat.int/features/discover-first-images-mtg-i1).

EUMETView provides near-real-time and historical visualisations through standard map interfaces. Its published fixed-image guide includes the MTG infrared layer `mtg_fd:ir105_hrfi` and cloud-type RGB. This is a practical source for a public Uganda cloud map; use the service's actual available timestamps and show image age. Ten-minute sampling does not promise ten-minute end-to-end latency. Rendered map images are suitable for visualisation; quantitative model training should use calibrated source products and their quality metadata. [EUMETView API guide](https://user.eumetsat.int/resources/user-guides/eumet-view-user-guide), [fixed-image URL guide](https://user.eumetsat.int/resources/user-guides/eumetview-image-download-by-using-fixed-urls-guide).

An additional public option is EUMETSAT's Africa video stream, updated every ten minutes with a stated 30-minute processing delay. EUMETSAT explicitly permits embedding these streams on websites. That stream delay must not be assumed to describe every EUMETView product. [Africa imagery stream announcement](https://www.eumetsat.int/new-satellites-eye-views-europe-and-africa-streaming-online).

### Open-Meteo forecasts

Open-Meteo supplies forecast precipitation, cloud cover, temperature, humidity and wind for Uganda coordinates. It is appropriate for the website's initial public forecast layer. These are provider forecasts, not proof of this project's own learned prediction accuracy. Its hourly precipitation probability represents more than 0.1 mm during the preceding hour ending at the timestamp; the documented probability field is based on ensemble models at approximately 0.25° resolution. Extra displayed decimal places or city markers do not improve that native resolution. [Forecast API documentation](https://open-meteo.com/en/docs).

The free hosted API is for noncommercial uses, including private/nonprofit websites without advertising or subscriptions. Published limits are below 10,000 calls/day, 5,000/hour and 600/minute. Data attribution is required; the underlying CC-BY data licence does not remove the hosted service's usage restrictions. Cache shared forecast requests and move to an appropriate commercial plan before adding commercial uses. [Terms](https://open-meteo.com/en/terms), [pricing and call accounting](https://open-meteo.com/en/pricing).

For experiments, explicitly select ERA5 in the historical API to avoid silently mixing its default combination of ERA5, ERA5-Land and IFS. Use archived forecast runs when evaluating an operational forecast at a fixed lead time. [Historical API documentation](https://open-meteo.com/en/docs/historical-weather-api).

### Uganda official forecasts and alerts

Link users to the [DMS weather portal](https://wids.mwe.go.ug/) for national forecasts, Lake Victoria marine information and alerts. This project is independent of DMS. Public availability of an official page does not establish an open API or republication licence for its complete contents.

## Recommended model and evaluation pipeline

The following is a proposed research design, not a claim that these experiments have already been completed.

1. **Define the prediction.** Start with probability of rainfall exceeding an explicit amount at a location over the next hour. Report 1-hour, 3-hour and 6-hour lead times separately. Keep heavy-rainfall thresholds separate from the ordinary rain/no-rain event. Use a consistent UTC time axis internally and display East Africa Time to users.
2. **Establish honest baselines.** Compare season/location/hour climatology, persistence where timely observations exist, and the unchanged operational provider forecast. A small logistic model is enough to test whether additional signals help; model complexity is not evidence of skill.
3. **Acquire independent rainfall labels.** Obtain quality-controlled, subhourly/hourly DMS or TAHMO gauges with publication rights. Use IMERG Final as a second, spatially complete reference, while acknowledging satellite and gauge dependence. Keep gauge outages, suspect spikes, missing data and lake/land masks explicit.
4. **Record what was available at issue time.** Archive forecast issue time, valid time, lead time, model version, satellite scan time and actual arrival time. Build predictors from operational forecasts and recent satellite frames available before each issue. Reanalysis at that same time, future frames and final rainfall products are not allowable live predictors.
5. **Use geographic and temporal holdouts.** Train on earlier complete seasons/years; tune on a subsequent period; test once on a later untouched period. Then roll the time window forward. Hold out entire stations or geographic groups, especially lake shores, highlands and northern Uganda. Keep overlapping storm windows together to prevent train/test leakage.
6. **Measure useful performance.** Report Brier score and calibration for probability, precision/recall and false-alarm ratio for rain events, and rainfall-amount errors by threshold. Include sample counts, missingness and uncertainty intervals by season, region and lead time. For map predictions, assess neighbourhood skill as well as pixel errors because small displacement errors matter.
7. **Promote only demonstrated improvements.** First publish experimental outputs alongside the existing provider forecast. Replace a public forecast only after the model improves the relevant baseline on independent held-out observations and prospective live evaluation. A model trained and tested solely on ERA5 does not meet this threshold.

For a later satellite nowcast, begin with recent calibrated infrared frames, cloud-top cooling/growth and motion, plus operational humidity/wind/instability. Evaluate simple motion/persistence first. A regional crop must extend beyond Uganda's borders so incoming storms are visible before crossing the boundary. Longer lead times should rely more heavily on numerical forecasts because convection can develop or decay within the lead window.

## Practical data entry points

- [CHIRPS v3 public file repository](https://data.chc.ucsb.edu/products/CHIRPS/v3.0/) — current archive, preliminary products, formats and documentation.
- [TAMSAT download and subsetting tools](https://research.reading.ac.uk/tamsat/data-access/) — Uganda point, region or gridded time series.
- [NASA IMERG data directory](https://gpm.nasa.gov/data/directory) — select exact run, temporal resolution and download service.
- [ERA5 CDS catalogue](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview) and [API setup](https://cds.climate.copernicus.eu/how-to-api) — spatial/time subsetting with an account.
- [ICPAC regional data centre](https://www.icpac.net/data-center/) — regional datasets and products.
- [EUMETView](https://view.eumetsat.int/) — current and historical satellite visualisations.
- [DMS weather portal](https://wids.mwe.go.ug/) — current Ugandan official forecasts and warnings.

Keep downloaded bulk archives and credentials out of Git. Publish source URLs, retrieval dates, dataset versions, preprocessing code, model artefacts and evaluation results instead; redistribute data only under the applicable source terms.
