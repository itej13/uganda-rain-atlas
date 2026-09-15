import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { futureHours, probabilityColor, timeLabel, value } from './weather.jsx';

export default function RainMap({ locations, selected, onSelect, onPoint, now, hourOffset, layer, satellite, frameIndex, onImageStatus }) {
  const element = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const pointHandler = useRef(onPoint);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  pointHandler.current = onPoint;

  useEffect(() => {
    const instance = L.map(element.current, { zoomControl: false, minZoom: 6, maxZoom: 12, scrollWheelZoom: false });
    map.current = instance;
    instance.fitBounds([[-1.48, 29.55], [4.25, 35.05]], { padding: [20, 30] });
    L.control.zoom({ position: 'topright' }).addTo(instance);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>', maxZoom: 19,
    }).addTo(instance);
    tiles.on('tileerror', () => setMapError('Basemap unavailable. Forecast points and the Uganda boundary remain usable.'));
    instance.createPane('satellite');
    instance.getPane('satellite').style.zIndex = 250;
    const controller = new AbortController();
    fetch('/uganda.geojson', { signal: controller.signal }).then(r => r.json()).then(boundary => {
      if (!controller.signal.aborted) L.geoJSON(boundary, { interactive: false, style: { color: '#346951', weight: 1.7, fillColor: '#a6c6a4', fillOpacity: 0.06 } }).addTo(instance);
    }).catch(error => { if (error.name !== 'AbortError') setMapError('Country boundary unavailable.'); });
    markers.current = L.layerGroup().addTo(instance);
    instance.on('click', event => pointHandler.current(event.latlng));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    setMapReady(true);
    return () => { controller.abort(); observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    markers.current.clearLayers();
    const points = selected && !locations.some(item => item.id === selected.id) ? [...locations, selected] : locations;
    points.forEach(location => {
      const hour = futureHours(location, now)[hourOffset];
      const active = selected?.id === location.id;
      const label = document.createElement('span');
      label.className = `town-marker ${active ? 'active' : ''}`;
      const dot = document.createElement('span');
      dot.className = 'town-dot';
      dot.style.background = layer === 'satellite' ? '#28785b' : probabilityColor(hour?.probability);
      const text = document.createElement('span');
      text.textContent = location.name;
      label.append(dot, text);
      const marker = L.marker([location.latitude, location.longitude], {
        icon: L.divIcon({ html: label, className: 'marker-container', iconSize: [100, 24], iconAnchor: [8, 12] }),
        title: `${location.name}: ${value(hour?.probability, '%')} chance of rain`, keyboard: true,
        zIndexOffset: active ? 1000 : 0,
      }).addTo(markers.current);
      marker.on('click', event => { L.DomEvent.stopPropagation(event); onSelect(location); });
    });
  }, [locations, selected, now, hourOffset, onSelect, mapReady, layer]);

  const frame = satellite?.frames?.[frameIndex];
  useEffect(() => {
    if (!mapReady || !selected) return;
    const point = [selected.latitude, selected.longitude];
    if (!map.current.getBounds().contains(point)) map.current.panTo(point, { animate: false });
  }, [selected?.id, selected?.latitude, selected?.longitude, mapReady]);

  useEffect(() => {
    if (!mapReady || layer !== 'satellite' || !frame) return;
    onImageStatus('loading');
    const overlay = L.imageOverlay(frame.url, satellite.imageBounds, { opacity: 0.85, pane: 'satellite', interactive: false });
    overlay.on('load', () => onImageStatus('ready'));
    overlay.on('error', () => onImageStatus('error'));
    overlay.addTo(map.current);
    return () => { overlay.off(); overlay.remove(); };
  }, [frame, layer, satellite, mapReady, onImageStatus]);

  return <>
    <div ref={element} className="map-canvas" aria-label="Map of Uganda. Select a town marker, or click a location for its forecast." />
    {mapError && <div className="map-notice" role="status">{mapError}</div>}
    <div className="map-legend">
      {layer === 'forecast' ? <><strong>Chance of rain</strong><div className="legend-colors"/><div className="legend-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><small>At forecast points · grey = no data</small></> : <><strong>Infrared cloud imagery</strong><div className="cloud-colors"/><div className="legend-scale"><span>Warmer</span><span>Colder cloud tops</span></div><small>Cloud temperature, not rainfall</small></>}
    </div>
    {layer === 'satellite' && frame && <div className="satellite-time">Captured {timeLabel(frame.time)} EAT</div>}
  </>;
}
