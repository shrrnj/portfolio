import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects, fromRoot } from "../global.js";

/* ---------------- Load and render projects ---------------- */
const projects = await fetchJSON(fromRoot("/lib/projects.json"));
const projectsContainer = document.querySelector(".projects-list");

// Render projects into the container
renderProjects(projects, projectsContainer, "h2");

// Update the title count
const titleEl = document.querySelector(".projects-title");
if (titleEl) {
  titleEl.textContent = projects.length;
}

/* ---------------- Step 3: Real data in pie ---------------- */

// 1) Select the SVG
const svg = d3.select("#projects-plot");
const arcGen = d3.arc().innerRadius(0).outerRadius(50);
const pie = d3.pie().value(d => d.value);

// 2) Group projects by year
let rolledData = d3.rollups(
  projects,
  v => v.length, // count
  d => d.year     // group by year
).sort((a, b) => d3.ascending(a[0], b[0]));

// 3) Convert to array of {label, value}
let data = rolledData.map(([year, count]) => ({
  label: year,
  value: count
}));

// 4) Slices
let slices = pie(data);

// 5) Color scale
const colors = d3.scaleOrdinal(d3.schemeTableau10);

// Draw slices
svg
  .selectAll("path")
  .data(slices)
  .join("path")
  .attr("d", arcGen)
  .attr("fill", (d, i) => colors(i));

/* ---------------- Legend ---------------- */
const legend = d3.select(".legend").html(""); // clear old

const legendItems = legend
  .selectAll("li")
  .data(data)
  .join("li")
  .attr("style", (d, i) => `--color:${colors(i)}`);

// checkbox
legendItems
  .append("input")
  .attr("type", "checkbox")
  .attr("disabled", true);

// swatch
legendItems
  .append("span")
  .attr("class", "swatch");

// label + count
legendItems
  .append("span")
  .html(d => `${d.label} <em>(${d.value})</em>`);