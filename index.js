import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// 1. Fetch all projects
const projects = await fetchJSON('./lib/projects.json');

// 2. Keep only the first 3
const latestProjects = projects.slice(0, 3);

// 3. Select the container on the homepage
const projectsContainer = document.querySelector('.projects');

// 4. Render them
renderProjects(latestProjects, projectsContainer, 'h2');

// --- GitHub Stats ---
// Replace 'shrrnj' with your GitHub username
const githubData = await fetchGitHubData('shrrnj');
console.log(githubData); // optional, check in console

// 5. Select the stats container
const profileStats = document.querySelector('#profile-stats');

// 6. Render GitHub stats if the container exists
if (profileStats && githubData) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers:</dt><dd>${githubData.followers}</dd>
      <dt>Following:</dt><dd>${githubData.following}</dd>
    </dl>
  `;
}