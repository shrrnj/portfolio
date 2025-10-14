console.log("IT’S ALIVE!");

// Helper from Step 1
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/* ---------- Step 3: Automatic navigation ---------- */

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