console.log("IT’S ALIVE!");

// Helper
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/* ---------- Smart base path (local vs GitHub Pages) ---------- */
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/";

/* ---------- Auto navigation ---------- */
const PAGES = [
  { url: "index.html", title: "Home" },
  { url: "projects/",  title: "Projects" },
  { url: "contact/",   title: "Contact" },
  { url: "resume/",    title: "Resume" },
  { url: "https://github.com/shrrnj/portfolio", title: "GitHub", external: true },
];

const mount = document.querySelector("main.container") || document.body;
const nav   = document.createElement("nav");
mount.prepend(nav);

const norm = (p) => p.replace(/\/index\.html?$/i, "/");

for (const { url, title, external } of PAGES) {
  const href = url.startsWith("http") ? url : BASE_PATH + url;
  const a = document.createElement("a");
  a.href = href;
  a.textContent = title;
  if (external) { a.target = "_blank"; a.rel = "noopener"; }
  const aURL = new URL(a.href, location.origin);
  if (!external && aURL.host === location.host &&
      norm(aURL.pathname) === norm(location.pathname)) {
    a.classList.add("current");
  }
  nav.append(a);
}

/* ---------- Theme switcher ---------- */
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="color-scheme">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

const style = document.createElement("style");
style.textContent = `
  .color-scheme{
    position:absolute; top:1rem; right:1rem;
    font-size:80%; color: var(--muted, canvastext);
  }
  .color-scheme select { font: inherit; }
`;
document.head.append(style);

const select = document.getElementById("color-scheme");
const ROOT = document.documentElement;
const STORAGE_KEY = "colorScheme";
const saved = localStorage.getItem(STORAGE_KEY) || "light dark";
select.value = saved;
ROOT.style.setProperty("color-scheme", saved);

select.addEventListener("input", (e) => {
  const scheme = e.target.value;
  ROOT.style.setProperty("color-scheme", scheme);
  localStorage.setItem(STORAGE_KEY, scheme);
});

/* ---------- Mailto form helper (optional) ---------- */
const form = document.querySelector('form[action^="mailto:"]');
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const params = new URLSearchParams();
  params.set("subject", data.get("subject") ?? "");
  params.set("body", (data.get("body") ?? "").replace(/\r?\n/g, "\n"));
  location.href = `${form.action}?${params.toString()}`;
});

/* ---------- Helpers exported to other modules ---------- */
export const fromRoot = (p) => {
  const base = BASE_PATH.endsWith("/") ? BASE_PATH.slice(0, -1) : BASE_PATH;
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
};

export async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    console.log("Response object:", res);
    return await res.json();
  } catch (err) {
    console.error("fetchJSON error:", err);
    return null;
  }
}

/* ---------- Project renderer (title → year → image → description) ---------- */
export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!Array.isArray(projects) || !containerElement) return;

  containerElement.innerHTML = "";

  for (const project of projects) {
    const article = document.createElement("article");

    const title = project.title ?? "Untitled project";
    const year = project.year ?? "—";
    const image = project.image ?? "https://via.placeholder.com/800x450?text=Preview";
    const description = project.description ?? "No description available.";

    article.innerHTML = `
      <${headingLevel}>${title}</${headingLevel}>
      <p class="meta">Year: ${year}</p>
      <img src="${image}" alt="${title}">
      <p class="desc">${description}</p>
    `;

    containerElement.appendChild(article);
  }
}

/* ---------- GitHub stats helper ---------- */
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}