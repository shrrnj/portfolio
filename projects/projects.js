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

/* ---------------- Lab 5 · Step 1: Pie chart ---------------- */

// 1) Select the SVG we inserted in index.html
const svg = d3.select("#projects-plot");

// 1.1–1.3) Arc generator for slices (radius 50, centered by viewBox)
const arcGen = d3.arc().innerRadius(0).outerRadius(50);

// Use d3.pie() to compute start/end angles for slices
const pie = d3.pie();

// 1.4) Initial data (will be replaced in 1.5)
let data = [1, 2];

// Compute slices from data
let slices = pie(data);

// Initial color scale
let color = d3.scaleOrdinal(["gold", "purple"]);

// Draw first two slices
svg
  .selectAll("path")
  .data(slices)
  .join("path")
  .attr("d", arcGen)
  .attr("fill", (d, i) => color(i));

// 1.5) Add more data and scale with d3 scheme
data = [1, 2, 3, 4, 5];
slices = pie(data);
color = d3.scaleOrdinal(d3.schemeTableau10); // 10-color palette

// Redraw with updated data
svg
  .selectAll("path")
  .data(slices)
  .join("path")
  .attr("d", arcGen)
  .attr("fill", (d, i) => color(i));