import React from 'react';
import { futureHours, timeLabel, value, rainDescription, RainIcon } from './weather.jsx';

export default function ForecastPanel({ location, now, hourOffset, setHourOffset, onMethod, loading }) {
  const hours = futureHours(location, now);
  const hour = hours[hourOffset];
  return <aside className="forecast-panel" aria-busy={loading}>
    <span className="section-label">Selected location</span>
    <h2>{location?.name || 'Kampala'}</h2>
    <p className="location-region">{location?.region || 'Central Uganda'}{location && <span> · {Math.abs(location.latitude).toFixed(2)}° {location.latitude < 0 ? 'S' : 'N'}, {location.longitude.toFixed(2)}° E</span>}</p>
    <h3>Chance of rain</h3>
    <p className="interval">{hour ? `${timeLabel(hour.intervalStart)}–${timeLabel(hour.time)} EAT${hourOffset ? ' · forecast' : ' · current clock hour'}` : 'Waiting for forecast data'}</p>
    <div className="probability"><RainIcon size={58}/><strong>{value(hour?.probability)}<span>{hour?.probability != null ? '%' : ''}</span></strong></div>
    <div className={`rain-summary ${hour?.probability == null ? 'unavailable' : ''}`}><span className="status-dot"/>{rainDescription(hour?.probability)}</div>
    <div className="rain-amount"><span>Predicted rainfall in this hour</span><strong>{value(hour?.precipitation, ' mm', 1)}</strong></div>
    <section className="hourly-chart"><div className="section-heading"><h3>Next 24 hours</h3><span>Rain chance</span></div>
      <div className="chart-area"><div className="chart-y"><span>100%</span><span>50%</span><span>0%</span></div><div className="chart-bars">{hours.length ? hours.map((item, index) => <button type="button" key={item.time} className={`chart-column ${index === hourOffset ? 'selected' : ''}`} aria-label={`${timeLabel(item.intervalStart)} to ${timeLabel(item.time)} EAT: ${value(item.probability, '%')} rain chance, ${value(item.precipitation, ' millimetres', 1)}`} aria-pressed={index === hourOffset} title={`${timeLabel(item.time)} EAT · ${value(item.probability, '%')} · ${value(item.precipitation, ' mm', 1)}`} onClick={() => setHourOffset(index)}><span style={{ height: `${Math.max(item.probability ?? 0, 1.5)}%`, opacity: item.probability == null ? 0.2 : 1 }}/></button>) : <p className="chart-empty">{loading ? 'Loading hourly forecast…' : 'Forecast unavailable'}</p>}</div></div>
      <div className="chart-x">{[0,6,12,18,23].map(index => <span key={index}>{hours[index] ? timeLabel(hours[index].time) : '—'}</span>)}</div>
    </section>
    <dl className="conditions"><div><dt><span aria-hidden="true">☁</span> Cloud cover</dt><dd>{value(hour?.cloudCover, '%')}</dd></div><div><dt><span aria-hidden="true">♧</span> Humidity</dt><dd>{value(hour?.humidity, '%')}</dd></div><div><dt><span aria-hidden="true">≋</span> Wind speed</dt><dd>{value(hour?.windSpeed, ' km/h')}</dd></div><div><dt><span aria-hidden="true">°</span> Temperature</dt><dd>{value(hour?.temperature, '°C')}</dd></div></dl>
    <p className="panel-note">Weather model forecast. Showers can vary within a town; a low chance does not mean no rain.</p>
    <button className="text-button" onClick={onMethod}>View data & method <span aria-hidden="true">↗</span></button>
  </aside>;
}
