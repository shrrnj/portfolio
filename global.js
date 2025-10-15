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

/* ----------------- Dark mode switcher (Step 4) ----------------- */

/* Inject the control at the very top of <body> */
document.body.insertAdjacentHTML(
    'afterbegin',
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
  
  /* Position it top-right & make it subtle via CSS-in-JS fallback (keeps all in one place).
     If you prefer, move these rules into style.css. */
  const style = document.createElement('style');
  style.textContent = `
    .color-scheme{
      position: absolute; top: 1rem; right: 1rem;
      font-size: 80%; color: var(--muted, canvastext);
    }
    /* ensure <select> inherits site font per Lab 2 */
    .color-scheme select { font: inherit; }
  `;
  document.head.append(style);
  
  /* Wire it up + persistence */
  const select = document.getElementById('color-scheme');
  const ROOT = document.documentElement;
  const STORAGE_KEY = 'colorScheme';
  
  /* Load saved preference (else default to Automatic) */
  const saved = localStorage.getItem(STORAGE_KEY) || 'light dark';
  select.value = saved;
  ROOT.style.setProperty('color-scheme', saved);
  
  /* Update on change and persist */
  select.addEventListener('input', (e) => {
    const scheme = e.target.value;              // 'light dark' | 'light' | 'dark'
    ROOT.style.setProperty('color-scheme', scheme);
    localStorage.setItem(STORAGE_KEY, scheme);
    console.log('color scheme changed to', scheme);
  });


  // ----- Step 5: Better contact form (optional) -----
const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  // Collect submitted values
  const data = new FormData(form);

  // Build query string with proper URL encoding
  const params = new URLSearchParams();

  // Only include fields that are relevant to mailto (subject/body)
  // (If you added more fields, include them here by name.)
  const subject = data.get('subject') ?? '';
  const body    = (data.get('body') ?? '').replace(/\r?\n/g, '\n'); // normalize newlines

  params.set('subject', subject);
  params.set('body', body);

  // Final mailto URL
  const url = `${form.action}?${params.toString()}`;

  // Open mail client
  location.href = url;
});