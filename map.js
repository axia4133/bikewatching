import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYXJ4aWEiLCJhIjoiY213ZTd5bm9mMDR4ZTJ6cHVybmhydXNmdiJ9.lO6X-6duAewWdoohG8secA';

const status = document.querySelector('#status');
const slider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');
const svg = d3.select('#map').select('svg');

const STATIONS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const TRIPS_URL = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
const BOSTON_LANES_URL = 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson';
const CAMBRIDGE_LANES_URL = 'https://data.cambridgema.gov/resource/9aey-9g9p.geojson?$limit=5000';

if (!mapboxgl.accessToken.startsWith('pk.')) {
  status.classList.add('error');
  status.textContent = 'Add your public Mapbox token to map.js to display the map.';
  throw new Error('Missing public Mapbox access token in map.js');
}

// Step 1.3: interactive Mapbox basemap, centered between Boston and Cambridge.
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});
map.addControl(new mapboxgl.NavigationControl(), 'top-left');

const tooltip = d3.select('#map')
  .append('div')
  .attr('class', 'station-tooltip');

function showTooltip(event, d) {
  tooltip
    .style('display', 'block')
    .text(
      `${d.name}: ${d.totalTraffic.toLocaleString()} trips ` +
      `(${d.departures.toLocaleString()} departures, ` +
      `${d.arrivals.toLocaleString()} arrivals)`
    );

  moveTooltip(event);
}

function moveTooltip(event) {
  const mapBounds = document.querySelector('#map').getBoundingClientRect();

  tooltip
    .style('left', `${event.clientX - mapBounds.left}px`)
    .style('top', `${event.clientY - mapBounds.top}px`);
}

// Step 3.3: project longitude and latitude onto the Mapbox pixel canvas.
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(minutes) {
  const date = new Date(2000, 0, 1, 0, minutes);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Step 5.4 (optional performance improvement): index arrivals and departures
// by minute once, so moving the slider does not scan ~260,000 trips every time.
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();

  // Include both endpoints of the one-hour window and wrap around midnight.
  const center = minute % 1440;
  let filtered = [];
  for (let offset = -60; offset <= 60; offset++) {
    const currentMinute = (center + offset + 1440) % 1440;
    filtered.push(...tripsByMinute[currentMinute]);
  }
  return filtered;
}

// Steps 4.2 and 5.3: aggregate trips at each station using D3 rollups.
// Separate minute buckets mean departures are counted by start time and
// arrivals by end time, which is the traffic-flow meaning of the slider.
function computeStationTraffic(stations, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    (v) => v.length,
    (d) => d.start_station_id,
  );
  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    (v) => v.length,
    (d) => d.end_station_id,
  );

  return stations.map((station) => {
    const id = station.short_name;
    const numDepartures = departures.get(id) ?? 0;
    const numArrivals = arrivals.get(id) ?? 0;
    return {
      ...station,
      departures: numDepartures,
      arrivals: numArrivals,
      totalTraffic: numDepartures + numArrivals,
    };
  });
}

// Step 6.1: three meaningful classes of departure proportion.
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
function departureRatio(station) {
  return station.totalTraffic === 0
    ? 0.5 // A station with no rides has no directional flow.
    : stationFlow(station.departures / station.totalTraffic);
}

// Step 2: add data-driven line layers after the Mapbox style loads.
function addBikeLaneLayer(sourceId, layerId, geojsonURL) {
  map.addSource(sourceId, { type: 'geojson', data: geojsonURL });
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': '#19845b',
      'line-width': 3,
      'line-opacity': 0.65,
    },
  });
}

map.on('load', async () => {
  // Steps 2.1–2.3: Boston and Cambridge bicycle facilities.
  addBikeLaneLayer('boston_route', 'boston-bike-lanes', BOSTON_LANES_URL);
  addBikeLaneLayer('cambridge_route', 'cambridge-bike-lanes', CAMBRIDGE_LANES_URL);

  try {
    // Step 3.1: read Bluebikes station JSON using the lab's fields.
    const jsonData = await d3.json(STATIONS_URL);
    const rawStations = jsonData.data.stations.filter(
      (station) => station.short_name && Number.isFinite(+station.lon) && Number.isFinite(+station.lat),
    );

    // Step 4.1: parse CSV dates while loading. These strings have local
    // wall-clock times but no timezone offset; use those hours for the slider.
    const trips = await d3.csv(TRIPS_URL, (trip) => {
      trip.started_at = new Date(trip.started_at.replace(' ', 'T'));
      trip.ended_at = new Date(trip.ended_at.replace(' ', 'T'));
      if (!Number.isFinite(trip.started_at.getTime()) ||
          !Number.isFinite(trip.ended_at.getTime())) return null;

      const departureMinute = minutesSinceMidnight(trip.started_at);
      const arrivalMinute = minutesSinceMidnight(trip.ended_at);
      departuresByMinute[departureMinute].push(trip);
      arrivalsByMinute[arrivalMinute].push(trip);
      return trip;
    });

    const stations = computeStationTraffic(rawStations);
    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic) || 1])
      .range([0, 25]);

    // Steps 3.2–3.3, 4.3, 4.4, 6.1: D3 SVG overlay of the stations.
    const circles = svg.selectAll('circle')
      .data(stations, (d) => d.short_name)
      .enter()
      .append('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .style('--departure-ratio', (d) => departureRatio(d))
      .each(function (d) {
        d3.select(this)
          .append('title')
          .text(`${d.name}: ${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      })
      .on('mouseenter', showTooltip)
      .on('mousemove', moveTooltip)
      .on('mouseleave', () => tooltip.style('display', 'none'));

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }
    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

    // Steps 5.2–5.3: recompute and rebind for every slider input change.
    function updateScatterPlot(timeFilter) {
      const filteredStations = computeStationTraffic(rawStations, timeFilter);
      timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

      const updated = svg.selectAll('circle')
        .data(filteredStations, (d) => d.short_name)
        .join('circle')
        // Zero trips must mean zero area, even with the filtered min radius.
        .attr('r', (d) => d.totalTraffic === 0 ? 0 : radiusScale(d.totalTraffic))
        .style('--departure-ratio', (d) => departureRatio(d));

      updated.select('title')
        .text((d) => `${d.name}: ${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);

      const activeStations = filteredStations.filter((d) => d.totalTraffic > 0).length;
      status.textContent = `${trips.length.toLocaleString()} March 2024 rides loaded · ${activeStations} stations with activity ${timeFilter === -1 ? 'throughout the day' : 'near the selected time'}.`;
    }

    function updateTimeDisplay() {
      const timeFilter = Number(slider.value);
      if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
      } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
      }
      updateScatterPlot(timeFilter);
    }

    slider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
    map.resize();
    updatePositions();
  } catch (error) {
    console.error('Could not load Bluebikes Lab 7 data:', error);
    status.classList.add('error');
    status.textContent = `Could not load station or trip data: ${error.message}. Check your browser console and network connection.`;
  }
});
