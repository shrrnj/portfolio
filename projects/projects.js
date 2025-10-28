import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects, fromRoot } from "../global.js";

/* ---------------- Load data ---------------- */
const allProjects = await fetchJSON(fromRoot("/lib/projects.json"));

/* DOM refs */
const svg = d3.select("#projects-plot");
const legendUL = d3.select(".legend");
const projectsContainer = document.querySelector(".projects-list");
const titleEl = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");

/* Page title count */
if (titleEl) titleEl.textContent = allProjects.length;

/* State */
let query = "";             // current text query (lowercased)
let selectedIndex = -1;     // -1 = nothing selected in the pie
let rolledData = [];        // [[year, count], ...] for the *currently plotted* set
let colorScale = d3.scaleOrdinal(d3.schemeTableau10);

/* Geometry */
const arcGen = d3.arc().innerRadius(0).outerRadius(50);
const pie = d3.pie().value(d => d[1]);  // use counts

/* ---------- Helpers ---------- */

/** Return projects filtered by search + (if any) selected year */
function getVisibleProjects() {
  // 1) search across all project values
  let filtered = allProjects.filter(p =>
    Object.values(p).join("\n").toLowerCase().includes(query)
  );

  // 2) filter by selected year if active
  if (selectedIndex !== -1 && rolledData[selectedIndex]) {
    const year = String(rolledData[selectedIndex][0]);
    filtered = filtered.filter(p => String(p.year) === year);
  }
  return filtered;
}

/** Recompute rollups (year -> count) for the given dataset */
function computeRollups(projects) {
  return d3.rollups(
    projects,
    v => v.length,
    d => d.year
  ).sort((a, b) => d3.ascending(a[0], b[0]));
}

/** Render (or re-render) the pie + legend from the given projects */
function renderPieChart(projects) {
  // 1) roll up fresh data for this view
  rolledData = computeRollups(projects);

  // 2) build arcs from rollups
  const arcs = pie(rolledData); // pie expects array of [label,value]

  // 3) JOIN paths
  const paths = svg
    .selectAll("path")
    .data(arcs, d => d.data[0]); // key by year

  paths.exit().remove();

  paths
    .enter()
    .append("path")
    .merge(paths)
    .attr("d", arcGen)
    .style("--color", (d, i) => colorScale(i))
    .style("fill", "var(--color)")
    .attr("class", (d, i) => (i === selectedIndex ? "selected" : null))
    .on("click", (_, i) => {
      // toggle selection
      selectedIndex = (selectedIndex === i) ? -1 : i;
      // when selection changes, re-render *cards* and keep pie/legend in sync
      renderEverything();
    });

  // 4) Legend
  const li = legendUL.selectAll("li")
    .data(rolledData, d => d[0]);

  li.exit().remove();

  const liEnter = li.enter()
    .append("li")
    .style("--color", (d, i) => colorScale(i))
    .style("cursor", "pointer")
    .on("click", (_, i) => {
      selectedIndex = (selectedIndex === i) ? -1 : i;
      renderEverything();
    });

  // swatch + label "(count)"
  liEnter.html(d => `
    <span class="swatch"></span>
    <span class="label">${d[0]} <em>(${d[1]})</em></span>
  `);

  liEnter.merge(li)
    .attr("class", (_, i) => (i === selectedIndex ? "selected" : null));
}

/** Render cards for current visible projects */
function renderCards(projects) {
  renderProjects(projects, projectsContainer, "h2");
}

/** One place to recompute + render everything reactively */
function renderEverything() {
  const visible = getVisibleProjects();    // apply query + selection
  renderCards(visible);                     // update cards
  renderPieChart(visible);                  // pie/legend reflect *visible* data
}

/* ---------- Search wiring (Step 4) ---------- */
searchInput?.addEventListener("input", (e) => {
  query = (e.target.value || "").toLowerCase().trim();
  renderEverything();
});

/* ---------- Initial paint ---------- */
renderEverything();