const HOUR = 3_600_000;

export function experimentalPrediction(hour, now, model) {
  const timestamp = Date.parse(hour?.time);
  // A completed input at t predicts (t, t + 1h]; expired or future inputs are unusable.
  if (!Number.isFinite(now) || timestamp !== Math.floor(now / HOUR) * HOUR) return null;
  const { precipitation, humidity, temperature, cloudCover, windSpeed } = hour;
  const physical = [[precipitation, 0, Infinity], [humidity, 0, 100], [temperature, -100, 70], [cloudCover, 0, 100], [windSpeed, 0, Infinity]];
  if (!physical.every(([value, min, max]) => Number.isFinite(value) && value >= min && value <= max)) return null;

  const local = new Date(timestamp + 3 * HOUR);
  const hourAngle = 2 * Math.PI * local.getUTCHours() / 24;
  const monthAngle = 2 * Math.PI * local.getUTCMonth() / 12;
  const features = [Math.log1p(precipitation), humidity, temperature, cloudCover, windSpeed,
    Math.sin(hourAngle), Math.cos(hourAngle), Math.sin(monthAngle), Math.cos(monthAngle)];
  if (model?.coefficients?.length !== features.length || model?.scaler?.mean?.length !== features.length
    || model?.scaler?.scale?.length !== features.length || !Number.isFinite(model.intercept)) return null;
  let score = model.intercept;
  for (let index = 0; index < features.length; index++) {
    const { mean, scale } = model.scaler;
    const coefficient = model.coefficients[index];
    if (!Number.isFinite(mean[index]) || !Number.isFinite(scale[index]) || scale[index] <= 0 || !Number.isFinite(coefficient)) return null;
    score += coefficient * (features[index] - mean[index]) / scale[index];
  }
  if (!Number.isFinite(score)) return null;
  return {
    probability: 1 / (1 + Math.exp(-score)),
    intervalStart: new Date(timestamp).toISOString(),
    intervalEnd: new Date(timestamp + HOUR).toISOString(),
  };
}
