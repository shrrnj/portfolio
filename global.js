console.log("IT’S ALIVE!");

// Helper from earlier labs
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/* ---------- Automatic navigation ---------- */

// Detect base path: local dev vs GitHub Pages (/portfolio/)
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"                          // local
    : "/portfolio/";               // your repo name on GitHub Pages

// Pages to show in the menu
const PAGES = [
  { url: "index.html",          title: "Home"     },
  { url: "projects/",           title: "Projects" },
  { url: "contact/",            title: "Contact"  },
  { url: "resume/",             title: "Resume"   },
  { url: "https://github.com/shrrnj/portfolio", title: "GitHub", external: true },
];

// Where to insert the nav (top of main.container if present, else <body>)
const mount = document.querySelector("main.container") || document.body;
const nav = document.createElement("nav");
mount.prepend(nav);

// Utility: treat /folder/ and /folder/index.html as the same
const norm = (p) => p.replace(/\/index\.html?$/i, "/");

// Build the links
for (const { url, title, external } of PAGES) {
  // Prefix internal links with BASE_PATH; leave absolute URLs as-is
  const href = url.startsWith("http") ? url : BASE_PATH + url;

  const a = document.createElement("a");
  a.href = href;
  a.textContent = title;

  // External links open in a new tab
  if (external) {
    a.target = "_blank";
    a.rel = "noopener";
  }

  // Highlight current page (only for internal links)
  const aURL = new URL(a.href, location.origin);
  if (!external && aURL.host === location.host &&
      norm(aURL.pathname) === norm(location.pathname)) {
    a.classList.add("current");
  }

  nav.append(a);
}

/* ----------------- Dark mode switcher ----------------- */

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

// quick styles for the switcher (optional to move to CSS)
const style = document.createElement("style");
style.textContent = `
  .color-scheme{
    position: absolute; top: 1rem; right: 1rem;
    font-size: 80%; color: var(--muted, canvastext);
  }
  .color-scheme select { font: inherit; }
`;
document.head.append(style);

// Wire it up + persistence
const select = document.getElementById("color-scheme");
const ROOT = document.documentElement;
const STORAGE_KEY = "colorScheme";

const saved = localStorage.getItem(STORAGE_KEY) || "light dark";
select.value = saved;
ROOT.style.setProperty("color-scheme", saved);

select.addEventListener("input", (e) => {
  const scheme = e.target.value;              // 'light dark' | 'light' | 'dark'
  ROOT.style.setProperty("color-scheme", scheme);
  localStorage.setItem(STORAGE_KEY, scheme);
  console.log("color scheme changed to", scheme);
});

/* ----------------- Better contact form (optional) ----------------- */

const form = document.querySelector('form[action^="mailto:"]');
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const params = new URLSearchParams();

  const subject = data.get("subject") ?? "";
  const body    = (data.get("body") ?? "").replace(/\r?\n/g, "\n");

  params.set("subject", subject);
  params.set("body", body);

  const url = `${form.action}?${params.toString()}`;
  location.href = url;
});

/* ----------------- Helpers exported to other modules ----------------- */

// Build a URL from the site root that works locally & on GH Pages
export const fromRoot = (p) => {
  const base = BASE_PATH.endsWith("/") ? BASE_PATH.slice(0, -1) : BASE_PATH;
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
};

// JSON fetch helper
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    console.log("Response object:", response);
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error fetching or parsing JSON data:", err);
  }
}

/* ----------------- Lab 4: renderProjects (overlap-proof) ----------------- */

export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!Array.isArray(projects)) {
    console.error("renderProjects expected an array, got:", projects);
    return;
  }
  if (!containerElement) {
    console.error("renderProjects: containerElement not found");
    return;
  }

  containerElement.innerHTML = "";

  for (const project of projects) {
    const article = document.createElement("article");

    const title = project.title ?? "Untitled project";
    const year = project.year ?? "—";
    const image = project.image ?? "https://via.placeholder.com/800x450?text=No+Image";
    const description = project.description ?? "No description available.";

    // NOTE: .thumb wrapper guarantees a fixed box for the image
    article.innerHTML = `
      <${headingLevel}>${title}</${headingLevel}>
      <p class="meta">Year: ${year}</p>
      <div class="thumb">
        <img src="${image}" alt="${title}">
      </div>
      <p class="desc">${description}</p>
    `;

    containerElement.appendChild(article);
  }
}

/* ----------------- Lab 4: GitHub API helper ----------------- */

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}