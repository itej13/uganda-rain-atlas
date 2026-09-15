import React from 'react';
import model from '../model/model.json';
import { experimentalPrediction } from '../lib/model.js';
import { timeLabel } from './weather.jsx';

export default function ExperimentalModel({ location, now = Date.now() }) {
  const hour = location?.hourly?.findLast(row => Date.parse(row.time) <= now);
  const prediction = experimentalPrediction(hour, now, model);
  const evaluations = [
    ['Later year · 2025', model.evaluation.temporal_2025],
    ['Unseen town · Moroto 2025', model.evaluation.unseen_moroto_2025],
  ];
  return <section className="reading-section" id="experimental-model" aria-labelledby="experimental-heading">
    <span className="section-label">Experimental model · ERA5-trained</span>
    <h2 id="experimental-heading">A local baseline, with evidence first.</h2>
    <p>This logistic regression model learned from {model.training.sample_count.toLocaleString('en-GB')} hourly samples across five Ugandan towns in 2023–2024. It estimates the chance that the next hour exceeds 0.1 mm of rainfall in ERA5, a reconstructed weather dataset.</p>
    <p><strong>Live inputs are forecasts; this probability is not locally validated.</strong></p>
    <div role="status" aria-live="polite">
      {prediction ? <p><strong>{location.name}: {(prediction.probability * 100).toFixed(1)}% experimental rain probability</strong><br/>
        For {timeLabel(prediction.intervalStart, { day: 'numeric', month: 'short' })}–{timeLabel(prediction.intervalEnd, { day: 'numeric', month: 'short' })} EAT. This is the full displayed clock hour, including its elapsed portion.</p>
        : <p>Experimental probability unavailable. Complete inputs for the latest finished hour are needed.</p>}
    </div>
    <p>The tests below compare against ERA5 estimates, not independent rain gauges. Brier score measures probability error; lower is better. Learned persistence estimates the next hour from whether the preceding hour was wet or dry.</p>
    <div className="dataset-table"><table>
      <caption>Held-out ERA5 evaluation · Brier score</caption>
      <thead><tr><th scope="col">Test set</th><th scope="col">Trained model</th><th scope="col">Learned persistence</th><th scope="col">Error reduction</th></tr></thead>
      <tbody>{evaluations.map(([label, results]) => <tr key={label}><th scope="row">{label}<small>{results.sample_count.toLocaleString('en-GB')} samples</small></th><td>{results.logistic_regression.brier.toFixed(4)}</td><td>{results.train_transition_persistence.brier.toFixed(4)}</td><td>{(results.brier_skill_vs_transition_persistence * 100).toFixed(2)}%</td></tr>)}</tbody>
    </table></div>
    <p>The later-year result reduces Brier error by {(model.evaluation.temporal_2025.brier_skill_vs_transition_persistence * 100).toFixed(2)}% against learned persistence. These retrospective results do not establish live forecast accuracy or Uganda-wide validation.</p>
    <a className="primary-link" href="https://github.com/itej13/uganda-rain-atlas/blob/main/docs/MODEL_CARD.md">Read the model results ↗</a>
  </section>;
}
