# Experimental Uganda next-hour rain model

**Status: research baseline. Live forecast accuracy has not been established.** This is an actually trained logistic regression model with published coefficients, input transformations, source hashes, test metrics, and runnable training code. It estimates whether the following hourly ERA5 grid estimate exceeds **0.1 mm** of precipitation.

The model improves modestly on a strong persistence baseline in the retrospective tests: **3.54% lower Brier score in the 2025 temporal test and 2.09% lower in the unseen-location test.** These improvements are against ERA5 labels, not independent rain gauges or live forecasts. The website's weather-provider forecast and this experiment must remain clearly distinguished.

## Data and split

Actual hourly records were downloaded from the [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), explicitly selecting `models=era5`, for 2023-01-01 through 2025-12-31 UTC. ERA5 is a global reanalysis with roughly 0.25° grid spacing. It combines observations with a physical model; a returned grid estimate is not a local station measurement.

| Requested location | Latitude | Longitude | Role |
| --- | ---: | ---: | --- |
| Kampala | 0.3476 | 32.5825 | Train 2023–24, temporal test 2025 |
| Gulu | 2.7724 | 32.2881 | Train 2023–24, temporal test 2025 |
| Mbale | 1.0644 | 34.1794 | Train 2023–24, temporal test 2025 |
| Mbarara | -0.6072 | 30.6545 | Train 2023–24, temporal test 2025 |
| Arua | 3.0201 | 30.9111 | Train 2023–24, temporal test 2025 |
| Moroto | 2.5348 | 34.6666 | Completely excluded from fitting; spatial test 2025 |

There are 26,304 downloaded hours per location (157,824 total); no adjacent pairs were dropped for missing data in this run. Moroto's 2023–24 records are downloaded for reproducibility but excluded from fitting and evaluation. Returned grid coordinates, URLs, retrieval times, SHA-256 hashes of cached payloads, and missing-pair counts are recorded in `model/model.json`.

The split uses the **target timestamp**, not a random row split:

- Training: 87,715 examples from five locations, target years 2023 and 2024.
- Temporal test: 43,800 examples at the same five locations, target year 2025.
- Spatial and temporal test: 8,760 examples at unseen Moroto, target year 2025.
- All feature means, scales, climatology rates, and persistence transition probabilities are fitted on training rows only. No hyperparameters were selected using either test set.

## Target and exact inference contract

For a row timestamped `t`, the target is `precipitation[t + 1 hour] > 0.1`. Open-Meteo precipitation timestamps represent the **preceding hour's accumulation**, so this target covers `(t, t + 1 hour]`. Humidity, temperature, cloud cover, wind, and precipitation used as inputs all come from row `t`. No features are read from the target row. The threshold is strictly greater than 0.1 mm, not greater than or equal to it. [Hourly parameter definitions](https://open-meteo.com/en/docs/historical-weather-api#hourly-parameter-definition)

Use the latest completed hourly input at serving time. Validate finite numeric values; precipitation and wind must be nonnegative, and humidity/cloud percentages must be in `[0, 100]`. Never turn missing values into zeros. Convert the input's UTC timestamp to Uganda time by adding three hours **before** extracting hour and month, including date/month rollover.

| Index | Exported feature | Transformation |
| ---: | --- | --- |
| 0 | `log1p_precipitation_mm` | `log(1 + precipitation_mm)` |
| 1 | `relative_humidity_percent` | Relative humidity at 2 m, percent |
| 2 | `temperature_celsius` | Temperature at 2 m, °C |
| 3 | `cloud_cover_percent` | Total cloud cover, percent |
| 4 | `wind_speed_kmh` | Wind speed at 10 m, km/h |
| 5 | `local_hour_sin` | `sin(2π × hour / 24)` |
| 6 | `local_hour_cos` | `cos(2π × hour / 24)` |
| 7 | `local_month_sin` | `sin(2π × (month − 1) / 12)` |
| 8 | `local_month_cos` | `cos(2π × (month − 1) / 12)` |

Here `hour` is 0–23 and `month` is 1–12. Apply the stored training scaler once, in the order above:

```text
z = intercept + Σ coefficients[i] × (features[i] − scaler.mean[i]) / scaler.scale[i]
probability = 1 / (1 + exp(−z))
```

The algorithm is logistic regression with L2 coefficient penalty `0.001` on the mean-loss objective; the intercept is unpenalized. A deterministic NumPy Newton optimizer converged in seven iterations. There is no random initialization, oversampling, neural network, satellite optical flow, or post-hoc probability calibration. Two real examples with expected probabilities are included in the artifact for JavaScript/Python parity checks.

## Measured evaluation

Lower Brier score and log loss are better. Brier score is the mean squared error of the predicted probability against the binary label. It is **not a percentage accuracy**. Training wet-hour frequency is 21.89%; test frequencies are 20.09% at the five training locations and 9.33% at Moroto.

| Model / baseline | Temporal Brier | Temporal log loss | Moroto Brier | Moroto log loss |
| --- | ---: | ---: | ---: | ---: |
| Logistic regression | **0.082215** | **0.281929** | **0.048177** | **0.174145** |
| Training climatology | 0.160859 | 0.502606 | 0.100360 | 0.365720 |
| Training monthly climatology | 0.159700 | 0.496409 | 0.104654 | 0.370245 |
| Deterministic persistence | 0.101119 | 1.397008 | 0.057306 | 0.791712 |
| Training transition persistence | 0.085230 | 0.302045 | 0.049204 | 0.197662 |

Climatology always predicts the training wet-hour rate. Monthly climatology uses the training rate for the input's Uganda local month. Deterministic persistence predicts probability 1 after a wet input hour and 0 after a dry hour; its log loss clips these probabilities to `[0.000001, 0.999999]`. The stronger transition baseline learns separate next-hour wet probabilities after dry and wet inputs using training data.

Brier skill is `1 − model_Brier / baseline_Brier`: 48.89% against global climatology but only **3.54% against transition persistence** in the temporal test. Corresponding Moroto skill values are 52.00% and **2.09%**. No significance or confidence interval is claimed; adjacent hours and nearby locations are correlated.

Probability calibration needs improvement. In the temporal test, the 40–50% prediction bin averaged 44.68% while 66.20% of its 778 ERA5 labels were wet. The 90–100% bin averaged 97.31% while 90.72% of its 3,039 labels were wet. All ten nonempty calibration bins for each test are published in the artifact. A low overall Brier score does not make every displayed probability reliable.

## Limits and what would establish operational value

1. **Reanalysis is retrospective.** ERA5 can assimilate information unavailable at the original issue time. This code prevents explicit future-row leakage and keeps test rows out of fitting, but it is not an operational hindcast.
2. **Labels are not independent measurements.** Predictors and targets come from the same reanalysis product. Independent Ugandan rain gauges, quality-controlled stations, and appropriately validated satellite rain estimates are needed for external verification.
3. **Serving data differ from training data.** Applying these coefficients to current numerical weather prediction inputs creates an unmeasured distribution shift. Retrospective scores cannot be presented as live forecast accuracy.
4. **Coverage is limited.** Five training locations and one holdout do not validate every district, elevation, lake shore, or climatic region. Hourly grid estimates cannot resolve every local shower or its exact onset.
5. **This model has no cloud-motion input.** A satellite cloud layer on the website does not mean the experimental model ingests or tracks those images. Cloud cover percentage is the only cloud predictor here.
6. **One year of evaluation is not enough for a warning service.** Preserve untouched future periods, score by season and location, and monitor calibration and missing inputs. Collect forecasts as they were issued, compare against the unmodified provider forecast and strong persistence baselines, and add independent observations before claiming improvement.

The model is suitable for transparent experimentation and education. It should not issue emergency warnings or support safety-critical decisions.

## Reproduce

From the repository root, with Python 3 and the pinned NumPy dependency:

```sh
python3 -m pip install -r model/requirements.txt
python3 scripts/train-model.py --self-check
python3 scripts/train-model.py
# Once the real downloads are cached:
python3 scripts/train-model.py --offline
```

Training requires no API key at present, subject to [Open-Meteo API limits and terms](https://open-meteo.com/en/terms). Cached source payloads go to ignored `data/model-cache/`; reruns reuse them. Failed downloads stop the run and do not create fabricated records. If the API rate-limits a run, respect its retry interval and rerun: completed location downloads are already cached. Re-fetching can change payload hashes because provider metadata or datasets may be revised; exact local replay uses the original cache and its published hashes.

`--self-check` runs without network access. It checks the strict wet threshold, one-hour target alignment, Uganda midnight/month rollover, timestamp format, missing-label exclusion, negative-precipitation rejection, stable sigmoid, and stored inference examples. Training also checks UTC units, continuous hourly timestamps, field lengths, percentage ranges, sample counts, optimizer convergence, and the temporal/spatial split. No test performance is simulated.

Attribute Open-Meteo and Copernicus ERA5 when reusing the data. Open-Meteo describes its data as CC BY 4.0; use of its hosted API has separate terms. See the [Open-Meteo licence](https://open-meteo.com/en/licence) and the linked underlying data providers.
