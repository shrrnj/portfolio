import { fetchJSON, renderProjects } from './global.js';

// 1. Fetch all projects
const projects = await fetchJSON('./lib/projects.json');

// 2. Keep only the first 3
const latestProjects = projects.slice(0, 3);

// 3. Select the container on the homepage
const projectsContainer = document.querySelector('.projects');

// 4. Render them
renderProjects(latestProjects, projectsContainer, 'h2');