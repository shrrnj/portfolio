import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// ---------- LOAD & PREPARE DATA ----------

async function loadData() {
  const raw = await d3.csv("loc.csv", d3.autoType);

  // Group by commit id + datetime so we can aggregate line counts
  const commits = d3
    .groups(raw, (d) => d.commit)
    .map(([id, rows]) => {
      const first = rows[0];
      const datetime = new Date(first.datetime);
      return {
        id,
        author: first.author,
        datetime,
        // total lines in this commit
        totalLines: d3.sum(rows, (r) => r.length),
        // number of files touched
        files: d3.rollups(
          rows,
          (v) => d3.sum(v, (r) => r.length),
          (r) => r.file
        ),
      };
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));

  return commits;
}

// ---------- STATS HELPERS ----------

function computeSummary(commits) {
  if (!commits.length) {
    return {
      commits: 0,
      files: 0,
      totalLoc: 0,
      maxDepth: 0,
      longestLine: 0,
      maxLines: 0,
    };
  }

  const allFiles = d3.rollups(
    commits.flatMap((d) =>
      d.files.map(([file, lines]) => ({ file, lines, depth: file.split("/").length }))
    ),
    (v) => ({
      lines: d3.sum(v, (r) => r.lines),
      maxDepth: d3.max(v, (r) => r.depth),
      maxLine: d3.max(v, (r) => r.lines),
    }),
    (d) => d.file
  );

  const totalLoc = d3.sum(allFiles, ([, v]) => v.lines);
  const maxDepth = d3.max(allFiles, ([, v]) => v.maxDepth) ?? 0;
  const longestLine = d3.max(allFiles, ([, v]) => v.maxLine) ?? 0;
  const maxLines = longestLine;

  return {
    commits: commits.length,
    files: allFiles.length,
    totalLoc,
    maxDepth,
    longestLine,
    maxLines,
  };
}

function formatDateTime(d) {
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- DOM UPDATERS ----------

function updateSummary(summary) {
  d3.select("#stat-commits").text(summary.commits);
  d3.select("#stat-files").text(summary.files);
  d3.select("#stat-loc").text(summary.totalLoc);
  d3.select("#stat-depth").text(summary.maxDepth);
  d3.select("#stat-longest-line").text(summary.longestLine);
  d3.select("#stat-max-lines").text(summary.maxLines);
}

function updateDateLabel(d) {
  d3.select("#date-label").text(formatDateTime(d));
}

// ---------- SCATTERPLOT ----------

function initScatter(commits) {
  const svg = d3.select("#scatter-plot svg");
  svg.selectAll("*").remove();

  const margin = { top: 20, right: 20, bottom: 32, left: 30 };
  const width = svg.node().clientWidth - margin.left - margin.right;
  const height = svg.node().clientHeight - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, width])
    .nice();

  const y = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height, 0])
    .nice();

  const r = d3
    .scaleSqrt()
    .domain([0, d3.max(commits, (d) => d.totalLines) || 1])
    .range([4, 40]);

  const xAxis = d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%a %d"));
  const yAxis = d3.axisLeft(y).ticks(8).tickFormat((d) => `${d.toString().padStart(2, "0")}:00`);

  g.append("g")
    .attr("class", "scatter-axis scatter-x")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

  g.append("g").attr("class", "scatter-axis scatter-y").call(yAxis);

  const dotsGroup = g.append("g").attr("class", "scatter-dots");

  function draw(filtered) {
    const circles = dotsGroup.selectAll("circle").data(filtered, (d) => d.id);

    circles
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "scatter-dot")
            .attr("cx", (d) => x(d.datetime))
            .attr("cy", (d) => y(d.datetime.getHours() + d.datetime.getMinutes() / 60))
            .attr("r", 0)
            .call((enter) =>
              enter
                .transition()
                .duration(400)
                .attr("r", (d) => r(d.totalLines))
            ),
        (update) =>
          update.call((u) =>
            u
              .transition()
              .duration(300)
              .attr("cx", (d) => x(d.datetime))
              .attr("cy", (d) => y(d.datetime.getHours() + d.datetime.getMinutes() / 60))
              .attr("r", (d) => r(d.totalLines))
          ),
        (exit) =>
          exit.call((e) => e.transition().duration(250).attr("r", 0).remove())
      );
  }

  return { draw, x };
}

// ---------- STORY BUILDING (SCROLLY) ----------

function buildStory(commits) {
  const story = d3.select("#scatter-story");
  story.selectAll("*").remove();

  // One step per commit, like the lab example
  const steps = story
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class", "step");

  steps
    .append("div")
    .attr("class", "step-date")
    .text((d) => formatDateTime(d.datetime));

  steps
    .append("div")
    .attr("class", "step-text-main")
    .html(
      (d, i) =>
        `On this commit, ${d.author} edited <strong>${d3.sum(
          d.files,
          ([, lines]) => lines
        )}</strong> lines across <strong>${d.files.length}</strong> files.`
    );

  steps
    .append("div")
    .attr("class", "step-text-meta")
    .text(
      (d) =>
        `The biggest file in this commit changed by ${d3.max(
          d.files,
          ([, lines]) => lines
        )} lines.`
    );
}

// ---------- SCROLLAMA SETUP ----------

function initScroller(commits, drawScatter, setFromScroller) {
  const scroller = scrollama();

  function onStepEnter(response) {
    const d = response.element.__data__;

    // All commits up to and including this one
    const currentIdx = commits.indexOf(d);
    const visible = commits.slice(0, currentIdx + 1);

    const summary = computeSummary(visible);
    updateSummary(summary);
    updateDateLabel(d.datetime);
    drawScatter(visible);

    // Keep slider thumb in sync
    setFromScroller(currentIdx);
  }

  scroller
    .setup({
      container: "#scrolly-1",
      step: "#scrolly-1 .step",
      offset: 0.6,
    })
    .onStepEnter(onStepEnter);

  window.addEventListener("resize", () => scroller.resize());
}

// ---------- MAIN INIT ----------

async function init() {
  const commits = await loadData();
  if (!commits.length) return;

  const slider = d3.select("#date-slider").node();
  slider.min = 0;
  slider.max = commits.length - 1;
  slider.value = commits.length - 1;

  const { draw: drawScatter } = initScatter(commits);
  buildStory(commits);

  // Initial view: all commits
  const initialSummary = computeSummary(commits);
  updateSummary(initialSummary);
  updateDateLabel(commits[commits.length - 1].datetime);
  drawScatter(commits);

  // Slider handler
  slider.addEventListener("input", () => {
    const idx = +slider.value;
    const visible = commits.slice(0, idx + 1);
    const summary = computeSummary(visible);
    updateSummary(summary);
    updateDateLabel(commits[idx].datetime);
    drawScatter(visible);
  });

  // Scrollama
  initScroller(commits, drawScatter, (idxFromScroller) => {
    slider.value = idxFromScroller;
  });
}

init();