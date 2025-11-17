console.clear();
console.log("Lab 7 — bike lanes with data-driven filters + fallback");

// ───────────────────────────────── Mapbox init
mapboxgl.accessToken =
  "pk.eyJ1Ijoic2hycm5qIiwiYSI6ImNtaHZqOXdkOTBiNjkyam9sZmtvN280czAifQ.bJJBb2dNCVa0MoH3imCdQw";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-71.0589, 42.3601],
  zoom: 11
});

map.addControl(
  new mapboxgl.NavigationControl({ visualizePitch: true }),
  "top-right"
);
map.addControl(new mapboxgl.FullscreenControl(), "top-right");

// ───────────────────────── D3 SVG overlay (for Step 3.3)

// Select the SVG inside #map (we created it in index.html)
const svg = d3.select("#map").select("svg");

/**
 * Helper to convert station lon/lat into pixel coords using map.project().
 * Expects each station to have `lon` and `lat` properties (as in the lab).
 */
function getCoords(station) {
  const point = map.project(
    new mapboxgl.LngLat(+station.lon, +station.lat)
  );
  return { cx: point.x, cy: point.y };
}

// ───────────────────────────────── Data (LOCAL files)
const BOSTON_URL = "data/boston_bike_lanes.geojson";
const CAMBRIDGE_URL = "data/cambridge_bike_lanes.geojson";

// ───────────────────────────────── Facility label expression
const FAC_EXPR = [
  "upcase",
  [
    "coalesce",
    ["get", "FACILITY"],
    ["get", "FACILITYTY"],
    ["get", "FACILITY_T"],
    ["get", "FacilityTy"],
    ["get", "FacilityType"], // Cambridge / Boston local files
    ["get", "TYPE"],
    ["get", "FAC_TYPE"],
    ["get", "FACILITYTYPE"],
    ["get", "FACILITY DESC"],
    ["get", "FACILITY_DESC"],
    ["get", "NETWORKTYPE"],
    "UNKNOWN"
  ]
];

const toUI = (s) =>
  s
    .toLowerCase()
    .replace(/\b[\w']/g, (c) => c.toUpperCase());

// ───────────────────────────────── Dynamic state
let CATEGORIES = []; // [{ ui, key, color }]
let LABELS_UPPER = []; // ["SEPARATED / PROTECTED LANE", ...]
let ACTIVE = new Set(); // active upper-case keys
let SHOW_ALL_FALLBACK = false; // true if we can’t detect labels

// Thickness by zoom
const widthExpr = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  1.2,
  12,
  2,
  14,
  3,
  16,
  5
];

// Build a "match" color expression from categories
const colorExprFromCategories = (facExpr, cats) => {
  const expr = ["match", facExpr];
  cats.forEach((c) => {
    expr.push(c.key, c.color);
  });
  expr.push("#bdbdbd"); // default color
  return expr;
};

// Line opacity depending on ACTIVE
const baseOpacityExpr = () => {
  if (SHOW_ALL_FALLBACK) return 0.95; // always show if we can’t filter
  if (ACTIVE.size === 0) return 0.0;
  if (ACTIVE.size === LABELS_UPPER.length) return 0.95;

  // Only show features whose facility is in ACTIVE
  return [
    "case",
    ["match", FAC_EXPR, Array.from(ACTIVE), true, false],
    0.95,
    0.0
  ];
};

// Hover opacity
const hoverOpacityExpr = () => [
  "case",
  [
    "all",
    ["boolean", ["feature-state", "hover"], false],
    SHOW_ALL_FALLBACK ? true : ["==", baseOpacityExpr(), 0.95]
  ],
  0.9,
  0.0
];

// ───────────────────────────────── Map load
map.on("load", async () => {
  console.log("Map loaded ✅");

  // Sources (use local files, but still promote OBJECTID as the feature id)
  map.addSource("boston_route", {
    type: "geojson",
    data: BOSTON_URL,
    promoteId: "OBJECTID"
  });

  map.addSource("cambridge_route", {
    type: "geojson",
    data: CAMBRIDGE_URL,
    promoteId: "OBJECTID"
  });

  // Fetch both files (same URLs) to inspect properties for labels
  let boston, cambridge;
  try {
    [boston, cambridge] = await Promise.all([
      fetch(BOSTON_URL).then((r) => r.json()),
      fetch(CAMBRIDGE_URL).then((r) => r.json())
    ]);
  } catch (e) {
    console.warn("Fetch failed; enabling show-all fallback.", e);
    SHOW_ALL_FALLBACK = true;
  }

  if (!SHOW_ALL_FALLBACK) {
    const grab = (f) => {
      const p = f.properties || {};
      return (
        p.FACILITY ??
        p.FACILITYTY ??
        p.FACILITY_T ??
        p.FacilityTy ??
        p.FacilityType ??
        p.TYPE ??
        p.FAC_TYPE ??
        p.FACILITYTYPE ??
        p["FACILITY DESC"] ??
        p.FACILITY_DESC ??
        p.NETWORKTYPE ??
        ""
      )
        .toString()
        .trim()
        .toUpperCase();
    };

    const uniq = new Set();
    (boston?.features || []).forEach((f) => {
      const v = grab(f);
      if (v) uniq.add(v);
    });
    (cambridge?.features || []).forEach((f) => {
      const v = grab(f);
      if (v) uniq.add(v);
    });

    LABELS_UPPER = Array.from(uniq).sort();
    if (LABELS_UPPER.length === 0) {
      console.warn("No facility labels found; enabling show-all fallback.");
      SHOW_ALL_FALLBACK = true;
    }
  }

  // ── Categories + palette
  const palette = [
    "#1f78b4",
    "#33a02c",
    "#ff7f00",
    "#6a3d9a",
    "#e31a1c",
    "#a6cee3",
    "#b2df8a",
    "#fdbf6f",
    "#cab2d6",
    "#fb9a99"
  ];

  CATEGORIES = (SHOW_ALL_FALLBACK ? ["ALL"] : LABELS_UPPER).map((L, i) => ({
    ui: SHOW_ALL_FALLBACK ? "All Facilities" : toUI(L),
    key: SHOW_ALL_FALLBACK ? "ALL" : L,
    color: palette[i % palette.length]
  }));

  ACTIVE = new Set(SHOW_ALL_FALLBACK ? ["ALL"] : LABELS_UPPER);

  // ── Layers (Boston + Cambridge)
  const colorExpr = SHOW_ALL_FALLBACK
    ? CATEGORIES[0]?.color ?? "#3b82f6"
    : colorExprFromCategories(FAC_EXPR, CATEGORIES);

  // Boston base
  map.addLayer({
    id: "boston-bike-lanes",
    type: "line",
    source: "boston_route",
    paint: {
      "line-color": colorExpr,
      "line-width": widthExpr,
      "line-opacity": baseOpacityExpr()
    }
  });

  // Cambridge base
  map.addLayer({
    id: "cambridge-bike-lanes",
    type: "line",
    source: "cambridge_route",
    paint: {
      "line-color": "#00aaff",
      "line-width": widthExpr,
      "line-opacity": baseOpacityExpr()
    }
  });

  // Hover overlays
  map.addLayer({
    id: "boston-bike-lanes-hover",
    type: "line",
    source: "boston_route",
    paint: {
      "line-color": "#111",
      "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 6, 0],
      "line-opacity": hoverOpacityExpr()
    }
  });

  map.addLayer({
    id: "cambridge-bike-lanes-hover",
    type: "line",
    source: "cambridge_route",
    paint: {
      "line-color": "#111",
      "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 6, 0],
      "line-opacity": hoverOpacityExpr()
    }
  });

  // ───────────────────────── Hover + popup binding
  function bind(layerId, sourceId, idFields = ["OBJECTID", "OBJECTID_1", "FID", "id"]) {
    let hoveredId = null;

    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("mousemove", layerId, (e) => {
      if (!e.features?.length) return;
      const f = e.features[0];
      const id =
        f.id ??
        idFields.map((k) => f.properties?.[k]).find((v) => v != null);
      if (id == null) return;

      if (hoveredId !== null && hoveredId !== id) {
        map.setFeatureState(
          { source: sourceId, id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = id;
      map.setFeatureState(
        { source: sourceId, id: hoveredId },
        { hover: true }
      );
    });

    map.on("mouseleave", layerId, () => {
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: sourceId, id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = null;
    });

    // Popup
    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
    map.on("click", layerId, (e) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties || {};
      const name =
        p.STREET_NAM || p.STREETNAME || p.STREET || p.NAME || "Unnamed segment";
      const facility =
        p.FACILITY ||
        p.FACILITYTY ||
        p.FACILITY_T ||
        p.FacilityTy ||
        p.FacilityType ||
        p.TYPE ||
        p["FACILITY DESC"] ||
        p.FACILITY_DESC ||
        p.NETWORKTYPE ||
        "—";
      const len = p.LENGTH_FT || p.LENGTH || p.Shape__Length || null;

      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
             <div style="font-weight:600;margin-bottom:4px;">${name}</div>
             <div><strong>Facility:</strong> ${facility}</div>
             <div><strong>Length:</strong> ${
               len ? Number(len).toLocaleString() + " ft" : "—"
             }</div>
           </div>`
        )
        .addTo(map);
    });
  }

  bind("boston-bike-lanes", "boston_route", ["OBJECTID"]);
  bind("cambridge-bike-lanes", "cambridge_route", [
    "OBJECTID",
    "OBJECTID_1",
    "FID",
    "id"
  ]);

  // ───────────────────────── Legend
  class LegendControl {
    onAdd() {
      const el = document.createElement("div");
      el.className = "mapboxgl-ctrl legend";
      el.innerHTML = `
        <h4>Bike Facility Type</h4>
        ${CATEGORIES.map(
          (c) =>
            `<div class="row">
               <span class="swatch" style="background:${c.color}"></span>
               <span>${c.ui}</span>
             </div>`
        ).join("")}
      `;
      this._el = el;
      return el;
    }
    onRemove() {
      this._el.remove();
    }
  }
  map.addControl(new LegendControl(), "bottom-left");

  // ───────────────────────── Filters UI
  if (!SHOW_ALL_FALLBACK) {
    class FiltersControl {
      onAdd() {
        const el = document.createElement("div");
        el.className = "mapboxgl-ctrl filters";
        el.innerHTML = `
          <h4>Filter Facilities</h4>
          <div class="list">
            ${CATEGORIES.map(
              (c) =>
                `<label class="row">
                   <input type="checkbox" value="${c.key}" checked />
                   <span>${c.ui}</span>
                 </label>`
            ).join("")}
          </div>
          <div class="actions">
            <button type="button" data-a="all">Select all</button>
            <button type="button" data-a="none">Clear all</button>
          </div>
        `;

        const apply = () => {
          const base = baseOpacityExpr();
          const hov = hoverOpacityExpr();
          ["boston-bike-lanes", "cambridge-bike-lanes"].forEach((id) =>
            map.setPaintProperty(id, "line-opacity", base)
          );
          ["boston-bike-lanes-hover", "cambridge-bike-lanes-hover"].forEach(
            (id) => map.setPaintProperty(id, "line-opacity", hov)
          );
        };

        // checkbox changes
        el.addEventListener("change", (e) => {
          if (!e.target?.matches('input[type="checkbox"]')) return;
          const key = e.target.value.toUpperCase();
          if (e.target.checked) ACTIVE.add(key);
          else ACTIVE.delete(key);
          apply();
        });

        // Select all / Clear all
        el.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          if (b.dataset.a === "all") {
            ACTIVE = new Set(LABELS_UPPER);
            el
              .querySelectorAll('input[type="checkbox"]')
              .forEach((cb) => (cb.checked = true));
          } else {
            ACTIVE = new Set();
            el
              .querySelectorAll('input[type="checkbox"]')
              .forEach((cb) => (cb.checked = false));
          }
          apply();
        });

        // Ensure the initial state uses the expression as well
        apply();

        this._el = el;
        return el;
      }
      onRemove() {
        this._el.remove();
      }
    }

    map.addControl(new FiltersControl(), "top-left");
  } else {
    console.warn("Filters hidden (fallback mode).");
  }

  console.log("Facility labels (UPPER):", LABELS_UPPER, {
    SHOW_ALL_FALLBACK
  });

  // ───────────────────────── Step 3.3 — Station markers (D3 circles)

  let stations = [];
  try {
    // adjust filename if your lab uses a different path
    stations = await d3.json("data/stations.json");
  } catch (e) {
    console.error("Failed to load station data for markers:", e);
    return;
  }

  // Append circles for each station
  const circles = svg
    .selectAll("circle")
    .data(stations)
    .enter()
    .append("circle")
    .attr("r", 5)            // radius
    .attr("fill", "steelblue")
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .attr("opacity", 0.8);

  // Function to update circle positions when map moves/zooms
  function updatePositions() {
    circles
      .attr("cx", (d) => getCoords(d).cx)
      .attr("cy", (d) => getCoords(d).cy);
  }

  // Initial positioning + keep in sync with map interactions
  updatePositions();
  map.on("move", updatePositions);
  map.on("zoom", updatePositions);
  map.on("resize", updatePositions);
  map.on("moveend", updatePositions);
});