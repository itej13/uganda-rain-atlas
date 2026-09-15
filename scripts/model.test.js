import assert from 'node:assert/strict';
import test from 'node:test';
import model from '../model/model.json' with { type: 'json' };
import { experimentalPrediction } from '../lib/model.js';

test('experimental inference matches trained examples and rejects unavailable inputs', () => {
  for (const example of model.inference_examples) {
    const [rain, humidity, temperature, cloudCover, windSpeed] = example.features;
    const hour = { time: example.input_time_utc, precipitation: Math.expm1(rain), humidity, temperature, cloudCover, windSpeed };
    const timestamp = Date.parse(hour.time);
    const now = timestamp + 30 * 60_000;
    const result = experimentalPrediction(hour, now, model);
    assert.ok(Math.abs(result.probability - example.probability) < 1e-12);
    assert.equal(Date.parse(result.intervalStart), timestamp);
    assert.equal(Date.parse(result.intervalEnd), Date.parse(example.target_time_utc));
    assert.ok(experimentalPrediction(hour, timestamp, model));
    assert.equal(experimentalPrediction(hour, timestamp - 1, model), null);
    assert.equal(experimentalPrediction(hour, timestamp + 3_600_000, model), null);
    assert.equal(experimentalPrediction(hour, timestamp + 7_200_000, model), null);
    assert.equal(experimentalPrediction({ ...hour, time: 'invalid' }, now, model), null);
    assert.equal(experimentalPrediction({ ...hour, time: new Date(timestamp + 60_000).toISOString() }, now, model), null);
    for (const field of ['precipitation', 'humidity', 'temperature', 'cloudCover', 'windSpeed']) {
      for (const value of [null, undefined, NaN, Infinity, '0']) {
        assert.equal(experimentalPrediction({ ...hour, [field]: value }, now, model), null);
      }
    }
    for (const [field, value] of [['precipitation', -1], ['humidity', 101], ['temperature', -101], ['cloudCover', -1], ['windSpeed', -1]]) {
      assert.equal(experimentalPrediction({ ...hour, [field]: value }, now, model), null);
    }
    assert.equal(experimentalPrediction(null, now, model), null);
  }
});
