#!/usr/bin/env python3
"""Train the Uganda experimental next-hour ERA5 rain baseline. Requires NumPy."""

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SITES = {
    "kampala": (0.3476, 32.5825),
    "gulu": (2.7724, 32.2881),
    "mbale": (1.0644, 34.1794),
    "mbarara": (-0.6072, 30.6545),
    "arua": (3.0201, 30.9111),
    "moroto": (2.5348, 34.6666),
}
VARIABLES = ["temperature_2m", "relative_humidity_2m", "precipitation", "cloud_cover", "wind_speed_10m"]
FEATURES = ["log1p_precipitation_mm", "relative_humidity_percent", "temperature_celsius", "cloud_cover_percent", "wind_speed_kmh", "local_hour_sin", "local_hour_cos", "local_month_sin", "local_month_cos"]
THRESHOLD = 0.1
L2 = 0.001


def request_url(latitude, longitude):
    return "https://archive-api.open-meteo.com/v1/archive?" + urlencode({
        "latitude": latitude, "longitude": longitude,
        "start_date": "2023-01-01", "end_date": "2025-12-31",
        "hourly": ",".join(VARIABLES), "models": "era5", "timezone": "GMT",
    })


def load_site(name, coordinates, cache, offline):
    path = cache / f"{name}-2023-2025.json"
    url = request_url(*coordinates)
    if not path.exists():
        if offline:
            raise FileNotFoundError(f"Missing cached data: {path}")
        print(f"Downloading ERA5 for {name}...", flush=True)
        with urlopen(url, timeout=120) as response:
            payload = json.load(response)
        if "hourly" not in payload:
            raise ValueError(f"Archive API did not return hourly data for {name}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, separators=(",", ":")))
    raw = path.read_bytes()
    data = json.loads(raw)
    if data.get("utc_offset_seconds") != 0:
        raise ValueError("Expected UTC archive timestamps")
    expected_units = {"temperature_2m": "°C", "relative_humidity_2m": "%", "precipitation": "mm", "cloud_cover": "%", "wind_speed_10m": "km/h"}
    if any(data["hourly_units"].get(k) != v for k, v in expected_units.items()):
        raise ValueError("Unexpected units in archive response")
    provenance = {
        "site": name, "requested_latitude": coordinates[0], "requested_longitude": coordinates[1],
        "returned_latitude": data["latitude"], "returned_longitude": data["longitude"],
        "url": url, "cache_file": path.name, "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        "hourly_records": len(data["hourly"]["time"]),
    }
    return data["hourly"], provenance


def feature_matrix(hourly):
    times = np.array(hourly["time"], dtype="datetime64[h]")
    if len(times) < 2 or np.any(np.diff(times) != np.timedelta64(1, "h")):
        raise ValueError("Archive timestamps must be continuous ascending hours")
    values = {name: np.array(hourly[name], dtype=float) for name in VARIABLES}
    if any(len(value) != len(times) for value in values.values()):
        raise ValueError("Archive variable lengths differ")
    # Uganda is UTC+3 throughout the year. Features describe input hour t.
    local = times + np.timedelta64(3, "h")
    hour = local.astype("int64") % 24
    month = local.astype("datetime64[M]").astype("int64") % 12 + 1
    rain = values["precipitation"]
    if np.any(rain < 0) or np.any(values["wind_speed_10m"] < 0):
        raise ValueError("Negative precipitation or wind speed")
    for name in ("relative_humidity_2m", "cloud_cover"):
        if np.any((values[name] < 0) | (values[name] > 100)):
            raise ValueError(f"Out-of-range {name}")
    x = np.column_stack([
        np.log1p(rain), values["relative_humidity_2m"], values["temperature_2m"],
        values["cloud_cover"], values["wind_speed_10m"],
        np.sin(2 * np.pi * hour / 24), np.cos(2 * np.pi * hour / 24),
        np.sin(2 * np.pi * (month - 1) / 12), np.cos(2 * np.pi * (month - 1) / 12),
    ])
    # Only t predictors are used. y is precipitation accumulated over (t, t+1].
    valid = np.all(np.isfinite(x[:-1]), axis=1) & np.isfinite(rain[1:])
    return {
        "x": x[:-1][valid], "y": (rain[1:] > THRESHOLD)[valid].astype(float),
        "previous_rain": (rain[:-1] > THRESHOLD)[valid].astype(int),
        "target_year": (times[1:].astype("datetime64[Y]").astype(int) + 1970)[valid],
        "input_time": times[:-1][valid], "target_time": times[1:][valid],
        "input_month": month[:-1][valid],
        "dropped_pairs": int(len(times) - 1 - valid.sum()),
    }


def sigmoid(logits):
    return np.exp(-np.logaddexp(0, -logits))


def utc_iso(timestamp):
    return str(timestamp.astype("datetime64[s]")) + "Z"


def fit(x, y):
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale[scale < 1e-12] = 1.0
    design = np.column_stack([np.ones(len(x)), (x - mean) / scale])
    beta = np.zeros(design.shape[1])
    penalty = np.full(len(beta), L2)
    penalty[0] = 0

    def objective(candidate):
        z = design @ candidate
        return np.mean(np.logaddexp(0, z) - y * z) + 0.5 * np.sum(penalty * candidate**2)

    converged = False
    for iteration in range(60):
        p = sigmoid(design @ beta)
        gradient = design.T @ (p - y) / len(y) + penalty * beta
        hessian = (design.T * (p * (1 - p))) @ design / len(y) + np.diag(penalty)
        step = np.linalg.solve(hessian, gradient)
        rate = 1.0
        old_loss = objective(beta)
        while rate > 1e-8 and objective(beta - rate * step) > old_loss:
            rate *= 0.5
        if rate <= 1e-8:
            raise RuntimeError("Optimizer line search failed")
        beta -= rate * step
        if np.max(np.abs(rate * step)) < 1e-8:
            converged = True
            break
    if not converged:
        raise RuntimeError("Optimizer did not converge")
    return mean, scale, beta, iteration + 1


def score(y, probabilities):
    p = np.broadcast_to(probabilities, y.shape)
    clipped = np.clip(p, 1e-6, 1 - 1e-6)
    return {
        "brier": float(np.mean((p - y) ** 2)),
        "log_loss": float(-np.mean(y * np.log(clipped) + (1 - y) * np.log1p(-clipped))),
    }


def self_check():
    """Checks timestamp alignment, units, finite handling, and exported inference."""
    hourly = {
        "time": ["2023-12-31T20:00", "2023-12-31T21:00", "2023-12-31T22:00"],
        "temperature_2m": [20, 21, 22], "relative_humidity_2m": [70, 80, 90],
        "precipitation": [0, 0.1, 0.2], "cloud_cover": [40, 60, 80], "wind_speed_10m": [2, 3, 4],
    }
    data = feature_matrix(hourly)
    assert data["y"].tolist() == [0, 1], "Threshold must be strictly greater than 0.1 mm"
    assert math.isclose(data["x"][1, 0], math.log1p(0.1))
    assert math.isclose(data["x"][1, 5], 0, abs_tol=1e-12), "21 UTC is midnight in Uganda"
    assert math.isclose(data["x"][1, 7], 0, abs_tol=1e-12), "Local month crosses at midnight"
    assert np.all(data["target_time"] - data["input_time"] == np.timedelta64(1, "h"))
    assert utc_iso(data["input_time"][0]) == "2023-12-31T20:00:00Z"
    assert score(np.array([0., 1.]), np.array([0., 1.]))["brier"] == 0
    assert np.all(np.isfinite(sigmoid(np.array([-1000, 0, 1000]))))
    hourly["precipitation"][1] = None
    assert len(feature_matrix(hourly)["y"]) == 0, "Missing labels must never become dry labels"
    hourly["precipitation"][1] = -1
    try:
        feature_matrix(hourly)
        raise AssertionError("Negative precipitation must be rejected")
    except ValueError:
        pass
    model_path = ROOT / "model" / "model.json"
    if model_path.exists():
        artifact = json.loads(model_path.read_text())
        for sample in artifact["inference_examples"]:
            z = artifact["intercept"] + sum(
                (value - mean) / scale * coefficient
                for value, mean, scale, coefficient in zip(sample["features"], artifact["scaler"]["mean"], artifact["scaler"]["scale"], artifact["coefficients"])
            )
            assert math.isclose(float(sigmoid(z)), sample["probability"], abs_tol=1e-12)
    print("Self-check passed", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true", help="Run the small offline check and exit")
    parser.add_argument("--offline", action="store_true", help="Require cached real data; never download")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / "data" / "model-cache")
    args = parser.parse_args()
    self_check()
    if args.self_check:
        return

    datasets, sources = {}, []
    for name, coordinates in SITES.items():
        hourly, provenance = load_site(name, coordinates, args.cache_dir, args.offline)
        datasets[name] = feature_matrix(hourly)
        provenance["dropped_pairs"] = datasets[name]["dropped_pairs"]
        sources.append(provenance)
    train_sites = [name for name in SITES if name != "moroto"]

    def combine(names, years):
        output = {}
        for field in ("x", "y", "previous_rain", "input_time", "target_time", "input_month"):
            output[field] = np.concatenate([
                datasets[name][field][np.isin(datasets[name]["target_year"], years)] for name in names
            ])
        return output

    train = combine(train_sites, [2023, 2024])
    temporal_test = combine(train_sites, [2025])
    spatial_test = combine(["moroto"], [2025])
    assert train["target_time"].max() < temporal_test["target_time"].min()
    assert set(train_sites).isdisjoint({"moroto"})
    if min(len(train["y"]), len(temporal_test["y"]), len(spatial_test["y"])) < 1000:
        raise ValueError("Insufficient actual archive data for the declared evaluation")
    mean, scale, beta, iterations = fit(train["x"], train["y"])
    climatology = float(train["y"].mean())
    transition = [float(train["y"][train["previous_rain"] == state].mean()) for state in (0, 1)]
    monthly = [float(train["y"][train["input_month"] == month].mean()) for month in range(1, 13)]

    def predict(x):
        return sigmoid(beta[0] + ((x - mean) / scale) @ beta[1:])

    def evaluate(data):
        y, p = data["y"], predict(data["x"])
        metrics = {
            "sample_count": len(y), "rain_frequency": float(y.mean()),
            "target_start_utc": utc_iso(data["target_time"].min()),
            "target_end_utc": utc_iso(data["target_time"].max()),
            "logistic_regression": score(y, p), "train_climatology": score(y, climatology),
            "train_monthly_climatology": score(y, np.array(monthly)[data["input_month"] - 1]),
            "persistence": score(y, data["previous_rain"]),
            "train_transition_persistence": score(y, np.array(transition)[data["previous_rain"]]),
        }
        metrics["brier_skill_vs_climatology"] = 1 - metrics["logistic_regression"]["brier"] / metrics["train_climatology"]["brier"]
        metrics["brier_skill_vs_transition_persistence"] = 1 - metrics["logistic_regression"]["brier"] / metrics["train_transition_persistence"]["brier"]
        metrics["calibration_bins"] = []
        for index in range(10):
            mask = (p >= index / 10) & (p < (index + 1) / 10)
            if mask.any():
                metrics["calibration_bins"].append({"lower": index / 10, "upper": (index + 1) / 10, "count": int(mask.sum()), "mean_probability": float(p[mask].mean()), "observed_era5_frequency": float(y[mask].mean())})
        return metrics

    examples = []
    for index in (0, int(np.flatnonzero(temporal_test["y"])[0])):
        examples.append({
            "site": train_sites[0], "input_time_utc": utc_iso(temporal_test["input_time"][index]),
            "target_time_utc": utc_iso(temporal_test["target_time"][index]),
            "features": temporal_test["x"][index].tolist(), "probability": float(predict(temporal_test["x"][index])),
            "era5_rain_label": int(temporal_test["y"][index]),
        })
    artifact = {
        "version": "1.0.0", "name": "Uganda experimental ERA5 rain baseline", "status": "experimental_reanalysis_only",
        "trained_at": datetime.now(timezone.utc).isoformat(), "algorithm": "L2 logistic regression",
        "target": {"variable": "ERA5 precipitation", "operator": ">", "threshold_mm": THRESHOLD, "horizon_hours": 1, "interval": "(input_time, input_time + 1 hour]", "ground_truth": "ERA5 reanalysis grid estimate, not a station observation"},
        "feature_names": FEATURES,
        "feature_formula": "[log1p(precipitation_mm), relative_humidity_percent, temperature_celsius, cloud_cover_percent, wind_speed_kmh, sin(2*pi*local_hour/24), cos(2*pi*local_hour/24), sin(2*pi*(local_month-1)/12), cos(2*pi*(local_month-1)/12)]",
        "time_basis": "Input timestamp is UTC; add 3 hours before extracting local hour and local month (1-12). Use the latest completed hourly input, never a later feature.",
        "inference_formula": "p = 1 / (1 + exp(-(intercept + sum(coefficients[i] * (features[i] - scaler.mean[i]) / scaler.scale[i]))))",
        "scaler": {"mean": mean.tolist(), "scale": scale.tolist()}, "intercept": float(beta[0]), "coefficients": beta[1:].tolist(),
        "training": {"sites": train_sites, "target_years": [2023, 2024], "sample_count": len(train["y"]), "rain_frequency": climatology, "l2_on_mean_loss": L2, "optimizer": "Newton method with backtracking, intercept unpenalized", "iterations": iterations, "random_split": False, "hyperparameter_selection": "Fixed before evaluation; no test-set tuning", "scaler_fit": "Training rows only"},
        "evaluation": {"temporal_2025": evaluate(temporal_test), "unseen_moroto_2025": evaluate(spatial_test)},
        "baseline_parameters": {"climatology_probability": climatology, "transition_probability_after_dry_and_wet": transition, "monthly_climatology_jan_to_dec": monthly, "deterministic_persistence": "Probability 1 if input-hour precipitation > 0.1 mm, otherwise 0. Log-loss probabilities clipped to [1e-6, 1-1e-6]."},
        "sources": sources, "source_license": "Open-Meteo data CC BY 4.0; attribute Open-Meteo and Copernicus ERA5. API usage subject to provider terms.",
        "limitations": [
            "Labels and predictors are ERA5 reanalysis estimates, not independent local rain-gauge observations.",
            "ERA5 is retrospective and can assimilate later information. This split prevents explicit feature/target leakage but is not an operational hindcast.",
            "Serving with live numerical weather prediction inputs introduces unmeasured distribution shift; the test scores do not establish live forecast accuracy.",
            "Only five training locations and one held-out location; no claim of Uganda-wide spatial validation.",
            "Hourly grid-scale precipitation misses localized convection and sub-hourly onset; no satellite motion or radar is used.",
            "One test year; hourly outcomes are correlated and no independent uncertainty interval is claimed.",
            "Do not use for emergency warnings or safety-critical decisions. Compare operationally against a weather provider and independent observations first.",
        ],
        "inference_examples": examples,
    }
    output = ROOT / "model" / "model.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(artifact, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"training_samples": len(train["y"]), "evaluation": {key: {k: v for k, v in value.items() if k != "calibration_bins"} for key, value in artifact["evaluation"].items()}}, indent=2))
    self_check()
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
