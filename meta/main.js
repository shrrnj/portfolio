// /meta/main.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let xScale, yScale;

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
    length: +row.length,
  };
}

async function loadData() {
  // loc.csv must live next to this file in /meta/
  const rows = await d3.csv("./loc.csv", rowConvert);

  // Group rows by commit → 1 object per commit with derived fields
  const grouped = d3.groups(rows, d => d.commit);
  const commits = grouped.map(([id, lines]) => {
    const first = lines[0];
    const dt = first.datetime;
    const totalLines = d3.sum(lines, l => l.length);
    const hourFrac = dt.getHours() + dt.getMinutes() / 60;

    const ret = {
      id,
      url: `https://github.com/YOUR_ORG/YOUR_REPO/commit/${id}`, // optional
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: dt,
      hourFrac,
      totalLines,
      depth: d3.max(lines, d => d.depth),
    };
    Object.defineProperty(ret, "lines", {
      value: lines, enumerable: false, writable: false, configurable: true
    });
    return ret;
  });

  // Expose for console checks
  window.commits = commits;
  return { rows, commits };
}

/* -------------------- Summary stats -------------------- */
function renderStats(rows, commits) {
  const root = d3.select("#stats").html("");
  const dl = root.append("dl").attr("class", "stats");

  const totalLOC = d3.sum(rows, d => d.length);
  const files = new Set(rows.map(d => d.file));
  const maxDepth = d3.max(rows, d => d.depth);
  const longestLine = d3.max(rows, d => d.length);

  const byPeriod = d3.rollup(
    commits,
    v => v.length,
    d => d.datetime.toLocaleString("en", { dayPeriod: "short" }) // "in the evening"
  );
  const top = [...byPeriod.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "";
  const prettyPeriod = top.replace(/^in the\s+/i, "").trim();

  [
    ["Total LOC", totalLOC],
    ["Total commits", commits.length],
    ["Files", files.size],
    ["Max depth", maxDepth],
    ["Longest line", longestLine],
    ["Most work (time of day)", prettyPeriod],
  ].forEach(([k, v]) => {
    dl.append("dt").text(k);
    dl.append("dd").text(v);
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
  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([margin.left, width - margin.right])
    .nice();

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 28]); // area ∝ value

  // Gridlines (horizontal)
  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-(width - margin.left - margin.right)));

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(8);
  const yAxis = d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, "0") + ":00");

  svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(xAxis);
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(yAxis);

  // Sort big → small so small dots stay hoverable
  const data = d3.sort(commits, d => -d.totalLines);

  const dots = svg.append("g").attr("class", "dots")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("fill-opacity", 0.7)
    .style("transition", "200ms transform, 200ms fill-opacity")
    .style("transform-origin", "center")
    .style("transform-box", "fill-box");

  /* ---------- Tooltip (uses the existing <dl id="commit-tooltip">) ---------- */
  const tooltip = document.getElementById("commit-tooltip");
  const commitLink = document.getElementById("commit-link");
  const commitDate = document.getElementById("commit-date");

  function showTooltip(d, event) {
    commitLink.href = d.url;
    commitLink.textContent = d.id;
    commitDate.textContent = d.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" });
    tooltip.hidden = false;
    moveTooltip(event);
  }
  function moveTooltip(event) {
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top  = `${event.clientY + 10}px`;
  }
  function hideTooltip() { tooltip.hidden = true; }

  dots
    .on("mouseenter", (event, d) => {
      d3.select(event.currentTarget).attr("fill-opacity", 1).style("transform", "scale(1.05)");
      showTooltip(d, event);
    })
    .on("mousemove", (event) => moveTooltip(event))
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).attr("fill-opacity", 0.7).style("transform", "scale(1)");
      hideTooltip();
    });

  /* ---------- Brush (make sure overlay doesn't block hover) ---------- */
  const brush = d3.brush()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on("brush end", brushed);

  svg.call(brush);

  // Move dots (and anything after overlay) ABOVE the overlay so hover works
  svg.selectAll(".dots, .overlay ~ *").raise();

  function isSelected(selection, d) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(d.datetime);
    const y = yScale(d.hourFrac);
    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selected = selection ? data.filter(d => isSelected(selection, d)) : [];
    const el = document.getElementById("selection-count");
    el.textContent = selected.length ? `${selected.length} commits selected` : "No commits selected";
    return selected;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection ? data.filter(d => isSelected(selection, d)) : [];
    const container = document.getElementById("language-breakdown");
    container.innerHTML = "";
    if (!selected.length) return;

    const lines = selected.flatMap(d => d.lines);
    const breakdown = d3.rollup(lines, v => v.length, d => d.type);
    const total = lines.length;

    for (const [language, count] of breakdown) {
      const pct = d3.format(".1%")(count / total);
      container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${pct})</dd>`;
    }
  }

  function brushed(event) {
    const sel = event.selection;
    dots.classed("selected", d => isSelected(sel, d));
    renderSelectionCount(sel);
    renderLanguageBreakdown(sel);
  }
}

/* -------------------- Boot -------------------- */
const { rows, commits } = await loadData();
renderStats(rows, commits);
renderScatter(commits);