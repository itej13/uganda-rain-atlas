import React, { useCallback, useEffect, useRef, useState } from 'react';
import RainMap from './RainMap.jsx';
import ForecastPanel from './ForecastPanel.jsx';
import Research from './Research.jsx';
import { locations as towns } from '../lib/locations.js';
import { fetchJson, futureHours, RainIcon, timeLabel } from './weather.jsx';

export default function App() {
  const [page, setPage] = useState('map');
  const [data, setData] = useState(null);
  const [satellite, setSatellite] = useState(null);
  const [selectedId, setSelectedId] = useState('kampala');
  const [custom, setCustom] = useState(null);
  const [layer, setLayer] = useState('forecast');
  const [hourOffset, setHourOffset] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [imageStatus, setImageStatus] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [pointLoading, setPointLoading] = useState(false);
  const [error, setError] = useState('');
  const [satelliteError, setSatelliteError] = useState('');
  const [pointError, setPointError] = useState('');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(Date.now());
  const refreshController = useRef(null);
  const pointController = useRef(null);
  const customRequest = useRef(null);

  const refresh = useCallback(async () => {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    setLoading(true);
    const activePoint = customRequest.current;
    const results = await Promise.allSettled([
      fetchJson('/api/forecast', controller.signal),
      fetchJson('/api/satellite', controller.signal),
      activePoint ? fetchJson(`/api/forecast?lat=${activePoint.lat}&lon=${activePoint.lng}`, controller.signal) : Promise.resolve(null),
    ]);
    if (controller.signal.aborted) return;
    if (results[0].status === 'fulfilled') { setData(results[0].value); setError(''); }
    else setError(results[0].reason.message);
    if (results[1].status === 'fulfilled') {
      setSatellite(results[1].value);
      setFrameIndex(Math.max(0, results[1].value.frames.length - 1));
      setSatelliteError('');
    } else setSatelliteError(results[1].reason.message);
    if (activePoint && customRequest.current === activePoint) {
      if (results[2].status === 'fulfilled') {
        setCustom({ ...results[2].value.locations[0], fetchedAt: results[2].value.fetchedAt });
        setPointError('');
      } else setPointError('The selected location could not refresh. Showing its last successful fetch.');
    }
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const refreshTimer = setInterval(refresh, 15 * 60_000);
    const clockTimer = setInterval(() => setNow(Date.now()), 60_000);
    return () => { clearInterval(refreshTimer); clearInterval(clockTimer); refreshController.current?.abort(); pointController.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (!playing) return;
    // Wait for each satellite image to load so playback never outruns the imagery.
    if (layer === 'satellite' && imageStatus === 'loading') return;
    const timer = setTimeout(() => {
      if (layer === 'forecast') setHourOffset(offset => (offset + 1) % 24);
      else setFrameIndex(index => (index + 1) % (satellite?.frames?.length || 1));
    }, layer === 'satellite' ? 1100 : 1500);
    return () => clearTimeout(timer);
  }, [playing, layer, hourOffset, frameIndex, imageStatus, satellite]);

  const selectLocation = useCallback(location => {
    pointController.current?.abort();
    setPointLoading(false); setPointError(''); setQuery(''); setSelectedId(location.id);
    customRequest.current = location.id === 'selected-location' ? { lat: location.latitude, lng: location.longitude } : null;
  }, []);

  const selectPoint = useCallback(async ({ lat, lng }) => {
    pointController.current?.abort();
    const controller = new AbortController();
    pointController.current = controller;
    setPointLoading(true); setPointError(''); setQuery('');
    try {
      const result = await fetchJson(`/api/forecast?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`, controller.signal);
      if (controller.signal.aborted) return;
      setCustom({ ...result.locations[0], fetchedAt: result.fetchedAt });
      customRequest.current = { lat: result.locations[0].latitude, lng: result.locations[0].longitude };
      setSelectedId(result.locations[0].id);
    } catch (error) { if (!controller.signal.aborted) setPointError(error.message); }
    finally { if (!controller.signal.aborted) setPointLoading(false); }
  }, []);

  const useLocation = () => {
    if (!navigator.geolocation) return setPointError('This browser does not support location access. Select a town instead.');
    setPointError('');
    navigator.geolocation.getCurrentPosition(position => selectPoint({ lat: position.coords.latitude, lng: position.coords.longitude }), () => setPointError('Location access is unavailable. Select a town or a point in Uganda.'), { timeout: 10000, maximumAge: 300000 });
  };

  const locations = data?.locations || towns;
  const selected = selectedId === custom?.id ? custom : locations.find(location => location.id === selectedId) || locations[0];
  const selectedHour = futureHours(selected, now)[hourOffset];
  const satelliteAge = satellite ? Math.max(0, Math.floor((now - Date.parse(satellite.latest)) / 60000)) : null;
  const frame = satellite?.frames?.[frameIndex];
  const results = query.trim() ? locations.filter(location => location.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
  const goPage = page => { setPage(page); setPlaying(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const switchLayer = next => { setLayer(next); setPlaying(false); };

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><button className="brand" onClick={() => goPage('map')} aria-label="Rain Atlas Uganda home"><RainIcon size={42}/><span><strong>Rain Atlas</strong><small>Uganda</small></span></button>
      <nav aria-label="Main navigation">{[['map','Rain map'],['research','Data & method'],['about','About']].map(([id,label]) => <button key={id} onClick={() => goPage(id)} aria-current={page === id ? 'page' : undefined}>{label}</button>)}</nav>
      <button className="refresh-button" onClick={refresh} disabled={loading}><span className={loading ? 'spinning' : ''} aria-hidden="true">↻</span> {loading ? 'Refreshing' : 'Refresh'}</button>
    </header>
    <main id="main">
      {page === 'map' ? <>
        <div className="page-intro"><div><h1>A clearer view of the rain.</h1><p>Explore rainfall forecasts and satellite cloud cover across Uganda.</p></div><div className={`update-status ${error ? 'warning' : ''}`} role="status"><span className="status-dot"/><div><strong>{loading ? 'Fetching latest data' : error ? 'Forecast connection issue' : 'Forecast retrieved'}</strong><span>{data ? `${timeLabel(data.fetchedAt, { day: 'numeric', month: 'short' })} EAT` : 'Connecting to the source'}</span></div></div></div>
        {error && <div className="error-banner" role="alert">{error} {data ? 'Showing the last successful fetch, timestamped above.' : 'Forecast values will appear when the provider responds.'}<button onClick={refresh}>Try again</button></div>}
        {pointError && <div className="error-banner" role="alert">{pointError}<button onClick={() => setPointError('')}>Dismiss</button></div>}
        <div className="dashboard">
          <section className="map-panel" aria-label="Uganda rain explorer"><div className="map-view">
            <RainMap locations={locations} selected={selected} onSelect={selectLocation} onPoint={selectPoint} now={now} hourOffset={hourOffset} layer={layer} satellite={satellite} frameIndex={frameIndex} onImageStatus={setImageStatus}/>
            <div className="map-toolbar"><div className="search-wrap"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search a town in Uganda" placeholder="Search a town in Uganda" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && results[0]) selectLocation(results[0]); if (event.key === 'Escape') setQuery(''); }}/></label>{query && <div className="search-results">{results.length ? results.map(location => <button key={location.id} onClick={() => selectLocation(location)}>{location.name}<small>{location.region}</small></button>) : <p>No matching town. Select a point on the map.</p>}</div>}</div>
              <div className="layer-switch" aria-label="Map layer"><button aria-pressed={layer === 'forecast'} onClick={() => switchLayer('forecast')}>Rain forecast</button><button aria-pressed={layer === 'satellite'} onClick={() => switchLayer('satellite')}>Satellite clouds</button></div></div>
            <button className="location-button" onClick={useLocation} title="Use my location" aria-label="Use my location">⌖</button>
            {pointLoading && <div className="map-message" role="status">Fetching this location’s forecast…</div>}
            {layer === 'satellite' && <div className={`satellite-status ${satelliteError || satelliteAge > 90 || imageStatus === 'error' ? 'warning' : ''}`} role="status">{satelliteError || (imageStatus === 'error' ? 'This image could not load. Try another time or refresh.' : !satellite ? 'Connecting to Meteosat…' : imageStatus === 'loading' ? 'Loading satellite image…' : `Latest capture ${satelliteAge} min ago${satelliteAge > 90 ? ' · delayed feed' : ' · 10-minute cadence'}`)}</div>}
          </div>
          <div className="timeline"><button className="play-button" aria-label={playing ? 'Pause animation' : 'Play animation'} onClick={() => setPlaying(!playing)} disabled={layer === 'satellite' ? !satellite?.frames?.length : !data}>{playing ? 'Ⅱ' : '▶'}</button><div className="timeline-track"><div className="timeline-heading"><strong>{layer === 'forecast' ? 'Hourly forecast' : 'Clouds · past 110 minutes'}</strong><span>{layer === 'forecast' ? selectedHour ? `${timeLabel(selectedHour.intervalStart)}–${timeLabel(selectedHour.time)} EAT` : 'Waiting for data' : frame ? `${timeLabel(frame.time)} EAT` : 'Waiting for imagery'}</span></div><input type="range" aria-label={layer === 'forecast' ? 'Forecast hour' : 'Satellite capture time'} min="0" max={layer === 'forecast' ? 23 : Math.max(0, (satellite?.frames.length || 1) - 1)} value={layer === 'forecast' ? hourOffset : frameIndex} onChange={event => { setPlaying(false); layer === 'forecast' ? setHourOffset(Number(event.target.value)) : setFrameIndex(Number(event.target.value)); }}/><div className="timeline-labels">{layer === 'forecast' ? <><span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+23h</span></> : <><span>{satellite?.frames[0] ? timeLabel(satellite.frames[0].time) : 'Earlier'}</span><span>All times EAT</span><span>Latest capture</span></>}</div></div></div></section>
          <ForecastPanel location={selected} now={now} hourOffset={hourOffset} setHourOffset={setHourOffset} onMethod={() => goPage('research')} loading={loading || pointLoading}/>
        </div>
        <section className="explore-towns" aria-label="Explore Uganda"><span className="section-label">Explore Uganda</span>{['kampala','gulu','mbale','mbarara','arua','moroto'].map(id => { const town = locations.find(location => location.id === id); return town && <button key={id} aria-pressed={selectedId === id} onClick={() => selectLocation(town)}>{town.name}</button>; })}<select aria-label="All towns" value={towns.some(t => t.id === selectedId) ? selectedId : ''} onChange={event => selectLocation(locations.find(location => location.id === event.target.value))}><option value="" disabled>More towns</option>{locations.filter(t => t.id !== 'selected-location').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></section>
        <div className="map-help"><p>Click anywhere within Uganda for a local forecast. Each dot represents a forecast point, not the surrounding area.</p>{selectedId === custom?.id && <span>Location retrieved {timeLabel(custom.fetchedAt)} EAT</span>}</div>
      </> : <Research page={page} selected={selected} now={now} onMap={() => goPage('map')}/>}
      <footer><div><a href="https://open-meteo.com/">Forecast · Open-Meteo</a><span className="footer-divider">|</span><a href="https://view.eumetsat.int/">Satellite · EUMETSAT</a><span className="footer-divider">|</span><span>East Africa Time · UTC+3</span></div><p>{layer === 'satellite' && satellite ? satellite.attribution : 'Forecasts express uncertainty. Cloud images show clouds, not rain at the ground.'}</p></footer>
    </main>
  </>;
}
