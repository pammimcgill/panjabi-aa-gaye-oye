const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const CITY_COORDINATES = Object.freeze({
  seattle: [47.6062, -122.3321],
  bellevue: [47.6101, -122.2015],
  redmond: [47.6740, -122.1215],
  'federal way': [47.3223, -122.3126],
  everett: [47.9790, -122.2021],
  tacoma: [47.2529, -122.4443],
  kent: [47.3809, -122.2348],
  auburn: [47.3073, -122.2285],
  renton: [47.4829, -122.2171],
  kirkland: [47.6769, -122.2060],
  bothell: [47.7623, -122.2054],
  lynnwood: [47.8209, -122.3151],
  shoreline: [47.7557, -122.3415],
  burien: [47.4704, -122.3468],
  seatac: [47.4502, -122.3088],
  tukwila: [47.474, -122.261],
  puyallup: [47.1854, -122.2929],
  'gig harbor': [47.3293, -122.5801],
  bellingham: [48.7519, -122.4787],
  marysville: [48.0518, -122.1771],
  'mount vernon': [48.4212, -122.3341],
  olympia: [47.0379, -122.9007],
  vancouver: [49.2827, -123.1207],
  surrey: [49.1913, -122.849],
  burnaby: [49.2488, -122.9805],
  richmond: [49.1666, -123.1336],
  coquitlam: [49.2838, -122.7932],
  delta: [49.0847, -123.0586],
  langley: [49.1044, -122.6604],
  abbotsford: [49.0504, -122.3045],
  'new westminster': [49.2057, -122.911],
  'north vancouver': [49.32, -123.0724],
  'west vancouver': [49.328, -123.1593],
  'white rock': [49.0253, -122.8029],
  'port coquitlam': [49.2625, -122.7811],
  'port moody': [49.2846, -122.7932]
});

const REGION_FALLBACKS = Object.freeze({
  seattle: { label: 'Greater Seattle', coordinates: [47.6062, -122.3321] },
  vancouver: { label: 'Metro Vancouver', coordinates: [49.2827, -123.1207] }
});

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b(city of|wa|washington|bc|b\.c\.|british columbia)\b/g, ' ')
  .replace(/[^a-z]+/g, ' ')
  .trim();

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const eventPath = (value) => {
  const path = String(value || '');
  return /^\/events\/[a-z0-9][a-z0-9-]*$/i.test(path) ? path : '/';
};

const formatDate = (value) => {
  if (!value) return 'Date to be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(date);
};

export function mapLocationForEvent(event = {}) {
  const normalizedCity = normalize(event.city);
  const matchedCity = Object.keys(CITY_COORDINATES).find((city) => normalizedCity === city || normalizedCity.startsWith(`${city} `));
  if (matchedCity) {
    const [lat, lng] = CITY_COORDINATES[matchedCity];
    return { key: matchedCity, label: String(event.city || matchedCity), lat, lng, approximate: false };
  }

  const region = normalize(event.region).includes('vancouver') ? 'vancouver' : 'seattle';
  const fallback = REGION_FALLBACKS[region];
  const [lat, lng] = fallback.coordinates;
  return {
    key: `region-${region}`,
    label: String(event.city || fallback.label),
    lat,
    lng,
    approximate: true
  };
}

export function groupEventsForMap(events = []) {
  const groups = new Map();
  for (const event of events) {
    const location = mapLocationForEvent(event);
    const group = groups.get(location.key) || { ...location, events: [] };
    group.events.push(event);
    groups.set(location.key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    events: group.events.sort((a, b) => String(a.startsAt || '').localeCompare(String(b.startsAt || '')))
  }));
}

let leafletPromise;
function loadLeaflet() {
  if (globalThis.L?.map) return Promise.resolve(globalThis.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.L), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.crossOrigin = '';
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => reject(new Error('The map library could not be loaded.'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function popupHtml(group) {
  const visible = group.events.slice(0, 8);
  const more = group.events.length - visible.length;
  return `<div class="event-map-popup"><strong>${esc(group.label)}</strong>${group.approximate ? '<small>Approximate regional location</small>' : ''}<ul>${visible.map((event) => `<li><a href="${eventPath(event.pageUrl)}">${esc(event.title || 'Event')}</a><span>${esc(formatDate(event.startsAt))}</span></li>`).join('')}</ul>${more > 0 ? `<small>+ ${more} more event${more === 1 ? '' : 's'} in this area</small>` : ''}</div>`;
}

export function createEventMapController({ container, status, toggle } = {}) {
  if (!container) return null;
  let map;
  let layer;
  let revision = 0;

  if (toggle) {
    toggle.addEventListener('click', () => {
      const hidden = container.hidden;
      container.hidden = !hidden;
      toggle.textContent = hidden ? 'Hide map' : 'Show map';
      toggle.setAttribute('aria-expanded', String(hidden));
      if (hidden && map) window.setTimeout(() => map.invalidateSize(), 0);
    });
  }

  return {
    async update(events = []) {
      const currentRevision = ++revision;
      const groups = groupEventsForMap(events);
      if (status) status.textContent = groups.length
        ? `Loading ${events.length} event${events.length === 1 ? '' : 's'} in ${groups.length} area${groups.length === 1 ? '' : 's'}…`
        : 'No events match these filters on the map.';

      if (!groups.length) {
        if (layer) layer.clearLayers();
        return;
      }

      try {
        const L = await loadLeaflet();
        if (currentRevision !== revision || !L) return;
        if (!map) {
          map = L.map(container, { scrollWheelZoom: false, worldCopyJump: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          }).addTo(map);
          layer = L.layerGroup().addTo(map);
        }
        layer.clearLayers();
        const bounds = [];
        for (const group of groups) {
          const count = group.events.length;
          const icon = L.divIcon({
            className: 'event-map-marker-wrap',
            html: `<span class="event-map-marker" aria-hidden="true">${count}</span>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
            popupAnchor: [0, -20]
          });
          L.marker([group.lat, group.lng], { icon, title: `${count} events in ${group.label}` })
            .bindPopup(popupHtml(group), { maxWidth: 310 })
            .addTo(layer);
          bounds.push([group.lat, group.lng]);
        }
        if (bounds.length === 1) map.setView(bounds[0], 10);
        else map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 });
        window.setTimeout(() => map.invalidateSize(), 0);
        if (status) status.textContent = `${events.length} event${events.length === 1 ? '' : 's'} across ${groups.length} mapped area${groups.length === 1 ? '' : 's'}. Select a marker for event links.`;
      } catch {
        if (status) status.textContent = 'The interactive map is temporarily unavailable. All events remain available in the list below.';
      }
    }
  };
}
