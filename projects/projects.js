import { fetchJSON, renderProjects, fromRoot } from '../global.js';

const projects = await fetchJSON(fromRoot('/lib/projects.json'));
const projectsContainer = document.querySelector('.projects');

// Render the projects
renderProjects(projects, projectsContainer, 'h2');

// Count projects and update title
const titleEl = document.querySelector('.projects-title');
if (titleEl) {
  titleEl.textContent = projects.length;
}