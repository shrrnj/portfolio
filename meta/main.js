import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let xScale, yScale, rScale, brushData;

let commitProgress = 100;
let timeScale, commitMaxTime;
let allCommits = [];
let filteredCommits = [];

/* -------------------- Load & transform CSV -------------------- */

function rowConvert(row) {
  return {
    file: row.file,
    line: +row.line,
    type: row.type,
    commit: row.commit,
    author: row.author,
    date: row.date,
    time: row.time,
    timezone: row.timezone,
    datetime: new Date(row.datetime),
    depth: +row.depth,
    length: +row.length
  };
}

async function loadData() {
  const rows = await d3.csv("./loc.csv", rowConvert);

  // Grouping by commit id -> one object per commit
  const grouped = d3.groups(rows, (d) => d.commit);

  const commits = grouped.map(([id, lines]) => {
    const first = lines[0];
    const dt = first.datetime;
    const totalLines = d3.sum(lines, (l) => l.length);
    const hourFrac = dt.getHours() + dt.getMinutes() / 60;

    const commit = {
      id,
      url: `https://github.com/YOUR_ORG/YOUR_REPO/commit/${id}`, 
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: dt,
      hourFrac,
      totalLines,
      depth: d3.max(lines, (d) => d.depth)
    };

    Object.defineProperty(commit, "lines", {
      value: lines,
      enumerable: false,
      writable: false,
      configurable: true
    });

    return commit;
  });

  window.commits = commits;

  return commits;
}


function renderStats(commits) {
  const root = d3.select("#stats").html("");

  const dl = root.append("dl").attr("class", "stats stats-inline");

  if (!commits || !commits.length) {
    const stats = [
      ["COMMITS", 0],
      ["FILES", 0],
      ["TOTAL LOC", 0],
      ["MAX DEPTH", 0],
      ["LONGEST LINE", 0],
      ["MAX LINES", 0]
    ];
    stats.forEach(([label, value]) => {
      dl.append("dt").text(label);
      dl.append("dd").text(value);
    });
    return;
  }

  const allLines = commits.flatMap((c) => c.lines);

  const totalLOC = d3.sum(allLines, (d) => d.length);
  const files = new Set(allLines.map((d) => d.file));
  const maxDepth = d3.max(allLines, (d) => d.depth);
  const longestLine = d3.max(allLines, (d) => d.length);
  const maxLines = d3.max(commits, (d) => d.totalLines);

  const stats = [
    ["COMMITS", commits.length],
    ["FILES", files.size],
    ["TOTAL LOC", totalLOC],
    ["MAX DEPTH", maxDepth],
    ["LONGEST LINE", longestLine],
    ["MAX LINES", maxLines]
  ];

  stats.forEach(([label, value]) => {
    dl.append("dt").text(label);
    dl.append("dd").text(value);
  });
}

/* -------------------- Chart + tooltip + brush -------------------- */

function renderScatter(commits) {
  const container = d3.select("#chart").html("");

  const width = 1000;
  const height = 600;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`);

  // Scales
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([margin.left, width - margin.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 28]);

  // Gridlines
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat("")
        .tickSize(-(width - margin.left - margin.right))
    );

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(8);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .attr("class", "x-axis")
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .attr("class", "y-axis")
    .call(yAxis);

  brushData = d3.sort(commits, (d) => -d.totalLines);

  const dots = svg
    .append("g")
    .attr("class", "dots")
    .selectAll("circle")
    .data(brushData)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("fill-opacity", 0.7)
    .style("transition", "200ms transform, 200ms fill-opacity")
    .style("transform-origin", "center")
    .style("transform-box", "fill-box");

  /* ---------- Tooltip ---------- */
  const tooltip = document.getElementById("commit-tooltip");
  const commitLink = document.getElementById("commit-link");
  const commitDate = document.getElementById("commit-date");

  function showTooltip(d, event) {
    commitLink.href = d.url;
    commitLink.textContent = d.id;
    commitDate.textContent = d.datetime.toLocaleString("en", {
      dateStyle: "full",
      timeStyle: "short"
    });
    tooltip.hidden = false;
    moveTooltip(event);
  }
  function moveTooltip(event) {
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  }
  function hideTooltip() {
    tooltip.hidden = true;
  }

  dots
    .on("mouseenter", (event, d) => {
      d3
        .select(event.currentTarget)
        .attr("fill-opacity", 1)
        .style("transform", "scale(1.05)");
      showTooltip(d, event);
    })
    .on("mousemove", (event) => moveTooltip(event))
    .on("mouseleave", (event) => {
      d3
        .select(event.currentTarget)
        .attr("fill-opacity", 0.7)
        .style("transform", "scale(1)");
      hideTooltip();
    });

  /* ---------- Brush ---------- */
  const brush = d3
    .brush()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom]
    ])
    .on("brush end", brushed);

  svg.call(brush);
  svg.selectAll(".dots, .overlay ~ *").raise();

  function isSelected(selection, d) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(d.datetime);
    const y = yScale(d.hourFrac);
    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selected = selection ? brushData.filter((d) => isSelected(selection, d)) : [];
    const el = document.getElementById("selection-count");
    el.textContent = selected.length
      ? `${selected.length} commits selected`
      : "No commits selected";
    return selected;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection ? brushData.filter((d) => isSelected(selection, d)) : [];
    const container = document.getElementById("language-breakdown");
    container.innerHTML = "";
    if (!selected.length) return;

    const lines = selected.flatMap((d) => d.lines);
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type
    );
    const total = lines.length;

    for (const [language, count] of breakdown) {
      const pct = d3.format(".1%")(count / total);
      container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${pct})</dd>`;
    }
  }

  function brushed(event) {
    const sel = event.selection;
    dots.classed("selected", (d) => isSelected(sel, d));
    renderSelectionCount(sel);
    renderLanguageBreakdown(sel);
  }
}

/* --------- Update scatter plot when slider filters commits --------- */

function updateScatterPlot(commits) {
  const svg = d3.select("#chart").select("svg");
  if (svg.empty()) return;

  if (!commits || !commits.length) {
    svg.select("g.dots").selectAll("circle").remove();
    document.getElementById("selection-count").textContent = "No commits selected";
    document.getElementById("language-breakdown").innerHTML = "";
    return;
  }

  const width = 1000;
  const height = 600;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };

  xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale.domain([minLines, maxLines]);

  const xAxis = d3.axisBottom(xScale).ticks(8);
  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.call(xAxis);

  brushData = d3.sort(commits, (d) => -d.totalLines);
  const dotsGroup = svg.select("g.dots");

  const tooltip = document.getElementById("commit-tooltip");
  const commitLink = document.getElementById("commit-link");
  const commitDate = document.getElementById("commit-date");

  function showTooltip(d, event) {
    commitLink.href = d.url;
    commitLink.textContent = d.id;
    commitDate.textContent = d.datetime.toLocaleString("en", {
      dateStyle: "full",
      timeStyle: "short"
    });
    tooltip.hidden = false;
    moveTooltip(event);
  }
  function moveTooltip(event) {
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientX + 10}px`;
  }
  function hideTooltip() {
    tooltip.hidden = true;
  }

  const dots = dotsGroup.selectAll("circle").data(brushData, (d) => d.id);

  dots.exit().remove();

  dots
    .join(
      (enter) => enter.append("circle"),
      (update) => update
    )
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("fill-opacity", 0.7)
    .style("transition", "200ms transform, 200ms fill-opacity")
    .style("transform-origin", "center")
    .style("transform-box", "fill-box")
    .on("mouseenter", (event, d) => {
      d3
        .select(event.currentTarget)
        .attr("fill-opacity", 1)
        .style("transform", "scale(1.05)");
      showTooltip(d, event);
    })
    .on("mousemove", (event) => moveTooltip(event))
    .on("mouseleave", (event) => {
      d3
        .select(event.currentTarget)
        .attr("fill-opacity", 0.7)
        .style("transform", "scale(1)");
      hideTooltip();
    });

  document.getElementById("selection-count").textContent = "No commits selected";
  document.getElementById("language-breakdown").innerHTML = "";
}

/* -------------------- Boot -------------------- */

const commits = await loadData();

allCommits = commits;
filteredCommits = commits;

renderStats(commits);
renderScatter(commits);

timeScale = d3
  .scaleTime()
  .domain(d3.extent(allCommits, (d) => d.datetime))
  .range([0, 100]);

commitMaxTime = timeScale.invert(commitProgress);

const sliderEl = document.querySelector("#commit-progress");
const timeEl = document.querySelector("#commit-time");

function onTimeSliderChange() {
  commitProgress = +sliderEl.value;
  commitMaxTime = timeScale.invert(commitProgress);

  timeEl.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short"
  });

  filteredCommits = allCommits.filter((d) => d.datetime <= commitMaxTime);

  renderStats(filteredCommits);       
  updateScatterPlot(filteredCommits); 
}

if (sliderEl && timeEl) {
  sliderEl.addEventListener("input", onTimeSliderChange);
  onTimeSliderChange();
}