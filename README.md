# Bikewatching — DSC 106 Lab 7

A separate static GitHub Pages project using Mapbox GL JS v2.15.0 and D3 v7.9.0, as specified in Lab 7.

## Before you run it

1. Get your **public** Mapbox token from https://account.mapbox.com/access-tokens/ (it starts with `pk.`).
2. Replace `YOUR_MAPBOX_PUBLIC_ACCESS_TOKEN` near the top of `map.js` with your own token.
3. Open the **bikewatching** folder in VS Code and use the Live Server extension on `index.html`.
4. The site downloads the Lab 7 March 2024 traffic CSV (~21 MB) and Bluebikes station JSON on initial load; internet access is required. The bike-lane layers are also retrieved from municipal open-data sources.
5. This is a new repository, not a folder within your existing `portfolio` repository.

## Files

- `index.html` — header, slider, SVG map container, legend, source credits.
- `global.css` — general typography and page layout (Lab 7 Step 0.4).
- `map.css` — layout, chart appearance, traffic colors, legends, and responsive styling.
- `map.js` — Mapbox map, official bike-lane layers, Bluebikes stations/trips, D3 overlay, interactions.
- `assets/favicon.svg` — SVG bike favicon.

## Lab checklist

- Step 0: new repo + GitHub Pages, heading, global CSS, favicon.
- Step 1: Mapbox ESM import, HTML map container, Boston-centered Mapbox map.
- Step 2: Boston and Cambridge GeoJSON bike lanes drawn with `map.addSource()` and `map.addLayer()`.
- Step 3: `d3.json()` station data, SVG overlay, `map.project()` markers updated on map pan/zoom/resize.
- Step 4: `d3.csv()` traffic, `d3.rollup()` traffic counts, `d3.scaleSqrt()` circle areas, SVG `<title>` tooltips.
- Step 5: range slider -1..1440, formatted time, arrivals/departures bucketed by minute, filtered marker sizes.
- Step 6: `d3.scaleQuantize()` with 3 values (0, 0.5, 1), corresponding CSS colors and legend.
- Step 7: add a new project to the original portfolio's `lib/projects.json`, and link existing project URLs in `global.js`.

## Notes

- Mapbox public tokens are visible in a client application by design. Never paste a secret `sk.` token into these files. You may restrict your public token's allowed URLs to your GitHub Pages site and localhost after local testing.
- The Boston GeoJSON source is the one specified by the lab. The Cambridge GeoJSON source is the Cambridge Open Data portal's Bike Facilities (dataset `9aey-9g9p`). If a government endpoint changes or blocks cross-origin requests, replace its URL with a current GeoJSON download from the same official dataset.
- In Step 5.4, this implementation uses minute buckets for performance and wraps across midnight. Zero-traffic stations have zero circle area to avoid implying activity where none occurred.
- Color is a 3-category discretization of departures / total traffic; size is proportional to the square root of the trip count, so *area* is proportional to trips.
- The two remote Bluebikes datasets are **not included** in the repository zip; they are loaded from the official lab copies at runtime.
- The app must be tested in a browser after the token is supplied. Compilation checks alone cannot verify Mapbox network requests.
