import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects, fromRoot } from "../global.js";

/* ---------------- Load + render project cards ---------------- */
const projects = await fetchJSON(fromRoot("/lib/projects.json"));
const listEl = document.querySelector(".projects-list");
renderProjects(projects, listEl, "h2");

// title count
const titleEl = document.querySelector(".projects-title");
if (titleEl) titleEl.textContent = projects.length;

/* ---------------- Pie chart + legend (Lab 5 Step 1 & 2) ---------------- */

// 1) SVG and generators
const svg = d3.select("#projects-plot");
const arcGen = d3.arc().innerRadius(0).outerRadius(50);

// Use objects with labels (Step 2.1)
const data = [
  { value: 5, label: "apples" },
  { value: 3, label: "oranges" },
  { value: 8, label: "mangos" },
  { value: 6, label: "pears" },
  { value: 7, label: "limes" },
  { value: 2, label: "cherries" }
];

// Pie with value accessor
const pie = d3.pie()
  .value(d => d.value)
  .sort(null);

// Color scale
const color = d3.scaleOrdinal(d3.schemeTableau10);

// 2) Draw slices
const slices = pie(data);

svg.selectAll("path")
  .data(slices)
  .join("path")
  .attr("d", arcGen)
  .attr("fill", (d, i) => color(i))
  .select(function() { return this; }) // keep path selection
  .append("title")
  .text(d => `${d.data.label}: ${d.data.value}`);

// 3) Build legend under the chart
const legend = d3.select(".legend"); // <ul class="legend"> must exist in HTML

legend.selectAll("li")
  .data(data)
  .join("li")
  .style("--color", (_, i) => color(i))
  .html(d => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);