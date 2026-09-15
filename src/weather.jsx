export const timeLabel = (time, options = {}) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit', ...options,
}).format(new Date(time));

export const value = (number, suffix = '', digits = 0) => Number.isFinite(number) ? `${number.toFixed(digits)}${suffix}` : '—';
export const futureHours = (location, now) => location?.hourly?.filter(hour => Date.parse(hour.time) > now).slice(0, 24) || [];
export const probabilityColor = probability => probability == null ? '#89958f' : probability < 20 ? '#bad9c4' : probability < 40 ? '#7fb596' : probability < 60 ? '#4b9876' : probability < 80 ? '#28785b' : '#124d3c';
export const rainDescription = probability => probability == null ? 'Rain probability unavailable.' : probability < 20 ? 'A lower chance of rain.' : probability < 50 ? 'Some chance of rain.' : probability < 80 ? 'Rain is likely in this hour.' : 'A high chance of rain.';

export async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || 'The data provider is temporarily unavailable.');
  return body;
}

export function RainIcon({ size = 36, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 29h24a8 8 0 0 0 0-16 11 11 0 0 0-21-1 9 9 0 0 0-3 17Z" fill="currentColor"/><path d="m13 35-4 7m15-7-4 7m15-7-4 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/></svg>;
}
import React from 'react';
