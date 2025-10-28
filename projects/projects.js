import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects, fromRoot } from "../global.js";

/* ---------------- Load data ---------------- */
const allProjects = await fetchJSON(fromRoot("/lib/projects.json"));

/* DOM refs */
const svg            = d3.select("#projects-plot");
const legendUL       = d3.select(".legend");
const projectsEl     = document.querySelector(".projects-list");
const titleCountEl   = document.querySelector(".projects-title");
const searchInputEl  = document.querySelector(".searchBar");

/* Page title count */
if (titleCountEl) titleCountEl.textContent = allProjects.length;

/* ---------------- Reactive state ---------------- */
let query = "";                 // search text (lowercased)
let selectedYear = null;        // null = nothing selected

/* Scales & geometry */
const color = d3.scaleOrdinal(d3.schemeTableau10);
const arc   = d3.arc().innerRadius(0).outerRadius(50);
const pie   = d3.pie().value(d => d[1]); // d = [year, count]

/* ---------------- Helpers ---------------- */

/** Projects visible after applying both search & (optional) selectedYear */
function getVisibleProjects() {
  // 1) search across all metadata (case-insensitive)
  let filtered = allProjects.filter(p =>
    Object.values(p).join("\n").toLowerCase().includes(query)
  );
  // 2) if a year is selected, filter to that year too
  if (selectedYear !== null) {
    filtered = filtered.filter(p => String(p.year) === String(selectedYear));
  }
  return filtered;
}

/** Year -> count rollups for a given project list */
function rollupByYear(projects) {
  return d3.rollups(
    projects,
    v => v.length,
    d => d.year
  ).sort((a, b) => d3.ascending(a[0], b[0])); // [[year, count], ...]
}

/** Render (or re-render) the pie + legend based on the given project list */
function renderPieAndLegend(projects) {
  const yearCounts = rollupByYear(projects);
  const arcs = pie(yearCounts); // pie over [year,count]

  // --- PIE ---
  const paths = svg.selectAll("path").data(arcs, d => d.data[0]); // key = year
  paths.exit().remove();

  paths
    .enter().append("path")
      .merge(paths)
      .attr("d", arc)
      .style("--color", (d, i) => color(i))
      .style("fill", "var(--color)")
      .attr("class", d => (String(d.data[0]) === String(selectedYear) ? "selected" : null))
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const year = String(d.data[0]);
        selectedYear = (selectedYear === year) ? null : year;  // toggle
        renderEverything();
      });

  // --- LEGEND ---
  const items = legendUL.selectAll("li").data(yearCounts, d => d[0]);
  items.exit().remove();

  const itemsEnter = items.enter()
    .append("li")
    .style("--color", (d, i) => color(i))
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      const year = String(d[0]);
      selectedYear = (selectedYear === year) ? null : year;    // toggle
      renderEverything();
    });

  itemsEnter.html(d => `
    <span class="swatch"></span>
    <span class="label">${d[0]} <em>(${d[1]})</em></span>
  `);

  itemsEnter.merge(items)
    .attr("class", d => (String(d[0]) === String(selectedYear) ? "selected" : null));
}

/** Render the project cards */
function renderCards(projects) {
  renderProjects(projects, projectsEl, "h2");
}

/** Single function that recomputes and renders *everything* reactively */
function renderEverything() {
  const visible = getVisibleProjects();
  renderCards(visible);           // cards reflect search + selection
  renderPieAndLegend(visible);    // pie/legend reflect *current visible set*
}

/* ---------------- Search wiring (Step 4) ---------------- */
searchInputEl?.addEventListener("input", (e) => {
  query = (e.target.value || "").toLowerCase().trim();
  renderEverything();
});

/* ---------------- Initial paint ---------------- */
renderEverything();